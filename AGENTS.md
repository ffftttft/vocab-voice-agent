# AGENTS.md

## ⚠️ 第一条规则：开发环境 ≠ 生产环境，不要往服务器推垃圾

谁改代码，谁负责部署（别人改的不要替他推）；部署前必须遵守以下规则。

### 环境划分
- **开发环境**：本机（Mac）。所有修改都先在本地完成、本地验证。
- **生产环境**：腾讯云服务器（ssh 别名 `tencent`，目录 `/home/ubuntu/vocab-voice-agent`，域名 https://aixft.top/）。
- 唯一部署方式：仓库根目录执行 `./deploy.sh`（git bundle → 服务器 `reset --hard` → 按需装依赖/构建前端 → 重启 + 健康检查）。不要手动 scp/rsync 文件到服务器，不要在服务器上直接改代码。
- `deploy.sh` 推送的是 **git 里已提交的内容**，所以「不推垃圾」= **不提交垃圾**。

### Python 依赖：用 uv 管理，严格区分 dev / 生产
- 只用 `uv`，不要用 `pip install`，不要手改 `uv.lock`。
- 加生产依赖：`uv add <pkg>`；加开发工具（测试、lint、类型检查、调试用）：`uv add --dev <pkg>`，放进 `[dependency-groups] dev`。
- 本地：`uv sync`（默认带 dev 组）。
- 生产：`uv sync --frozen --no-dev --no-install-project`，运行用 `uv run --no-dev ...`。生产环境永远不装 dev 包。
- 部署前验证生产依赖能独立跑：`uv sync --frozen --no-dev --no-install-project`。

### 前端（web/）
- 只把源码和锁文件入库；`web/node_modules/`、`web/dist/`、`web/.vite/` 不入库，服务器上自己构建。
- 开发专用的东西（mock 数据、调试面板、dev server 配置、测试页）不能进生产构建，需要时用 `import.meta.env.DEV` 隔离。

### 不许提交 / 推到服务器的东西
- `.env`、任何 API Key 或密钥（生产 `.env` 只在服务器上改，部署不覆盖）。
- `.venv*/`、`node_modules/`、`dist/`、各种 cache、`*.log`、`tmp/`。
- `data/` 下的运行时数据（数据库、音频缓存、词书原始文件、记忆文件）。
- 验证截图、调试产物、临时脚本，如 `docs/design/**/verify/`、`docs/design/**/impl-verify/`。
- **截图目录绝对不要传上服务器**：`impl-verify/`、`verify/` 只留在本地。服务器只保留把服务跑起来必需的东西（源码、`uv.lock`、生产 `.venv`、`web/node_modules`、`web/dist`、运行时 `data/`、`.env`），其余一律不要。
- `data/` **入库仅限** `.gitkeep` 与 `*.example.md` 占位；真实 db / 音频缓存 / 词书 / 记忆文件只留本地或服务器运行时，绝不提交。
- 服务器上因 `UV_DEFAULT_INDEX`（国内镜像）跑 `uv sync` 后，`uv.lock` 可能被改写 registry URL：立刻 `git checkout -- uv.lock` 还原，**不要**把服务器上的 lock 改动提交或拷回仓库。运行产生的 `__pycache__/` 可留，勿入库。
- 设计稿大文件（`docs/design/` 下的 png/html 原型）如无必要不入库，入库前先确认。

### 部署前检查清单
1. `uv run pytest -q` 全绿，`uv run ruff check .` 干净，前端 `pnpm -C web build`（或项目惯用的 pnpm 构建命令）能过。不要在服务器上用 npm 装依赖，避免生成 `package-lock.json`。
2. `git status` 逐个看要提交的文件，确认没有上面列出的垃圾。
3. 提交后再执行 `./deploy.sh`，看健康检查通过。

---

更多背景见 `HANDOFF.md`、`STATUS.md`、`README.md`。
