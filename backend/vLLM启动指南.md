# vLLM 模型服务启动指南

## 为什么使用 vLLM？

GLM4V（AutoGLM-Phone-9B）是多模态模型，**不能直接用 transformers 加载**。vLLM 是专门为这类大模型设计的高性能推理引擎。

## 快速启动

### 方式一：使用启动脚本（推荐）

```bash
cd backend
./start_vllm.sh
```

### 方式二：手动启动

```bash
# 1. 激活conda环境
conda activate ai-auto-touch

# 2. 安装vLLM（如果还未安装）
pip install vllm>=0.12.0 transformers>=5.0.0rc0

# 3. 启动vLLM服务
python3 -m vllm.entrypoints.openai.api_server \
  --served-model-name autoglm-phone-9b \
  --allowed-local-media-path / \
  --mm-encoder-tp-mode data \
  --mm_processor_cache_type shm \
  --mm_processor_kwargs "{\"max_pixels\":5000000}" \
  --max-model-len 25480 \
  --chat-template-content-format string \
  --limit-mm-per-prompt "{\"image\":10}" \
  --model ./models/AutoGLM-Phone-9B \
  --port 8000
```

## 启动前检查

- [ ] conda环境已激活：`conda activate ai-auto-touch`
- [ ] vLLM已安装：`python -c "import vllm"`
- [ ] 模型文件完整：`./models/AutoGLM-Phone-9B` 目录存在
- [ ] 端口8000未被占用

## 验证服务

启动成功后，可以通过以下方式验证：

```bash
# 检查服务是否运行
curl http://localhost:8000/v1/models

# 或访问API文档（如果支持）
# 浏览器打开: http://localhost:8000/docs
```

## 常见问题

### 1. vLLM安装失败

**macOS用户注意**：vLLM 主要支持 Linux 和 CUDA，在 macOS 上可能无法正常工作。

**解决方案**：
- 使用 Linux 服务器或 WSL2
- 或使用 Docker 容器运行 vLLM
- 或考虑使用其他推理引擎（如 SGlang）

### 2. CUDA相关错误

如果出现 CUDA 相关错误：

```bash
# 检查CUDA是否可用
python -c "import torch; print(torch.cuda.is_available())"

# 如果没有CUDA，vLLM可能无法运行
# 考虑使用CPU版本的替代方案
```

### 3. 内存不足

如果出现内存不足错误：

- 减少 `--max-model-len` 参数（如改为 8192）
- 使用量化模型（如果可用）
- 增加系统内存

### 4. 模型加载慢

首次启动会加载模型到内存，可能需要几分钟，请耐心等待。

## 启动参数说明

| 参数 | 说明 |
|------|------|
| `--served-model-name` | 服务暴露的模型名称 |
| `--allowed-local-media-path` | 允许访问的本地媒体路径 |
| `--mm-encoder-tp-mode` | 多模态编码器并行模式 |
| `--mm_processor_cache_type` | 多模态处理器缓存类型 |
| `--mm_processor_kwargs` | 多模态处理器参数 |
| `--max-model-len` | 模型最大上下文长度 |
| `--chat-template-content-format` | 对话模板格式 |
| `--limit-mm-per-prompt` | 单提示最大图像数量 |
| `--model` | 模型路径 |
| `--port` | 服务端口 |

## 完整启动流程

1. **启动vLLM服务**：
   ```bash
   cd backend
   ./start_vllm.sh
   ```

2. **启动后端服务**（新终端）：
   ```bash
   cd backend
   ./start_conda.sh
   ```

3. **启动前端服务**（可选，新终端）：
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 性能优化

- 使用 GPU 可以大幅提升性能
- 调整 `--max-model-len` 根据实际需求
- 使用 `--tensor-parallel-size` 进行多GPU并行（如果有多个GPU）

## 停止服务

按 `Ctrl+C` 停止服务，或使用：

```bash
# 查找并终止进程
lsof -ti:8000 | xargs kill -9
```

