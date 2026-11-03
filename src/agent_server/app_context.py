"""应用上下文：把配置、DB、Provider 装配在一起，供路由通过 Depends 取用。

用 lifespan 管理生命周期，测试时可用 `create_app(overrides=...)` 注入假 provider。
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .config import AppConfig, load_app_config, settings
from .db.session import build_engine, ensure_data_dirs, init_db, make_session_factory
from .providers.registry import ProviderRegistry
from .services.memory_store import MemoryStore


@dataclass
class AppContext:
    config: AppConfig
    registry: ProviderRegistry
    session_factory: async_sessionmaker[AsyncSession]
    memory: MemoryStore
    data_dir: Path
    engine: object = None
    planner_factory: object = None
    extras: dict = field(default_factory=dict)


_CTX_KEY = "app_ctx"


def get_context(app: FastAPI) -> AppContext:
    return getattr(app.state, _CTX_KEY)


def create_app(
    config: AppConfig | None = None,
    data_dir: Path | None = None,
    db_url: str | None = None,
    start_scheduler: bool = False,
) -> FastAPI:
    """构建 FastAPI 应用。参数可覆盖，便于测试注入。"""
    cfg = config or load_app_config()
    base = data_dir or settings.data_dir
    url = db_url or f"sqlite+aiosqlite:///{base / 'app.db'}"

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        ensure_data_dirs(base)
        engine = build_engine(url)
        await init_db(engine)
        factory = make_session_factory(engine)
        memory = MemoryStore(base / "memory")
        memory.ensure_initialized()
        registry = ProviderRegistry(cfg, base / "audio_cache")

        ctx = AppContext(
            config=cfg,
            registry=registry,
            session_factory=factory,
            memory=memory,
            data_dir=base,
            engine=engine,
        )
        setattr(app.state, _CTX_KEY, ctx)
        try:
            yield
        finally:
            await engine.dispose()

    app = FastAPI(title="Vocab Voice Agent", version="0.1.0", lifespan=lifespan)

    from .api import admin, study, tts, voice

    app.include_router(study.router, prefix="/api/v1")
    app.include_router(tts.router, prefix="/api/v1")
    app.include_router(voice.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")

    @app.get("/api/v1/health")
    async def health() -> dict:
        return {"status": "ok", "today": date.today().isoformat()}

    _mount_frontend(app, base)
    return app


def _mount_frontend(app: FastAPI, data_dir: Path) -> None:
    """挂载前端静态产物（SPEC Milestone 5）。

    查找顺序：web/dist（本地构建）→ web_dist（Docker 镜像内）。
    找不到时不影响 API 使用，只是没有界面。
    """
    from pathlib import Path as _Path

    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    project_root = _Path(__file__).resolve().parents[2]
    candidates = [project_root / "web" / "dist", project_root / "web_dist"]
    dist = next((c for c in candidates if (c / "index.html").exists()), None)
    if dist is None:
        return

    assets = dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):  # type: ignore[no-untyped-def]
        # API 路径不走 SPA 兜底
        if full_path.startswith("api/"):
            from fastapi import HTTPException

            raise HTTPException(status_code=404)
        candidate = dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(dist / "index.html")
