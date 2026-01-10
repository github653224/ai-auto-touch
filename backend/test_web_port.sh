#!/bin/bash

# 测试 mitmweb web 端口

DEVICE_ID="EP0110MZ0BC110733W"

echo "=== 测试 mitmweb web 端口 ==="
echo ""

# 1. 获取状态
echo "1. 获取 mitmweb 状态..."
STATUS=$(curl -s http://localhost:8001/api/v1/mitmproxy/device/${DEVICE_ID}/status)
echo "$STATUS" | python3 -m json.tool
echo ""

# 2. 提取 web_port
WEB_PORT=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('web_port', 'NOT_FOUND'))")
echo "2. 提取的 web_port: $WEB_PORT"
echo ""

# 3. 测试端口是否可访问
echo "3. 测试端口 $WEB_PORT 是否可访问..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}/" --max-time 5)
echo "   HTTP 状态码: $HTTP_CODE"
echo ""

# 4. 检查进程监听的端口
echo "4. 检查 mitmweb 进程监听的端口..."
lsof -i -P | grep mitmweb | grep LISTEN
echo ""

# 5. 生成正确的 URL
echo "5. 正确的 mitmweb web 界面 URL:"
echo "   http://localhost:${WEB_PORT}/"
echo ""

# 6. 在浏览器中打开（macOS）
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "6. 是否在浏览器中打开？(y/n)"
    read -r ANSWER
    if [[ "$ANSWER" == "y" ]]; then
        open "http://localhost:${WEB_PORT}/"
        echo "   已在浏览器中打开"
    fi
fi
