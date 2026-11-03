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

    planner = DailyPlanner(
        llm=ctx.registry.get_text_llm(),
        tts=ctx.registry.get_tts(),
        memory=ctx.memory,
        study_plan=ctx.config.study_plan,
    )
    try:
        result = await planner.generate_plan(session, target)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"计划生成失败：{exc}") from exc

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


@router.get("/study/queue")
async def study_queue(
    request: Request,
    plan_date: date | None = None,
    include_done: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    target = plan_date or _today()
    queue = await get_study_queue(session, target, include_done=include_done)
    return {
        "plan_date": target.isoformat(),
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
    return await stats_snapshot(session)
