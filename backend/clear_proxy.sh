#!/bin/bash

# 清除手机代理的脚本

set -e

echo "=========================================="
echo "  清除手机代理"
echo "=========================================="
echo ""

# 检查设备连接
if ! adb devices | grep device$ > /dev/null; then
    echo "✗ 错误：未检测到手机连接"
    exit 1
fi

DEVICE_ID=$(adb devices | grep device$ | awk '{print $1}')
echo "✓ 检测到设备: $DEVICE_ID"
echo ""

# 获取当前代理设置
CURRENT_PROXY=$(adb shell settings get global http_proxy)
if [ -n "$CURRENT_PROXY" ] && [ "$CURRENT_PROXY" != "null" ] && [ "$CURRENT_PROXY" != ":0" ]; then
    echo "当前代理: $CURRENT_PROXY"
else
    echo "当前未设置代理"
fi
echo ""

# 清除代理
echo "正在清除代理..."
adb shell settings put global http_proxy :0

# 验证
CURRENT_PROXY=$(adb shell settings get global http_proxy)
echo "✓ 代理已清除"
echo ""

echo "=========================================="
echo "  代理清除成功！"
echo "=========================================="
echo ""
echo "手机现在可以正常上网了"
echo ""
