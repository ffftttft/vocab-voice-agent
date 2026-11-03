# Vocab Voice Agent

个人定制的英语学习 Agent：**FSRS 场景化背单词** + **实时语音口语实战**。

纯自用、单机部署、模型全部可热切换。

---

## 这个系统解决什么问题

传统背单词练的是**识别**（看英文选中文），但开口说话需要**产出**（想表达 → 调出英文）。
一个人可以认出几千个词却依然说不出句子——这两条检索通路不一样。

本系统的设计重心因此在**语音产出环节**，背词环节是为它供弹药的：

```
白天 → 按你的真实场景成组学词，例句是你真会说的话
晚上 → 10 分钟语音对话，AI 引导你把今天的词说出来
次日 → 提炼成两份 Markdown（个人画像 + 语言病历），清空原始转写
```

---

## 快速开始

### 1. 安装

```bash
uv sync
```

### 2. 配置模型

复制 `.env.example` 为 `.env`，填三处：

```bash
TEXT_LLM_BASE_URL=...      # 中转站或 DeepSeek
TEXT_LLM_API_KEY=...
TEXT_LLM_MODEL=deepseek-v4.1-flash
VOICE_API_KEY=...          # 阿里百炼
```

也可以启动后在「设置」页里改，改完立即生效，不用重启。

### 3. 导入词书

```bash
# JSON: {"words": [{"word": "...", "phonetic": "...", "definitions": "v. ..."}]}
# CSV:  word,phonetic,definitions
```

或在「设置 → 词书」上传。

### 4. 构建前端（首次必需）

前端构建产物不入库，全新克隆需要先构建一次：

```bash
cd web && pnpm install && pnpm build && cd ..
```

### 5. 运行

```bash
uv run uvicorn src.agent_server.main:app --reload --port 8000
```

打开 <http://127.0.0.1:8000>。若看到「前端尚未构建」提示，回到第 4 步。

> 只用 API 不建前端也可以：文档在 <http://127.0.0.1:8000/docs>。

### 6. 手机真机测试

手机浏览器只在 HTTPS 下给麦克风权限。没有域名时用 cloudflared 临时隧道：

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

### 7. 部署

```bash
cp .env.example .env   # 填好
docker compose up -d --build
```

Caddy 会自动申请 Let's Encrypt 证书。`DOMAIN_NAME` 环境变量指定域名。

---

## 开发

```bash
uv run pytest -q            # 测试（247 个）
uv run ruff check .         # 静态检查
uv run ruff format .        # 格式化

cd web && pnpm install && pnpm dev   # 前端开发服（代理到 :8000）
```

生产依赖验证（确认 dev 包不进镜像）：

```bash
uv sync --frozen --no-dev --no-install-project
```

---

## 架构

```
web/            React 19 H5（4 视图 + Web Audio）
   ↓ REST / SSE / WebSocket
api/            FastAPI 路由（薄）
harness/        业务编排：daily_planner / voice_orchestrator
                          / hint_streamer / memory_compactor
services/       FSRS / 记忆 / 词书 / 背词状态机
providers/      三大抽象接口 + registry 热切换
db/             SQLAlchemy Async + SQLite WAL
```

**铁律**：业务代码不 import 任何具体厂商 SDK。模型调用一律经 `ProviderRegistry`。

---

## 关键设计决定

| 决定 | 原因 |
|---|---|
| 新卡判定用 `stability IS NULL`，不是 `state == 0` | py-fsrs 6.3.2 无 `State.New`，照抄上游规格会导致新词恒为 0 |
| 每日 15 新词（而非 30） | 面向「开不了口」的水平，先建立惯性再加量 |
| 语音 10 分钟起步（而非 30） | 同上，可持续性优先于强度 |
| 纠错用 Recast 而非打断 | 打断对话流是体验红线 |
| SSE 提示绝不预生成 | 只有点击才烧 token |
| 记忆只追加不重写 | 文件是用户可手改的 |

完整的决策记录见 [设计文档](docs/superpowers/specs/2026-11-03-vocab-voice-agent-design.md)。

---

## 文档

- [HANDOFF.md](HANDOFF.md) — 交接入口，含已踩坑与自续说明
- [STATUS.md](STATUS.md) — 当前进度与下一步
- [设计文档](docs/superpowers/specs/2026-11-03-vocab-voice-agent-design.md) — 意图、取舍、裁决依据
- [原始规格](docs/SPEC.md) — 用户提供的 SPEC（含已知缺陷）
