#!/bin/bash

# 停止所有服务脚本
# 使用方法: ./stop_all.sh

echo "=========================================="
echo "停止所有服务"
echo "=========================================="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 停止后端主服务（8001端口）
echo "停止后端主服务 (端口 8001)..."
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "✓ 后端主服务已停止 (PID: $BACKEND_PID)"
    else
        echo "⚠️  后端主服务进程不存在"
    fi
    rm -f logs/backend.pid
else
    # 如果没有PID文件，尝试通过端口查找
    BACKEND_PID=$(lsof -ti :8001 2>/dev/null)
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID
        echo "✓ 后端主服务已停止 (PID: $BACKEND_PID)"
    else
        echo "⚠️  未找到运行在 8001 端口的服务"
    fi
fi

# 停止AI模型服务（8000端口）
echo "停止 AI 模型服务 (端口 8000)..."
if [ -f "logs/vllm.pid" ]; then
    VLLM_PID=$(cat logs/vllm.pid)
    if kill -0 $VLLM_PID 2>/dev/null; then
        kill $VLLM_PID
        echo "✓ vLLM 服务已停止 (PID: $VLLM_PID)"
    else
        echo "⚠️  vLLM 服务进程不存在"
    fi
    rm -f logs/vllm.pid
fi

if [ -f "logs/local_model.pid" ]; then
    LOCAL_MODEL_PID=$(cat logs/local_model.pid)
    if kill -0 $LOCAL_MODEL_PID 2>/dev/null; then
        kill $LOCAL_MODEL_PID
        echo "✓ 本地模型服务已停止 (PID: $LOCAL_MODEL_PID)"
    else
        echo "⚠️  本地模型服务进程不存在"
    fi
    rm -f logs/local_model.pid
fi

# 如果没有PID文件，尝试通过端口查找
VLLM_PID=$(lsof -ti :8000 2>/dev/null)
if [ ! -z "$VLLM_PID" ]; then
    kill $VLLM_PID
    echo "✓ AI 模型服务已停止 (PID: $VLLM_PID)"
else
    echo "⚠️  未找到运行在 8000 端口的服务"
fi

echo ""
echo "=========================================="
echo "✓ 所有服务已停止"
echo "=========================================="

