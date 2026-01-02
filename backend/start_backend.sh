#!/bin/bash

#==============================================================================
# AI Auto Touch - 后端主服务启动脚本
#==============================================================================
# 功能: 启动 FastAPI 后端服务
# 端口: 8001
# 用法: ./start_backend.sh
# 说明: 前台运行，显示所有日志，按 Ctrl+C 停止服务
#==============================================================================

echo "=========================================="
echo "后端主服务启动脚本"
echo "=========================================="

#------------------------------------------------------------------------------
# 配置项
#------------------------------------------------------------------------------
# Conda 环境名称（如果使用 conda）
CONDA_ENV_NAME="ai-auto-touch"

# 服务端口
PORT=8001

#------------------------------------------------------------------------------
# 设置 ADB 路径
#------------------------------------------------------------------------------
# 确保 bash 环境下也能找到 adb 命令
# 从 zsh 配置中获取 ANDROID_HOME，如果不存在则使用默认路径

if [ -z "$ANDROID_HOME" ]; then
    # 尝试从常见的 Android SDK 路径中查找
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "/usr/local/android-sdk" ]; then
        export ANDROID_HOME="/usr/local/android-sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    fi
fi

# 如果找到了 ANDROID_HOME，添加到 PATH
if [ -n "$ANDROID_HOME" ]; then
    export PATH="$PATH:$ANDROID_HOME/platform-tools"
    export PATH="$PATH:$ANDROID_HOME/tools"
    export PATH="$PATH:$ANDROID_HOME/tools/bin"
    echo "✓ 已设置 ANDROID_HOME: $ANDROID_HOME"
    echo "✓ ADB 路径已添加到 PATH"
else
    echo "⚠️  警告: 未找到 ANDROID_HOME，将尝试使用系统 PATH 中的 adb"
fi

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
# 检查 AI 模型服务配置
#------------------------------------------------------------------------------
echo ""
echo "检查 AI 模型服务配置..."

# 读取 .env 文件中的配置
if [ -f ".env" ]; then
    # 提取 AUTOGLM_BASE_URL
    BASE_URL=$(grep "^AUTOGLM_BASE_URL=" .env | cut -d '=' -f2 | tr -d ' "'"'"'')
    
    if [[ $BASE_URL == *"localhost"* ]] || [[ $BASE_URL == *"127.0.0.1"* ]]; then
        # 使用本地模型服务
        echo "检测到本地模型配置: ${BASE_URL}"
        echo "检查本地模型服务..."
        
        if curl -s "${BASE_URL}/models" > /dev/null 2>&1; then
            echo "✓ 本地 AI 模型服务已运行"
        else
            echo "⚠️  警告: 本地 AI 模型服务未启动或无法访问"
            echo "提示: 请先启动模型服务: ./start_model.sh"
            echo ""
            read -p "是否继续启动后端服务？(y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        # 使用远程 API 服务
        echo "✓ 使用远程 API 服务: ${BASE_URL}"
        echo "提示: 确保已在 .env 文件中配置正确的 API Key"
    fi
else
    echo "⚠️  警告: 未找到 .env 文件"
    echo "提示: 复制 .env.example 并配置: cp .env.example .env"
    echo ""
    read -p "是否继续启动？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

#------------------------------------------------------------------------------
# 检查并安装依赖
#------------------------------------------------------------------------------
echo ""
echo "检查 Python 依赖..."
if ! python -c "import fastapi" 2>/dev/null; then
    echo "安装依赖..."
    pip install -r requirements.txt
else
    echo "✓ 依赖已安装"
fi

#------------------------------------------------------------------------------
# 启动服务
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "启动后端主服务"
echo "=========================================="
echo "服务地址: http://localhost:${PORT}"
echo "API 文档: http://localhost:${PORT}/docs"
echo "交互式文档: http://localhost:${PORT}/redoc"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 前台启动后端服务（显示所有日志）
# --reload: 代码修改后自动重启（开发模式）
uvicorn main:app --host 0.0.0.0 --port ${PORT} --reload

