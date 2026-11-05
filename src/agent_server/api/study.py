"""背词流程 REST API（SPEC 6.1）。"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..app_context import get_context
from ..harness.daily_planner import DailyPlanner
from ..services.study_service import (
    StudyError,
    get_study_queue,
    progress,
    stats_snapshot,
    submit_rating,
)
from ..services.wordbook_loader import WordbookError, import_wordbook

router = APIRouter(tags=["study"])


async def get_session(request: Request) -> AsyncSession:
    ctx = get_context(request.app)
    async with ctx.session_factory() as session:
        yield session


def _today() -> date:
    return date.today()


class ReviewCardRequest(BaseModel):
    word_id: int
    selected_label: str | None = None
    duration_ms: int = Field(default=0, ge=0)
    manual_rating: int | None = Field(default=None, ge=1, le=4)


@router.post("/wordbooks/import")
async def upload_wordbook(
    request: Request,
    file: UploadFile = File(...),
    book_name: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="上传文件为空")
    try:
        return await import_wordbook(session, content, file.filename or "upload.json", book_name)
    except WordbookError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/study/daily-plan")
async def create_daily_plan(
    request: Request,
    plan_date: date | None = None,
    regenerate: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """获取或生成今日学习计划。

    已存在且未要求重生成时直接返回，避免每次打开首页都烧一次 LLM 费用。
    """
    ctx = get_context(request.app)
    target = plan_date or _today()
    await _purge_legacy_demo_seed(session)

    from sqlalchemy import func, select

    from ..db.models import DailyPlanItem
    from ..db.repos import get_or_create_plan

    existing = await session.scalar(
        select(func.count()).select_from(DailyPlanItem).where(DailyPlanItem.plan_date == target)
    )
    if existing and not regenerate:
        plan = await get_or_create_plan(session, target)
        return {
            "plan_date": target.isoformat(),
            "cached": True,
            "scenario_title": plan.scenario_title,
            "scenario_brief": plan.scenario_brief,
            "status": plan.status,
            "progress": await progress(session, target),
        }

    # provider 构造本身也可能失败（如未配置 API Key），必须在同一层捕获，
    # 否则用户看到的是裸 500 而不是可读的配置提示。
    try:
        planner = DailyPlanner(
            llm=ctx.registry.get_text_llm(),
            tts=ctx.registry.get_tts(),
            memory=ctx.memory,
            study_plan=ctx.config.study_plan,
        )
        result = await planner.generate_plan(session, target)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=(
                f"计划生成失败：{exc}. "
                "请检查 config.yaml / .env 中的模型配置（base_url、api_key、model_name）是否正确。"
            ),
        ) from exc

    return {
        "plan_date": target.isoformat(),
        "cached": False,
        "scenario_title": result.scenario_title,
        "scenario_brief": result.scenario_brief,
        "new_count": result.new_count,
        "review_count": result.review_count,
        "voice_target_count": result.voice_target_count,
        "audio_ready": result.audio_ready,
        "warnings": result.warnings,
        "progress": await progress(session, target),
    }


async def _purge_legacy_demo_seed(session: AsyncSession) -> None:
    """清理早期原型阶段误写入数据库的 Core_3000_Engineer / Dear Alex 演示假数据。"""
    from sqlalchemy import delete, select

    from ..db.models import (
        DEFAULT_USER_ID,
        DailyPlanItem,
        DailyStudyPlan,
        FSRSCard,
        LinguisticMistake,
        Word,
    )

    demo_word_ids = list(
        (
            await session.execute(
                select(Word.id).where(
                    Word.user_id == DEFAULT_USER_ID,
                    Word.book_name == "Core_3000_Engineer",
                )
            )
        ).scalars()
    )
    dirty = False
    if demo_word_ids:
        await session.execute(
            delete(DailyPlanItem).where(DailyPlanItem.word_id.in_(demo_word_ids))
        )
        await session.execute(delete(FSRSCard).where(FSRSCard.word_id.in_(demo_word_ids)))
        await session.execute(delete(Word).where(Word.id.in_(demo_word_ids)))
        dirty = True

    demo_plans = list(
        (
            await session.execute(
                select(DailyStudyPlan).where(
                    DailyStudyPlan.user_id == DEFAULT_USER_ID,
                    DailyStudyPlan.scenario_brief.like("Dear Alex%"),
                )
            )
        ).scalars()
    )
    for p in demo_plans:
        await session.delete(p)
        dirty = True

    demo_mistakes = (
        "we need to de-PRE-cate (/dɪˈprekeɪt/) the old API",
        "If the gateway would timeout, the webhook retries twice.",
        "We must make sure the retry logic is no-repeat.",
    )
    res = await session.execute(
        delete(LinguisticMistake).where(
            LinguisticMistake.user_id == DEFAULT_USER_ID,
            LinguisticMistake.user_original.in_(demo_mistakes),
        )
    )
    if res.rowcount:
        dirty = True

    if dirty:
        await session.commit()


@router.get("/study/queue")
async def study_queue(
    request: Request,
    plan_date: date | None = None,
    include_done: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    from ..db.models import DEFAULT_USER_ID, DailyStudyPlan

    await _purge_legacy_demo_seed(session)
    target = plan_date or _today()
    queue = await get_study_queue(session, target, include_done=include_done)
    plan = await session.get(DailyStudyPlan, {"plan_date": target, "user_id": DEFAULT_USER_ID})
    return {
        "plan_date": target.isoformat(),
        "scenario_title": plan.scenario_title if plan else None,
        "scenario_brief": plan.scenario_brief if plan else None,
        "status": plan.status if plan else None,
        "progress": await progress(session, target),
        "cards": [
            {
                "item_id": c.item_id,
                "word_id": c.word_id,
                "word": c.word,
                "phonetic_us": c.phonetic_us,
                "item_type": c.item_type,
                "sentence_en": c.sentence_en,
                "sentence_zh": c.sentence_zh,
                "sentence_audio_path": c.sentence_audio_path,
                "options": c.options,
                "pos_defs": c.pos_defs,
                "is_voice_target": c.is_voice_target,
                "requeue_count": c.requeue_count,
            }
            for c in queue
        ],
    }


@router.post("/study/review-card")
async def review_card(
    request: Request,
    body: ReviewCardRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        return await submit_rating(
            session,
            plan_date=_today(),
            word_id=body.word_id,
            selected_label=body.selected_label,
            duration_ms=body.duration_ms,
            manual_rating=body.manual_rating,
        )
    except StudyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/study/stats")
async def study_stats(request: Request, session: AsyncSession = Depends(get_session)) -> dict:
    await _purge_legacy_demo_seed(session)
    return await stats_snapshot(session)


@router.get("/study/words")
async def list_words(
    request: Request,
    tag: str | None = None,
    limit: int = 60,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """获取词库明细、FSRS 4 态统计与错题本数据，供 Lexicon Planet 与 Journal 消费。"""
    from sqlalchemy import select

    from ..db.models import DEFAULT_USER_ID, FSRSCard, LinguisticMistake, Word

    await _purge_legacy_demo_seed(session)
    stmt = (
        select(Word, FSRSCard)
        .join(FSRSCard, FSRSCard.word_id == Word.id)
        .where(Word.user_id == DEFAULT_USER_ID)
        .order_by(Word.id.asc())
        .limit(limit)
    )
    rows = await session.execute(stmt)
    words_out = []
    for w, c in rows:
        tags = w.topic_tags or []
        if tag and tag != "all" and tag not in tags:
            continue
        words_out.append(
            {
                "id": w.id,
                "word": w.word,
                "phonetic_us": w.phonetic_us or "",
                "pos_defs": w.pos_defs or [],
                "topic_tags": tags,
                "book_name": w.book_name,
                "state": 0 if c.stability is None else c.state,
                "stability": round(c.stability, 1) if c.stability is not None else None,
                "difficulty": round(c.difficulty, 1) if c.difficulty is not None else None,
                "reps": c.reps or 0,
                "lapses": c.lapses or 0,
            }
        )

    mistakes_rows = await session.execute(
        select(LinguisticMistake)
        .where(LinguisticMistake.user_id == DEFAULT_USER_ID)
        .order_by(LinguisticMistake.id.desc())
        .limit(25)
    )
    mistakes_out = [
        {
            "id": m.id,
            "plan_date": m.plan_date.isoformat(),
            "mistake_type": m.mistake_type,
            "user_original": m.user_original,
            "corrected_version": m.corrected_version,
            "explanation": m.explanation or "",
        }
        for (m,) in mistakes_rows
    ]
    all_words_rows = await session.execute(
        select(Word.topic_tags, Word.book_name).where(Word.user_id == DEFAULT_USER_ID)
    )
    tag_counts: dict[str, int] = {}
    books_set: set[str] = set()
    for w_tags, b_name in all_words_rows:
        if b_name:
            books_set.add(b_name)
        for t in w_tags or []:
            tag_counts[t] = tag_counts.get(t, 0) + 1

    return {
        "words": words_out,
        "mistakes": mistakes_out,
        "tag_counts": tag_counts,
        "books": sorted(books_set),
    }
