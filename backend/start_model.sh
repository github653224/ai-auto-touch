#!/bin/bash

# AI模型服务启动脚本（独立启动，前台运行，显示日志）
# 使用方法: ./start_model.sh
# 按 Ctrl+C 停止服务

echo "=========================================="
echo "AI 模型服务启动脚本"
echo "=========================================="

# Conda环境名称
CONDA_ENV_NAME="ai-auto-touch"

# 初始化conda
eval "$(conda shell.bash hook)"

# 激活conda环境
echo "激活conda环境: ${CONDA_ENV_NAME}..."
if ! conda activate ${CONDA_ENV_NAME}; then
    echo "❌ 错误: 无法激活conda环境 ${CONDA_ENV_NAME}"
    echo "请先创建conda环境: conda create -n ${CONDA_ENV_NAME} python=3.11"
    exit 1
fi

# 检查端口
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告: 端口 8000 已被占用"
    echo "是否要停止现有服务并重新启动？(y/n)"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -ti :8000)
        kill $PID
        sleep 2
    else
        echo "取消启动"
        exit 1
    fi
fi

# 检查vLLM是否已安装
if python -c "import vllm" 2>/dev/null; then
    echo "✓ 检测到 vLLM，使用 vLLM 启动..."
    echo ""
    echo "=========================================="
    echo "启动 vLLM 服务 (端口 8000)"
    echo "提示: vLLM 启动可能需要较长时间，请耐心等待"
    echo "按 Ctrl+C 停止服务"
    echo "=========================================="
    echo ""
    
    # 获取模型路径
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
    MODEL_DIR="${PROJECT_ROOT}/models/AutoGLM-Phone-9B"
    
    # 检查模型路径
    if [ -d "${MODEL_DIR}" ]; then
        echo "✓ 使用本地模型: ${MODEL_DIR}"
        MODEL_PATH="${MODEL_DIR}"
    else
        echo "⚠️  未找到本地模型，将使用Hugging Face模型"
        MODEL_PATH="zai-org/AutoGLM-Phone-9B"
    fi
    
    # 前台启动vLLM（显示所有日志）
    # 使用与start_vllm.sh相同的完整参数
    python3 -m vllm.entrypoints.openai.api_server \
        --served-model-name autoglm-phone-9b \
        --allowed-local-media-path / \
        --mm-encoder-tp-mode data \
        --mm_processor_cache_type shm \
        --mm_processor_kwargs '{"max_pixels":5000000}' \
        --max-model-len 25480 \
        --chat-template-content-format string \
        --limit-mm-per-prompt '{"image":10}' \
        --model "${MODEL_PATH}" \
        --port 8000 \
        --trust-remote-code
else
    echo "⚠️  vLLM 未安装，使用本地模型服务..."
    echo "提示: 如需使用 vLLM，请先安装: pip install \"vllm>=0.12.0\" \"transformers>=4.56.0,<5\""
    echo ""
    echo "=========================================="
    echo "启动本地模型服务 (端口 8000)"
    echo "按 Ctrl+C 停止服务"
    echo "=========================================="
    echo ""
    
    # 前台启动本地模型服务（显示所有日志）
    python local_api.py
fi

