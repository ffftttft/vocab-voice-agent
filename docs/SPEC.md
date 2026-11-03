这份技术规格说明书（Technical Specification）专为 **AI 编码 Agent** 编写。你可以直接将本文档保存为项目根目录下的 `SPEC.md`，交给你的 Coding Agent 作为唯一事实来源（Single Source of Truth）按阶段执行开发。

---

# 个人定制化英语学习 Agent 系统技术规格说明书 (SPEC v1.0)

## 1. 项目概述与核心设计原则

### 1.1 项目定位
构建一个纯自用、高度定制化的 Web H5 英语学习 Agent 系统，部署于单台云服务器。系统将**“基于 FSRS 算法的场景化动态背单词”**与**“20~30 分钟端到端实时语音对话实战”**打通，实现从词汇输入到语境主动输出的完整闭环。

### 1.2 核心架构铁律（Coding Agent 必须严格遵守）
1. **全阶段模型彻底解耦（零硬编码）**：文本生成（选词、造句、出题、SSE 提示、记忆提炼）、实时端到端语音（S2S）、静态/流式语音合成（TTS）三大模块必须通过统一的抽象接口（Provider Pattern）实现。所有模型的 `provider`、`base_url`、`api_key`、`model_name` 均支持通过环境变量与数据库配置表热切换，严禁在业务代码中写死任何特定模型。
2. **拒绝黑盒重型框架，采用自研轻量级 Harness**：不使用 LangChain、AutoGen 等重型框架。后端直接基于 Python `AsyncOpenAI` 客户端、原生 `websockets` 与 Pydantic 结构化校验，编写不到 300 行的确定性 Agent Harness（负责生命周期钩子、滑动窗口状态注入与异步 Tool Calling 分发）。
3. **零预生成浪费，提示采用按需实时 SSE**：语音通话中的“示例回答提示”**绝不**在后台每轮预生成。仅当用户主动点击屏幕上的“提示示例回答”按钮时，才通过 **SSE (`text/event-stream`)** 实时请求文本模型流式返回答案，并按需触发 TTS 发音。
4. **范围收敛（MVP）**：仅支持英语学习；暂不开发课后影子跟读/复盘模块；聚焦“每日定制背词 + 实时语音引导与隐性纠错 + 每日记忆提炼与重置”。

---

## 2. 技术栈选型与 `uv` 环境管理规范

### 2.1 前后端技术栈
* **后端语言与运行时**：Python 3.12+
* **包与环境管理**：`uv`（严格通过 PEP 735 `dependency-groups` 区分 `dev` 开发环境与生产部署环境）
* **Web 框架**：`FastAPI` + `Uvicorn`（原生支持 REST、SSE 流式响应与双向 WebSocket）
* **数据库与 ORM**：`SQLite`（开启 WAL 模式支持高并发读写）+ `SQLAlchemy 2.0 (Async)` + `aiosqlite` + `Alembic`（数据库迁移）
* **记忆曲线算法库**：`fsrs >= 6.3.2`（官方 `py-fsrs` 库，墨墨背单词同源 FSRS 算法实现）
* **模型与语音依赖**：`openai >= 1.60.0`（兼容 DeepSeek / Qwen 等所有 OpenAI 协议接口）、`websockets >= 14.0`（桥接实时语音大模型）、`edge-tts >= 7.0.0`（默认免费高自然度 TTS）、`httpx`
* **前端技术栈（Web H5 / PWA）**：React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand（状态管理）+ Web Audio API（`AudioWorklet` 处理 16kHz/24kHz PCM 实时音频流）
* **网关与部署**：Docker Compose + Caddy（自动申请 Let's Encrypt HTTPS 证书，解决移动端浏览器 `getUserMedia` 麦克风权限强制要求 HTTPS 的限制）

### 2.2 项目目录结构 (Monorepo)
```text
vocab-voice-agent/
├── pyproject.toml                 # uv 项目定义与依赖分组 (核心配置)
├── uv.lock                        # uv 锁定文件 (提交至版本控制)
├── .env.example                   # 环境变量模板
├── config.yaml                    # 默认模型路由与学习计划配置
├── Dockerfile                     # 多阶段构建 (前端构建 + uv --no-dev 生产镜像)
├── docker-compose.yml             # 单机一键部署编排 (App + Caddy)
├── Caddyfile                      # 反向代理与自动 HTTPS 配置
├── data/                          # 持久化挂载目录 (Docker Volume)
│   ├── app.db                     # SQLite 数据库文件
│   ├── audio_cache/               # 单词与例句 TTS MP3 缓存
│   ├── wordbooks/                 # 原始词书文件 (JSON/CSV)
│   └── memory/                    # 双层记忆持久化 Markdown 档案
│       ├── user_profile.md        # 用户个人画像与生活/技术背景
│       └── error_patterns.md      # 长期累积的语法盲区与发音顽疾
├── src/
│   └── agent_server/
│       ├── __init__.py
│       ├── main.py                # FastAPI 入口与静态前端挂载
│       ├── config.py              # Pydantic Settings 配置加载器
│       ├── db/
│       │   ├── session.py         # Async SQLite 引擎
│       │   └── models.py          # SQLAlchemy ORM 表模型
│       ├── providers/             # 【核心】可插拔模型抽象层
│       │   ├── base.py            # TextLLMProvider, RealtimeVoiceProvider, TTSProvider 抽象基类
│       │   ├── registry.py        # 动态模型实例化工厂 (支持运行时切换)
│       │   ├── llm/
│       │   │   └── openai_compat.py  # 通用 OpenAI 兼容实现 (适配 DeepSeek-V4.1-Flash / Qwen 等)
│       │   ├── voice/
│       │   │   ├── qwen_omni.py      # 阿里百炼 Qwen-Omni-Realtime WebSocket 适配器 (默认)
│       │   │   └── doubao_realtime.py# 火山引擎豆包实时语音适配器 (备选)
│       │   └── tts/
│       │       ├── edge_tts_Impl.py  # 免费 Edge-TTS 适配器 (默认)
│       │       └── openai_tts_impl.py# 商业 API TTS 适配器 (备选)
│       ├── harness/               # 【核心】轻量级确定性 Agent Harness
│       │   ├── daily_planner.py   # 每日场景聚类选词、定制例句与干扰项生成器
│       │   ├── voice_orchestrator.py # 实时语音会话状态机、滑动窗口目标词注入、Tool 拦截
│       │   ├── hint_streamer.py   # 按需实时 SSE 示例回答生成器
│       │   └── memory_compactor.py# 每日记忆提炼与 Context 清理器
│       ├── services/
│       │   ├── fsrs_service.py    # 封装 py-fsrs 卡片调度与口语联动评分
│       │   └── wordbook_loader.py # 词书导入与批量语义标签初始化
│       └── api/
│           ├── study.py           # 背词流程 REST API
│           ├── voice_ws.py        # 全双工语音 WebSocket 端点与 SSE 提示端点
│           └── admin.py           # 模型配置热更新、词书上传、记忆文件读写 API
└── web/                           # 前端 Web H5 工程 (React + Vite)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── components/            # 刷词卡片、语音波形、纠错浮窗、SSE 示例答案抽屉
        ├── hooks/                 # usePCMRecorder, useRealtimeVoiceWS, useSSEHint
        ├── pages/                 # Dashboard, StudySession, VoiceCall, Settings
        └── store/                 # Zustand 全局状态
```

### 2.3 `uv` 环境隔离配置 (`pyproject.toml`)
使用 `uv` 的标准 `[project.dependencies]` 与 `[dependency-groups]` 严格区分生产环境与开发环境：

```toml
[project]
name = "vocab-voice-agent"
version = "0.1.0"
description = "Personalized English SRS & Realtime Voice Agent"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy[asyncio]>=2.0.36",
    "aiosqlite>=0.20.0",
    "alembic>=1.14.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "pyyaml>=6.0.2",
    "fsrs>=6.3.2",
    "openai>=1.65.0",
    "websockets>=14.1",
    "httpx>=0.28.1",
    "edge-tts>=7.0.0",
    "python-multipart>=0.0.20",
]

[dependency-groups]
dev = [
    "pytest>=8.3.4",
    "pytest-asyncio>=0.25.0",
    "ruff>=0.9.0",
    "mypy>=1.14.0",
    "httpx>=0.28.1",
    "watchfiles>=1.0.0",
]

[tool.uv]
default-groups = ["dev"]

[tool.ruff]
line-length = 100
target-version = "py312"
```

* **本地开发命令**：
  * 安装全量依赖（含 `dev` 组）：`uv sync`
  * 启动热重载开发服：`uv run uvicorn src.agent_server.main:app --reload --host 0.0.0.0 --port 8000`
  * 代码检查与测试：`uv run ruff check . && uv run pytest`
* **生产环境部署命令（Dockerfile 内使用）**：
  * 仅安装生产依赖（彻底剔除 `pytest`、`ruff`、`mypy` 等开发包）：`uv sync --frozen --no-dev --no-editable`
  * 生产启动：`uv run --no-dev uvicorn src.agent_server.main:app --host 0.0.0.0 --port 8000 --workers 1`（注：SQLite + 内存 WebSocket 会话管理建议使用单进程异步 Event Loop）。

---

## 3. 模型抽象层设计（全阶段可热插拔，零硬编码）

所有模型调用通过 `ProviderRegistry` 根据当前激活配置动态实例化。用户可在 `.env`、`config.yaml` 或前端设置页随时修改任意阶段的模型 URL、Key 和名称。

### 3.1 配置文件结构 (`config.yaml`)
```yaml
study_plan:
  daily_new_words: 30
  daily_review_limit: 90
  voice_target_words_count: 22      # 每次语音通话从今日120词中精选的口语高频目标词数
  voice_sliding_window_size: 4      # 语音对话中同时暴露给AI引导的待激活词窗口大小

models:
  # 阶段1：文本大模型（用于选词聚类、生成定制例句与4选1、实时SSE提示、记忆提炼）
  text_llm:
    provider: "openai_compatible"
    base_url: "${TEXT_LLM_BASE_URL:https://api.deepseek.com/v1}"
    api_key: "${TEXT_LLM_API_KEY}"
    model_name: "${TEXT_LLM_MODEL:deepseek-v4.1-flash}"
    temperature: 0.7
    extra_body: {}                  # 预留自定义厂商参数（如 thinking 开关等）

  # 阶段2：实时端到端语音大模型（用于20-30分钟全双工语音对话与发音/语法纠错）
  realtime_voice:
    provider: "${VOICE_PROVIDER:qwen_omni}"  # 可选: qwen_omni | doubao_realtime | openai_realtime
    ws_url: "${VOICE_WS_URL:wss://dashscope.aliyuncs.com/api-ws/v1/realtime}"
    api_key: "${VOICE_API_KEY}"
    model_name: "${VOICE_MODEL:qwen-omni-turbo-realtime}"
    voice_id: "${VOICE_ID:Chelsie}"          # 发音人音色
    input_sample_rate: 16000                 # 输入音频采样率 16kHz PCM16
    output_sample_rate: 24000                # 输出音频采样率 24kHz PCM16

  # 阶段3：TTS 语音合成（用于背单词、例句朗读、点击示例回答朗读）
  tts:
    provider: "${TTS_PROVIDER:edge_tts}"     # 可选: edge_tts | openai_compatible_tts | dashscope_tts
    voice_id: "${TTS_VOICE:en-US-AndrewMultilingualNeural}"
    base_url: "${TTS_BASE_URL:}"
    api_key: "${TTS_API_KEY:}"
    model_name: "${TTS_MODEL:}"
```

### 3.2 三大核心抽象接口 (`src/agent_server/providers/base.py`)

#### (1) `TextLLMProvider`
```python
from abc import ABC, abstractmethod
from typing import AsyncIterator, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class TextLLMProvider(ABC):
    @abstractmethod
    async def generate_structured(
        self, system_prompt: str, user_prompt: str, response_model: Type[T], temperature: float | None = None
    ) -> T:
        """返回严格符合 Pydantic Schema 的结构化对象（兼容 JSON Mode / response_format）"""

    @abstractmethod
    async def stream_text(
        self, system_prompt: str, messages: list[dict], temperature: float | None = None
    ) -> AsyncIterator[str]:
        """用于按需 SSE 实时流式生成文本（如点击提示示例回答）"""
```
* **实现细节**：`OpenAICompatibleLLMProvider` 内部使用 `AsyncOpenAI(base_url=..., api_key=...)`。为保证对所有国产模型（如 `deepseek-v4.1-flash`、千问、GLM 等）的最大兼容性，`generate_structured` 将 Pydantic 的 `model_json_schema()` 注入 System Prompt 并开启 `response_format={"type": "json_object"}`，收到返回后通过 `response_model.model_validate_json()` 校验，若解析失败自动触发最多 2 次带错误信息的自愈重试。

#### (2) `RealtimeVoiceProvider`
屏蔽阿里云百炼 `Qwen-Omni-Realtime` 与火山引擎豆包 `Seeduplex` 的底层协议差异，向上层 `VoiceOrchestrator` 暴露统一的双向异步事件流：
* **上行标准方法（前端/Harness -> 模型）**：
  * `connect(session_config: VoiceSessionConfig) -> None`：建立上游 WebSocket 连接，初始化 System Prompt、音色、服务端 VAD（支持语义打断）及 Tool 定义。
  * `send_audio_chunk(pcm16_bytes: bytes) -> None`：发送 16kHz 单声道 16-bit PCM 音频块（内部自动转为 Base64 封装进 `input_audio_buffer.append` 事件）。
  * `update_instructions(new_system_prompt: str) -> None`：当滑动窗口的目标词更新时，动态发送 `session.update` 刷新模型上下文指令，不中断当前通话。
  * `send_tool_result(call_id: str, result_json: str) -> None`：回传异步 Tool 执行结果。
  * `interrupt() -> None`：当用户在前端说话触发打断时，通知上游停止当前音频生成并清空播放缓冲。
* **下行标准事件（模型 -> Harness/前端）**：
  * `AudioDeltaEvent(pcm24_bytes: bytes)`：模型返回的流式音频帧（24kHz PCM16）。
  * `TranscriptDeltaEvent(role: "user" | "assistant", text: str, is_final: bool)`：实时双端语音转写字幕（用于前端展示与按需 SSE 提示的上下文记录）。
  * `ToolCallEvent(call_id: str, name: str, arguments: dict)`：模型触发工具调用（如记录发音/语法错误、标记单词已使用）。
  * `SpeechStartedEvent()`：服务端 VAD 检测到用户开口说话，前端立即停止播放当前 AI 语音流。

#### (3) `TTSProvider`
* `synthesize_to_file(text: str, cache_key: str) -> Path`：计算 `sha256(provider + voice_id + text)` 作为文件名，若 `/data/audio_cache/{hash}.mp3` 已存在则直接返回路径；若不存在则调用 `edge-tts`（或配置的商业 TTS）合成并落盘缓存。

---

## 4. 数据库设计与双层记忆文件规范

### 4.1 SQLite 核心表结构 (`src/agent_server/db/models.py`)

#### 表 1：`words`（基础词库表）
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `INTEGER PK` | 自增主键 |
| `word` | `VARCHAR(100) UNIQUE` | 英文单词或短语（如 `deprecate`） |
| `phonetic_us` | `VARCHAR(100)` | 美式音标（如 `/ˈdeprəkeɪt/`） |
| `pos_defs` | `JSON` | 词性与基础中文释义列表，如 `[{"pos": "v.", "def": "弃用；反对"}]` |
| `book_name` | `VARCHAR(100)` | 所属词书名称（如 `Core_3000`） |
| `topic_tags` | `JSON` | AI 预处理打上的场景语义标签，如 `["software_engineering", "daily_work", "debate"]` |
| `word_audio_path` | `VARCHAR(255)` | 单词发音本地缓存相对路径 |

#### 表 2：`fsrs_cards`（FSRS 记忆状态表，与 `words` 1:1 关联）
严格对应 `py-fsrs` (`fsrs >= 6.3.2`) 的 `Card` 对象字段：
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `word_id` | `INTEGER PK, FK` | 关联 `words.id` |
| `state` | `INTEGER` | `0=New`, `1=Learning`, `2=Review`, `3=Relearning` |
| `step` | `INTEGER NULL` | Learning/Relearning 阶段步数 |
| `stability` | `FLOAT NULL` | 记忆稳定性 $S$ |
| `difficulty` | `FLOAT NULL` | 记忆难度 $D$ |
| `due` | `DATETIME INDEX` | 下次应复习时间（UTC） |
| `last_review` | `DATETIME NULL` | 上次复习时间（UTC） |
| `reps` | `INTEGER DEFAULT 0` | 累计复习次数 |
| `lapses` | `INTEGER DEFAULT 0` | 遗忘重置次数 |
| `fsrs_card_json` | `JSON` | `card.to_dict()` 完整序列化快照（确保与 `py-fsrs` 无损互转） |

#### 表 3：`daily_study_plans`（每日学习计划主表）
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `plan_date` | `DATE PK` | 计划日期（如 `2026-11-03`） |
| `scenario_title` | `VARCHAR(200)` | AI 为今日词汇规划的统一场景主题（如 `"线上故障排查与架构重构讨论"`） |
| `scenario_brief` | `TEXT` | 场景背景简述（同时用于晚上语音对话的开场设定） |
| `status` | `VARCHAR(30)` | `GENERATING` -> `STUDYING` -> `VOICE_READY` -> `COMPLETED` |
| `created_at` | `DATETIME` | 创建时间 |

#### 表 4：`daily_plan_items`（每日单词明细与定制内容表）
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `INTEGER PK` | 自增主键 |
| `plan_date` | `DATE FK, INDEX` | 关联 `daily_study_plans.plan_date` |
| `word_id` | `INTEGER FK` | 关联 `words.id` |
| `item_type` | `VARCHAR(20)` | `NEW`（今日新学，默认 30 个）或 `REVIEW`（今日到期复习，上限 90 个） |
| `custom_sentence_en` | `TEXT` | AI 结合用户画像与今日场景生成的专属英文例句 |
| `custom_sentence_zh` | `TEXT` | 专属例句的中文翻译 |
| `sentence_audio_path` | `VARCHAR(255)` | 专属例句的 TTS 音频缓存路径 |
| `mcq_options` | `JSON` | 4 选 1 选项数组：`[{"label": "A", "pos": "v.", "text": "弃用；不赞成", "is_correct": true}, ...]` |
| `card_done` | `BOOLEAN DEFAULT 0` | 背词阶段是否已完成 |
| `card_rating` | `INTEGER NULL` | 背词阶段评分（`1=Again, 2=Hard, 3=Good, 4=Easy`） |
| `is_voice_target` | `BOOLEAN DEFAULT 0` | 是否被选为今日语音通话的口语激活目标词 |
| `voice_used_status` | `VARCHAR(20)` | `UNUSED` / `USED_PROACTIVELY`（主动用对） / `USED_WITH_HINT`（看提示后用出） / `FAILED` |

#### 表 5：`voice_sessions` & `linguistic_mistakes`（语音会话与纠错记录表）
* `voice_sessions`：`id`, `plan_date`, `started_at`, `ended_at`, `duration_seconds`, `transcript_json`（当天的对话记录，次日 Compaction 后可清理详情）。
* `linguistic_mistakes`：`id`, `session_id`, `plan_date`, `mistake_type` (`PRONUNCIATION` | `GRAMMAR` | `WORD_CHOICE`), `user_original`（原话/错音描述）, `corrected_version`（正确表达）, `explanation`（简短原因）, `created_at`。

### 4.2 双层记忆 Markdown 文件规范 (`/data/memory/`)
为了保持 Agent 上下文极致干净且高度可人工干预，核心长期记忆以纯文本 Markdown 存储：
1. **`/data/memory/user_profile.md`（用户个人画像）**
   * 记录用户的职业背景、当前正在做的项目、个人兴趣、日常高频沟通场景、近期生活动态（如：“一名偏好确定性工作流与工程规范的软件开发者，日常涉及代码架构、AI Agent 研发与日常英语交流”）。
   * 作用：在每日生成例句和语音对话时注入 System Prompt，确保 AI 造出的每一句例句都是用户现实中会说的话，杜绝无意义的鸡汤名言。
2. **`/data/memory/error_patterns.md`（语言顽疾病历本）**
   * 记录经由每日夜间 Compaction 提炼出的高频发音偏误（如特定元音饱满度、重音位置）与高频语法错误（如特定时态混用、介词搭配）。
   * 作用：次日语音通话启动时注入 System Prompt，让语音模型在倾听时重点关注这些薄弱点。

---

## 5. 核心业务模块详细需求与实现逻辑

### 5.1 模块一：词书导入与非顺序场景组局引擎 (`daily_planner.py`)

#### 需求描述
导入 3000 词词书后，每日学习不再按死板的 A-Z 或固定序号背诵，而是由 AI 挑选最容易构成同一个真实生活/工作场景的 30 个新词 + 当日到期的 90 个复习词，生成贴合用户画像的专属例句与高质量 4 选 1 题目。

#### 实现细节
1. **词书导入与语义标签初始化 (`wordbook_loader.py`)**：
   * 支持上传 JSON 或 CSV 词书（包含 `word`, `phonetic`, `definitions`）。入库时自动为每个词初始化一条 `fsrs_cards` 记录（`state=State.New`）。
   * 后台异步任务按每批 50 个词调用 `TextLLMProvider`（`deepseek-v4.1-flash`），为每个词打上 2~3 个场景标签（枚举池：`["tech_dev", "workplace_comm", "daily_life", "travel_dining", "finance_business", "emotion_opinion", "problem_solving"]`）存入 `words.topic_tags`。
2. **每日学习包生成流程（用户每日首次打开或点击“生成今日计划”时触发）**：
   * **Step 1 提取到期复习词**：查询 `fsrs_cards` 中 `state != 0 AND due <= now()` 的卡片，按 `due` 升序最多取 `daily_review_limit`（90）个词。
   * **Step 2 场景聚类挑选 30 个新词**：
     * 统计今日复习词中出现频率最高的 `topic_tag`（若今日无复习词，则随机或按用户偏好选一个主题标签）。
     * 从 `fsrs_cards.state == 0 (New)` 的未学词库中，筛选带有该主题标签的 80 个候选新词。
     * 调用 `TextLLMProvider`，传入 `user_profile.md` 和这 80 个候选词，让模型**挑选出最能自然融入同一个连贯场景的 30 个新词**，并拟定今日的 `scenario_title` 和 `scenario_brief`。
   * **Step 3 批量生成定制例句与同词性 4 选 1 干扰项**：
     * 将选定的 30 个新词 + 需要生成新语境例句的复习词，按每批 15 个词并发请求 `TextLLMProvider.generate_structured()`。
     * **Prompt 强约束规范**：
       1. 例句必须严格符合 `user_profile.md` 中的人物背景与今日 `scenario_title`，长度控制在 10~22 个单词之间，地道自然，适合口语复述。
       2. 4 个中文选项必须**词性完全一致**（例如目标词在例句中作及物动词，则 4 个选项全部以 `v.` 开头）。
       3. 3 个干扰项必须具备迷惑性（包含 1 个形近词释义、1 个反义/近义边界释义、1 个同场景常见词释义），严禁出现一眼假选项。
       4. 同时判断该词是否适合作为晚间口语对话的主动输出词，选出 20~25 个标记 `is_voice_target = True`。
   * **Step 4 音频预热（Edge-TTS）**：
     * 异步并发调用 `TTSProvider` 为今日所有单词本身及新生成的 `custom_sentence_en` 生成 MP3 文件缓存至 `/data/audio_cache/`，确保前端背词切换时 0 延迟秒播。

---

### 5.2 模块二：FSRS 卡片背诵交互引擎 (`fsrs_service.py`)

#### 需求描述
复刻墨墨背单词的流畅刷词体验：每个单词出现时自动播放单词发音，展示符合个人场景的定制例句（可自动或点击播放发音），下方展示 4 个带中文意思的选项。根据用户的作答表现更新 FSRS 记忆参数。

#### 实现细节
1. **单卡交互状态机（前端 H5）**：
   * **状态 A（出题态）**：进入卡片时，立即自动播放单词发音（`word_audio_path`），延迟 600ms 后自动播放定制例句发音（`sentence_audio_path`，可在设置中切换是否自动联播例句）。屏幕上方显示单词、音标、专属英文例句（目标词高亮，此时隐藏例句中文翻译），下方显示打乱顺序的 4 个中文释义选项按钮。
   * **状态 B（揭晓与评级态）**：
     * **若用户一次选对**：选项变绿，展开例句中文翻译与完整词典释义。底部出现 3 个手动微调按钮（默认 1.5 秒无操作或点击“下一词”按响应耗时自动提交）：
       * 响应耗时小于 3.5 秒且一次选对 $\rightarrow$ 默认映射 `Rating.Easy (4)`
       * 响应耗时 3.5 ~ 8 秒且一次选对 $\rightarrow$ 默认映射 `Rating.Good (3)`
       * 响应耗时大于 8 秒（犹豫较久）但选对 $\rightarrow$ 默认映射 `Rating.Hard (2)`
       * 用户也可手动点击底部的 `模糊 (Hard)` 或 `秒杀 (Easy)` 覆盖默认评级。
     * **若用户选错**：错误选项变红，正确选项高亮，强制停留揭晓页，再次播放单词与例句发音。该词本轮评级锁定为 `Rating.Again (1)`，并将其压入今日学习队列末尾要求当天重新过一遍，直到选对为止。
2. **FSRS 算法调度更新（后端 `py-fsrs` 调用）**：
   ```python
   from datetime import datetime, timezone
   from fsrs import Scheduler, Card, Rating

   scheduler = Scheduler(
       desired_retention=0.90,  # 90% 目标记忆保留率
       enable_fuzzing=True      # 开启微小随机离散，防止同一天学习的词未来全部扎堆在同一天到期
   )

   def record_card_review(db_card: FSRSCardORM, rating_int: int) -> FSRSCardORM:
       card = Card.from_dict(db_card.fsrs_card_json) if db_card.fsrs_card_json else Card()
       rating = Rating(rating_int)
       now = datetime.now(timezone.utc)
       updated_card, review_log = scheduler.review_card(card, rating, now)
       # 同步更新 ORM 字段与 JSON 快照
       db_card.state = int(updated_card.state)
       db_card.stability = updated_card.stability
       db_card.difficulty = updated_card.difficulty
       db_card.due = updated_card.due
       db_card.last_review = now
       db_card.fsrs_card_json = updated_card.to_dict()
       return db_card
   ```

---

### 5.3 模块三：20~30 分钟全双工语音场景实战 (`voice_orchestrator.py`)

#### 需求描述
当日单词（新学 + 复习）背诵完成后，解锁语音实战。AI 根据今日规划的场景先开口打招呼，一步步引导用户进行 20~30 分钟的对话以复习今日所学单词。使用原生端到端语音模型（优先 `qwen-omni-turbo-realtime`，备选豆包实时语音），实时纠正发音与语法错误。

#### 实现细节
1. **滑动窗口目标词注入机制（Sliding Window Target Pool）**：
   * 为什么需要滑动窗口：如果把今日 120 个词全部塞进语音模型的 System Prompt，模型会失焦或机械地背诵词表。
   * **编排逻辑**：
     * 会话启动时，`VoiceOrchestrator` 加载今日标记为 `is_voice_target = True` 的 22 个目标词队列。
     * 维护一个容量为 `4` 的活跃窗口（Active Window）。每次仅将这 4 个词（连同它们今天背诵时的专属例句）注入语音模型的当前指令中，要求 AI：“在接下来的自然对话中，通过设问或情境推进，引导用户主动说出这 4 个词中的任意词汇；若用户自己没用出来，在引导 2 轮后你可以自然地示范使用它并进入下一个话题。”
     * 每当模型触发 `mark_word_used` 工具调用，orchestrator 将该词移出活跃窗口，从待考队列补充下一个词，并通过 `RealtimeVoiceProvider.update_instructions()` 静默刷新上游指令。
2. **三段式对话节奏控制（20~30 分钟状态机）**：
   * **阶段 1：AI 主动破冰（0 ~ 2 分钟）**：WebSocket 连接建立后，后端主动向实时语音模型发送一条触发指令，让 AI 先开口用自然亲切的语气打招呼，并切入今日的 `scenario_title`（例如：*"Hey! Good to hear from you. I heard you were looking into refactoring that legacy module today—how's it going so far?"*）。
   * **阶段 2：渐进式场景引导与词汇激活（2 ~ 25 分钟）**：围绕场景层层深入提问，结合滑动窗口推进目标词，实时展示任务进度条（如：`已激活今日核心词：8 / 22`）。
   * **阶段 3：自然收尾（25 ~ 30 分钟）**：当所有目标词遍历完毕或达到设定时长，AI 用 1~2 句话针对今天聊得最精彩的部分做个简短鼓励并道别。
3. **发音与语法纠错的“双轨制”（不打断对话流 + 关键错误示范）**：
   * 在实时语音模型的 System Prompt 中挂载两个 Function Tools：
     * **Tool 1: `mark_word_used(word: str, used_correctly: bool)`**
       * 当用户在语音中说出了当前窗口的目标词（或今日学过的任意词）时，模型静默调用此工具。
       * **联动 FSRS**：若 `used_correctly=True` 且该词未点击过提示（`voice_used_status != 'USED_WITH_HINT'`），后端自动为该词在 FSRS 中追加一次 `Rating.Easy` 奖励加固；若用户用错词义，标记为需要次日复习。
     * **Tool 2: `log_mistake(category: "PRONUNCIATION" | "GRAMMAR" | "WORD_CHOICE", user_said: str, suggested: str, tip_zh: str)`**
       * **轻微错误（不影响理解的语法小瑕疵或轻微口音）**：AI 在语音里**不要停下来长篇大论说教**，而是采用语言学上的 *Recast（自然重铸）* 技巧——在回应的开头用正确的发音和语法自然地重复一遍用户的意思，同时后台静默调用 `log_mistake`。前端 H5 收到 WebSocket 推下来的 `mistake_logged` 事件后，在屏幕上方优雅地滑出一个**非阻断式的纠错小卡片**（显示：`你刚才说: ... -> 建议表达: ... [发音问题/语法提示]`），并存入数据库。
       * **明显发音错误或重音错位**：因为使用的是原生端到端语音模型（直接输入 PCM 音频波形），模型能听出重音错误（如把 `deprecate` 读成重音在第二音节）或元音吞音。此时 AI 会在回应前温和地插一句口头纠正并慢速示范一次发音，让用户顺口跟读一遍再继续刚才的话题，同时调用 `log_mistake(category="PRONUNCIATION", ...)`。

---

### 5.4 模块四：按需实时 SSE“示例回答”提示器 (`hint_streamer.py`)

#### 需求描述
在语音通话中，如果用户面对 AI 的提问突然卡壳，不知道怎么组织英文句子或怎么把今日目标词用进去，**不需要任何后台预生成**；用户直接点击屏幕上的 `💡 提示示例回答` 按钮，系统通过 **SSE (Server-Sent Events)** 实时流式展示参考回答，并支持点击播放标准发音。

#### 实现细节
1. **交互与数据流**：
   * 后端 `VoiceOrchestrator` 在内存中维护当前通话最近 4 轮的实时转写历史（`recent_transcript`）以及当前活跃窗口的 4 个待考目标词（`active_target_words`）。
   * 当用户点击前端的 `💡 提示示例回答` 按钮时：
     1. 前端建立 SSE 请求：`GET /api/v1/voice/{session_id}/hint-stream`。
     2. 后端立即将当前活跃窗口的目标词标记为 `hint_requested = True`（防止后续用户照着念出来时被误判为“无提示主动掌握”）。
     3. 后端组装轻量 Prompt 调用 `TextLLMProvider.stream_text()`（默认 `deepseek-v4.1-flash`）：
        ```text
        [System]
        你是一个口语实战助攻助手。用户正在进行实时英语语音对话，面对 AI 刚才的提问卡壳了。
        请结合用户的个人背景，直接给出一个地道、自然、口语化的第一人称英文回答示例（1~2句话，15~30词），
        并尽可能自然地融入以下待考目标词中的 1~2 个：{active_target_words}。
        严格按以下格式流式输出（不要任何多余寒暄）：
        EN: <英文示例句子，将用到的目标词用 **词** 包裹>
        ZH: <对应的中文意思>
        ```
     4. 前端通过 SSE 接收流式字符，首字延迟控制在 300~500ms 内，实时渲染在屏幕底部的半透明提示抽屉中。
2. **示例答案点击发音**：
   * 当 SSE 流式输出完毕后（收到 `[DONE]` 事件），前端在示例句子右侧展示一个 `🔊 朗读示范` 按钮（或支持开启“提示生成后自动小声朗读”）。
   * 用户点击 `🔊` 时，前端请求 `POST /api/v1/tts/speak`（传入刚生成的 `EN` 文本），后端调用 `TTSProvider`（默认 `edge-tts`）返回音频流直接播放。**注意**：前端播放提示音频时，自动暂时静音麦克风上行采集（Mute Mic Input），防止提示音被麦克风录进去误触发语音大模型的 VAD 打断。

---

### 5.5 模块五：每日记忆清空与关键记忆沉淀 (`memory_compactor.py`)

#### 需求描述
每天的学习作为一个独立的记忆周期，第二天自动清空当天的冗长对话历史，但自动提炼并保留关键记忆（个人新动态 + 高频发音/语法错误模式）。

#### 实现细节
1. **触发时机**：
   * 每日语音通话点击“结束今日学习”时异步触发，或每日凌晨 `04:00` 定时任务兜底触发。
2. **Compaction 提炼流水线**：
   * 读取今日 `voice_sessions.transcript_json` 与今日所有 `linguistic_mistakes` 记录，以及现有的 `/data/memory/user_profile.md` 和 `/data/memory/error_patterns.md`。
   * 调用 `TextLLMProvider.generate_structured()` 执行记忆归并：
     * **更新 `user_profile.md`**：如果用户在今天的闲聊中提到了新的个人事实、近期计划或工作变动（例如：“今天提到下周要上线一个新的支付微服务”），将其精简追加到个人画像的 `## 近期动态` 章节，以便明天生成例句和话题时具有连续感。
     * **更新 `error_patterns.md`**：分析今日的 `linguistic_mistakes`，按“发音易错点”与“语法/用词盲区”进行频次聚合与去重，保留最核心的 Top 15 条活跃病历。
   * **清空当日会话上下文**：将 `voice_sessions.transcript_json` 清空（置为 `NULL` 释放空间并隔离上下文），次日开启全新 Session 时仅加载精炼后的两个 Markdown 文件与次日 FSRS 词表。

---

## 6. 核心接口契约 (API & WebSocket Protocols)

### 6.1 REST & SSE 接口一览
| 方法 | 路径 | 功能说明 |
| :--- | :--- | :--- |
| `POST` | `/api/v1/wordbooks/import` | 上传 JSON/CSV 词书，初始化 `words` 与 `fsrs_cards` 并触发后台标签批处理 |
| `POST` | `/api/v1/study/daily-plan` | 获取或生成今日学习计划（含 30 新词 + 90 复习词、定制场景例句、4 选 1 选项） |
| `POST` | `/api/v1/study/review-card` | 提交单个单词的背诵结果（传入 `word_id`, `rating`, `duration_ms`），更新 FSRS |
| `GET` | `/api/v1/voice/{session_id}/hint-stream` | **【SSE 接口】** 用户点击“提示示例回答”时触发，流式返回 `EN` 与 `ZH` 示例回答 |
| `POST` | `/api/v1/tts/speak` | 传入任意英文句子（如实时生成的示例回答），返回 MP3 音频流 |
| `POST` | `/api/v1/voice/{session_id}/end` | 结束语音通话，触发每日记忆 Compaction 并清空当日对话上下文 |
| `GET/PUT` | `/api/v1/admin/config` | 读取或热更新各阶段的模型配置（URL、Key、Model Name、每日词数配额） |
| `GET/PUT` | `/api/v1/admin/memory` | 在线查看或手动编辑 `user_profile.md` 与 `error_patterns.md` |

### 6.2 全双工语音 WebSocket 协议 (`WS /api/v1/voice/ws?plan_date=YYYY-MM-DD`)
前后端通过单个 WebSocket 连接复用传输 **二进制音频帧（Binary Frames）** 与 **JSON 控制指令帧（Text Frames）**，最大化降低移动端 H5 解析开销：

* **前端 H5 $\rightarrow$ 后端 Server**：
  * **Binary Frame**：直接发送 `Int16Array` buffer（16kHz, 单声道, 16-bit PCM 裸流，每帧约 100ms 即 3200 bytes）。
  * **Text Frame (JSON)**：
    * `{"type": "client.interrupt"}`：用户手动打断或本地检测到抢话。
    * `{"type": "client.mute", "muted": true}`：用户正在听“示例回答”发音或暂停麦克风。
* **后端 Server $\rightarrow$ 前端 H5**：
  * **Binary Frame**：直接下发模型生成的 24kHz, 单声道, 16-bit PCM 音频块，前端放入环形队列无缝播放。
  * **Text Frame (JSON)**：
    * `{"type": "server.speech_started"}`：通知前端立即清空本地音频播放队列（实现毫秒级打断响应）。
    * `{"type": "server.transcript", "role": "user"|"assistant", "text": "...", "is_final": false}`：实时字幕流。
    * `{"type": "server.target_progress", "active_words": [...], "completed_words": [...]}`：刷新屏幕上的今日目标词激活状态。
    * `{"type": "server.mistake_card", "category": "PRONUNCIATION", "user_said": "...", "suggested": "...", "tip_zh": "..."}`：触发前端顶部非阻断纠错轻提示卡片。

---

## 7. Web H5 前端交互与音频工程细节

### 7.1 四大核心视图设计（移动端优先响应式布局）
1. **首页仪表盘 (`Dashboard`)**：
   * 展示今日学习卡片：`今日新学 (0/30)`、`今日复习 (0/90)`、今日 AI 规划的场景主题预告。
   * 展示 FSRS 记忆持久度概览与未来 7 天复习压力柱状图。
2. **沉浸式背词页 (`StudySession`)**：
   * 顶部：进度条 + 单词大字 + 美式音标 + 发音重播按钮。
   * 中部：专属场景例句卡片（目标词高亮，带独立发音按钮；答题前隐藏中文翻译，答题后展开）。
   * 底部：4 个中文词义选项大按钮（单手拇指热区友好），答对后底部浮出 `模糊(Hard)` / `良好(Good)` / `太简单(Easy)` 快捷修正栏。
3. **实时语音实战页 (`VoiceCall`)**：
   * **顶部状态栏**：通话计时器（目标 20~30 分钟）+ 今日核心词激活进度胶囊（点击可展开查看当前待激活的 4 个目标词及其释义）。
   * **中部交互区**：AI 语音律动光球 + 实时滚动的双语字幕流 + **非阻断式纠错提示飘窗**（出现发音/语法问题时从顶部滑入，5 秒后自动收起至右上角错题收纳盒，绝不打断语音）。
   * **底部操控区**：
     * 左侧：`🎙️ 静音/暂停` 按钮。
     * 中间（核心功能）：**`💡 提示示例回答` 醒目按钮**。点击后从底部弹出半屏卡片，通过 SSE 流式打出地道英文示例与中文翻译，卡片右上角配有一个大号的 **`🔊 听标准发音`** 按钮。
     * 右侧：`📞 结束今日学习` 按钮。
4. **设置与记忆管理页 (`Settings`)**：
   * 可视化表单：随时修改 Text LLM（如切换 `deepseek-v4.1-flash` 或其他模型 URL/Key）、Realtime Voice（切换 `qwen_omni` / `doubao`）、TTS 引擎。
   * 在线 Markdown 编辑器：直接查看和修改 `user_profile.md` 和 `error_patterns.md`。

### 7.2 H5 Web Audio API 关键工程要求（防踩坑指南）
Coding Agent 在实现前端 `usePCMRecorder.ts` 和 `usePCMPlayer.ts` 时必须遵守以下规范：
1. **回声消除与降噪**：调用 `navigator.mediaDevices.getUserMedia` 时必须显式开启硬件级回声消除：
   ```typescript
   audio: {
     sampleRate: 16000,
     channelCount: 1,
     echoCancellation: true,
     noiseSuppression: true,
     autoGainControl: true,
   }
   ```
2. **重采样至 16kHz PCM16**：部分手机浏览器（尤其是 iOS Safari）硬件采样率固定为 44.1kHz 或 48kHz。必须在 `AudioWorkletProcessor` 内实现线性插值降采样至 `16000Hz`，并将 `Float32` 采样点(`-1.0 ~ 1.0`)转换为小端序 `Int16` (`-32768 ~ 32767`) 后通过 WebSocket 发送。
3. **下行 24kHz 流式无缝播放**：收到后端的 24kHz `Int16` 二进制帧后，转换为 `Float32Array`，使用 `AudioContext.createBuffer(1, length, 24000)` 并维护一个 `nextStartTime` 时间游标调度 `AudioBufferSourceNode.start(nextStartTime)`，消除音频分片之间的爆音（Pop/Click noise）。

---

## 8. 生产部署配置 (`Dockerfile` & `Caddyfile`)

### 8.1 多阶段构建 `Dockerfile`（严格使用 `uv --no-dev`）
```dockerfile
# Stage 1: 构建前端 Web H5 静态产物
FROM node:22-alpine AS web-builder
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: 构建 Python 生产环境 (使用 uv 剔除 dev 依赖)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS app-runner
WORKDIR /app

# 开启字节码编译并禁止 uv 缓存以减小镜像体积
ENV UV_COMPILE_BYTECODE=1 \
    UV_NO_CACHE=1 \
    PYTHONUNBUFFERED=1

# 仅复制依赖声明文件并安装生产依赖 (--no-dev 排除 pytest/ruff/mypy)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 复制后端源码与前端构建产物
COPY config.yaml ./
COPY src/ ./src/
COPY --from=web-builder /build/web/dist ./web_dist

# 创建持久化目录
RUN mkdir -p /app/data/audio_cache /app/data/memory /app/data/wordbooks

EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "src.agent_server.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

### 8.2 `Caddyfile`（自动 HTTPS 支持移动端 H5 麦克风）
```caddyfile
{$DOMAIN_NAME:localhost} {
    encode gzip
    reverse_proxy app:8000
}
```

---

## 9. Coding Agent 分步实现执行清单 (Implementation Roadmap)

请 Coding Agent 严格按照以下 5 个 Milestone 顺序推进开发，每完成一个阶段运行 `uv run ruff check .` 与 `uv run pytest` 自检通过后再进入下一阶段：

1. **Milestone 1：脚手架初始化与数据库/FSRS 核心层**
   * 使用 `uv init` 初始化项目，按第 2.3 节配置 `pyproject.toml` 并执行 `uv sync`。
   * 实现 SQLite Async ORM 模型与 `fsrs_service.py`（对接 `py-fsrs`），编写单元测试验证卡片从 `New -> Learning -> Review` 的状态流转与 `Again/Hard/Good/Easy` 四级评分。
   * 初始化 `/data/memory/user_profile.md` 和 `/data/memory/error_patterns.md` 模板文件。
2. **Milestone 2：可插拔模型抽象层与每日智能组局引擎**
   * 实现 `TextLLMProvider`（默认对接 `deepseek-v4.1-flash`）与 `TTSProvider`（默认对接 `edge-tts` 并带本地 MP3 缓存）。
   * 实现词书导入器与 `daily_planner.py`（复习词提取 + 场景聚类选 30 新词 + 定制例句与同词性 4 选 1 生成）。
3. **Milestone 3：实时语音适配器与轻量级 Harness 编排器**
   * 实现 `QwenOmniRealtimeAdapter`（优先）与 `DoubaoRealtimeAdapter`（备选）WebSocket 协议封装。
   * 实现 `voice_orchestrator.py`（滑动窗口目标词注入、`mark_word_used` 与 `log_mistake` 异步 Tool Calling 拦截、FSRS 口语表现联动加分）。
   * 实现 `hint_streamer.py`（按需 SSE 实时流式生成示例回答）与 `memory_compactor.py`（每日记忆提炼与对话重置）。
4. **Milestone 4：前端 Web H5 界面与 Web Audio 实时音频流**
   * 搭建 React + Vite + Tailwind 移动端 H5 界面（Dashboard、背词卡片页、语音通话页、模型与记忆设置页）。
   * 实现 `AudioWorklet` 16kHz PCM 录音上行、24kHz PCM 流式播放队列、VAD 打断清空、SSE 示例答案抽屉及点击发音自动静音麦克风逻辑。
5. **Milestone 5：联调测试与 Docker 生产打包**
   * FastAPI 挂载前端静态资源，编写 `Dockerfile` 与 `docker-compose.yml`，验证 `uv sync --frozen --no-dev` 构建与端到端完整流程。