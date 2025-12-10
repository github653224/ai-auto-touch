#!/bin/bash

# 本地模型服务启动脚本（使用transformers，替代vLLM）
# 使用方法: ./start_local_model.sh 或 bash start_local_model.sh
# 前提: 已创建并激活conda环境 ai-auto-touch

echo "=========================================="
echo "本地模型服务启动脚本 (Transformers)"
echo "=========================================="

# Conda环境名称
CONDA_ENV_NAME="ai-auto-touch"

# 初始化conda
echo "初始化conda..."
eval "$(conda shell.bash hook)"

# 激活conda环境
echo "激活conda环境: ${CONDA_ENV_NAME}..."
if conda activate ${CONDA_ENV_NAME}; then
    echo "✓ conda环境已激活"
else
    echo "错误: 无法激活conda环境 ${CONDA_ENV_NAME}"
    echo "请先创建conda环境: conda create -n ${CONDA_ENV_NAME} python=3.10"
    exit 1
fi

# 检查Python版本
echo "检查Python环境..."
python_version=$(python --version 2>&1)
echo "Python版本: $python_version"

# 检查依赖
echo "检查依赖..."
if ! python -c "import torch" 2>/dev/null; then
    echo "安装PyTorch..."
    pip install torch transformers accelerate
fi

if ! python -c "import fastapi" 2>/dev/null; then
    echo "安装FastAPI..."
    pip install fastapi uvicorn
fi

# 检查模型路径
# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODEL_DIR="${PROJECT_ROOT}/models/AutoGLM-Phone-9B"

if [ -d "${MODEL_DIR}" ]; then
    echo "✓ 检测到本地模型: ${MODEL_DIR}"
    # 检查模型文件是否完整
    if [ -f "${MODEL_DIR}/config.json" ] && [ -f "${MODEL_DIR}/tokenizer.json" ]; then
        echo "✓ 模型文件完整"
        export LOCAL_MODEL_ID="${MODEL_DIR}"
        MODEL_PATH="${MODEL_DIR}"
    else
        echo "警告: 模型目录存在但文件不完整，将使用Hugging Face模型"
        export LOCAL_MODEL_ID="zai-org/AutoGLM-Phone-9B"
        MODEL_PATH="zai-org/AutoGLM-Phone-9B"
    fi
else
    echo "未找到本地模型目录: ${MODEL_DIR}"
    echo "将使用Hugging Face模型: zai-org/AutoGLM-Phone-9B"
    echo "提示: 首次运行会下载模型，可能需要较长时间"
    export LOCAL_MODEL_ID="zai-org/AutoGLM-Phone-9B"
    MODEL_PATH="zai-org/AutoGLM-Phone-9B"
fi

# 检查端口
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "警告: 端口8000已被占用"
    echo "请先停止占用8000端口的服务，或修改local_api.py中的端口"
    exit 1
fi

# 启动服务
echo ""
echo "=========================================="
echo "启动本地模型服务..."
echo "服务地址: http://localhost:8000"
echo "API端点: http://localhost:8000/v1/chat/completions"
echo "模型路径: ${MODEL_PATH}"
echo "按 Ctrl+C 停止服务"
echo "=========================================="
if [ "${MODEL_PATH}" != "zai-org/AutoGLM-Phone-9B" ]; then
    echo "✓ 使用本地模型，无需下载"
else
    echo "注意: 首次启动会下载模型，请耐心等待..."
fi
echo ""

# 启动服务
python local_api.py

