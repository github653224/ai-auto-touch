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
echo "  1) 启动后端服务 (当前终端)"
echo "  2) 启动前端服务 (当前终端)"
echo "  3) 同时启动前后端 (新终端窗口)"
echo "  4) 同时启动前后端 (tmux 分屏)"
echo "  5) 启动 AI 模型服务 (当前终端)"
echo "  6) 查看服务日志 (实时)"
echo "  0) 退出"
echo ""
read -p "请输入选项 [0-6]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}🚀 启动后端服务...${NC}"
        echo -e "${YELLOW}💡 日志将显示在当前终端${NC}"
        echo ""
        cd backend
        bash start_backend.sh
        ;;
    2)
        echo ""
        echo -e "${BLUE}🚀 启动前端服务...${NC}"
        echo -e "${YELLOW}💡 日志将显示在当前终端${NC}"
        echo ""
        cd frontend
        bash start_frontend.sh
        ;;
    3)
        echo ""
        echo -e "${BLUE}🚀 同时启动前后端服务 (新终端窗口)...${NC}"
        echo ""
        echo -e "${YELLOW}💡 提示: 将在两个新终端窗口中启动服务${NC}"
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
            echo ""
            echo -e "${YELLOW}💡 提示: 可以在新打开的终端窗口中查看实时日志${NC}"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            if command -v gnome-terminal &> /dev/null; then
                gnome-terminal -- bash -c "cd backend && bash start_backend.sh; exec bash"
                sleep 2
                gnome-terminal -- bash -c "cd frontend && bash start_frontend.sh; exec bash"
                echo -e "${GREEN}✅ 已在新终端窗口中启动服务${NC}"
                echo ""
                echo -e "${YELLOW}💡 提示: 可以在新打开的终端窗口中查看实时日志${NC}"
            elif command -v xterm &> /dev/null; then
                xterm -e "cd backend && bash start_backend.sh" &
                sleep 2
                xterm -e "cd frontend && bash start_frontend.sh" &
                echo -e "${GREEN}✅ 已在新终端窗口中启动服务${NC}"
                echo ""
                echo -e "${YELLOW}💡 提示: 可以在新打开的终端窗口中查看实时日志${NC}"
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
        echo -e "${BLUE}🚀 同时启动前后端服务 (tmux 分屏)...${NC}"
        echo ""
        
        # 检查 tmux 是否安装
        if ! command -v tmux &> /dev/null; then
            echo -e "${RED}❌ 错误: 未检测到 tmux${NC}"
            echo "请先安装 tmux:"
            echo "  macOS: brew install tmux"
            echo "  Ubuntu: sudo apt install tmux"
            exit 1
        fi
        
        echo -e "${YELLOW}💡 提示: 使用 tmux 分屏显示日志${NC}"
        echo -e "${YELLOW}   - 左侧: 后端日志${NC}"
        echo -e "${YELLOW}   - 右侧: 前端日志${NC}"
        echo ""
        echo -e "${YELLOW}快捷键:${NC}"
        echo -e "${YELLOW}   - Ctrl+B 然后按 ←/→: 切换窗格${NC}"
        echo -e "${YELLOW}   - Ctrl+B 然后按 D: 分离会话（后台运行）${NC}"
        echo -e "${YELLOW}   - Ctrl+C: 停止当前窗格的服务${NC}"
        echo -e "${YELLOW}   - 输入 'exit' 两次: 完全退出${NC}"
        echo ""
        read -p "按 Enter 继续..."
        
        # 创建 tmux 会话
        SESSION_NAME="ai-auto-touch"
        
        # 检查会话是否已存在
        if tmux has-session -t $SESSION_NAME 2>/dev/null; then
            echo -e "${YELLOW}⚠️  会话已存在，正在附加...${NC}"
            tmux attach -t $SESSION_NAME
        else
            # 创建新会话并启动后端
            tmux new-session -d -s $SESSION_NAME -n "services" "cd $(pwd)/backend && bash start_backend.sh"
            
            # 垂直分屏并启动前端
            tmux split-window -h -t $SESSION_NAME "cd $(pwd)/frontend && bash start_frontend.sh"
            
            # 调整窗格大小（左右各50%）
            tmux select-layout -t $SESSION_NAME even-horizontal
            
            # 附加到会话
            echo -e "${GREEN}✅ tmux 会话已创建${NC}"
            tmux attach -t $SESSION_NAME
        fi
        ;;
    5)
        echo ""
        echo -e "${BLUE}🚀 启动 AI 模型服务...${NC}"
        echo -e "${YELLOW}💡 日志将显示在当前终端${NC}"
        echo ""
        cd backend
        if [ -f "start_model.sh" ]; then
            bash start_model.sh
        else
            echo -e "${RED}❌ 错误: 未找到 start_model.sh${NC}"
            echo "如果使用远程 API，请忽略此错误"
        fi
        ;;
    6)
        echo ""
        echo -e "${BLUE}📊 查看服务日志...${NC}"
        echo ""
        echo "请选择要查看的日志："
        echo "  1) 后端日志"
        echo "  2) 前端日志"
        echo "  3) 同时查看 (tmux 分屏)"
        echo ""
        read -p "请输入选项 [1-3]: " log_choice
        
        case $log_choice in
            1)
                echo ""
                echo -e "${BLUE}📋 后端日志 (实时)${NC}"
                echo -e "${YELLOW}💡 按 Ctrl+C 退出${NC}"
                echo ""
                if [ -f "backend/logs/app.log" ]; then
                    tail -f backend/logs/app.log
                else
                    echo -e "${YELLOW}⚠️  日志文件不存在，请先启动后端服务${NC}"
                fi
                ;;
            2)
                echo ""
                echo -e "${BLUE}📋 前端日志 (实时)${NC}"
                echo -e "${YELLOW}💡 按 Ctrl+C 退出${NC}"
                echo ""
                if [ -f "frontend/logs/vite.log" ]; then
                    tail -f frontend/logs/vite.log
                else
                    echo -e "${YELLOW}⚠️  日志文件不存在，请先启动前端服务${NC}"
                fi
                ;;
            3)
                if ! command -v tmux &> /dev/null; then
                    echo -e "${RED}❌ 错误: 未检测到 tmux${NC}"
                    exit 1
                fi
                
                SESSION_NAME="ai-auto-touch-logs"
                
                if tmux has-session -t $SESSION_NAME 2>/dev/null; then
                    tmux attach -t $SESSION_NAME
                else
                    tmux new-session -d -s $SESSION_NAME -n "logs" "tail -f backend/logs/app.log 2>/dev/null || echo '后端日志不存在'"
                    tmux split-window -h -t $SESSION_NAME "tail -f frontend/logs/vite.log 2>/dev/null || echo '前端日志不存在'"
                    tmux select-layout -t $SESSION_NAME even-horizontal
                    tmux attach -t $SESSION_NAME
                fi
                ;;
            *)
                echo -e "${RED}❌ 无效选项${NC}"
                ;;
        esac
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
