#!/bin/bash
# ABOUTME: 服务器部署/启动脚本（生产环境）
# 用法：
#   首次部署：bash deploy.sh
#   更新部署：bash deploy.sh（会拉取最新代码、重新安装依赖并构建）
#   仅重启：RESTART_ONLY=true bash deploy.sh
# 环境变量：PORT（默认 3001）

set -Eeuo pipefail

# ============ 配置 ============
PORT="${PORT:-3001}"
APP_NAME="video-toolbox"
RESTART_ONLY="${RESTART_ONLY:-false}"
WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${WORKSPACE}"

echo "======================================"
echo "  VidPop 视频工具箱 - 部署脚本"
echo "  端口: ${PORT}"
echo "  目录: ${WORKSPACE}"
echo "======================================"

# 1. 更新代码（如仓库目录且有远端）
if [ "${RESTART_ONLY}" != "true" ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[1/5] 拉取最新代码..."
  git pull --ff-only || echo "git pull 失败（非 ff 或无远端），继续使用当前代码"
else
  echo "[1/5] 跳过代码拉取"
fi

# 2. 安装依赖
if [ "${RESTART_ONLY}" != "true" ]; then
  echo "[2/5] 安装依赖（pnpm）..."
  pnpm install --prefer-frozen-lockfile
else
  echo "[2/5] 跳过依赖安装"
fi

# 3. 构建
if [ "${RESTART_ONLY}" != "true" ]; then
  echo "[3/5] 构建前端 + 打包服务端..."
  pnpm run build
else
  echo "[3/5] 跳过构建"
fi

# 4. 启动（优先 PM2，其次 nohup 后台）
echo "[4/5] 启动服务..."
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
    pm2 restart "${APP_NAME}" --update-env
  else
    PORT="${PORT}" pm2 start dist-server/server.js --name "${APP_NAME}" --update-env
  fi
  pm2 save || true
  echo "已用 PM2 启动：pm2 logs ${APP_NAME} 查看日志"
else
  mkdir -p logs
  if [ -f "logs/app.pid" ] && kill -0 "$(cat logs/app.pid)" 2>/dev/null; then
    echo "停止旧进程 (pid=$(cat logs/app.pid))..."
    kill "$(cat logs/app.pid)" 2>/dev/null || true
    sleep 1
  fi
  PORT="${PORT}" nohup node dist-server/server.js > logs/app.log 2>&1 &
  echo $! > logs/app.pid
  echo "已用 nohup 后台启动 (pid=$(cat logs/app.pid))，日志: logs/app.log"
fi

# 5. 健康检查
echo "[5/5] 健康检查..."
sleep 2
if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "部署成功！访问地址: http://<服务器IP>:${PORT}"
  curl -s "http://127.0.0.1:${PORT}/api/health" || true
  echo ""
else
  echo "健康检查未通过，请查看日志确认启动状态"
  exit 1
fi
