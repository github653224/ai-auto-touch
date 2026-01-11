#!/bin/bash

echo "=========================================="
echo "  mitmproxy 代理设置验证工具"
echo "=========================================="
echo ""

# 1. 检查 mitmproxy 是否运行
echo "1. 检查 mitmproxy 进程..."
if ps aux | grep -v grep | grep mitmweb > /dev/null; then
    echo "✅ mitmproxy 正在运行"
    echo ""
    echo "运行的实例："
    ps aux | grep -v grep | grep mitmweb | awk '{print "   端口:", $0}' | grep -o "listen-port [0-9]*" | sed 's/listen-port /   代理端口: /'
    ps aux | grep -v grep | grep mitmweb | awk '{print "   端口:", $0}' | grep -o "web-port [0-9]*" | sed 's/web-port /   Web端口: /'
else
    echo "❌ mitmproxy 未运行"
    echo "   请先进入抓包页面启动 mitmproxy"
    exit 1
fi

echo ""

# 2. 获取电脑 IP
echo "2. 获取电脑 IP 地址..."
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
if [ -z "$IP" ]; then
    echo "❌ 无法获取 IP 地址"
    exit 1
fi
echo "✅ 电脑 IP: $IP"

echo ""

# 3. 检查设备连接
echo "3. 检查 Android 设备..."
DEVICE_COUNT=$(adb devices | grep -v "List" | grep "device$" | wc -l | tr -d ' ')
if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "❌ 未检测到 Android 设备"
    echo "   请确保设备已连接并开启 USB 调试"
    exit 1
fi

DEVICE_ID=$(adb devices | grep -v "List" | grep "device$" | head -1 | awk '{print $1}')
echo "✅ 检测到设备: $DEVICE_ID"

echo ""

# 4. 设置代理
echo "4. 设置设备代理..."
read -p "是否自动设置代理到 $IP:8091? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    adb shell settings put global http_proxy $IP:8091
    CURRENT_PROXY=$(adb shell settings get global http_proxy)
    echo "✅ 代理已设置: $CURRENT_PROXY"
else
    echo "⏭️  跳过自动设置"
    echo ""
    echo "请手动设置："
    echo "   1. 手机打开: 设置 → WLAN"
    echo "   2. 长按当前 WiFi → 修改网络"
    echo "   3. 高级选项 → 代理: 手动"
    echo "   4. 主机名: $IP"
    echo "   5. 端口: 8091"
    echo "   6. 保存"
fi

echo ""

# 5. 提示下载证书
echo "5. 安装证书..."
echo "📱 请在手机浏览器访问: http://mitm.it"
echo ""
echo "   如果看到证书下载页面 → 代理设置成功 ✅"
echo "   如果看到错误提示 → 代理设置失败 ❌"
echo ""
echo "   下载并安装证书后，即可开始抓包"

echo ""

# 6. 提示测试
echo "6. 测试抓包..."
echo "   在手机浏览器访问任意网站（如 http://www.baidu.com）"
echo "   在抓包页面右侧应该能看到网络请求"

echo ""
echo "=========================================="
echo "  常用命令"
echo "=========================================="
echo "查看当前代理: adb shell settings get global http_proxy"
echo "清除代理:     adb shell settings put global http_proxy :0"
echo "重启设备:     adb reboot"
echo ""
