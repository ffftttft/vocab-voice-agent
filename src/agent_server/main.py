"""入口：`uv run uvicorn src.agent_server.main:app`。"""

from __future__ import annotations

from .app_context import create_app

app = create_app()
