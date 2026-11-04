#!/usr/bin/env bash
# 一键部署到生产服务器。
#
# 用法：./deploy.sh
# 前提：~/.ssh/config 里有 Host tencent（43.136.173.192，ubuntu 用户免密）
#
# 流程：
#   1. git bundle 打包整个仓库（含历史）→ scp 到服务器
#   2. 服务器 git fetch + reset --hard（不引入第二个 git remote 体系）
#   3. 依赖清单变了才 uv sync --no-dev（生产环境永远不含 dev 包）
#   4. web/ 变了才重新构建前端（vite 构建在 2G 机器上限制堆内存）
#   5. 重启 systemd 服务并做健康检查，失败自动打印日志
set -euo pipefail

HOST="${DEPLOY_HOST:-tencent}"

cd "$(dirname "$0")"

if ! git diff --quiet 2>/dev/null; then
  echo "!! 工作区有未提交改动。部署的是仓库内容，请先 git commit。"
  git status --short
  exit 1
fi

BUNDLE=$(mktemp /tmp/vocab-deploy-XXXXXX.bundle)
trap 'rm -f "$BUNDLE"' EXIT
git bundle create "$BUNDLE" --all

echo "==> 传输 $(du -h "$BUNDLE" | cut -f1) 到 $HOST"
scp -q "$BUNDLE" "$HOST:/tmp/vocab.bundle"

ssh -o BatchMode=yes "$HOST" bash -s <<'REMOTE'
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
export UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
cd ~/vocab-voice-agent

PREV=$(git rev-parse HEAD)
git fetch -q /tmp/vocab.bundle main
git reset --hard -q FETCH_HEAD
rm -f /tmp/vocab.bundle
echo "==> 代码已更新: ${PREV:0:7} -> $(git rev-parse --short HEAD)"

if ! git diff --quiet "$PREV" HEAD -- pyproject.toml uv.lock 2>/dev/null; then
  echo "==> 依赖清单变化，安装生产依赖（--no-dev）"
  uv sync --frozen --no-dev --no-install-project
fi

if ! git diff --quiet "$PREV" HEAD -- web/ 2>/dev/null; then
  echo "==> 前端变化，构建（限制 1G 堆内存）"
  (cd web && NODE_OPTIONS=--max-old-space-size=1024 npm run build)
fi

# 同步 Caddy 配置（域名/反代规则变更时生效）
if ! cmp -s /etc/caddy/Caddyfile "$HOME/vocab-voice-agent/Caddyfile" 2>/dev/null; then
  echo "==> Caddy 配置有变化，同步并重载"
  sudo cp "$HOME/vocab-voice-agent/Caddyfile" /etc/caddy/Caddyfile
  sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 && sudo systemctl reload caddy
fi

sudo systemctl restart vocab-agent
# uvicorn 冷启动约 10s（导入全部依赖），轮询而不是固定 sleep
for i in $(seq 1 20); do
  if curl -sf --max-time 5 http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1; then
    echo "==> ✓ 服务正常（${i}s）"
    exit 0
  fi
  sleep 1
done
echo "!! 健康检查失败，最近日志："
sudo journalctl -u vocab-agent -n 30 --no-pager
exit 1
REMOTE

echo "==> 部署完成: http://43.136.173.192:8000/"
