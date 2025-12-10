#!/bin/bash

# 统一启动脚本 - 提示用户分别启动各个服务
# 使用方法: ./start_all.sh
# 注意: 此脚本会提示用户分别启动各个服务，以便查看日志

echo "=========================================="
echo "群控手机平台 - 服务启动指南"
echo "=========================================="
echo ""
echo "为了便于查看日志和调试，建议分别启动各个服务："
echo ""
echo "📋 启动顺序："
echo ""
echo "1️⃣  AI模型服务 (端口 8000)"
echo "   在新终端窗口运行:"
echo "   cd $(pwd)"
echo "   ./start_model.sh"
echo ""
echo "2️⃣  后端主服务 (端口 8001)"
echo "   在另一个新终端窗口运行:"
echo "   cd $(pwd)"
echo "   ./start_backend.sh"
echo ""
echo "3️⃣  前端服务 (端口 3000)"
echo "   在第三个新终端窗口运行:"
echo "   cd ../frontend"
echo "   npm run dev"
echo ""
echo "=========================================="
echo "服务说明："
echo "=========================================="
echo ""
echo "• start_model.sh    - AI模型服务（vLLM/本地），前台运行，显示日志"
echo "• start_backend.sh  - 后端主服务（FastAPI），前台运行，显示日志"
echo "• stop_all.sh       - 停止所有服务"
echo ""
echo "=========================================="
echo "快速启动命令："
echo "=========================================="
echo ""
echo "终端1 - AI模型服务:"
echo "  ./start_model.sh"
echo ""
echo "终端2 - 后端主服务:"
echo "  ./start_backend.sh"
echo ""
echo "终端3 - 前端服务:"
echo "  cd ../frontend && npm run dev"
echo ""
echo "=========================================="
echo "检查服务状态："
echo "=========================================="
echo ""

# 检查服务状态
check_service_status() {
    local port=$1
    local service=$2
    local health_url=$3
    
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        if [ ! -z "$health_url" ]; then
            if curl -s "$health_url" > /dev/null 2>&1; then
                echo "✓ ${service} 正在运行 (端口 ${port})"
                return 0
            else
                echo "⚠️  ${service} 端口被占用但服务可能不健康 (端口 ${port})"
                return 1
            fi
        else
            echo "⚠️  ${service} 端口被占用 (端口 ${port})"
            return 1
        fi
    else
        echo "✗ ${service} 未运行 (端口 ${port})"
        return 2
    fi
}

check_service_status 8000 "AI模型服务" "http://localhost:8000/v1/models"
check_service_status 8001 "后端主服务" "http://localhost:8001/docs"
check_service_status 3000 "前端服务" "http://localhost:3000"

echo ""
echo "=========================================="
