"""数据访问层：选词查询、卡片更新、计划读写。

**这里是修复 SPEC 缺陷的关键位置。**

SPEC 5.1 Step 2 写的是 `WHERE fsrs_cards.state == 0` 来挑新词，但 py-fsrs
6.3.2 不存在 State.New / 0 这个值。若照抄 spec，新词查询永远返回空集，
每日计划里 30 个新词会恒为 0。

本模块用 `stability IS NULL` 表达「从未复习过的新卡」，语义准确且可索引
（`ix_fsrs_user_stability`）。
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    DEFAULT_USER_ID,
    DailyPlanItem,
    DailyStudyPlan,
    FSRSCard,
    Word,
    utcnow,
)


async def add_words_with_cards(
    session: AsyncSession,
    entries: list[dict],
    book_name: str,
    user_id: str = DEFAULT_USER_ID,
) -> tuple[list[Word], int]:
    """批量导入词条并为每个词初始化一张 New 卡。

    entries: [{"word": str, "phonetic_us": str|None, "pos_defs": list, "topic_tags": list}]
    返回 (新建的词列表, 跳过重复的数量)。
    """
    created: list[Word] = []
    skipped = 0

    existing = set()
    if entries:
        names = [e["word"] for e in entries]
        rows = await session.execute(
            select(Word.word).where(Word.user_id == user_id, Word.word.in_(names))
        )
        existing = {r[0] for r in rows}

    for entry in entries:
        name = entry["word"].strip()
        if not name or name in existing:
            skipped += 1
            continue
        word = Word(
            word=name,
            phonetic_us=entry.get("phonetic_us"),
            pos_defs=entry.get("pos_defs") or [],
            topic_tags=entry.get("topic_tags") or [],
            book_name=book_name,
            user_id=user_id,
        )
        session.add(word)
        created.append(word)
        existing.add(name)

    await session.flush()  # 拿到自增 id

    for word in created:
        session.add(
            FSRSCard(
                word_id=word.id,
                user_id=user_id,
                state=1,  # py-fsrs 新卡默认 Learning
                step=0,
                stability=None,  # 关键：stability IS NULL 即「新卡」
                difficulty=None,
                due=utcnow(),
                reps=0,
                lapses=0,
                fsrs_card_json=None,
            )
        )
    await session.flush()
    return created, skipped


def _due_review_query(user_id: str, now: datetime, limit: int) -> Select:
    """到期复习词：已复习过（stability 非空）且 due 已到。"""
    return (
        select(Word, FSRSCard)
        .join(FSRSCard, FSRSCard.word_id == Word.id)
        .where(
            Word.user_id == user_id,
            FSRSCard.user_id == user_id,
            FSRSCard.stability.is_not(None),
            FSRSCard.due <= now,
        )
        .order_by(FSRSCard.due.asc())
        .limit(limit)
    )


def _new_word_query(user_id: str, limit: int) -> Select:
    """新词：从未复习过。

    注意：**不是** SPEC 写的 `state == 0`（该状态在 py-fsrs 中不存在）。
    """
    return (
        select(Word, FSRSCard)
        .join(FSRSCard, FSRSCard.word_id == Word.id)
        .where(
            Word.user_id == user_id,
            FSRSCard.user_id == user_id,
            FSRSCard.stability.is_(None),
        )
        .order_by(Word.id.asc())
        .limit(limit)
    )


async def get_due_review_words(
    session: AsyncSession,
    limit: int,
    user_id: str = DEFAULT_USER_ID,
    now: datetime | None = None,
) -> list[tuple[Word, FSRSCard]]:
    moment = now or utcnow()
    rows = await session.execute(_due_review_query(user_id, moment, limit))
    return [(r[0], r[1]) for r in rows]


async def get_new_word_candidates(
    session: AsyncSession,
    limit: int,
    user_id: str = DEFAULT_USER_ID,
) -> list[tuple[Word, FSRSCard]]:
    rows = await session.execute(_new_word_query(user_id, limit))
    return [(r[0], r[1]) for r in rows]


async def get_new_word_candidates_by_topics(
    session: AsyncSession,
    topics: list[str],
    limit: int,
    user_id: str = DEFAULT_USER_ID,
) -> list[tuple[Word, FSRSCard]]:
    """按场景标签筛选新词候选（SPEC 5.1 Step 2：筛出 80 个候选）。"""
    if not topics:
        return await get_new_word_candidates(session, limit, user_id)

    rows = await session.execute(_new_word_query(user_id, limit * 20))
    matched = [(w, c) for (w, c) in rows if set(w.topic_tags or []) & set(topics)]
    return matched[:limit]


async def count_cards_by_state(session: AsyncSession, user_id: str = DEFAULT_USER_ID) -> dict:
    """统计：新卡数 / 到期数 / 各状态分布（首页仪表盘用）。"""
    new_count = await session.scalar(
        select(func.count())
        .select_from(FSRSCard)
        .where(FSRSCard.user_id == user_id, FSRSCard.stability.is_(None))
    )
    due_count = await session.scalar(
        select(func.count())
        .select_from(FSRSCard)
        .where(
            FSRSCard.user_id == user_id,
            FSRSCard.stability.is_not(None),
            FSRSCard.due <= utcnow(),
        )
    )
    learning_count = await session.scalar(
        select(func.count())
        .select_from(FSRSCard)
        .where(
            FSRSCard.user_id == user_id,
            FSRSCard.stability.is_not(None),
            FSRSCard.state == 1,
        )
    )
    review_count = await session.scalar(
        select(func.count())
        .select_from(FSRSCard)
        .where(
            FSRSCard.user_id == user_id,
            FSRSCard.stability.is_not(None),
            FSRSCard.state == 2,
        )
    )
    relearning_count = await session.scalar(
        select(func.count())
        .select_from(FSRSCard)
        .where(
            FSRSCard.user_id == user_id,
            FSRSCard.stability.is_not(None),
            FSRSCard.state == 3,
        )
    )
    total = await session.scalar(
        select(func.count()).select_from(FSRSCard).where(FSRSCard.user_id == user_id)
    )
    return {
        "new": new_count or 0,
        "due": due_count or 0,
        "learning": learning_count or 0,
        "review": review_count or 0,
        "relearning": relearning_count or 0,
        "total": total or 0,
    }


async def get_or_create_plan(
    session: AsyncSession,
    plan_date: date,
    user_id: str = DEFAULT_USER_ID,
) -> DailyStudyPlan:
    plan = await session.get(DailyStudyPlan, {"plan_date": plan_date, "user_id": user_id})
    if plan is None:
        plan = DailyStudyPlan(plan_date=plan_date, user_id=user_id)
        session.add(plan)
        await session.flush()
    return plan


async def get_plan_with_items(
    session: AsyncSession,
    plan_date: date,
    user_id: str = DEFAULT_USER_ID,
) -> DailyStudyPlan | None:
    return await session.get(DailyStudyPlan, {"plan_date": plan_date, "user_id": user_id})


async def plan_item_stats(
    session: AsyncSession,
    plan_date: date,
    user_id: str = DEFAULT_USER_ID,
) -> dict:
    rows = await session.execute(
        select(DailyPlanItem.item_type, DailyPlanItem.card_done, func.count())
        .where(DailyPlanItem.plan_date == plan_date, DailyPlanItem.user_id == user_id)
        .group_by(DailyPlanItem.item_type, DailyPlanItem.card_done)
    )
    stats = {"NEW": {"total": 0, "done": 0}, "REVIEW": {"total": 0, "done": 0}}
    for item_type, done, count in rows:
        bucket = stats.setdefault(item_type, {"total": 0, "done": 0})
        bucket["total"] += count
        if done:
            bucket["done"] += count
    stats["total"] = stats["NEW"]["total"] + stats["REVIEW"]["total"]
    stats["done"] = stats["NEW"]["done"] + stats["REVIEW"]["done"]
    return stats


async def top_topic_tags(
    session: AsyncSession,
    plan_date: date,
    limit: int,
    user_id: str = DEFAULT_USER_ID,
) -> list[str]:
    """统计今日复习词里出现最多的场景标签（SPEC 5.1 Step 2）。"""
    rows = await session.execute(
        select(Word.topic_tags)
        .join(DailyPlanItem, DailyPlanItem.word_id == Word.id)
        .where(
            DailyPlanItem.plan_date == plan_date,
            DailyPlanItem.user_id == user_id,
            DailyPlanItem.item_type == "REVIEW",
        )
    )
    counter: dict[str, int] = {}
    for (tags,) in rows:
        for tag in tags or []:
            counter[tag] = counter.get(tag, 0) + 1
    return [t for t, _ in sorted(counter.items(), key=lambda kv: -kv[1])][:limit]


async def upcoming_due_counts(
    session: AsyncSession,
    days: int = 7,
    user_id: str = DEFAULT_USER_ID,
) -> list[dict]:
    """未来 N 天的复习压力分布（首页柱状图）。"""
    now = datetime.now(UTC)
    rows = await session.execute(
        select(FSRSCard.due).where(
            FSRSCard.user_id == user_id,
            FSRSCard.stability.is_not(None),
            FSRSCard.due >= now,
        )
    )
    buckets = {i: 0 for i in range(days)}
    for (due,) in rows:
        if due is None:
            continue
        if due.tzinfo is None:
            due = due.replace(tzinfo=UTC)
        delta = (due.date() - now.date()).days
        if 0 <= delta < days:
            buckets[delta] += 1
    return [
        {"date": (now.date() + timedelta(days=i)).isoformat(), "offset": i, "count": buckets[i]}
        for i in range(days)
    ]
