#!/bin/bash

# 后端启动脚本
# 使用方法: ./start.sh 或 bash start.sh

echo "=========================================="
echo "群控手机平台 - 后端服务启动脚本"
echo "=========================================="

# 检查Python版本
echo "检查Python环境..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python版本: $python_version"

# 检查是否使用conda环境
CONDA_ENV_NAME="ai-auto-touch"
USE_CONDA=false

# 检查conda是否可用
if command -v conda &> /dev/null; then
    # 检查conda环境是否存在
    if conda env list | grep -q "^${CONDA_ENV_NAME} "; then
        USE_CONDA=true
        echo "检测到conda环境: ${CONDA_ENV_NAME}"
    fi
fi

# 激活环境
if [ "$USE_CONDA" = true ]; then
    echo "激活conda环境: ${CONDA_ENV_NAME}..."
    # 初始化conda（如果还没初始化）
    eval "$(conda shell.bash hook)"
    conda activate ${CONDA_ENV_NAME}
    echo "conda环境已激活"
else
    # 使用venv
    if [ ! -d "venv" ]; then
        echo "创建虚拟环境..."
        python3 -m venv venv
    fi
    echo "激活虚拟环境..."
    source venv/bin/activate
fi

# 安装/更新依赖
echo "检查依赖..."
pip install --upgrade pip
pip install -r requirements.txt

# 检查Open-AutoGLM是否已安装
echo "检查Open-AutoGLM依赖..."
if ! python3 -c "import phone_agent" 2>/dev/null; then
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

