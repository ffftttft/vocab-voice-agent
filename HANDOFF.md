# 交接文档 (HANDOFF)

> **任何新会话从这里开始。** 读完这一份 + `STATUS.md`，你就能无缝接手，
> 不需要看任何历史对话。

---

## 这个项目是什么

一套**纯自用的英语学习 Agent 系统**，单机部署。核心闭环：

```
白天  →  FSRS 场景化背单词（AI 按你的画像和当日场景定制例句 + 4选1）
晚上  →  10 分钟全双工实时语音实战，AI 引导你把今天的词说出来
次日  →  把对话压成两份 Markdown（个人画像 + 语言病历），清空原始转写
```

用户是**程序员**，想跳槽外企，自述**完全开不了口**（会读简单单词、不会造句、词汇量一般）。
这个背景决定了所有难度参数都调低了，见 STATUS.md 的 D3-D5。

---

## 唯一事实来源的层级

发生冲突时，按这个优先级裁决：

```
用户的最新口头指令
   ↓
docs/superpowers/specs/2026-11-03-vocab-voice-agent-design.md   ← 设计文档（含裁决记录）
   ↓
STATUS.md                                                         ← 当前进度与已裁决偏差
   ↓
docs/SPEC.md                                                      ← 用户的原始规格（有已知缺陷）
```

**`docs/SPEC.md` 是原始需求，不是绝对真理。** 它有两处已被实测推翻的地方，
照抄会写出跑不通的代码（详见下节 D1）。

---

## 立刻要避开的坑

### 坑 1：`state == 0` 选新词（会导致功能完全失效）

`SPEC.md` 5.1 Step 2 写 `WHERE fsrs_cards.state == 0` 挑新词。

**这是错的。** 实测 `fsrs==6.3.2`：

```python
>>> from fsrs import State
>>> [s.name for s in State]
['Learning', 'Review', 'Relearning']     # 没有 New，值只有 1/2/3
```

新卡 `Card()` 默认就是 `state=Learning(1), step=0, stability=None`。

正确写法：

```python
# 新词
where(FSRSCard.stability.is_(None))
# 到期复习词
where(FSRSCard.stability.is_not(None), FSRSCard.due <= now)
```

已封装好，直接用 `src/agent_server/db/repos.py`：
- `get_due_review_words()`
- `get_new_word_candidates()`
- `get_new_word_candidates_by_topics()`

### 坑 2：`uv run` 的 `--no-dev` 参数位置

```bash
uv sync --frozen --no-dev --no-install-project      # 装生产依赖
uv run --no-dev uvicorn ...                          # 运行时排除 dev 组
```

`--no-install-project` 是必需的（本项目无 build-system，装不了项目本身）。

### 坑 3：import 路径

项目是 `src/` 布局但**没有 build-system**，所以：

✅ `from src.agent_server.config import settings`
❌ `from agent_server.config import ...`

uvicorn 启动目标同理：`src.agent_server.main:app`。

### 坑 4：SQLite 并发

必须开 WAL，否则「背词写入」和「语音会话写入」会撞 `database is locked`。
`db/session.py` 的 `build_engine()` 已经在连接事件里设好了
（`journal_mode=WAL` + `busy_timeout=5000`），**不要绕过它直接 `create_async_engine`**。

### 坑 5：记忆文件不能被整体重写

`data/memory/*.md` 是**用户可手改**的文件。Compaction 只能追加/裁剪
（`MemoryStore.append_recent_events()` / `merge_error_patterns()`），
**绝不能** `write_text()` 覆盖全文，否则会抹掉用户手写的内容。

---

## 目录结构（实际，非 spec 的理想图）

```
language/
├── pyproject.toml            # PEP 735 dependency-groups: dev / 生产
├── uv.lock                   # 已提交
├── config.yaml               # 模型路由 + 学习计划参数
├── STATUS.md                 # ← 进度看板
├── HANDOFF.md                # ← 本文件
├── docs/
│   ├── SPEC.md               # 用户原始规格（有已知缺陷）
│   └── superpowers/
│       ├── specs/            # 设计文档（裁决记录在此）
│       └── plans/            # 实现计划
├── data/
│   ├── app.db                # SQLite（gitignored）
│   ├── audio_cache/*.mp3     # TTS 缓存（gitignored）
│   ├── wordbooks/            # 原始词书（gitignored）
│   └── memory/               # user_profile.md / error_patterns.md（gitignored，有 example 模板）
├── src/agent_server/
│   ├── config.py             # ✅ Pydantic Settings + ${VAR:default} 替换
│   ├── db/
│   │   ├── models.py         # ✅ 7 张表
│   │   ├── session.py        # ✅ Async engine + WAL
│   │   └── repos.py          # ✅ 选词/统计/计划查询
│   ├── providers/
│   │   ├── base.py           # ✅ 三大抽象接口
│   │   ├── registry.py       # ✅ 热切换工厂
│   │   ├── llm/openai_compat.py   # ✅ 结构化生成 + 自愈重试
│   │   ├── voice/            # ⬜ M4
│   │   └── tts/edge_tts_impl.py   # ✅ sha256 磁盘缓存
│   ├── harness/
│   │   ├── daily_planner.py       # ⬜ 下一步
│   │   ├── voice_orchestrator.py  # ⬜ M4
│   │   ├── hint_streamer.py       # ⬜ M5
│   │   └── memory_compactor.py    # ⬜ M5
│   ├── services/
│   │   ├── fsrs_service.py   # ✅ 评级映射 + 状态流转
│   │   ├── memory_store.py   # ✅ 追加式 Markdown 记忆
│   │   └── wordbook_loader.py# ✅ JSON/CSV 导入
│   └── api/                  # ⬜ M3
├── tests/                    # ✅ 83 个测试
└── web/                      # ⬜ M3/M6
```

---

## 常用命令

```bash
cd /Users/ft/Desktop/Project/02_项目/language

uv sync                              # 装依赖（含 dev）
uv run pytest -q                     # 跑测试
uv run pytest tests/test_fsrs_service.py -v   # 单文件
uv run ruff check .                  # 静态检查
uv run ruff format .                 # 格式化

# 开发服务器（M3 后可用）
uv run uvicorn src.agent_server.main:app --reload --port 8000

# 生产依赖验证（部署前）
uv sync --frozen --no-dev --no-install-project
```

---

## 工作流要求（用户明确要求）

1. **TDD**：先写失败测试，看着它失败，再写实现。测试必须实际运行并读输出，
   「应该能过」不算证据。
2. **每个里程碑结束必须**：
   - `uv run pytest -q` 全绿
   - `uv run ruff check .` 干净
   - 更新 `STATUS.md`
   - `git commit`（用 `feat(...)` / `fix(...)` 前缀）
3. **代码注释用中文**，写「为什么」而不是「是什么」。
4. **禁止硬编码模型**：任何模型调用都必须经 `ProviderRegistry`。
5. **不允许**在业务代码里 `import openai` / `import edge_tts` —— 只能出现在 `providers/` 下。

---

## 接手后的第一步

1. `uv sync && uv run pytest -q` —— 确认 83 测试全绿
2. 读 `STATUS.md` 的「下一步具体做什么」
3. 开干

---

## 需要用户提供才能继续的东西

| 项 | 用于 | 阻塞哪个里程碑 |
|---|---|---|
| 中转站 `base_url` + `api_key` | 文本模型 | 不阻塞开发（可用假 provider 测），阻塞真实验收 |
| 百炼 API Key | 实时语音 | **阻塞 M4 真实验收** |
| 域名 | HTTPS / 手机麦克风 | 阻塞上线，不阻塞开发 |

配置方式：复制 `.env.example` 为 `.env` 填入，或直接改 `config.yaml`。
`config.yaml` 支持 `${ENV_VAR:默认值}` 语法。
