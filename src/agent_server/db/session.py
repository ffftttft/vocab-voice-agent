"""Async SQLite 引擎与会话工厂。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..config import settings
from .models import Base


def build_engine(db_url: str | None = None, *, echo: bool = False):
    """构建异步引擎。

    SQLite 需要显式开启 WAL 才能支撑「背词写入 + 语音会话」并发读写（SPEC 2.1）。
    WAL 通过连接建立事件在每个连接上设置，且必须同时对 database 设置 busy_timeout，
    否则并发写入会直接抛 "database is locked"。
    """
    url = db_url or settings.resolved_database_url
    engine = create_async_engine(url, echo=echo, future=True)

    if url.startswith("sqlite"):

        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _record):  # type: ignore[no-untyped-def]
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA synchronous=NORMAL")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    return engine


async def init_db(engine) -> None:  # type: ignore[no-untyped-def]
    """建表。MVP 阶段直接用 metadata.create_all；生产迁移走 Alembic。"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def make_session_factory(engine) -> async_sessionmaker[AsyncSession]:  # type: ignore[no-untyped-def]
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session(factory: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    async with factory() as session:
        yield session


def ensure_data_dirs(data_dir: Path | None = None) -> None:
    base = data_dir or settings.data_dir
    for sub in ("", "audio_cache", "wordbooks", "memory"):
        (base / sub).mkdir(parents=True, exist_ok=True)
