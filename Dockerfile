# ---------- Stage 1: 构建前端静态产物 ----------
FROM node:22-alpine AS web-builder
WORKDIR /build/web
COPY web/package.json web/pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@latest --activate || true
RUN pnpm install --frozen-lockfile || npm install
COPY web/ ./
RUN pnpm run build || npm run build

# ---------- Stage 2: Python 生产环境（uv，剔除 dev 依赖）----------
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS app-runner
WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 先只拷依赖声明，让依赖层可缓存
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 源码与配置
COPY config.yaml ./
COPY src/ ./src/
COPY --from=web-builder /build/web/dist ./web_dist

RUN mkdir -p /app/data/audio_cache /app/data/memory /app/data/wordbooks

# 非 root 运行
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# 单 worker：语音会话状态在内存（SPEC 2.1 明确）
CMD ["uv", "run", "--no-dev", "uvicorn", "src.agent_server.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
