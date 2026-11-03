"""TTS 接口（SPEC 6.1：`POST /api/v1/tts/speak`）。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..app_context import get_context

router = APIRouter(tags=["tts"])


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@router.post("/tts/speak")
async def speak(request: Request, body: SpeakRequest) -> FileResponse:
    """传入任意英文句子，返回 MP3 音频流。

    命中磁盘缓存时直接返回文件，不打网络（SPEC 3.2 的缓存契约）。
    """
    ctx = get_context(request.app)
    try:
        tts = ctx.registry.get_tts()
        path = await tts.synthesize_to_file(body.text)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"TTS 合成失败：{exc}") from exc

    return FileResponse(
        path,
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
