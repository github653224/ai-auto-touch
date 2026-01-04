#!/bin/bash

# 一键启动脚本
# AI 驱动设备自动化平台

echo "=========================================="
echo "  AI 驱动设备自动化平台 - 一键启动"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录下运行此脚本${NC}"
    exit 1
fi

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 错误: 未检测到 Python3${NC}"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: 未检测到 Node.js${NC}"
    exit 1
fi

# 检查 ADB
if ! command -v adb &> /dev/null; then
    echo -e "${YELLOW}⚠️  警告: 未检测到 ADB，请确保已安装 Android Platform Tools${NC}"
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"
echo ""

# 显示菜单
echo "请选择启动模式："
echo ""
echo "  1) 启动后端服务 (FastAPI)"
echo "  2) 启动前端服务 (React)"
echo "  3) 同时启动前后端 (推荐)"
echo "  4) 启动 AI 模型服务 (vLLM)"
echo "  5) 全部启动 (模型 + 后端 + 前端)"
echo "  0) 退出"
echo ""
read -p "请输入选项 [0-5]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}🚀 启动后端服务...${NC}"
        cd backend
        bash start_backend.sh
        ;;
    2)
        echo ""
        echo -e "${BLUE}🚀 启动前端服务...${NC}"
        cd frontend
        bash start_frontend.sh
        ;;
    3)
        echo ""
        echo -e "${BLUE}🚀 同时启动前后端服务...${NC}"
        echo ""
        echo -e "${YELLOW}💡 提示: 将在两个终端窗口中启动服务${NC}"
        echo -e "${YELLOW}   - 后端: http://localhost:8001${NC}"
        echo -e "${YELLOW}   - 前端: http://localhost:3002${NC}"
        echo ""
        
        # 检查操作系统
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'/backend\" && bash start_backend.sh"'
            sleep 2
            osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'/frontend\" && bash start_frontend.sh"'
            echo -e "${GREEN}✅ 已在新终端窗口中启动服务${NC}"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            if command -v gnome-terminal &> /dev/null; then
                gnome-terminal -- bash -c "cd backend && bash start_backend.sh; exec bash"
                sleep 2
                gnome-terminal -- bash -c "cd frontend && bash start_frontend.sh; exec bash"
                echo -e "${GREEN}✅ 已在新终端窗口中启动服务${NC}"
            elif command -v xterm &> /dev/null; then
                xterm -e "cd backend && bash start_backend.sh" &
                sleep 2
                xterm -e "cd frontend && bash start_frontend.sh" &
                echo -e "${GREEN}✅ 已在新终端窗口中启动服务${NC}"
            else
                echo -e "${YELLOW}⚠️  未检测到终端模拟器，请手动启动：${NC}"
                echo "   终端1: cd backend && bash start_backend.sh"
                echo "   终端2: cd frontend && bash start_frontend.sh"
            fi
        else
            echo -e "${YELLOW}⚠️  不支持的操作系统，请手动启动：${NC}"
            echo "   终端1: cd backend && bash start_backend.sh"
            echo "   终端2: cd frontend && bash start_frontend.sh"
        fi
        ;;
    4)
        echo ""
        echo -e "${BLUE}🚀 启动 AI 模型服务...${NC}"
        cd backend
        if [ -f "start_model.sh" ]; then
            bash start_model.sh
        else
            echo -e "${RED}❌ 错误: 未找到 start_model.sh${NC}"
            echo "如果使用远程 API，请忽略此错误"
        fi
        ;;
    5)
        echo ""
        echo -e "${BLUE}🚀 启动全部服务...${NC}"
        echo ""
        echo -e "${YELLOW}💡 提示: 将在三个终端窗口中启动服务${NC}"
        echo -e "${YELLOW}   - AI 模型: http://localhost:8000${NC}"
        echo -e "${YELLOW}   - 后端: http://localhost:8001${NC}"
        echo -e "${YELLOW}   - 前端: http://localhost:3002${NC}"
        echo ""
        
        # 检查操作系统
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if [ -f "backend/start_model.sh" ]; then
                osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'/backend\" && bash start_model.sh"'
                echo "⏳ 等待 AI 模型启动 (30秒)..."
                sleep 30
            fi
            osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'/backend\" && bash start_backend.sh"'
            sleep 2
            osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'/frontend\" && bash start_frontend.sh"'
            echo -e "${GREEN}✅ 已在新终端窗口中启动所有服务${NC}"
        else
            echo -e "${YELLOW}⚠️  请手动启动：${NC}"
            echo "   终端1: cd backend && bash start_model.sh"
            echo "   终端2: cd backend && bash start_backend.sh"
            echo "   终端3: cd frontend && bash start_frontend.sh"
        fi
        ;;
    0)
        echo ""
        echo -e "${GREEN}👋 再见！${NC}"
        exit 0
        ;;
    *)
        echo ""
        echo -e "${RED}❌ 无效选项${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}=========================================="
echo "  启动完成"
echo "==========================================${NC}"
