#!/bin/bash

# mitmproxy 反向代理集成测试脚本
# 一键启动所有服务并测试

set -e

echo "=========================================="
echo "  mitmproxy 反向代理集成测试"
echo "=========================================="
echo ""

# 激活 conda 环境
source ~/miniconda3/etc/profile.d/conda.sh
conda activate ai-auto-touch

# 配置
DEVICE_ID="test-device"
PROXY_PORT=8091
WEB_PORT=8191
API_PORT=8000
TEST_PORT=8192

echo "📋 测试配置:"
echo "  设备 ID: $DEVICE_ID"
echo "  代理端口: $PROXY_PORT"
echo "  Web 端口: $WEB_PORT"
echo "  API 端口: $API_PORT"
echo "  测试页面端口: $TEST_PORT"
echo ""

# 检查端口占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  端口 $port 已被占用"
        return 1
    fi
    return 0
}

# 停止旧进程
cleanup() {
    echo ""
    echo "🧹 清理旧进程..."
    
    # 停止 mitmweb
    pkill -f "mitmweb.*$WEB_PORT" 2>/dev/null || true
    
    # 停止测试服务器
    pkill -f "http.server $TEST_PORT" 2>/dev/null || true
    
    sleep 1
    echo "✓ 清理完成"
}

# 注册信号处理
trap cleanup EXIT INT TERM

# 清理旧进程
cleanup

echo ""
echo "🚀 启动服务..."
echo ""

# 1. 启动 mitmweb
echo "1️⃣  启动 mitmweb (端口 $WEB_PORT)..."
mitmweb \
  --listen-port $PROXY_PORT \
  --web-port $WEB_PORT \
  --web-host 127.0.0.1 \
  --no-web-open-browser \
  --set block_global=false \
  > /tmp/mitmweb.log 2>&1 &

MITMWEB_PID=$!
sleep 2

if ps -p $MITMWEB_PID > /dev/null; then
    echo "   ✓ mitmweb 启动成功 (PID: $MITMWEB_PID)"
else
    echo "   ✗ mitmweb 启动失败"
    cat /tmp/mitmweb.log
    exit 1
fi

# 2. 检查 FastAPI 是否运行
echo ""
echo "2️⃣  检查 FastAPI 后端..."
if curl -s http://localhost:$API_PORT/ > /dev/null 2>&1; then
    echo "   ✓ FastAPI 正在运行"
else
    echo "   ⚠️  FastAPI 未运行，请在另一个终端启动:"
    echo "      cd backend && python main.py"
    echo ""
    echo "   按 Enter 继续（假设你已经启动了 FastAPI）..."
    read
fi

# 3. 注册 mitmweb
echo ""
echo "3️⃣  注册 mitmweb 到反向代理..."
python register_mitmweb.py register \
  --device-id $DEVICE_ID \
  --proxy-port $PROXY_PORT \
  --web-port $WEB_PORT \
  --api-url http://localhost:$API_PORT

# 4. 启动测试服务器
echo ""
echo "4️⃣  启动测试页面服务器 (端口 $TEST_PORT)..."
python3 -m http.server $TEST_PORT --directory . > /tmp/test_server.log 2>&1 &
TEST_SERVER_PID=$!
sleep 1

if ps -p $TEST_SERVER_PID > /dev/null; then
    echo "   ✓ 测试服务器启动成功 (PID: $TEST_SERVER_PID)"
else
    echo "   ✗ 测试服务器启动失败"
    exit 1
fi

# 5. 测试连接
echo ""
echo "🧪 测试连接..."
echo ""

# 测试直接访问
echo "测试 1: 直接访问 mitmweb"
if curl -s -I http://localhost:$WEB_PORT/ | grep -q "X-Frame-Options"; then
    echo "   ✓ 直接访问有 X-Frame-Options 限制（预期）"
else
    echo "   ⚠️  直接访问没有 X-Frame-Options（意外）"
fi

# 测试反向代理
echo ""
echo "测试 2: 反向代理访问"
if curl -s -I http://localhost:$API_PORT/api/v1/mitmproxy/proxy/$DEVICE_ID/ | grep -q "access-control-allow-origin"; then
    echo "   ✓ 反向代理已添加 CORS 头（预期）"
else
    echo "   ⚠️  反向代理没有 CORS 头（意外）"
fi

if curl -s -I http://localhost:$API_PORT/api/v1/mitmproxy/proxy/$DEVICE_ID/ | grep -q "X-Frame-Options"; then
    echo "   ✗ 反向代理仍有 X-Frame-Options（失败）"
else
    echo "   ✓ 反向代理已移除 X-Frame-Options（预期）"
fi

# 测试状态 API
echo ""
echo "测试 3: 状态 API"
STATUS=$(curl -s http://localhost:$API_PORT/api/v1/mitmproxy/device/$DEVICE_ID/status | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")
if [ "$STATUS" = "online" ]; then
    echo "   ✓ 设备状态: online"
else
    echo "   ✗ 设备状态: $STATUS"
fi

# 显示访问地址
echo ""
echo "=========================================="
echo "  ✅ 所有服务已启动"
echo "=========================================="
echo ""
echo "📝 访问地址:"
echo ""
echo "  1. 直接访问 mitmweb (有限制):"
echo "     http://localhost:$WEB_PORT"
echo ""
echo "  2. 反向代理访问 (无限制):"
echo "     http://localhost:$API_PORT/api/v1/mitmproxy/proxy/$DEVICE_ID/"
echo ""
echo "  3. 测试页面 (对比测试):"
echo "     http://localhost:$TEST_PORT/test_iframe_proxy.html"
echo ""
echo "  4. API 文档:"
echo "     http://localhost:$API_PORT/docs"
echo ""
echo "  5. 设备状态:"
echo "     http://localhost:$API_PORT/api/v1/mitmproxy/device/$DEVICE_ID/status"
echo ""
echo "=========================================="
echo ""
echo "💡 提示:"
echo "  - 在浏览器中打开测试页面查看对比效果"
echo "  - 左侧 iframe 会被阻止（X-Frame-Options）"
echo "  - 右侧 iframe 可以正常显示（反向代理）"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
wait
