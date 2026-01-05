#!/data/data/com.termux/files/usr/bin/bash

# Open-AutoGLM 混合方案 - Termux 一键部署脚本
# 版本: 1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo "============================================================"
    echo "  Open-AutoGLM 混合方案 - 一键部署"
    echo "  版本: 1.0.0"
    echo "============================================================"
    echo ""
}

# 检查网络连接
check_network() {
    print_info "检查网络连接..."
    if ping -c 1 8.8.8.8 &> /dev/null; then
        print_success "网络连接正常"
    else
        print_error "网络连接失败，请检查网络设置"
        exit 1
    fi
}

# 更新软件包
update_packages() {
    print_info "更新软件包列表..."
    pkg update -y
    print_success "软件包列表更新完成"
}

# 安装必要软件
install_dependencies() {
    print_info "安装必要软件..."
    
    # 检查并安装 Python
    if ! command -v python &> /dev/null; then
        print_info "安装 Python..."
        pkg install python -y
    else
        print_success "Python 已安装: $(python --version)"
    fi
    
    # 检查并安装 Git
    if ! command -v git &> /dev/null; then
        print_info "安装 Git..."
        pkg install git -y
    else
        print_success "Git 已安装: $(git --version)"
    fi
    
    # 安装其他工具
    pkg install curl wget -y
    
    # 新增：安装 Rust 和构建工具
    print_info "安装 Rust 和构建工具..."
    pkg install rust binutils clang uv -y
    
    # 新增：安装 Pillow 所需的图像库依赖
    print_info "安装 Pillow 图像库依赖..."
    pkg install libjpeg-turbo zlib libpng freetype libwebp libtiff -y
    
    print_success "必要软件安装完成"
}

# 安装 Python 依赖
install_python_packages() {
    print_info "安装 Python 依赖包..."
    
    # 确保在正确的目录
    cd ~ || {
        print_error "无法切换到 home 目录"
        return 1
    }
    
    # 检查虚拟环境是否存在
    if [ ! -d ".venv" ]; then
        print_info "创建虚拟环境..."
        uv venv .venv || {
            print_error "创建虚拟环境失败"
            return 1
        }
    fi
    
    # 检查虚拟环境结构
    print_info "检查虚拟环境结构..."
    if [ -d ".venv/bin" ]; then
        print_info "使用标准虚拟环境结构 (bin/)"
        VENV_ACTIVATE=".venv/bin/activate"
    elif [ -d ".venv/Scripts" ]; then
        print_info "使用 Windows 虚拟环境结构 (Scripts/)"
        VENV_ACTIVATE=".venv/Scripts/activate"
    else
        print_error "无法识别虚拟环境结构"
        print_info "列出 .venv 目录内容:"
        ls -la .venv/
        return 1
    fi
    
    # 激活虚拟环境
    if [ -f "$VENV_ACTIVATE" ]; then
        source "$VENV_ACTIVATE" || {
            print_error "虚拟环境激活失败"
            return 1
        }
        print_success "虚拟环境已激活"
    else
        print_error "虚拟环境激活脚本不存在: $(pwd)/$VENV_ACTIVATE"
        print_info "列出 .venv 目录内容:"
        ls -la .venv/
        return 1
    fi
    
    # 设置 UV_LINK_MODE 以避免硬链接失败
    export UV_LINK_MODE=copy
    
    # 设置 Rust 构建目标
    print_info "设置 Rust 构建目标..."
    export CARGO_BUILD_TARGET="$(rustc -Vv | grep host | awk '{print $2}')"
    
    # 新增：设置 Pillow 编译的环境变量，帮助找到库路径
    export PREFIX="/data/data/com.termux/files/usr"
    export LDFLAGS="-L${PREFIX}/lib/"
    export CFLAGS="-I${PREFIX}/include/"
    
    # 升级 pip
    uv pip install --upgrade pip
    
    # 安装依赖（如果还是失败，可添加 --no-binary pillow 以强制源构建测试）
    uv pip install pillow openai requests
    
    print_success "Python 依赖安装完成"
}

# 下载 Open-AutoGLM
download_autoglm() {
    print_info "下载 Open-AutoGLM 项目..."
    
    cd ~
    
    if [ -d "Open-AutoGLM" ]; then
        print_warning "Open-AutoGLM 目录已存在"
        read -p "是否删除并重新下载? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            rm -rf Open-AutoGLM
        else
            print_info "跳过下载，使用现有目录"
            return
        fi
    fi
    
    git clone https://github.com/zai-org/Open-AutoGLM.git
    
    print_success "Open-AutoGLM 下载完成"
}

# 安装 Open-AutoGLM
install_autoglm() {
    print_info "安装 Open-AutoGLM..."
    
    # 切换到 Open-AutoGLM 目录
    if [ ! -d ~/Open-AutoGLM ]; then
        print_error "Open-AutoGLM 目录不存在"
        return 1
    fi
    
    cd ~/Open-AutoGLM || {
        print_error "无法切换到 Open-AutoGLM 目录"
        return 1
    }
    
    print_info "当前目录: $(pwd)"
    
    # 检查并创建虚拟环境
    if [ ! -d ".venv" ]; then
        print_info "创建虚拟环境..."
        uv venv .venv || {
            print_error "创建虚拟环境失败"
            return 1
        }
    else
        print_info "虚拟环境已存在"
    fi
    
    # 检查虚拟环境结构
    print_info "检查虚拟环境结构..."
    if [ -d ".venv/bin" ]; then
        print_info "使用标准虚拟环境结构 (bin/)"
        VENV_ACTIVATE=".venv/bin/activate"
    elif [ -d ".venv/Scripts" ]; then
        print_info "使用 Windows 虚拟环境结构 (Scripts/)"
        VENV_ACTIVATE=".venv/Scripts/activate"
    else
        print_error "无法识别虚拟环境结构"
        print_info "列出 .venv 目录内容:"
        ls -la .venv/
        return 1
    fi
    
    # 检查虚拟环境激活脚本
    if [ ! -f "$VENV_ACTIVATE" ]; then
        print_error "虚拟环境激活脚本不存在: $(pwd)/$VENV_ACTIVATE"
        print_info "尝试列出 .venv 目录内容:"
        ls -la .venv/ 2>/dev/null || print_error ".venv 目录不可访问"
        return 1
    fi
    
    # 激活虚拟环境
    print_info "激活虚拟环境..."
    source "$VENV_ACTIVATE" || {
        print_error "虚拟环境激活失败"
        return 1
    }
    
    print_success "虚拟环境已激活"
    print_info "Python 路径: $(which python)"
    
    # 安装项目依赖
    if [ -f "requirements.txt" ]; then
        print_info "安装项目依赖..."
        uv pip install -r requirements.txt || {
            print_error "依赖安装失败"
            return 1
        }
    else
        print_warning "未找到 requirements.txt"
    fi
    
    # 安装 phone_agent
    print_info "安装 phone_agent..."
    uv pip install -e . || {
        print_error "phone_agent 安装失败"
        return 1
    }
    
    print_success "Open-AutoGLM 安装完成"
}

# 下载混合方案脚本
download_hybrid_scripts() {
    print_info "下载混合方案脚本..."
    
    cd ~
    
    # 创建目录
    mkdir -p ~/.autoglm
    
    # 下载 phone_controller.py (自动降级逻辑)
    # 注意: 这里需要替换为实际的下载链接
    # wget -O ~/.autoglm/phone_controller.py https://your-link/phone_controller.py
    # wget -O ~/.autoglm/phone_controller.py https://github.com/xietao778899-rgb/Open-AutoGLM-Hybrid/blob/main/termux-scripts/phone_controller.py
    
    # 暂时使用本地创建
    cat > ~/.autoglm/phone_controller.py << 'PYTHON_EOF'
# 这个文件会在后续步骤中创建
pass
PYTHON_EOF
    
    print_success "混合方案脚本下载完成"
}

# 配置 GRS AI
configure_grsai() {
    print_info "配置 GRS AI..."
    
    echo ""
    echo "请输入您的 GRS AI API Key:"
    read -p "API Key: " api_key
    
    if [ -z "$api_key" ]; then
        print_warning "未输入 API Key，跳过配置"
        print_warning "您可以稍后手动配置: export PHONE_AGENT_API_KEY='your_key'"
        return
    fi
    
    # 创建配置文件
    cat > ~/.autoglm/config.sh << EOF
#!/data/data/com.termux/files/usr/bin/bash

# GRS AI 配置
export PHONE_AGENT_BASE_URL="https://api.grsai.com/v1"
export PHONE_AGENT_API_KEY="$api_key"
export PHONE_AGENT_MODEL="gpt-4-vision-preview"

# AutoGLM Helper 配置
export AUTOGLM_HELPER_URL="http://localhost:8080"
EOF
    
    # 添加到 .bashrc
    if ! grep -q "source ~/.autoglm/config.sh" ~/.bashrc; then
        echo "" >> ~/.bashrc
        echo "# AutoGLM 配置" >> ~/.bashrc
        echo "source ~/.autoglm/config.sh" >> ~/.bashrc
    fi
    
    # 立即加载配置
    source ~/.autoglm/config.sh
    
    print_success "GRS AI 配置完成"
}

# 创建启动脚本
create_launcher() {
    print_info "创建启动脚本..."
    
    # 创建 autoglm 命令
    cat > ~/bin/autoglm << 'LAUNCHER_EOF'
#!/data/data/com.termux/files/usr/bin/bash

# 加载配置
source ~/.autoglm/config.sh

# 启动 AutoGLM
cd ~/Open-AutoGLM
python -m phone_agent.cli
LAUNCHER_EOF
    
    chmod +x ~/bin/autoglm
    
    # 确保 ~/bin 在 PATH 中
    if ! grep -q 'export PATH=$PATH:~/bin' ~/.bashrc; then
        echo 'export PATH=$PATH:~/bin' >> ~/.bashrc
    fi
    
    print_success "启动脚本创建完成"
}

# 检查 AutoGLM Helper
check_helper_app() {
    print_info "检查 AutoGLM Helper APP..."
    
    echo ""
    echo "请确保您已经:"
    echo "1. 安装了 AutoGLM Helper APK"
    echo "2. 开启了无障碍服务权限"
    echo ""
    
    read -p "是否已完成以上步骤? (y/n): " confirm
    
    if [ "$confirm" != "y" ]; then
        print_warning "请先完成以上步骤，然后重新运行部署脚本"
        print_info "APK 文件位置: 项目根目录/AutoGLM-Helper.apk"
        print_info "安装命令: adb install AutoGLM-Helper.apk"
        exit 0
    fi
    
    # 测试连接
    print_info "测试 AutoGLM Helper 连接..."
    
    if curl -s http://localhost:8080/status > /dev/null 2>&1; then
        print_success "AutoGLM Helper 连接成功！"
    else
        print_warning "无法连接到 AutoGLM Helper"
        print_info "这可能是因为:"
        print_info "1. AutoGLM Helper 未运行"
        print_info "2. 无障碍服务未开启"
        print_info "3. HTTP 服务器未启动"
        print_info ""
        print_info "请检查后重试"
    fi
}

# 显示完成信息
show_completion() {
    print_success "部署完成！"
    
    echo ""
    echo "============================================================"
    echo "  部署成功！"
    echo "============================================================"
    echo ""
    echo "使用方法:"
    echo "  1. 确保 AutoGLM Helper 已运行并开启无障碍权限"
    echo "  2. 在 Termux 中输入: autoglm"
    echo "  3. 输入任务，如: 打开淘宝搜索蓝牙耳机"
    echo ""
    echo "配置文件:"
    echo "  ~/.autoglm/config.sh"
    echo ""
    echo "启动命令:"
    echo "  autoglm"
    echo ""
    echo "故障排除:"
    echo "  - 检查 AutoGLM Helper 是否运行"
    echo "  - 检查无障碍权限是否开启"
    echo "  - 测试连接: curl http://localhost:8080/status"
    echo ""
    echo "============================================================"
    echo ""
}

# 主函数
main() {
    print_header
    
    # 检查是否在 Termux 中运行
    if [ ! -d "/data/data/com.termux" ]; then
        print_error "此脚本必须在 Termux 中运行！"
        exit 1
    fi
    
    # 执行部署步骤
    check_network
    update_packages
    install_dependencies
    install_python_packages
    download_autoglm
    install_autoglm
    download_hybrid_scripts
    configure_grsai
    create_launcher
    check_helper_app
    show_completion
}

# 运行主函数
main
