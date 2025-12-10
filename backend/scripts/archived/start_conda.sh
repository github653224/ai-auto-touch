#!/bin/bash

# 后端启动脚本（Conda版本）
# 使用方法: ./start_conda.sh 或 bash start_conda.sh
# 前提: 已创建并激活conda环境 ai-auto-touch

echo "=========================================="
echo "群控手机平台 - 后端服务启动脚本 (Conda)"
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

# 安装/更新依赖
echo "检查依赖..."
pip install --upgrade pip
pip install -r requirements.txt

# 检查Open-AutoGLM是否已安装
echo "检查Open-AutoGLM依赖..."
if ! python -c "import phone_agent" 2>/dev/null; then
    echo "警告: phone_agent未安装，正在尝试安装..."
    if [ -d "../Open-AutoGLM" ]; then
        echo "在Open-AutoGLM目录中安装phone_agent..."
        cd ../Open-AutoGLM
        pip install -e .
        cd ../backend
    else
        echo "错误: 未找到Open-AutoGLM目录，请确保项目结构正确"
        echo "提示: 需要先安装Open-AutoGLM，运行: cd ../Open-AutoGLM && pip install -e ."
    fi
fi

# 检查环境变量
echo "检查环境配置..."
if [ ! -f ".env" ]; then
    echo "创建.env配置文件..."
    cat > .env << EOF
# 后端服务配置
HOST=0.0.0.0
PORT=8001
DEBUG=True
WORKERS=1

# ADB和scrcpy路径（如果已添加到系统PATH，保持默认即可）
ADB_PATH=adb
SCRCPY_PATH=scrcpy

# AI模型服务配置（确保vLLM服务已启动在8000端口）
AUTOGLM_BASE_URL=http://localhost:8000/v1
AUTOGLM_MODEL_NAME=autoglm-phone-9b
AUTOGLM_MAX_STEPS=100

# 设备配置
MAX_DEVICES=100
SCREENSHOT_INTERVAL=1
EOF
    echo ".env文件已创建，请根据需要修改配置"
fi

# 检查ADB
echo "检查ADB..."
if ! command -v adb &> /dev/null; then
    echo "警告: ADB未找到，请确保已安装并添加到PATH"
else
    adb_version=$(adb --version 2>&1 | head -n 1)
    echo "ADB: $adb_version"
fi

# 检查scrcpy
echo "检查scrcpy..."
if ! command -v scrcpy &> /dev/null; then
    echo "警告: scrcpy未找到，请确保已安装并添加到PATH"
else
    scrcpy_version=$(scrcpy --version 2>&1 | head -n 1)
    echo "scrcpy: $scrcpy_version"
fi

# 检查AI模型服务
echo "检查AI模型服务..."
if curl -s http://localhost:8000/v1/models > /dev/null 2>&1; then
    echo "✓ AI模型服务已运行在 http://localhost:8000"
elif lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "警告: 端口8000已被占用，但无法访问AI服务"
    echo "提示: 请确保AI模型服务已启动（vLLM或local_api.py）"
else
    echo "警告: AI模型服务未启动"
    echo "提示: 需要先启动AI模型服务："
    echo "  方案1 (推荐): 使用vLLM (参考README.md 1.3.3节)"
    echo "  方案2 (简单): 运行 ./start_local_model.sh 启动本地模型服务"
fi

# 启动服务
echo ""
echo "=========================================="
echo "启动后端服务..."
echo "服务地址: http://localhost:8001"
echo "API文档: http://localhost:8001/docs"
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 使用uvicorn启动
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

