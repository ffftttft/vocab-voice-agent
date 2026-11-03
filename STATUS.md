# 状态看板 (STATUS)

> **换会话后第一件事：读这个文件。** 它记录当前进度、下一步、以及未决事项。
> 每次完成一个里程碑或做出重要裁决，必须更新本文件并提交。

**最后更新**：2026-11-03
**当前里程碑**：M2 进行中
**测试状态**：83 passed（`uv run pytest`）

---

## 一句话现状

地基（配置/DB/FSRS/Provider/词书/记忆）已全部落地并有测试覆盖。剩下的是把它们串成 API 与界面。

---

## 里程碑进度

| # | 里程碑 | 状态 | 备注 |
|---|---|---|---|
| 0 | 需求澄清 + 技术核验 | ✅ 完成 | 见 `docs/superpowers/specs/` |
| 1 | 脚手架 + DB + FSRS 核心层 | ✅ 完成 | 30 测试 |
| 2 | Provider 抽象 + 词书 + 记忆 | ✅ 完成 | 53 测试 |
| 2.5 | 每日组局引擎（daily_planner） | ⬜ 未开始 | **下一步** |
| 3 | 背词 API + 最小前端 | ⬜ 未开始 | |
| 4 | 实时语音适配器 + Orchestrator | ⬜ 未开始 | 依赖百炼 key |
| 5 | SSE 提示 + 记忆 Compaction | ⬜ 未开始 | |
| 6 | 完整前端四视图 | ⬜ 未开始 | |
| 7 | Docker 打包 | ⬜ 未开始 | 域名可后置 |

---

## 下一步具体做什么

**Task 2.5：`src/agent_server/harness/daily_planner.py`**

按 SPEC 5.1 的 Step 1-4 实现，但**必须遵守已裁决的偏差**：

1. **Step 1 提取到期复习词** → 用 `repos.get_due_review_words()`（已实现）
2. **Step 2 场景聚类选新词**：
   - ⚠️ **不要**写 `WHERE state == 0`，用 `repos.get_new_word_candidates_by_topics()`
   - 统计今日复习词的 `topic_tags` 频次 → 取 top 标签
   - 从新词候选池按标签筛 80 个 → 调 LLM 选 30 个（**当前配置是 15**，读 `config.yaml`）
   - LLM 同时产出 `scenario_title` / `scenario_brief`
3. **Step 3 批量生成例句 + 4 选 1**：每批 15 个词并发，用 `generate_structured`
   - 例句 10~22 词，符合 `user_profile.md` 与场景
   - 4 个选项**词性必须一致**
   - 3 个干扰项：1 形近词 + 1 反义/近义 + 1 同场景词
4. **Step 4 音频预热**：并发调 `TTSProvider.synthesize_to_file()`

**写完必须**：`uv run pytest` 全绿 + `uv run ruff check .` 干净，再更新 STATUS.md。

---

## 已完成的关键裁决（改代码前必读）

这些是对 `SPEC.md` 的**有意偏离**，不是 bug。详情见 `docs/superpowers/specs/2026-11-03-vocab-voice-agent-design.md`。

| # | 裁决 | 原因 |
|---|---|---|
| D1 | **新卡判定用 `stability IS NULL`，不用 `state == 0`** | 实测 py-fsrs 6.3.2 无 `State.New`，`0` 不存在。照抄 spec 会导致每日新词恒为 0 |
| D2 | `reps` / `lapses` 由 ORM 自行维护 | py-fsrs 的 `Card` 没有这两个字段 |
| D3 | 每日新词 15（spec 是 30） | 用户自述「完全开不了口」，30 会崩 |
| D4 | 语音通话目标 10 分钟（spec 是 20-30） | 同上，且可随熟练度上调 |
| D5 | 语音目标词 12 个（spec 是 22） | 同上 |
| D6 | 所有业务表带 `user_id`，MVP 恒为 `local-user` | 为将来商业化留迁移口子，成本极低 |
| D7 | MVP 只实现 `qwen_omni` 语音适配器 | 豆包备选需要真实 key 才能验，MVP 不写 |
| D8 | 路线改为垂直切片（非 spec 的严格 M1→M5） | 用户要求「全部完成后才开始用」，切片只为便于交接 |

---

## 环境事实（已实测，勿再猜）

| 项 | 值 |
|---|---|
| Python | 3.12.13 |
| uv | 0.12.7（`uv sync` 带 dev，`uv sync --no-deps --no-dev` 部署） |
| fsrs | **6.3.2** — State 只有 Learning(1)/Review(2)/Relearning(3) |
| SQLAlchemy | 2.1.6 |
| FastAPI | 0.162.0 |
| openai | 3.42.1 |
| edge-tts | 7.3.1 |
| 布局 | `src/agent_server/`，无 build-system，靠 cwd 在 sys.path = **`src.agent_server.xxx`** |
| 中文路径 | `/Users/ft/Desktop/Project/02_项目/language`，已确认 uv/git 正常 |

---

## 用户已确认的需求偏好

1. **真的天天要用** —— 但要求**全部实现完成**后才开始用
2. 会**随时切换会话** → 交接文档必须能自续
3. 技术栈：Python 后端 + React H5 前端（SPEC 已定）
4. 文本模型：走**中转站**（成本优先），倾向 `deepseek-v4.1-flash`
5. 语音模型：走**官方**阿里百炼（key 已有）
6. 词书：暂无，M2 先用几十个测试词跑通
7. 部署：服务器有，域名暂缺，**不阻塞开发**
8. 英语水平：**完全开不了口**，程序员语境，目标跳槽外企
9. 产出训练：**先放缓节奏，不加新模态**（用户明确选择）

---

## 未决事项

- [ ] 中转站的 `base_url` / `api_key` / 实际可用模型名 —— 需要用户提供后填入 `.env`
- [ ] 百炼的 API Key —— 同上
- [ ] 是否要接入 cloudflared 做手机真机测试（M4 时确认）
