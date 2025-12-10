#!/bin/bash

# vLLM模型服务启动脚本（推荐方案）
# 使用方法: ./start_vllm.sh 或 bash start_vllm.sh
# 前提: 已创建并激活conda环境 ai-auto-touch，且已安装vLLM

echo "=========================================="
echo "vLLM模型服务启动脚本 (推荐)"
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

# 检查vLLM是否已安装
echo "检查vLLM依赖..."
if ! python -c "import vllm" 2>/dev/null; then
    echo "vLLM未安装，正在安装..."
    echo "提示: vLLM安装可能需要较长时间，请耐心等待"
    pip install vllm>=0.12.0 transformers>=5.0.0rc0
    if [ $? -ne 0 ]; then
        echo "❌ vLLM安装失败"
        echo "💡 提示: 如果安装失败，可能需要先安装CUDA或其他依赖"
        exit 1
    fi
else
    vllm_version=$(python -c "import vllm; print(vllm.__version__)" 2>/dev/null)
    echo "✓ vLLM已安装: $vllm_version"
fi

# 获取模型路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODEL_DIR="${PROJECT_ROOT}/models/AutoGLM-Phone-9B"

# 检查模型路径
if [ -d "${MODEL_DIR}" ]; then
    echo "✓ 检测到本地模型: ${MODEL_DIR}"
    # 检查模型文件是否完整
    if [ -f "${MODEL_DIR}/config.json" ] && [ -f "${MODEL_DIR}/model.safetensors.index.json" ]; then
        echo "✓ 模型文件完整"
        MODEL_PATH="${MODEL_DIR}"
    else
        echo "警告: 模型目录存在但文件不完整"
        echo "将使用Hugging Face模型: zai-org/AutoGLM-Phone-9B"
        MODEL_PATH="zai-org/AutoGLM-Phone-9B"
    fi
else
    echo "未找到本地模型目录: ${MODEL_DIR}"
    echo "将使用Hugging Face模型: zai-org/AutoGLM-Phone-9B"
    echo "提示: 首次运行会下载模型，可能需要较长时间"
    MODEL_PATH="zai-org/AutoGLM-Phone-9B"
fi

# 检查端口
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "警告: 端口8000已被占用"
    echo "请先停止占用8000端口的服务，或修改启动命令中的端口"
    exit 1
fi

# 启动服务
echo ""
echo "=========================================="
echo "启动vLLM模型服务..."
echo "服务地址: http://localhost:8000"
echo "API端点: http://localhost:8000/v1/chat/completions"
echo "模型路径: ${MODEL_PATH}"
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 构建vLLM启动命令
VLLM_CMD="python3 -m vllm.entrypoints.openai.api_server"
VLLM_CMD="${VLLM_CMD} --served-model-name autoglm-phone-9b"
VLLM_CMD="${VLLM_CMD} --allowed-local-media-path /"
VLLM_CMD="${VLLM_CMD} --mm-encoder-tp-mode data"
VLLM_CMD="${VLLM_CMD} --mm_processor_cache_type shm"
VLLM_CMD="${VLLM_CMD} --mm_processor_kwargs '{\"max_pixels\":5000000}'"
VLLM_CMD="${VLLM_CMD} --max-model-len 25480"
VLLM_CMD="${VLLM_CMD} --chat-template-content-format string"
VLLM_CMD="${VLLM_CMD} --limit-mm-per-prompt '{\"image\":10}'"
VLLM_CMD="${VLLM_CMD} --model ${MODEL_PATH}"
VLLM_CMD="${VLLM_CMD} --port 8000"

echo "执行命令:"
echo "${VLLM_CMD}"
echo ""

# 执行启动命令
eval ${VLLM_CMD}

