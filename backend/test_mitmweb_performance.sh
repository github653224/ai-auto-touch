#!/bin/bash

# 测试 mitmweb 性能优化效果

DEVICE_ID="EP0110MZ0BC110733W"
BASE_URL="http://localhost:8001/api/v1/mitmproxy"

echo "=== mitmweb 性能测试 ==="
echo ""

# 1. 检查服务状态
echo "1. 检查 mitmweb 状态..."
STATUS=$(curl -s "${BASE_URL}/device/${DEVICE_ID}/status")
echo "$STATUS" | python3 -m json.tool
echo ""

# 2. 测试 web 界面响应时间
echo "2. 测试 web 界面响应时间..."
WEB_PORT=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('web_port', 8191))")
echo "Web 端口: $WEB_PORT"

for i in {1..5}; do
    START=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}/" --max-time 10)
    END=$(date +%s%N)
    DURATION=$(( (END - START) / 1000000 ))
    echo "  请求 $i: HTTP $HTTP_CODE, 耗时 ${DURATION}ms"
done
echo ""

# 3. 测试流量列表 API 响应时间
echo "3. 测试流量列表 API 响应时间..."
for i in {1..5}; do
    START=$(date +%s%N)
    FLOWS=$(curl -s "${BASE_URL}/device/${DEVICE_ID}/flows?limit=100")
    END=$(date +%s%N)
    DURATION=$(( (END - START) / 1000000 ))
    COUNT=$(echo "$FLOWS" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('flows', [])))")
    echo "  请求 $i: 获取 $COUNT 条流量, 耗时 ${DURATION}ms"
done
echo ""

# 4. 检查进程资源占用
echo "4. 检查 mitmweb 进程资源占用..."
ps aux | grep mitmweb | grep -v grep | awk '{printf "  CPU: %s%%, 内存: %s%%\n", $3, $4}'
echo ""

# 5. 测试清空流量
echo "5. 测试清空流量..."
START=$(date +%s%N)
CLEAR_RESULT=$(curl -s -X POST "${BASE_URL}/device/${DEVICE_ID}/clear")
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "$CLEAR_RESULT" | python3 -m json.tool
echo "  耗时: ${DURATION}ms"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "优化建议："
echo "  - 如果 web 界面响应时间 > 1000ms，建议使用自定义抓包界面"
echo "  - 如果内存占用 > 5%，建议定期清空流量记录"
echo "  - 如果 CPU 占用 > 10%，建议降低抓包频率"
