#!/bin/bash

# 设置手机代理的脚本

set -e

# 获取本机 IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
PROXY_PORT=8091

echo "=========================================="
echo "  设置手机代理"
echo "=========================================="
echo ""
echo "代理地址: $LOCAL_IP:$PROXY_PORT"
echo ""

# 检查设备连接
if ! adb devices | grep device$ > /dev/null; then
    echo "✗ 错误：未检测到手机连接"
    echo "请确保手机已通过 USB 连接并启用 USB 调试"
    exit 1
fi

DEVICE_ID=$(adb devices | grep device$ | awk '{print $1}')
echo "✓ 检测到设备: $DEVICE_ID"
echo ""

# 设置全局代理
echo "正在设置代理..."
adb shell settings put global http_proxy $LOCAL_IP:$PROXY_PORT

# 验证设置
CURRENT_PROXY=$(adb shell settings get global http_proxy)
echo "✓ 代理已设置: $CURRENT_PROXY"
echo ""

echo "=========================================="
echo "  代理设置成功！"
echo "=========================================="
echo ""
echo "现在可以："
echo "  1. 在手机上打开任何 app 或浏览器"
echo "  2. 查看抓包页面，应该能看到流量"
echo "  3. 测试访问: http://mitm.it"
echo ""
echo "如果要关闭代理，运行："
echo "  bash clear_proxy.sh"
echo ""
echo "注意："
echo "  - 设置代理后，手机所有流量都会经过 mitmproxy"
echo "  - 如果证书未正确安装，HTTPS 网站会无法访问"
echo "  - 某些 app 可能会检测代理并拒绝连接"
echo "=========================================="
