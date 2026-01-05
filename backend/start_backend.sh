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
echo ""
echo "=========================================="
echo "Python 环境配置"
echo "=========================================="

# 检查当前是否已在虚拟环境中
if [ -n "$VIRTUAL_ENV" ] || [ -n "$CONDA_DEFAULT_ENV" ]; then
    if [ -n "$CONDA_DEFAULT_ENV" ]; then
        echo "✓ 检测到已激活的 conda 环境: ${CONDA_DEFAULT_ENV}"
    else
        echo "✓ 检测到已激活的虚拟环境: ${VIRTUAL_ENV}"
    fi
    echo ""
    read -p "是否使用当前环境？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "✓ 使用当前环境"
    else
        echo "请先退出当前环境，然后重新运行此脚本"
        exit 1
    fi
else
    # 未检测到激活的环境，询问用户
    echo "未检测到已激活的虚拟环境"
    echo ""
    echo "请选择 Python 环境："
    echo "  1) 使用 conda 环境"
    echo "  2) 使用 venv 虚拟环境"
    echo "  3) 创建新的 conda 环境"
    echo "  4) 创建新的 venv 虚拟环境"
    echo "  5) 使用系统 Python（不推荐）"
    echo ""
    read -p "请输入选项 [1-5]: " -n 1 -r
    echo
    echo ""
    
    case $REPLY in
        1)
            # 使用现有 conda 环境
            if command -v conda &> /dev/null; then
                eval "$(conda shell.bash hook)"
                
                # 列出所有 conda 环境
                echo "可用的 conda 环境："
                conda env list | grep -v "^#" | awk '{print "  - " $1}'
                echo ""
                read -p "请输入要使用的环境名称 [默认: ${CONDA_ENV_NAME}]: " USER_ENV
                USER_ENV=${USER_ENV:-$CONDA_ENV_NAME}
                
                if conda activate ${USER_ENV} 2>/dev/null; then
                    echo "✓ 已激活 conda 环境: ${USER_ENV}"
                else
                    echo "❌ 无法激活环境: ${USER_ENV}"
                    echo "提示: 请检查环境名称是否正确"
                    exit 1
                fi
            else
                echo "❌ 未安装 conda"
                exit 1
            fi
            ;;
        2)
            # 使用现有 venv 环境
            read -p "请输入虚拟环境路径 [默认: venv]: " VENV_PATH
            VENV_PATH=${VENV_PATH:-venv}
            
            if [ -d "$VENV_PATH" ]; then
                source ${VENV_PATH}/bin/activate
                echo "✓ 已激活虚拟环境: ${VENV_PATH}"
            else
                echo "❌ 虚拟环境不存在: ${VENV_PATH}"
                exit 1
            fi
            ;;
        3)
            # 创建新的 conda 环境
            if command -v conda &> /dev/null; then
                eval "$(conda shell.bash hook)"
                
                read -p "请输入新环境名称 [默认: ${CONDA_ENV_NAME}]: " NEW_ENV
                NEW_ENV=${NEW_ENV:-$CONDA_ENV_NAME}
                
                read -p "请输入 Python 版本 [默认: 3.12]: " PY_VERSION
                PY_VERSION=${PY_VERSION:-3.12}
                
                echo "创建 conda 环境: ${NEW_ENV} (Python ${PY_VERSION})..."
                conda create -n ${NEW_ENV} python=${PY_VERSION} -y
                
                if conda activate ${NEW_ENV} 2>/dev/null; then
                    echo "✓ 已创建并激活 conda 环境: ${NEW_ENV}"
                else
                    echo "❌ 创建环境失败"
                    exit 1
                fi
            else
                echo "❌ 未安装 conda"
                exit 1
            fi
            ;;
        4)
            # 创建新的 venv 环境
            read -p "请输入虚拟环境路径 [默认: venv]: " VENV_PATH
            VENV_PATH=${VENV_PATH:-venv}
            
            echo "创建虚拟环境: ${VENV_PATH}..."
            python3 -m venv ${VENV_PATH}
            
            if [ -d "$VENV_PATH" ]; then
                source ${VENV_PATH}/bin/activate
                echo "✓ 已创建并激活虚拟环境: ${VENV_PATH}"
            else
                echo "❌ 创建虚拟环境失败"
                exit 1
            fi
            ;;
        5)
            # 使用系统 Python
            echo "⚠️  使用系统 Python 环境（不推荐）"
            echo "提示: 建议使用虚拟环境以避免依赖冲突"
            ;;
        *)
            echo "❌ 无效选项"
            exit 1
            ;;
    esac
fi

# 显示当前 Python 信息
echo ""
echo "当前 Python 环境信息："
echo "  Python 版本: $(python --version 2>&1)"
echo "  Python 路径: $(which python)"
if [ -n "$CONDA_DEFAULT_ENV" ]; then
    echo "  Conda 环境: ${CONDA_DEFAULT_ENV}"
elif [ -n "$VIRTUAL_ENV" ]; then
    echo "  虚拟环境: ${VIRTUAL_ENV}"
fi
echo ""

#------------------------------------------------------------------------------
# 检查端口占用
#------------------------------------------------------------------------------
echo ""
echo "检查端口 ${PORT}..."
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID=$(lsof -ti :${PORT})
    PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "未知进程")
    echo "⚠️  警告: 端口 ${PORT} 已被占用"
    echo "   进程 PID: ${PID}"
    echo "   进程名称: ${PROCESS_NAME}"
    echo ""
    echo "请选择操作："
    echo "  1) 自动停止并重启"
    echo "  2) 手动处理"
    echo "  3) 取消启动"
    echo ""
    read -p "请输入选项 [1-3]: " -n 1 -r
    echo
    
    case $REPLY in
        1)
            echo "正在停止进程 ${PID}..."
            kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
            sleep 2
            
            # 再次检查端口是否释放
            if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo "❌ 端口仍被占用，尝试强制停止..."
                kill -9 $(lsof -ti :${PORT}) 2>/dev/null
                sleep 1
            fi
            
            echo "✓ 已停止现有服务"
            ;;
        2)
            echo ""
            echo "请手动停止占用端口的进程："
            echo "  kill ${PID}"
            echo "或强制停止："
            echo "  kill -9 ${PID}"
            exit 1
            ;;
        3|*)
            echo "取消启动"
            exit 1
            ;;
    esac
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
# 使用 socket_app 以支持 Socket.IO 视频流功能
uvicorn main:socket_app --host 0.0.0.0 --port ${PORT} --reload

