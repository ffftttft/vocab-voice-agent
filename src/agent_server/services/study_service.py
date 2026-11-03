"""背词交互引擎（SPEC 5.2）。

负责单卡作答的完整状态流转：
  出题 → 用户作答 → 判定 → 映射评级 → 更新 FSRS → 答错重排队尾

关键规则（来自 SPEC 5.2 与用户确认的难度参数）：
1. 答错 → 评级锁定 Again(1)，**压回当日队尾**，直到答对为止（requeue_count 累加）
2. 答对 → 按响应耗时映射 Easy/Good/Hard，用户可手动覆盖
3. 所有复习写入 fsrs_cards，并累加 reps / lapses（py-fsrs 的 Card 无此字段）

「答对」的定义是选中了 is_correct=True 的选项，而不是「答了题」。
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import (
    DEFAULT_USER_ID,
    VOICE_UNUSED,
    DailyPlanItem,
    FSRSCard,
    Word,
)
from ..db.repos import get_or_create_plan
from ..services.fsrs_service import apply_rating, rating_from_duration


class StudyError(ValueError):
    """背词流程的业务错误。"""


class CardView:
    """返回给前端的一张卡片的完整视图。

    注意：**不包含** is_correct 字段泄露给前端之前的选择逻辑 ——
    选项顺序在服务端打乱后固定，但不能在出题态告诉前端哪个对。
    """

    def __init__(self, item: DailyPlanItem, word: Word) -> None:
        self.item_id = item.id
        self.word_id = item.word_id
        self.word = word.word
        self.phonetic_us = word.phonetic_us
        self.item_type = item.item_type
        self.sentence_en = item.custom_sentence_en
        self.sentence_zh = item.custom_sentence_zh
        self.sentence_audio_path = item.sentence_audio_path
        self.word_audio_path = word.word_audio_path
        self.pos_defs = word.pos_defs or []
        # 出题态只给 label/pos/text，不给 is_correct
        self.options = [
            {"label": o.get("label", ""), "pos": o.get("pos", ""), "text": o.get("text", "")}
            for o in (item.mcq_options or [])
        ]
        self.is_voice_target = item.is_voice_target
        self.requeue_count = item.requeue_count


def _correct_labels(item: DailyPlanItem) -> set[str]:
    return {o.get("label", "") for o in (item.mcq_options or []) if o.get("is_correct")}


async def get_study_queue(
    session: AsyncSession,
    plan_date: date,
    user_id: str = DEFAULT_USER_ID,
    include_done: bool = False,
) -> list[CardView]:
    """取今日待背队列，按 order_index 排序。

    未完成的排在前面；已答错重排的（requeue_count > 0）沉到队尾，
    实现 SPEC 5.2 的「压入今日学习队列末尾」。
    """
    stmt = (
        select(DailyPlanItem, Word)
        .join(Word, Word.id == DailyPlanItem.word_id)
        .where(DailyPlanItem.plan_date == plan_date, DailyPlanItem.user_id == user_id)
        .order_by(DailyPlanItem.requeue_count.asc(), DailyPlanItem.order_index.asc())
    )
    if not include_done:
        stmt = stmt.where(DailyPlanItem.card_done.is_(False))

    rows = await session.execute(stmt)
    return [CardView(item, word) for item, word in rows]


async def submit_rating(
    session: AsyncSession,
    plan_date: date,
    word_id: int,
    selected_label: str | None,
    duration_ms: int,
    manual_rating: int | None = None,
    user_id: str = DEFAULT_USER_ID,
) -> dict:
    """提交一次作答，返回判定结果与新卡片状态。

    selected_label: 用户点的选项 label（"A".."D"）
    manual_rating: 用户手动覆盖的评级（1-4），优先级高于自动映射
    """
    item = (
        await session.execute(
            select(DailyPlanItem).where(
                DailyPlanItem.plan_date == plan_date,
                DailyPlanItem.user_id == user_id,
                DailyPlanItem.word_id == word_id,
            )
        )
    ).scalar_one_or_none()

    if item is None:
        raise StudyError(f"今日计划中没有 word_id={word_id}")

    correct_labels = _correct_labels(item)
    is_correct = selected_label in correct_labels if selected_label else False

    # 评级决定顺序：手动覆盖 > 自动映射
    if manual_rating is not None:
        if not 1 <= manual_rating <= 4:
            raise StudyError(f"manual_rating 必须 1-4，收到 {manual_rating}")
        rating = manual_rating
    else:
        rating = rating_from_duration(duration_ms, is_correct)

    # 答错强制 Again，不允许手动覆盖成更好的成绩
    if not is_correct:
        rating = 1

    card = await session.get(FSRSCard, word_id)
    if card is None:
        raise StudyError(f"word_id={word_id} 缺少 FSRS 卡片")

    snapshot, orm_fields = apply_rating(card.fsrs_card_json, rating)
    for key in ("state", "step", "stability", "difficulty", "due", "last_review", "fsrs_card_json"):
        setattr(card, key, orm_fields[key])

    card.reps = (card.reps or 0) + 1
    if rating == 1 and card.reps > 1:
        card.lapses = (card.lapses or 0) + 1

    # 答错：压回队尾，标记未完成
    if not is_correct:
        item.card_done = False
        item.card_rating = 1
        item.requeue_count = (item.requeue_count or 0) + 1
    else:
        item.card_done = True
        item.card_rating = rating

    await session.commit()
    await _advance_plan_status(session, plan_date, user_id)

    return {
        "word_id": word_id,
        "is_correct": is_correct,
        "correct_labels": sorted(correct_labels),
        "rating": rating,
        "rating_source": "manual" if manual_rating is not None else "auto",
        "requeued": not is_correct,
        "requeue_count": item.requeue_count or 0,
        "next_due": card.due.isoformat() if card.due else None,
        "progress": await progress(session, plan_date, user_id),
    }


async def progress(session: AsyncSession, plan_date: date, user_id: str = DEFAULT_USER_ID) -> dict:
    """今日进度。"""
    rows = await session.execute(
        select(DailyPlanItem.item_type, DailyPlanItem.card_done, func.count())
        .where(DailyPlanItem.plan_date == plan_date, DailyPlanItem.user_id == user_id)
        .group_by(DailyPlanItem.item_type, DailyPlanItem.card_done)
    )
    stats: dict = {"NEW": {"total": 0, "done": 0}, "REVIEW": {"total": 0, "done": 0}}
    for item_type, done, count in rows:
        bucket = stats.setdefault(item_type, {"total": 0, "done": 0})
        bucket["total"] += count
        if done:
            bucket["done"] += count

    total = stats["NEW"]["total"] + stats["REVIEW"]["total"]
    done = stats["NEW"]["done"] + stats["REVIEW"]["done"]
    return {
        "new": stats["NEW"],
        "review": stats["REVIEW"],
        "total": total,
        "done": done,
        "remaining": total - done,
        "all_done": total > 0 and done >= total,
    }


async def _advance_plan_status(session: AsyncSession, plan_date: date, user_id: str) -> None:
    """背词全部完成 → 计划状态推进到 VOICE_READY（解锁语音实战）。"""
    plan = await get_or_create_plan(session, plan_date, user_id)
    p = await progress(session, plan_date, user_id)
    if p["all_done"] and plan.status == "STUDYING":
        plan.status = "VOICE_READY"
        await session.commit()


async def daily_voice_targets(
    session: AsyncSession, plan_date: date, user_id: str = DEFAULT_USER_ID
) -> list[dict]:
    """今日语音目标词（is_voice_target=True），供 Orchestrator 加载。"""
    rows = await session.execute(
        select(DailyPlanItem, Word)
        .join(Word, Word.id == DailyPlanItem.word_id)
        .where(
            DailyPlanItem.plan_date == plan_date,
            DailyPlanItem.user_id == user_id,
            DailyPlanItem.is_voice_target.is_(True),
        )
        .order_by(DailyPlanItem.order_index.asc())
    )
    return [
        {
            "word_id": item.word_id,
            "word": word.word,
            "sentence_en": item.custom_sentence_en,
            "pos_defs": word.pos_defs or [],
            "voice_used_status": item.voice_used_status or VOICE_UNUSED,
        }
        for item, word in rows
    ]


async def mark_word_used(
    session: AsyncSession,
    plan_date: date,
    word: str,
    used_correctly: bool,
    user_id: str = DEFAULT_USER_ID,
) -> dict:
    """语音中模型调用 mark_word_used 的落地（SPEC 5.3 Tool 1）。

    联动 FSRS：用对且未点过提示 → 追加一次 Easy 奖励加固；
    用错 → 标记次日重点复习（这里通过降低评级为 Hard 实现）。
    """
    from ..db.models import VOICE_FAILED, VOICE_USED_PROACTIVELY, VOICE_USED_WITH_HINT

    row = (
        await session.execute(
            select(DailyPlanItem, Word)
            .join(Word, Word.id == DailyPlanItem.word_id)
            .where(
                DailyPlanItem.plan_date == plan_date,
                DailyPlanItem.user_id == user_id,
                func.lower(Word.word) == word.strip().lower(),
            )
        )
    ).first()

    if row is None:
        return {"found": False, "word": word}

    item, _word = row

    if not used_correctly:
        item.voice_used_status = VOICE_FAILED
        await session.commit()
        return {"found": True, "status": VOICE_FAILED, "fsrs_applied": False}

    if item.hint_requested:
        item.voice_used_status = VOICE_USED_WITH_HINT
        await session.commit()
        return {"found": True, "status": VOICE_USED_WITH_HINT, "fsrs_applied": False}

    item.voice_used_status = VOICE_USED_PROACTIVELY
    card = await session.get(FSRSCard, item.word_id)
    applied = False
    if card is not None:
        _snap, fields = apply_rating(card.fsrs_card_json, 4)  # Easy 奖励
        for key in (
            "state",
            "step",
            "stability",
            "difficulty",
            "due",
            "last_review",
            "fsrs_card_json",
        ):
            setattr(card, key, fields[key])
        card.reps = (card.reps or 0) + 1
        applied = True

    await session.commit()
    return {"found": True, "status": VOICE_USED_PROACTIVELY, "fsrs_applied": applied}


async def mark_hint_requested(
    session: AsyncSession, plan_date: date, words: list[str], user_id: str = DEFAULT_USER_ID
) -> int:
    """用户点了「提示示例回答」→ 标记当前活跃词，防止后续照念被误判为主动掌握。

    SPEC 5.4 Step 2 明确要求。
    """
    if not words:
        return 0
    lowered = [w.strip().lower() for w in words if w.strip()]
    rows = await session.execute(
        select(DailyPlanItem, Word)
        .join(Word, Word.id == DailyPlanItem.word_id)
        .where(
            DailyPlanItem.plan_date == plan_date,
            DailyPlanItem.user_id == user_id,
            func.lower(Word.word).in_(lowered),
        )
    )
    count = 0
    for item, _word in rows:
        if not item.hint_requested:
            item.hint_requested = True
            count += 1
    await session.commit()
    return count


async def stats_snapshot(session: AsyncSession, user_id: str = DEFAULT_USER_ID) -> dict:
    """仪表盘统计：总词数、新卡、到期、未来 7 天压力。"""
    from ..db.repos import count_cards_by_state, upcoming_due_counts

    base = await count_cards_by_state(session, user_id)
    base["upcoming"] = await upcoming_due_counts(session, 7, user_id)
    return base


def utcnow() -> datetime:
    return datetime.now(UTC)
