#!/bin/bash

# 测试设备锁定功能

DEVICE_ID="EP0110MZ0BC110733W"
BASE_URL="http://localhost:8001/api/v1/device-lock"

echo "=== 设备锁定功能测试 ==="
echo ""

# 1. 用户 A 获取锁
echo "1. 用户 A（张三）获取设备锁..."
RESPONSE_A=$(curl -s -X POST "${BASE_URL}/device/${DEVICE_ID}/acquire" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "userA", "user_name": "张三", "force": false}')
echo "$RESPONSE_A" | python3 -m json.tool
SESSION_A=$(echo "$RESPONSE_A" | python3 -c "import sys, json; print(json.load(sys.stdin).get('session_id', ''))")
echo "会话 ID: $SESSION_A"
echo ""

# 2. 用户 B 尝试获取锁（应该失败）
echo "2. 用户 B（李四）尝试获取设备锁..."
RESPONSE_B=$(curl -s -X POST "${BASE_URL}/device/${DEVICE_ID}/acquire" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "userB", "user_name": "李四", "force": false}')
echo "$RESPONSE_B" | python3 -m json.tool
echo ""

# 3. 查询设备锁状态
echo "3. 查询设备锁状态..."
curl -s "${BASE_URL}/device/${DEVICE_ID}/status" | python3 -m json.tool
echo ""

# 4. 用户 A 发送心跳
echo "4. 用户 A 发送心跳..."
curl -s -X POST "${BASE_URL}/device/${DEVICE_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_A\"}" | python3 -m json.tool
echo ""

# 5. 列出所有设备锁
echo "5. 列出所有设备锁..."
curl -s "${BASE_URL}/locks" | python3 -m json.tool
echo ""

# 6. 用户 A 释放锁
echo "6. 用户 A 释放设备锁..."
curl -s -X POST "${BASE_URL}/device/${DEVICE_ID}/release" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_A\"}" | python3 -m json.tool
echo ""

# 7. 用户 B 再次尝试获取锁（应该成功）
echo "7. 用户 B 再次尝试获取设备锁..."
RESPONSE_B2=$(curl -s -X POST "${BASE_URL}/device/${DEVICE_ID}/acquire" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "userB", "user_name": "李四", "force": false}')
echo "$RESPONSE_B2" | python3 -m json.tool
SESSION_B=$(echo "$RESPONSE_B2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('session_id', ''))")
echo ""

# 8. 测试强制获取
echo "8. 用户 C（王五）强制获取设备锁..."
curl -s -X POST "${BASE_URL}/device/${DEVICE_ID}/acquire" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "userC", "user_name": "王五", "force": true}' | python3 -m json.tool
echo ""

# 9. 查询最终状态
echo "9. 查询最终设备锁状态..."
curl -s "${BASE_URL}/device/${DEVICE_ID}/status" | python3 -m json.tool
echo ""

echo "=== 测试完成 ==="
