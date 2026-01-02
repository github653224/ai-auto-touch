#!/bin/bash

#==============================================================================
# AI Auto Touch - AI 模型服务启动脚本
#==============================================================================
# 功能: 启动本地 AI 模型服务（使用 vLLM）
# 端口: 8000
# 用法: ./start_model.sh
# 说明: 仅在本地部署模型时需要运行此脚本
#       如果使用远程 API 服务（智谱 AI、ModelScope 等），无需运行
#       前台运行，显示所有日志，按 Ctrl+C 停止服务
#==============================================================================

echo "=========================================="
echo "AI 模型服务启动脚本"
echo "=========================================="

#------------------------------------------------------------------------------
# 配置项
#------------------------------------------------------------------------------
# Conda 环境名称（如果使用 conda）
CONDA_ENV_NAME="ai-auto-touch"

# 服务端口
PORT=8000

# 模型名称（用于 API 端点）
MODEL_NAME="autoglm-phone-9b"

# 获取项目路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODEL_DIR="${PROJECT_ROOT}/models/AutoGLM-Phone-9B"

#------------------------------------------------------------------------------
# 激活 Python 环境
#------------------------------------------------------------------------------
# 检查是否使用 conda
if command -v conda &> /dev/null; then
    echo "检测到 conda，尝试激活环境: ${CONDA_ENV_NAME}..."
    
    # 初始化 conda
    eval "$(conda shell.bash hook)"
    
    # 激活 conda 环境
    if conda activate ${CONDA_ENV_NAME} 2>/dev/null; then
        echo "✓ 已激活 conda 环境: ${CONDA_ENV_NAME}"
    else
        echo "⚠️  conda 环境 ${CONDA_ENV_NAME} 不存在"
        echo "提示: 创建环境: conda create -n ${CONDA_ENV_NAME} python=3.10"
        echo "将使用系统默认 Python 环境"
    fi
else
    # 检查是否有虚拟环境
    if [ -d "venv" ]; then
        echo "检测到虚拟环境，激活中..."
        source venv/bin/activate
        echo "✓ 已激活虚拟环境"
    else
        echo "使用系统默认 Python 环境"
        echo "提示: 建议创建虚拟环境: python -m venv venv"
    fi
fi

#------------------------------------------------------------------------------
# 检查端口占用
#------------------------------------------------------------------------------
echo ""
echo "检查端口 ${PORT}..."
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告: 端口 ${PORT} 已被占用"
    echo "是否要停止现有服务并重新启动？(y/n)"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -ti :${PORT})
        echo "正在停止进程 ${PID}..."
        kill $PID
        sleep 2
        echo "✓ 已停止现有服务"
    else
        echo "取消启动"
        exit 1
    fi
else
    echo "✓ 端口 ${PORT} 可用"
fi

#------------------------------------------------------------------------------
# 检查 vLLM 是否已安装
#------------------------------------------------------------------------------
echo ""
echo "检查 vLLM 安装..."
if python -c "import vllm" 2>/dev/null; then
    echo "✓ 检测到 vLLM"
    
    # 检查 vLLM 版本
    VLLM_VERSION=$(python -c "import vllm; print(vllm.__version__)" 2>/dev/null)
    echo "  版本: ${VLLM_VERSION}"
    
    #--------------------------------------------------------------------------
    # 确定模型路径
    #--------------------------------------------------------------------------
    echo ""
    echo "检查模型路径..."
    
    if [ -d "${MODEL_DIR}" ]; then
        # 使用本地模型
        echo "✓ 找到本地模型: ${MODEL_DIR}"
        MODEL_PATH="${MODEL_DIR}"
    else
        # 使用 Hugging Face 自动下载
        echo "⚠️  未找到本地模型目录: ${MODEL_DIR}"
        echo "将使用 Hugging Face 自动下载模型: zai-org/AutoGLM-Phone-9B"
        echo "提示: 首次下载可能需要较长时间（约 18GB）"
        echo ""
        read -p "是否继续？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "取消启动"
            echo ""
            echo "如需手动下载模型，运行:"
            echo "  pip install huggingface-hub"
            echo "  huggingface-cli download zai-org/AutoGLM-Phone-9B --local-dir ${MODEL_DIR}"
            exit 1
        fi
        MODEL_PATH="zai-org/AutoGLM-Phone-9B"
    fi
    
    #--------------------------------------------------------------------------
    # 启动 vLLM 服务
    #--------------------------------------------------------------------------
    echo ""
    echo "=========================================="
    echo "启动 vLLM 服务"
    echo "=========================================="
    echo "模型: ${MODEL_PATH}"
    echo "端口: ${PORT}"
    echo "服务名称: ${MODEL_NAME}"
    echo ""
    echo "提示: vLLM 启动可能需要较长时间，请耐心等待"
    echo "      首次加载模型需要下载和编译，可能需要 5-10 分钟"
    echo ""
    echo "API 端点:"
    echo "  - 模型列表: http://localhost:${PORT}/v1/models"
    echo "  - 聊天补全: http://localhost:${PORT}/v1/chat/completions"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo "=========================================="
    echo ""
    
    # 前台启动 vLLM（显示所有日志）
    # 参数说明:
    #   --served-model-name: API 中使用的模型名称
    #   --allowed-local-media-path: 允许访问本地媒体文件（用于图像输入）
    #   --mm-encoder-tp-mode: 多模态编码器张量并行模式
    #   --mm_processor_cache_type: 多模态处理器缓存类型（共享内存）
    #   --mm_processor_kwargs: 多模态处理器参数（最大像素数）
    #   --max-model-len: 最大序列长度
    #   --chat-template-content-format: 聊天模板内容格式
    #   --limit-mm-per-prompt: 每个提示的多模态输入限制
    #   --model: 模型路径或 Hugging Face 模型 ID
    #   --port: 服务端口
    #   --trust-remote-code: 信任远程代码（某些模型需要）
    python3 -m vllm.entrypoints.openai.api_server \
        --served-model-name ${MODEL_NAME} \
        --allowed-local-media-path / \
        --mm-encoder-tp-mode data \
        --mm_processor_cache_type shm \
        --mm_processor_kwargs '{"max_pixels":5000000}' \
        --max-model-len 25480 \
        --chat-template-content-format string \
        --limit-mm-per-prompt '{"image":10}' \
        --model "${MODEL_PATH}" \
        --port ${PORT} \
        --trust-remote-code
    
else
    #--------------------------------------------------------------------------
    # vLLM 未安装
    #--------------------------------------------------------------------------
    echo "❌ vLLM 未安装"
    echo ""
    echo "vLLM 是一个高性能的大模型推理引擎，用于运行 AutoGLM-Phone-9B 模型"
    echo ""
    echo "安装要求:"
    echo "  - Python 3.8 - 3.11"
    echo "  - CUDA 11.8 或更高版本"
    echo "  - NVIDIA GPU（显存 ≥ 24GB）"
    echo ""
    echo "安装命令:"
    echo "  pip install vllm>=0.12.0 transformers>=4.56.0"
    echo ""
    echo "如果安装失败，请参考 vLLM 官方文档:"
    echo "  https://docs.vllm.ai/en/latest/getting_started/installation.html"
    echo ""
    echo "=========================================="
    echo "替代方案: 使用远程 API 服务"
    echo "=========================================="
    echo ""
    echo "如果没有 GPU 或不想本地部署，可以使用远程 API 服务:"
    echo ""
    echo "1. 智谱 AI BigModel（推荐）"
    echo "   - 注册: https://open.bigmodel.cn/"
    echo "   - 配置 .env:"
    echo "     AUTOGLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4"
    echo "     AUTOGLM_MODEL_NAME=autoglm-phone"
    echo "     AUTOGLM_API_KEY=your-api-key"
    echo ""
    echo "2. ModelScope"
    echo "   - 注册: https://modelscope.cn/"
    echo "   - 配置 .env:"
    echo "     AUTOGLM_BASE_URL=https://api-inference.modelscope.cn/v1"
    echo "     AUTOGLM_MODEL_NAME=ZhipuAI/AutoGLM-Phone-9B"
    echo "     AUTOGLM_API_KEY=your-api-key"
    echo ""
    echo "使用远程 API 后，无需运行此脚本，直接启动后端服务即可"
    echo ""
    exit 1
fi

