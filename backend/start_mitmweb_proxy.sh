#!/bin/bash

# 启动 mitmweb 并通过 FastAPI 反向代理访问
# 解决 X-Frame-Options 限制问题

set -e

echo "=========================================="
echo "  启动 mitmweb 反向代理服务"
echo "=========================================="
echo ""

# 激活 conda 环境
source ~/miniconda3/etc/profile.d/conda.sh
conda activate ai-auto-touch

# 配置
DEVICE_ID="${1:-test-device}"
PROXY_PORT="${2:-8091}"
WEB_PORT="${3:-8191}"
HOST="127.0.0.1"  # 只监听本地，通过反向代理访问

echo "配置信息:"
echo "  设备 ID: $DEVICE_ID"
echo "  代理端口: $PROXY_PORT"
echo "  Web 端口: $WEB_PORT"
echo "  监听地址: $HOST (仅本地)"
echo ""

# 检查版本
echo "✓ mitmproxy 版本:"
mitmproxy --version | head -1
echo ""

# 检查端口是否被占用
if lsof -Pi :$WEB_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告: 端口 $WEB_PORT 已被占用"
    echo "正在尝试停止旧进程..."
    lsof -ti:$WEB_PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# 启动 mitmweb
echo "启动 mitmweb..."
echo ""
echo "📝 访问方式:"
echo "  直接访问 (有 X-Frame-Options 限制):"
echo "    http://localhost:$WEB_PORT"
echo ""
echo "  通过反向代理访问 (无限制，可嵌入 iframe):"
echo "    http://localhost:8000/api/v1/mitmproxy/proxy/$DEVICE_ID/"
echo ""
echo "  API 状态检查:"
echo "    http://localhost:8000/api/v1/mitmproxy/device/$DEVICE_ID/status"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 启动 mitmweb
# --listen-host 0.0.0.0: 代理端口监听所有网络接口，允许手机连接
# --web-host 127.0.0.1: Web 界面只监听本地，通过反向代理访问
mitmweb \
  --listen-host 0.0.0.0 \
  --listen-port $PROXY_PORT \
  --web-host $HOST \
  --web-port $WEB_PORT \
  --no-web-open-browser \
  --set block_global=false

