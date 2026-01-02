# AI 模型部署指南

本文档详细介绍如何部署 AutoGLM-Phone-9B 模型，包括远程 API 和本地部署两种方式。

## 目录

- [部署方式对比](#部署方式对比)
- [方式一：远程 API 服务](#方式一远程-api-服务)
- [方式二：本地部署](#方式二本地部署)
- [常见问题](#常见问题)
- [性能优化](#性能优化)

---

## 部署方式对比

| 特性 | 远程 API | 本地部署 |
|------|---------|---------|
| **配置难度** | ⭐ 简单 | ⭐⭐⭐⭐ 复杂 |
| **硬件要求** | 无要求 | GPU 显存 ≥ 24GB |
| **响应速度** | 取决于网络 | 快速（本地推理） |
| **成本** | 按使用量付费 | 一次性硬件投入 |
| **隐私性** | 数据上传到云端 | 数据完全本地 |
| **适用场景** | 快速体验、小规模使用 | 大规模使用、隐私要求高 |

**推荐选择：**
- 新手用户、快速体验 → 远程 API
- 有 GPU 的用户、大规模使用 → 本地部署

---

## 方式一：远程 API 服务

### 1.1 智谱 AI BigModel（推荐）

智谱 AI 是 AutoGLM 模型的官方提供商，服务稳定，响应快速。

#### 注册和获取 API Key

1. 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 注册账号并登录
3. 进入"API 密钥"页面
4. 创建新的 API Key 并复制

#### 配置

编辑 `backend/.env` 文件：

```bash
AUTOGLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
AUTOGLM_MODEL_NAME=autoglm-phone
AUTOGLM_API_KEY=your-api-key-here  # 替换为你的 API Key
AUTOGLM_MAX_STEPS=100
```

#### 验证配置

```bash
# 启动后端服务
cd backend
bash start_backend.sh

# 在另一个终端测试 API
curl -X POST "http://localhost:8001/api/v1/ai/status"
```

---

### 1.2 ModelScope

ModelScope 是阿里云推出的模型服务平台，国内访问速度快。

#### 配置

编辑 `backend/.env` 文件：

```bash
AUTOGLM_BASE_URL=https://api-inference.modelscope.cn/v1
AUTOGLM_MODEL_NAME=ZhipuAI/AutoGLM-Phone-9B
AUTOGLM_API_KEY=your-modelscope-api-key
AUTOGLM_MAX_STEPS=100
```

---

### 1.3 其他 OpenAI 兼容 API

本项目支持任何 OpenAI 格式的 API 服务。

#### 配置

```bash
AUTOGLM_BASE_URL=https://your-api-endpoint.com/v1
AUTOGLM_MODEL_NAME=your-model-name
AUTOGLM_API_KEY=your-api-key
AUTOGLM_MAX_STEPS=100
```

---

## 方式二：本地部署

### 2.1 硬件要求

#### 最低配置
- **GPU**: NVIDIA GPU，显存 ≥ 24GB
- **内存**: ≥ 32GB RAM
- **磁盘**: ≥ 50GB 可用空间
- **CUDA**: 11.8 或更高版本

#### 推荐配置
- **GPU**: NVIDIA RTX 4090 (24GB) 或 A100 (40GB/80GB)
- **内存**: ≥ 64GB RAM
- **磁盘**: ≥ 100GB SSD
- **CUDA**: 12.1 或更高版本

---

### 2.2 安装依赖

#### 安装 vLLM

```bash
# 安装 vLLM 和依赖
pip install vllm>=0.12.0 transformers>=4.56.0

# 验证安装
python -c "import vllm; print(vllm.__version__)"
```

---

### 2.3 下载模型

#### 方式 A：使用 Hugging Face CLI

```bash
# 安装 Hugging Face CLI
pip install huggingface-hub

# 下载模型
huggingface-cli download zai-org/AutoGLM-Phone-9B \
  --local-dir ./models/AutoGLM-Phone-9B
```

#### 方式 B：使用 ModelScope（国内推荐）

```bash
# 安装 ModelScope CLI
pip install modelscope

# 下载模型
modelscope download --model ZhipuAI/AutoGLM-Phone-9B \
  --local_dir ./models/AutoGLM-Phone-9B
```

---

### 2.4 启动模型服务

#### 使用启动脚本（推荐）

```bash
cd backend
bash start_model.sh
```

#### 手动启动

```bash
python3 -m vllm.entrypoints.openai.api_server \
  --served-model-name autoglm-phone-9b \
  --model ./models/AutoGLM-Phone-9B \
  --port 8000 \
  --trust-remote-code
```

---

### 2.5 配置后端

编辑 `backend/.env` 文件：

```bash
AUTOGLM_BASE_URL=http://localhost:8000/v1
AUTOGLM_MODEL_NAME=autoglm-phone-9b
AUTOGLM_API_KEY=EMPTY
AUTOGLM_MAX_STEPS=100
```

---

## 常见问题

### Q1: vLLM 安装失败

**解决方案**:
1. 确保 CUDA 版本正确（11.8 或更高）
2. 确保 PyTorch 已正确安装
3. 查看 [vLLM 故障排除文档](https://docs.vllm.ai/)

### Q2: 显存不足（OOM）

**解决方案**:
1. 减少最大序列长度：`--max-model-len 20000`
2. 启用 CPU offload：`--cpu-offload-gb 8`

### Q3: 模型下载速度慢

**解决方案**:
1. 使用 Hugging Face 镜像：`export HF_ENDPOINT=https://hf-mirror.com`
2. 使用 ModelScope（国内用户）

---

## 参考资源

- [vLLM 官方文档](https://docs.vllm.ai/)
- [AutoGLM GitHub](https://github.com/THUDM/AutoGLM)
- [智谱 AI 开放平台](https://open.bigmodel.cn/)

---

**最后更新**: 2026-01-02
