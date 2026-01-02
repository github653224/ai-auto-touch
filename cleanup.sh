#!/bin/bash

# 项目清理脚本 - 为开源发布准备
# 使用方法: bash cleanup.sh

set -e

echo "🧹 开始清理项目..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 确认操作
echo -e "${YELLOW}⚠️  警告: 此脚本将删除临时文件和文档${NC}"
echo "建议先创建备份分支: git checkout -b backup-before-cleanup"
echo ""
read -p "是否继续? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "已取消"
    exit 1
fi

echo ""
echo "📝 步骤 1: 删除临时开发文档..."

# 临时开发文档
TEMP_DOCS=(
    "APP_SWITCH_FEATURE_ADDED.md"
    "BUGFIX_ADB_COMMAND_RESULT.md"
    "DEBUG_STEPS.md"
    "FEATURES_IMPLEMENTED.txt"
    "IMPLEMENTATION_COMPLETE.md"
    "IMPLEMENTATION_SUMMARY.txt"
    "NEW_PAGES_IMPLEMENTED.md"
    "REALTIME_QUALITY_UPDATE.txt"
    "SCREEN_DISPLAY_FEATURES.md"
    "SIMPLIFIED_SCREEN_DISPLAY.md"
    "VIDEO_MODE_DISABLED.md"
)

for doc in "${TEMP_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        rm -f "$doc"
        echo -e "${GREEN}✓${NC} 已删除: $doc"
    fi
done

echo ""
echo "📚 步骤 2: 整理功能文档到 docs/ 目录..."

# 创建 docs 目录（如果不存在）
mkdir -p docs/images

# 移动或整合文档
if [ -f "PHONE_CONTROL_IMPLEMENTED.md" ] || [ -f "PHONE_CONTROL_UI_IMPLEMENTED.md" ]; then
    echo -e "${YELLOW}ℹ${NC}  发现手机控制文档，建议手动整合到 docs/PHONE_CONTROL.md"
    echo "   - PHONE_CONTROL_IMPLEMENTED.md"
    echo "   - PHONE_CONTROL_UI_IMPLEMENTED.md"
    echo "   - QUICK_START_PHONE_CONTROL.md"
    echo "   - UI_LAYOUT_GUIDE.md"
    echo ""
    read -p "是否删除这些文档? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f PHONE_CONTROL_IMPLEMENTED.md
        rm -f PHONE_CONTROL_UI_IMPLEMENTED.md
        rm -f QUICK_START_PHONE_CONTROL.md
        rm -f UI_LAYOUT_GUIDE.md
        echo -e "${GREEN}✓${NC} 已删除手机控制文档"
    fi
fi

echo ""
echo "🗑️  步骤 3: 删除系统临时文件..."

# 删除 .DS_Store
find . -name ".DS_Store" -type f -delete
echo -e "${GREEN}✓${NC} 已删除所有 .DS_Store 文件"

# 删除 Python 缓存
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
echo -e "${GREEN}✓${NC} 已删除 Python 缓存文件"

echo ""
echo "📦 步骤 4: 检查子项目..."

# auto-touch 目录
if [ -d "auto-touch" ]; then
    echo -e "${YELLOW}ℹ${NC}  发现 auto-touch 目录（参考项目）"
    read -p "是否删除? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf auto-touch
        echo -e "${GREEN}✓${NC} 已删除 auto-touch 目录"
    fi
fi

# Open-AutoGLM 目录
if [ -d "Open-AutoGLM" ]; then
    echo -e "${YELLOW}ℹ${NC}  发现 Open-AutoGLM 目录"
    echo "   建议: 改为 git submodule 或添加到 .gitignore"
    read -p "是否删除? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf Open-AutoGLM
        echo -e "${GREEN}✓${NC} 已删除 Open-AutoGLM 目录"
    fi
fi

echo ""
echo "🔍 步骤 5: 检查环境配置文件..."

# 检查 .env 文件
if [ -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️${NC}  发现 backend/.env 文件"
    echo "   请确保此文件不会被提交到 Git"
    echo "   建议: 添加到 .gitignore"
fi

if [ ! -f "backend/.env.example" ]; then
    echo -e "${YELLOW}⚠️${NC}  未找到 backend/.env.example 文件"
    echo "   建议: 创建示例配置文件"
fi

echo ""
echo "📦 步骤 6: 检查大文件和模型..."

# 检查 models 目录
if [ -d "models" ]; then
    MODEL_SIZE=$(du -sh models/ 2>/dev/null | cut -f1)
    echo -e "${YELLOW}ℹ${NC}  发现 models 目录（大小: $MODEL_SIZE）"
    echo "   ✅ 已在 .gitignore 中，不会被推送"
    
    # 检查是否被 Git 跟踪
    if git ls-files models/ 2>/dev/null | grep -q .; then
        echo -e "${RED}⚠️  警告: models 目录已被 Git 跟踪！${NC}"
        echo "   需要从 Git 中移除:"
        echo "   git rm -r --cached models/"
        echo "   git commit -m 'chore: remove models from git tracking'"
    fi
fi

# 检查 Git 仓库大小
GIT_SIZE=$(du -sh .git 2>/dev/null | cut -f1)
echo -e "${YELLOW}ℹ${NC}  Git 仓库大小: $GIT_SIZE"
if [[ "$GIT_SIZE" =~ ^[0-9]+G ]]; then
    echo -e "${RED}⚠️  警告: Git 仓库过大（>1GB）${NC}"
    echo "   可能包含大文件，建议检查并清理"
    echo "   参考: docs/MODEL_SETUP.md"
fi

echo ""
echo "📋 步骤 7: 生成清理报告..."

# 统计文件数量
TOTAL_FILES=$(find . -type f | wc -l | tr -d ' ')
PY_FILES=$(find . -name "*.py" | wc -l | tr -d ' ')
TS_FILES=$(find . -name "*.ts" -o -name "*.tsx" | wc -l | tr -d ' ')
MD_FILES=$(find . -name "*.md" | wc -l | tr -d ' ')

echo ""
echo "📊 项目统计:"
echo "   总文件数: $TOTAL_FILES"
echo "   Python 文件: $PY_FILES"
echo "   TypeScript 文件: $TS_FILES"
echo "   Markdown 文件: $MD_FILES"

echo ""
echo -e "${GREEN}✅ 清理完成!${NC}"
echo ""
echo "📝 后续步骤:"
echo "   1. 检查 git status 确认删除的文件"
echo "   2. 整理文档到 docs/ 目录"
echo "   3. 更新 README.md"
echo "   4. 检查 .gitignore"
echo "   5. 运行测试: cd backend && pytest"
echo "   6. 运行测试: cd frontend && npm test"
echo "   7. 提交更改: git add . && git commit -m 'chore: cleanup for open source'"
echo ""
echo "📖 详细指南请查看: CLEANUP_GUIDE.md"
