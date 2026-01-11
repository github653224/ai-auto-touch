#!/bin/bash

echo "=========================================="
echo "  mitmproxy 代理诊断工具"
echo "=========================================="
echo ""

# 获取本机 IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "✓ 本机 IP 地址: $LOCAL_IP"
echo ""

# 检查 mitmproxy 进程
echo "检查 mitmproxy 进程..."
if ps aux | grep -v grep | grep mitmproxy > /dev/null; then
    echo "✓ mitmproxy 进程正在运行"
    ps aux | grep -v grep | grep mitmproxy | awk '{print "  PID:", $2, "CMD:", $11, $12, $13}'
else
    echo "✗ mitmproxy 进程未运行"
fi
echo ""

# 检查端口监听
echo "检查端口监听..."
if lsof -i :8091 > /dev/null 2>&1; then
    echo "✓ 代理端口 8091 正在监听"
    lsof -i :8091 | grep LISTEN | awk '{print "  ", $1, $2, $9}'
else
    echo "✗ 代理端口 8091 未监听"
fi

if lsof -i :8191 > /dev/null 2>&1; then
    echo "✓ Web 端口 8191 正在监听"
    lsof -i :8191 | grep LISTEN | awk '{print "  ", $1, $2, $9}'
else
    echo "✗ Web 端口 8191 未监听"
fi
echo ""

# 检查防火墙
echo "检查防火墙状态..."
if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate | grep enabled > /dev/null; then
    echo "⚠️  防火墙已启用，可能阻止手机连接"
    echo "   建议临时关闭防火墙测试："
    echo "   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off"
else
    echo "✓ 防火墙已关闭"
fi
echo ""

# 检查手机连接
echo "检查手机连接..."
if adb devices | grep device$ > /dev/null; then
    DEVICE_ID=$(adb devices | grep device$ | awk '{print $1}')
    echo "✓ 手机已通过 ADB 连接: $DEVICE_ID"
    
    # 检查手机代理设置
    echo ""
    echo "检查手机代理设置..."
    PROXY_HOST=$(adb shell settings get global http_proxy 2>/dev/null)
    if [ -n "$PROXY_HOST" ] && [ "$PROXY_HOST" != "null" ] && [ "$PROXY_HOST" != ":0" ]; then
        echo "✓ 手机已设置代理: $PROXY_HOST"
    else
        echo "✗ 手机未设置代理"
        echo ""
        echo "请在手机上手动设置 WiFi 代理："
        echo "  1. 打开 WiFi 设置"
        echo "  2. 长按当前连接的 WiFi"
        echo "  3. 选择'修改网络' 或 '高级选项'"
        echo "  4. 代理设置为'手动'"
        echo "  5. 代理主机名: $LOCAL_IP"
        echo "  6. 代理端口: 8091"
    fi
else
    echo "✗ 手机未通过 ADB 连接"
fi
echo ""

# 测试代理连接
echo "测试代理连接..."
if curl -x http://localhost:8091 -s -o /dev/null -w "%{http_code}" http://www.baidu.com 2>/dev/null | grep -E "200|301|302" > /dev/null; then
    echo "✓ 代理服务器响应正常"
else
    echo "⚠️  代理服务器响应异常"
fi
echo ""

# 显示证书路径
echo "mitmproxy 证书路径:"
CERT_PATH="$HOME/.mitmproxy/mitmproxy-ca-cert.cer"
if [ -f "$CERT_PATH" ]; then
    echo "✓ 证书文件存在: $CERT_PATH"
    echo ""
    echo "手机安装证书步骤："
    echo "  1. 在手机浏览器访问: http://mitm.it"
    echo "  2. 下载对应系统的证书"
    echo "  3. 安装证书并信任"
else
    echo "✗ 证书文件不存在"
fi
echo ""

echo "=========================================="
echo "  配置摘要"
echo "=========================================="
echo "代理地址: $LOCAL_IP:8091"
echo "Web 界面: http://localhost:8191"
echo "证书下载: http://mitm.it (需先设置代理)"
echo ""
echo "如果手机无法上网，请检查："
echo "  1. 手机和电脑是否在同一 WiFi"
echo "  2. 防火墙是否阻止连接"
echo "  3. 代理地址和端口是否正确"
echo "  4. 证书是否已安装并信任"
echo "=========================================="
