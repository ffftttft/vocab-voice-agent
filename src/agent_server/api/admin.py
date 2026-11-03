"""模型配置与记忆文件管理 API（SPEC 6.1 admin）。

- `GET/PUT /admin/config`：读取或热更新模型配置
- `GET/PUT /admin/memory`：在线查看/编辑两份 Markdown 记忆
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..app_context import get_context
from ..config import ModelStageConfig, load_app_config

router = APIRouter(prefix="/admin", tags=["admin"])

ALLOWED_MEMORY_FILES = {"user_profile", "error_patterns"}


class MemoryDoc(BaseModel):
    content: str


class ModelStagePatch(BaseModel):
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model_name: str | None = None
    ws_url: str | None = None
    voice_id: str | None = None
    temperature: float | None = None


class ConfigPatch(BaseModel):
    text_llm: ModelStagePatch | None = None
    realtime_voice: ModelStagePatch | None = None
    tts: ModelStagePatch | None = None


def _mask(secret: str) -> str:
    if not secret:
        return ""
    if len(secret) <= 8:
        return "*" * len(secret)
    return f"{secret[:4]}{'*' * (len(secret) - 8)}{secret[-4:]}"


@router.get("/config")
async def get_config(request: Request) -> dict:
    ctx = get_context(request.app)

    def dump(stage: ModelStageConfig) -> dict:
        return {
            "provider": stage.provider,
            "base_url": stage.base_url,
            "api_key": _mask(stage.api_key),
            "model_name": stage.model_name,
            "ws_url": stage.ws_url,
            "voice_id": stage.voice_id,
            "temperature": stage.temperature,
        }

    cfg = ctx.config
    return {
        "study_plan": cfg.study_plan.model_dump(),
        "models": {
            "text_llm": dump(cfg.models.text_llm),
            "realtime_voice": dump(cfg.models.realtime_voice),
            "tts": dump(cfg.models.tts),
        },
    }


@router.put("/config")
async def update_config(request: Request, body: ConfigPatch) -> dict:
    """热更新模型配置（内存生效 + 回写 config.yaml）。

    api_key 留空表示不修改，避免前端用掩码字符串覆盖真实 key。
    """
    ctx = get_context(request.app)
    cfg = load_app_config(ctx.config and _config_path())

    for stage_name in ("text_llm", "realtime_voice", "tts"):
        patch = getattr(body, stage_name)
        if patch is None:
            continue
        stage = getattr(cfg.models, stage_name)
        for key, value in patch.model_dump(exclude_none=True).items():
            if key == "api_key" and not value:
                continue
            setattr(stage, key, value)

    _persist_config(cfg)
    ctx.config = cfg
    ctx.registry.reload(cfg)
    return {"status": "ok", "reloaded": True}


def _config_path() -> Path:
    from ..config import PROJECT_ROOT

    return PROJECT_ROOT / "config.yaml"


def _persist_config(cfg) -> None:  # type: ignore[no-untyped-def]
    """把当前配置写回 config.yaml。

    注意：写出的是**已替换过环境变量**的明文值。因此推荐用 .env 管理密钥，
    或在写入后手动改回 ${VAR} 形式。此处只在值确实变化时才落盘。
    """
    import yaml

    path = _config_path()
    data = {
        "study_plan": cfg.study_plan.model_dump(),
        "models": {
            name: {k: v for k, v in getattr(cfg.models, name).model_dump().items() if v != ""}
            for name in ("text_llm", "realtime_voice", "tts")
        },
    }
    path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")


@router.get("/memory")
async def get_memory(request: Request) -> dict:
    ctx = get_context(request.app)
    return {
        "user_profile": ctx.memory.read_profile(),
        "error_patterns": ctx.memory.read_errors(),
    }


@router.put("/memory/{doc_name}")
async def update_memory(request: Request, doc_name: str, body: MemoryDoc) -> dict:
    if doc_name not in ALLOWED_MEMORY_FILES:
        raise HTTPException(status_code=404, detail=f"未知记忆文件: {doc_name}")

    ctx = get_context(request.app)
    if doc_name == "user_profile":
        ctx.memory.write_profile(body.content)
    else:
        ctx.memory.write_errors(body.content)
    return {"status": "ok", "doc": doc_name, "bytes": len(body.content.encode())}
