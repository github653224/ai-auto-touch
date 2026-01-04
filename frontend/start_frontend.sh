#!/bin/bash

# 前端启动脚本
# AI 驱动设备自动化平台

echo "=========================================="
echo "  AI 驱动设备自动化平台 - 前端服务"
echo "=========================================="
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    echo ""
fi

# 启动前端服务
echo "🚀 启动前端开发服务器..."
echo "📍 访问地址: http://localhost:3002"
echo "📍 网络地址: http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}'):3002"
echo ""
echo "💡 提示: 按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

npm run dev -- --host --port 3002 --clearScreen false
