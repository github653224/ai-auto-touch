#!/bin/bash

# 后端主服务启动脚本（独立启动，前台运行，显示日志）
# 使用方法: ./start_backend.sh
# 按 Ctrl+C 停止服务

echo "=========================================="
echo "后端主服务启动脚本"
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
if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告: 端口 8001 已被占用"
    echo "是否要停止现有服务并重新启动？(y/n)"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -ti :8001)
        kill $PID
        sleep 2
    else
        echo "取消启动"
        exit 1
    fi
fi

# 检查AI模型服务
echo "检查AI模型服务..."
if curl -s http://localhost:8000/v1/models > /dev/null 2>&1; then
    echo "✓ AI模型服务已运行在 http://localhost:8000"
elif lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告: 端口8000已被占用，但无法访问AI服务"
    echo "提示: 请确保AI模型服务已启动（运行 ./start_model.sh）"
else
    echo "⚠️  警告: AI模型服务未启动"
    echo "提示: 需要先启动AI模型服务：运行 ./start_model.sh"
    echo ""
    read -p "是否继续启动后端服务？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查依赖
echo "检查依赖..."
if ! python -c "import fastapi" 2>/dev/null; then
    echo "安装依赖..."
    pip install -r requirements.txt
fi

echo ""
echo "=========================================="
echo "启动后端主服务 (端口 8001)"
echo "服务地址: http://localhost:8001"
echo "API文档: http://localhost:8001/docs"
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 前台启动后端服务（显示所有日志）
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

