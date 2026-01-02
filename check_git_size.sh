#!/bin/bash

# Git 仓库大小检查脚本
# 用于确保大文件不会被推送到 GitHub

set -e

echo "🔍 检查 Git 仓库大小和大文件..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 检查 .git 目录大小
echo "📊 Git 仓库大小:"
GIT_SIZE=$(du -sh .git 2>/dev/null | cut -f1)
echo "   .git 目录: $GIT_SIZE"

if [[ "$GIT_SIZE" =~ ^[0-9]+G ]]; then
    echo -e "${RED}⚠️  警告: Git 仓库过大（>1GB）${NC}"
    echo "   可能包含大文件历史"
else
    echo -e "${GREEN}✓${NC} Git 仓库大小正常"
fi

echo ""

# 2. 检查 models 目录
echo "📦 检查 models 目录:"
if [ -d "models" ]; then
    MODEL_SIZE=$(du -sh models/ 2>/dev/null | cut -f1)
    echo "   models 目录大小: $MODEL_SIZE"
    
    # 检查是否在 .gitignore 中
    if grep -q "^models/" .gitignore 2>/dev/null; then
        echo -e "${GREEN}✓${NC} models/ 已在 .gitignore 中"
    else
        echo -e "${RED}✗${NC} models/ 不在 .gitignore 中"
    fi
    
    # 检查是否被 Git 跟踪
    if git ls-files models/ 2>/dev/null | grep -q .; then
        echo -e "${RED}✗ 警告: models 目录已被 Git 跟踪！${NC}"
        echo "   需要移除: git rm -r --cached models/"
    else
        echo -e "${GREEN}✓${NC} models/ 未被 Git 跟踪"
    fi
else
    echo "   models 目录不存在"
fi

echo ""

# 3. 检查暂存区中的大文件
echo "📋 检查暂存区中的大文件 (>10MB):"
LARGE_FILES=$(git diff --cached --name-only | while read file; do
    if [ -f "$file" ]; then
        size=$(du -m "$file" 2>/dev/null | cut -f1)
        if [ "$size" -gt 10 ]; then
            echo "$file ($size MB)"
        fi
    fi
done)

if [ -z "$LARGE_FILES" ]; then
    echo -e "${GREEN}✓${NC} 暂存区中没有大文件"
else
    echo -e "${RED}✗ 发现大文件:${NC}"
    echo "$LARGE_FILES"
fi

echo ""

# 4. 查找 Git 历史中的大文件
echo "🔎 查找 Git 历史中的大文件 (前 10 个):"
git rev-list --objects --all 2>/dev/null | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' 2>/dev/null | \
  sed -n 's/^blob //p' | \
  sort --numeric-sort --key=2 --reverse | \
  head -10 | \
  while read hash size path; do
    size_mb=$((size / 1024 / 1024))
    if [ $size_mb -gt 10 ]; then
        echo -e "${YELLOW}  $size_mb MB${NC} - $path"
    fi
  done

echo ""

# 5. 检查 .gitignore 配置
echo "📝 检查 .gitignore 配置:"
IMPORTANT_IGNORES=(
    "models/"
    "*.safetensors"
    "*.bin"
    "*.pt"
    "*.pth"
    ".env"
    "node_modules/"
    "__pycache__/"
)

for pattern in "${IMPORTANT_IGNORES[@]}"; do
    if grep -q "^$pattern" .gitignore 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $pattern"
    else
        echo -e "${RED}✗${NC} $pattern (缺失)"
    fi
done

echo ""

# 6. 检查未跟踪的大文件
echo "📂 检查未跟踪的大文件 (>10MB):"
UNTRACKED_LARGE=$(git ls-files --others --exclude-standard | while read file; do
    if [ -f "$file" ]; then
        size=$(du -m "$file" 2>/dev/null | cut -f1)
        if [ "$size" -gt 10 ]; then
            echo "$file ($size MB)"
        fi
    fi
done)

if [ -z "$UNTRACKED_LARGE" ]; then
    echo -e "${GREEN}✓${NC} 没有未跟踪的大文件"
else
    echo -e "${YELLOW}ℹ${NC}  发现未跟踪的大文件:"
    echo "$UNTRACKED_LARGE"
    echo "   这些文件不会被推送（如果在 .gitignore 中）"
fi

echo ""

# 7. 总结
echo "📊 总结:"
echo ""

# 计算工作区大小（不包括 .git）
WORK_SIZE=$(du -sh --exclude=.git . 2>/dev/null | cut -f1)
echo "   工作区大小: $WORK_SIZE"
echo "   Git 仓库大小: $GIT_SIZE"

# 检查是否安全推送
SAFE_TO_PUSH=true

if [[ "$GIT_SIZE" =~ ^[0-9]+G ]]; then
    SAFE_TO_PUSH=false
fi

if git ls-files models/ 2>/dev/null | grep -q .; then
    SAFE_TO_PUSH=false
fi

if [ -n "$LARGE_FILES" ]; then
    SAFE_TO_PUSH=false
fi

echo ""
if [ "$SAFE_TO_PUSH" = true ]; then
    echo -e "${GREEN}✅ 安全推送检查通过！${NC}"
    echo "   可以安全地推送到 GitHub"
else
    echo -e "${RED}⚠️  警告: 发现问题！${NC}"
    echo "   请先解决上述问题再推送"
    echo ""
    echo "💡 解决方案:"
    echo "   1. 确保 models/ 在 .gitignore 中"
    echo "   2. 移除已跟踪的大文件: git rm -r --cached models/"
    echo "   3. 清理 Git 历史: 参考 docs/MODEL_SETUP.md"
    echo "   4. 提交更改: git commit -m 'chore: remove large files'"
fi

echo ""
echo "📖 详细文档: docs/MODEL_SETUP.md"
