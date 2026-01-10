#!/bin/bash

# 重启手机网络连接，让代理设置生效

echo "=========================================="
echo "  重启手机网络"
echo "=========================================="
echo ""

# 检查设备连接
if ! adb devices | grep device$ > /dev/null; then
    echo "✗ 错误：未检测到手机连接"
    exit 1
fi

echo "正在重启网络..."
echo ""

# 方法1：切换飞行模式
echo "1. 开启飞行模式..."
adb shell cmd connectivity airplane-mode enable
sleep 2

echo "2. 关闭飞行模式..."
adb shell cmd connectivity airplane-mode disable
sleep 3

echo ""
echo "✓ 网络已重启"
echo ""

# 验证代理设置
CURRENT_PROXY=$(adb shell settings get global http_proxy)
echo "当前代理设置: $CURRENT_PROXY"
echo ""

echo "=========================================="
echo "  完成！"
echo "=========================================="
echo ""
echo "现在尝试在手机上访问网页，看看是否能正常使用"
echo ""
