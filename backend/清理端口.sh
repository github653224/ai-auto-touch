#!/bin/bash

# 清理端口脚本
# 使用方法: ./清理端口.sh [端口号]

PORT=${1:-8001}

echo "=========================================="
echo "清理端口 ${PORT}"
echo "=========================================="

# 查找占用端口的进程
PIDS=$(lsof -ti :${PORT} 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "✓ 端口 ${PORT} 未被占用"
    exit 0
fi

echo "发现占用端口 ${PORT} 的进程:"
for PID in $PIDS; do
    ps -p $PID -o pid,command | tail -1
done

echo ""
read -p "是否终止这些进程？(y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    for PID in $PIDS; do
        echo "终止进程 $PID..."
        kill $PID 2>/dev/null
        sleep 1
        # 如果还在运行，强制终止
        if kill -0 $PID 2>/dev/null; then
            kill -9 $PID 2>/dev/null
            echo "强制终止进程 $PID"
        fi
    done
    echo "✓ 端口 ${PORT} 已清理"
else
    echo "取消操作"
    exit 1
fi

