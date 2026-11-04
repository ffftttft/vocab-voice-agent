# 状态看板 (STATUS)

> **换会话后第一件事：读这个文件。** 它记录当前进度、下一步、以及未决事项。
> 每次完成一个里程碑或做出重要裁决，必须更新本文件并提交。

**最后更新**：2026-11-04
**当前状态**：**已部署到生产服务器并外网可达**（http://43.136.173.192:8000/），255 测试通过。等待真实 API Key 做端到端验收
**测试状态**：`uv run pytest` → 255 passed；`uv run ruff check .` → All checks passed

---

## 一句话现状

代码层面已完成：配置、DB、FSRS、Provider 抽象、词书导入、组局引擎、背词状态机、
语音编排、SSE 提示、记忆压缩、四视图前端、Web Audio 链路、Docker 部署。
**缺的只是真实 API Key，用来做最后的人工验收。**

---

## 里程碑进度

| # | 里程碑 | 状态 | 测试 |
|---|---|---|---|
| 0 | 需求澄清 + 技术核验 | ✅ 完成 | — |
| 1 | 脚手架 + DB + FSRS 核心层 | ✅ 完成 | 30 |
| 2 | Provider 抽象 + 词书 + 记忆 | ✅ 完成 | 53 |
| 3 | 每日组局引擎（daily_planner） | ✅ 完成 | 23 |
| 4 | 背词状态机（study_service） | ✅ 完成 | 30 |
| 5 | 语音编排（orchestrator） | ✅ 完成 | 42 |
| 6 | SSE 提示 + 记忆压缩 | ✅ 完成 | 24 |
| 7 | REST API + WebSocket | ✅ 完成 | 25 |
| 8 | Qwen-Omni 实时语音适配器 | ✅ 完成 | 19 |
| 9 | React H5 四视图 + Web Audio | ✅ 完成 | 构建通过 |
| 10 | Docker + Caddy 部署配置 | ✅ 完成 | 生产模式已验证 |

---

## 已实际验证的事项（不是"应该能跑"）

| 验证项 | 方式 | 结果 |
|---|---|---|
| 服务真实启动 | `uvicorn` 起进程 + curl | ✅ 健康检查 200 |
| 词书导入 | 真实 HTTP 上传 6 词 | ✅ 全部入库并建卡 |
| 完整计划生成 | 假 LLM 走完整链路 | ✅ 场景/例句/4选1/音频全生成 |
| 背词答题 | 浏览器真实点击 | ✅ 答对展开译文、答错重排队尾 |
| 重排队尾 | 查询队列顺序 | ✅ 答错词沉底，requeue=1 |
| TTS 真实合成 | Edge-TTS 无 key | ✅ 产出 4.9K MP3，二次请求 13ms 命中缓存 |
| 前端渲染 | ego-browser 真实浏览器 | ✅ 四个页面均正确渲染 |
| 生产依赖隔离 | `uv sync --no-dev` | ✅ pytest/ruff/mypy 已剔除，运行时依赖齐全 |
| 生产模式启动 | `uv run --no-dev uvicorn` | ✅ 正常启动 + 静态托管 |
| WS 协议翻译 | 本地假 DashScope 服务 | ✅ session.update/audio/transcript/tool 事件全对 |

---

## 生产部署（2026-11-04 已完成）

| 项 | 值 |
|---|---|
| 服务器 | 腾讯云轻量（成都）43.136.173.192，Ubuntu 24.04，2核2G + 1.9G swap |
| SSH | `ssh tencent`（ubuntu 免密 sudo）/ `ssh tencent-root` |
| 应用目录 | `/home/ubuntu/vocab-voice-agent` |
| 服务 | `sudo systemctl {status\|restart} vocab-agent`（开机自启、崩溃自动重启、MemoryMax=1G） |
| 访问 | **https://aixft.top/** （Let's Encrypt 证书，2027-02-02 到期，Caddy 自动续期） |
| 备用访问 | http://43.136.173.192:8000/ （直连，调试用） |
| HTTPS | Caddy 2.11.8 反代 127.0.0.1:8000，`isSecureContext: true`（**手机麦克风前提已满足**） |
| 域名 | `aixft.top` / `www.aixft.top` → 43.136.173.192（阿里云 DNS） |
| Python 依赖 | uv 0.13.7 + `uv sync --frozen --no-dev`，**dev 包已验证全部剔除** |
| PyPI 源 | `UV_DEFAULT_INDEX=清华镜像`（systemd 环境已配，直连 PyPI 会慢到超时） |
| 前端 | node 22 + npm（npmmirror），`web/dist` 在服务器上构建，不入库 |
| 密钥 | `/home/ubuntu/vocab-voice-agent/.env`（0600，untracked，**部署不会覆盖**） |

### 改动后推送服务器（标准流程）

```bash
# 本地：改代码 → 测试 → 提交
uv run pytest -q && uv run ruff check .
git add -A && git commit -m "fix: ..."

# 一键部署（bundle → 服务器 fetch/reset → 按需 uv sync → 按需前端构建 → 重启+健康轮询）
./deploy.sh
```

### ⚠️ 部署会覆盖的东西

- `config.yaml` 是 **tracked 文件**：`deploy.sh` 的 `git reset --hard` 会把它打回仓库版本。
  **在服务器上直接改 config.yaml 或用 admin 接口改配置都会丢。**
  持久配置一律写 `.env`（untracked，部署保留）。
- `data/`（app.db、audio_cache、memory）untracked，部署不动 ✓

### 线上已验证

- 健康检查/首页/SPA 路由/docs 全部 200
- `/.env`、`/config.yaml`、`/src/`、`/data/`、`/.git/`、目录穿越 全部 404（安全修复 a96ef7d）
- admin 配置接口返回的 api_key 已掩码
- HTTPS 证书签发成功，`ssl_verify_result: 0`，浏览器 `isSecureContext: true`
- `navigator.mediaDevices.getUserMedia` 与 `AudioWorklet` 在 HTTPS 下均可用

### 域名解析（aixft.top，2026-11-04 整理）

| 记录 | 指向 | 用途 |
|---|---|---|
| `@` / `www` | 43.136.173.192 | **本项目**（vocab-agent） |
| `yantu` / `yantu-admin` | 47.108.233.32 | 研图项目（保留） |
| ~~`aixft` / `vnc` / `bosshunter`~~ | ~~47.109.39.113~~ | **已删除**（刷题项目，用户确认无关） |

另外两条历史记录原指向 8.137.49.216 —— 那台已于 2026-10-27 到期停用，现已改指向本项目服务器。

---

## 剩余工作（按优先级）

### 1. 真实 API Key 验收（阻塞在用户）

- [ ] 中转站 `base_url` + `api_key` + 实际模型名 → 填**服务器上的** `.env`（`ssh tencent` 后编辑 `/home/ubuntu/vocab-voice-agent/.env`），然后 `sudo systemctl restart vocab-agent`
- [ ] 阿里百炼 `api_key` → 同上 `VOICE_API_KEY`

拿到后必须实测：

1. 真实 LLM 生成的例句是否**真的像程序员会说的话**（这是产品成败的核心指标）
2. 4 选 1 的干扰项是否真的有迷惑性（假数据看不出来）
3. 语音通话的延迟、打断手感、Recast 纠错是否自然
4. `qwen-omni` 的**实际事件名是否与 `qwen_omni.py` 中的映射一致**
   —— 这一条风险最高，因为我是按 DashScope 公开文档实现的，
   `input_audio_transcription.delta` 这类事件名可能随版本变化。
   **若不一致，只改 `_translate()` 方法里的字符串映射即可，不用动其它代码。**

### 2. 手机真机验证

- [ ] cloudflared 隧道 + 手机访问，确认麦克风权限与音频延迟
- [ ] iOS Safari 的重采样是否正常（AudioWorklet 在 iOS 上行为有差异）

### 3. 部署上线（等域名）

- [ ] 买域名 → 填 `DOMAIN_NAME` → `docker compose up -d --build`

---

## 已完成的关键裁决（改代码前必读）

这些是对 `docs/SPEC.md` 的**有意偏离**，不是 bug。

| # | 裁决 | 原因 |
|---|---|---|
| D1 | **新卡判定用 `stability IS NULL`** | 实测 py-fsrs 6.3.2 无 `State.New`/0。照抄会让每日新词恒为 0 |
| D2 | `reps`/`lapses` 由 ORM 维护 | py-fsrs 的 `Card` 没有这两个字段 |
| D3 | 每日新词 15（spec 30） | 用户自述「完全开不了口」 |
| D4 | 语音 10 分钟（spec 20-30） | 同上 |
| D5 | 语音目标词 12（spec 22） | 同上 |
| D6 | 所有表带 `user_id`，恒为 `local-user` | 为将来商业化留迁移口子 |
| D7 | 只实现 `qwen_omni` | 豆包无 key 无法验收，不写空壳 |
| D8 | 垂直切片路线 | 用户要求全部完成才用，切片便于交接 |
| D9 | 提示按钮是**主路径**而非辅助 | 用户选择「先放缓节奏，不加新模态」后的替代方案 |

---

## 环境事实（已实测）

| 项 | 值 |
|---|---|
| Python | 3.12.13 |
| uv | 0.12.7 |
| fsrs | **6.3.2** — State 只有 Learning(1)/Review(2)/Relearning(3) |
| SQLAlchemy | 2.1.6 / FastAPI 0.162.0 / openai 3.42.1 / edge-tts 7.3.1 |
| Node | 26.7.0 / pnpm 11.24.0 |
| 布局 | `src/agent_server/`，无 build-system → import 用 `src.agent_server.xxx` |

---

## 用户已确认的需求偏好

1. **真的天天要用**，会在**全部完成后**才开始使用
2. 会**随时切换会话** → 本文件与 HANDOFF.md 必须随时可自续
3. 文本模型走**中转站**（成本优先），倾向 `deepseek-v4.1-flash`
4. 语音模型走**官方**阿里百炼（key 已有，待提供）
5. 词书暂无，先用测试词
6. 部署：服务器有，域名暂缺，**不阻塞开发**
7. 英语水平：**完全开不了口**，程序员语境，目标跳槽外企
8. 产出训练：**先放缓节奏，不加新模态**

---

## 未决事项

- [ ] 真实 LLM/语音 Key（见上）
- [ ] qwen-omni 实际事件名可能与实现不一致（验收时优先确认）
- [ ] 是否接入 cloudflared 做手机测试
- [ ] 词书来源（用户后续提供）
