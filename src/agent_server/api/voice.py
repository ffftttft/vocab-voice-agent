"""语音会话路由：WebSocket 全双工 + SSE 提示（SPEC 6.1/6.2）。

协议要点：
- 同一 WebSocket 复用二进制帧（PCM 音频）与文本帧（JSON 控制）
- 上行：16kHz PCM16；下行：24kHz PCM16
- 服务端在会话开始时主动触发 AI 破冰
"""

from __future__ import annotations

import contextlib
import json
from datetime import date

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..app_context import get_context
from ..db.models import (
    DEFAULT_USER_ID,
    LinguisticMistake,
    VoiceSession,
)
from ..harness.voice_orchestrator import SessionState, TargetWord, VoiceOrchestrator
from ..services.study_service import daily_voice_targets, mark_hint_requested, mark_word_used

router = APIRouter(tags=["voice"])

# 内存中的活跃会话（单进程部署，SPEC 2.1 明确单 worker）
_ACTIVE: dict[int, VoiceOrchestrator] = {}


async def get_session(request: Request) -> AsyncSession:
    ctx = get_context(request.app)
    async with ctx.session_factory() as session:
        yield session


async def _create_voice_session(
    db: AsyncSession, plan_date: date, user_id: str = DEFAULT_USER_ID
) -> VoiceSession:
    vs = VoiceSession(plan_date=plan_date, user_id=user_id)
    db.add(vs)
    await db.commit()
    await db.refresh(vs)
    return vs


@router.websocket("/voice/ws")
async def voice_ws(websocket: WebSocket, plan_date: str | None = None) -> None:
    """全双工语音 WebSocket。

    query: plan_date=YYYY-MM-DD
    """
    await websocket.accept()
    app = websocket.app
    ctx = get_context(app)

    target_date = date.fromisoformat(plan_date) if plan_date else date.today()

    async with ctx.session_factory() as db:
        targets = await daily_voice_targets(db, target_date)
        if not targets:
            await websocket.send_json(
                {"type": "server.error", "message": "今日没有语音目标词，请先完成背词"}
            )
            await websocket.close()
            return

        plan = None
        from ..db.repos import get_or_create_plan

        plan = await get_or_create_plan(db, target_date)

        vs = await _create_voice_session(db, target_date)

        state = SessionState(
            session_id=vs.id,
            plan_date=target_date,
            scenario_title=plan.scenario_title or "自由对话",
            scenario_brief=plan.scenario_brief or "",
            queue=[
                TargetWord(w["word_id"], w["word"], w["sentence_en"], w["pos_defs"])
                for w in targets
            ],
            target_seconds=ctx.config.study_plan.voice_session_target_minutes * 60
            if hasattr(ctx.config.study_plan, "voice_session_target_minutes")
            else 600,
        )

        try:
            provider = ctx.registry.get_realtime_voice()
        except Exception as exc:  # noqa: BLE001
            await websocket.send_json(
                {"type": "server.error", "message": f"实时语音 provider 不可用：{exc}"}
            )
            await websocket.close()
            return

        orchestrator = VoiceOrchestrator(
            provider=provider,
            session_state=state,
            memory_profile=ctx.memory.read_profile(),
            error_patterns=ctx.memory.read_errors(),
            sliding_window_size=ctx.config.study_plan.voice_sliding_window_size,
        )
        _ACTIVE[vs.id] = orchestrator

        await websocket.send_json(
            {
                "type": "server.session_ready",
                "session_id": vs.id,
                "scenario_title": state.scenario_title,
                "scenario_brief": state.scenario_brief,
                "target_words": [t.word for t in state.active],
                "progress": state.progress,
            }
        )

        await orchestrator.start()

        import asyncio

        async def pump_downstream() -> None:
            async for event in orchestrator.iter_events():
                if event["type"] == "_audio_bytes":
                    await websocket.send_bytes(event["payload"])
                    continue

                persist = event.pop("_persist", None)
                if persist:
                    async with ctx.session_factory() as persist_db:
                        await _persist_side_effect(persist_db, persist, target_date, vs.id)
                await websocket.send_json(event)

        async def pump_upstream() -> None:
            while True:
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    raise WebSocketDisconnect()
                if message.get("bytes") is not None:
                    await orchestrator.feed_audio(message["bytes"])
                elif message.get("text") is not None:
                    await _handle_control(orchestrator, message["text"])

        try:
            await asyncio.gather(pump_upstream(), pump_downstream())
        except WebSocketDisconnect:
            pass
        except Exception as exc:  # noqa: BLE001
            with contextlib.suppress(RuntimeError):
                await websocket.send_json({"type": "server.error", "message": str(exc)})
        finally:
            _ACTIVE.pop(vs.id, None)
            await orchestrator.close()
            vs.ended_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            vs.duration_seconds = state.elapsed_seconds
            vs.target_progress_json = state.progress
            await db.commit()


async def _handle_control(orchestrator: VoiceOrchestrator, raw: str) -> None:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return
    kind = payload.get("type")
    if kind == "client.interrupt":
        await orchestrator.interrupt()
    elif kind == "client.mute":
        return


async def _persist_side_effect(
    db: AsyncSession, persist: dict, plan_date: date, session_id: int
) -> None:
    """把编排器交下来的落库意图写入数据库。"""
    kind = persist.get("kind")
    if kind == "mark_word_used":
        await mark_word_used(db, plan_date, persist["word"], persist["used_correctly"])
    elif kind == "log_mistake":
        db.add(
            LinguisticMistake(
                session_id=session_id,
                plan_date=plan_date,
                mistake_type=persist["category"],
                user_original=persist["user_said"],
                corrected_version=persist["suggested"],
                explanation=persist["tip_zh"],
            )
        )
        await db.commit()


# ---------------------------------------------------------------- SSE 提示


@router.get("/voice/{session_id}/hint-stream")
async def hint_stream(session_id: int, request: Request) -> StreamingResponse:
    """按需生成示例回答（SPEC 5.4）。

    **绝不预生成**：只有用户点按钮才会走到这里。
    """
    ctx = get_context(request.app)
    orchestrator = _ACTIVE.get(session_id)
    if orchestrator is None:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不在活动状态")

    active_words, transcript = orchestrator.hint_context()
    words_to_mark = orchestrator.note_hint_requested()

    async with ctx.session_factory() as db:
        await mark_hint_requested(db, orchestrator.state.plan_date, words_to_mark)

    from ..harness.hint_streamer import HintStreamer

    streamer = HintStreamer(ctx.registry.get_text_llm(), ctx.memory)
    return StreamingResponse(
        streamer.stream(active_words, transcript),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 关掉 nginx/caddy 缓冲，保证首字延迟
            "Connection": "keep-alive",
        },
    )
