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

# 检查端口占用
PORT=3002
echo "检查端口 ${PORT}..."
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID=$(lsof -ti :${PORT})
    PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "未知进程")
    echo "⚠️  警告: 端口 ${PORT} 已被占用"
    echo "   进程 PID: ${PID}"
    echo "   进程名称: ${PROCESS_NAME}"
    echo ""
    echo "请选择操作："
    echo "  1) 自动停止并重启"
    echo "  2) 手动处理"
    echo "  3) 取消启动"
    echo ""
    read -p "请输入选项 [1-3]: " -n 1 -r
    echo
    
    case $REPLY in
        1)
            echo "正在停止进程 ${PID}..."
            kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
            sleep 2
            
            # 再次检查端口是否释放
            if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo "❌ 端口仍被占用，尝试强制停止..."
                kill -9 $(lsof -ti :${PORT}) 2>/dev/null
                sleep 1
            fi
            
            echo "✓ 已停止现有服务"
            ;;
        2)
            echo ""
            echo "请手动停止占用端口的进程："
            echo "  kill ${PID}"
            echo "或强制停止："
            echo "  kill -9 ${PID}"
            exit 1
            ;;
        3|*)
            echo "取消启动"
            exit 1
            ;;
    esac
else
    echo "✓ 端口 ${PORT} 可用"
fi
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
