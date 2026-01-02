# AI 模型设置指南

## 📦 模型文件说明

本项目使用 AI 模型进行智能控制，模型文件较大（约 19GB），**不包含在 Git 仓库中**。

## 🚫 为什么不包含模型文件？

- **文件太大**: 模型文件约 19GB，超过 GitHub 文件大小限制
- **版本管理**: 模型文件不适合用 Git 管理
- **灵活性**: 用户可以选择不同的模型或部署方式

## 📥 获取模型的方式

### 方式 1: 使用远程 API 服务（推荐新手）

**无需下载模型**，直接使用云端 API 服务。

#### 智谱 AI BigModel 服务

```bash
# 1. 注册并获取 API Key
# 访问 https://open.bigmodel.cn/

# 2. 配置环境变量
cd backend
cp .env.example .env

# 3. 编辑 .env 文件
AUTOGLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
AUTOGLM_MODEL_NAME=autoglm-phone
AUTOGLM_API_KEY=your-api-key-here
```

#### ModelScope 服务（国内推荐）

```bash
AUTOGLM_BASE_URL=https://api-inference.modelscope.cn/v1
AUTOGLM_MODEL_NAME=ZhipuAI/AutoGLM-Phone-9B
AUTOGLM_API_KEY=your-modelscope-api-key
```

### 方式 2: 本地部署模型（推荐有 GPU 的用户）

#### 硬件要求

- **GPU**: NVIDIA GPU，显存 ≥ 24GB
- **内存**: ≥ 32GB
- **磁盘**: ≥ 50GB 可用空间

#### 下载模型

**选项 A: 使用 Hugging Face**

```bash
# 安装 Hugging Face CLI
pip install huggingface-hub

# 下载模型到 models 目录
huggingface-cli download zai-org/AutoGLM-Phone-9B \
  --local-dir ./models/AutoGLM-Phone-9B
```

**选项 B: 使用 ModelScope（国内更快）**

```bash
# 安装 ModelScope
pip install modelscope

# 下载模型
modelscope download \
  --model ZhipuAI/AutoGLM-Phone-9B \
  --local_dir ./models/AutoGLM-Phone-9B
```

#### 启动模型服务

```bash
cd backend

# 使用启动脚本
bash start_model.sh

# 或手动启动
python3 -m vllm.entrypoints.openai.api_server \
  --served-model-name autoglm-phone-9b \
  --model ./models/AutoGLM-Phone-9B \
  --port 8000 \
  --trust-remote-code
```

#### 配置本地模型

```bash
# 编辑 backend/.env
AUTOGLM_BASE_URL=http://localhost:8000/v1
AUTOGLM_MODEL_NAME=autoglm-phone-9b
AUTOGLM_API_KEY=EMPTY
```

## 📂 目录结构

```
ai-auto-touch/
├── models/                    # 模型目录（不在 Git 中）
│   └── AutoGLM-Phone-9B/     # 下载的模型文件
│       ├── config.json
│       ├── model-*.safetensors
│       ├── tokenizer.json
│       └── ...
└── backend/
    ├── .env                   # 配置文件（不在 Git 中）
    └── .env.example          # 配置示例（在 Git 中）
```

## 🔒 .gitignore 配置

以下内容已添加到 `.gitignore`，确保大文件不会被推送：

```gitignore
# Models and large files
models/
*.safetensors
*.bin
*.pt
*.pth
*.ckpt
*.h5
*.pb
*.onnx

# Environment
.env
.env.local
```

## ⚠️ 重要提示

### 如果模型文件已经被 Git 跟踪

如果你不小心已经将模型文件添加到 Git，需要从历史中移除：

```bash
# 1. 从 Git 中移除（但保留本地文件）
git rm -r --cached models/

# 2. 提交更改
git add .gitignore
git commit -m "chore: remove models from git tracking"

# 3. 如果已经推送到远程，需要清理历史
# 使用 BFG Repo-Cleaner（推荐）
brew install bfg  # macOS
# 或从 https://rtyley.github.io/bfg-repo-cleaner/ 下载

# 清理大文件
bfg --delete-folders models
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 强制推送（警告：会重写历史）
git push origin --force --all
```

### 检查仓库大小

```bash
# 检查 Git 仓库大小
du -sh .git

# 查找大文件
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sed -n 's/^blob //p' | \
  sort --numeric-sort --key=2 | \
  tail -20
```

## 🌐 使用 Git LFS（可选）

如果确实需要在 Git 中管理大文件，可以使用 Git LFS：

```bash
# 安装 Git LFS
brew install git-lfs  # macOS
# 或访问 https://git-lfs.github.com/

# 初始化
git lfs install

# 跟踪大文件
git lfs track "models/**/*.safetensors"
git lfs track "models/**/*.bin"

# 添加 .gitattributes
git add .gitattributes
git commit -m "chore: add git lfs tracking"
```

**注意**: Git LFS 有存储限制和费用，不推荐用于超大模型文件。

## 📚 相关文档

- [快速开始指南](QUICK_START.md)
- [部署指南](../README.md#安装依赖)
- [故障排除](../TROUBLESHOOTING.md)

## 🤝 贡献

如果你有更好的模型管理方案，欢迎提交 PR！

## 📄 许可证

模型文件遵循其原始许可证。详见模型仓库：
- [AutoGLM-Phone-9B](https://huggingface.co/zai-org/AutoGLM-Phone-9B)
