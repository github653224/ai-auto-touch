#!/bin/bash

# 端口清理脚本
# 用于停止占用指定端口的进程

echo "=========================================="
echo "  端口清理工具"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认端口列表
PORTS=(8000 8001 3002)

# 显示帮助
show_help() {
    echo "用法: $0 [选项] [端口...]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  -a, --all      清理所有默认端口 (8000, 8001, 3002)"
    echo "  -l, --list     列出占用端口的进程"
    echo ""
    echo "示例:"
    echo "  $0              # 交互式选择"
    echo "  $0 -a           # 清理所有默认端口"
    echo "  $0 8001         # 清理指定端口"
    echo "  $0 8000 8001    # 清理多个端口"
    echo "  $0 -l           # 列出占用端口的进程"
    echo ""
}

# 检查端口占用
check_port() {
    local port=$1
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 获取占用端口的进程信息
get_port_info() {
    local port=$1
    local pid=$(lsof -ti :${port} 2>/dev/null)
    
    if [ -n "$pid" ]; then
        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知")
        local process_cmd=$(ps -p $pid -o args= 2>/dev/null || echo "")
        echo "$pid|$process_name|$process_cmd"
    else
        echo ""
    fi
}

# 停止占用端口的进程
kill_port() {
    local port=$1
    local force=$2
    
    if ! check_port $port; then
        echo -e "${GREEN}✓${NC} 端口 ${port} 未被占用"
        return 0
    fi
    
    local info=$(get_port_info $port)
    local pid=$(echo $info | cut -d'|' -f1)
    local process_name=$(echo $info | cut -d'|' -f2)
    
    echo -e "${YELLOW}⚠️  端口 ${port} 被占用${NC}"
    echo "   PID: ${pid}"
    echo "   进程: ${process_name}"
    
    if [ "$force" = "true" ]; then
        # 强制模式，直接停止
        echo "   正在停止..."
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
        sleep 1
        
        if check_port $port; then
            kill -9 $pid 2>/dev/null
            sleep 1
        fi
        
        if check_port $port; then
            echo -e "${RED}❌ 停止失败${NC}"
            return 1
        else
            echo -e "${GREEN}✓ 已停止${NC}"
            return 0
        fi
    else
        # 交互模式，询问用户
        read -p "   是否停止此进程？(y/n) " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
            sleep 1
            
            if check_port $port; then
                kill -9 $pid 2>/dev/null
                sleep 1
            fi
            
            if check_port $port; then
                echo -e "${RED}❌ 停止失败${NC}"
                return 1
            else
                echo -e "${GREEN}✓ 已停止${NC}"
                return 0
            fi
        else
            echo "   跳过"
            return 0
        fi
    fi
}

# 列出所有占用端口的进程
list_ports() {
    echo "检查默认端口占用情况..."
    echo ""
    
    local found=false
    for port in "${PORTS[@]}"; do
        if check_port $port; then
            found=true
            local info=$(get_port_info $port)
            local pid=$(echo $info | cut -d'|' -f1)
            local process_name=$(echo $info | cut -d'|' -f2)
            local process_cmd=$(echo $info | cut -d'|' -f3)
            
            echo -e "${YELLOW}端口 ${port}:${NC}"
            echo "  PID: ${pid}"
            echo "  进程: ${process_name}"
            echo "  命令: ${process_cmd}"
            echo ""
        fi
    done
    
    if [ "$found" = false ]; then
        echo -e "${GREEN}✓ 所有端口都空闲${NC}"
    fi
}

# 主逻辑
main() {
    # 解析参数
    if [ $# -eq 0 ]; then
        # 无参数，交互式模式
        echo "请选择操作："
        echo "  1) 清理所有默认端口 (8000, 8001, 3002)"
        echo "  2) 清理指定端口"
        echo "  3) 列出占用端口的进程"
        echo "  0) 退出"
        echo ""
        read -p "请输入选项 [0-3]: " choice
        
        case $choice in
            1)
                echo ""
                for port in "${PORTS[@]}"; do
                    kill_port $port false
                    echo ""
                done
                ;;
            2)
                echo ""
                read -p "请输入端口号: " port
                if [[ $port =~ ^[0-9]+$ ]]; then
                    kill_port $port false
                else
                    echo -e "${RED}❌ 无效的端口号${NC}"
                fi
                ;;
            3)
                echo ""
                list_ports
                ;;
            0)
                echo "退出"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ 无效选项${NC}"
                exit 1
                ;;
        esac
    else
        # 有参数，解析命令行
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -a|--all)
                echo "清理所有默认端口..."
                echo ""
                for port in "${PORTS[@]}"; do
                    kill_port $port true
                    echo ""
                done
                ;;
            -l|--list)
                list_ports
                ;;
            *)
                # 清理指定端口
                for port in "$@"; do
                    if [[ $port =~ ^[0-9]+$ ]]; then
                        kill_port $port true
                        echo ""
                    else
                        echo -e "${RED}❌ 无效的端口号: $port${NC}"
                    fi
                done
                ;;
        esac
    fi
}

# 运行主函数
main "$@"

echo ""
echo "=========================================="
echo "  完成"
echo "=========================================="
