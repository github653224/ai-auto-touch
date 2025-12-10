# 手动安装 vLLM

## 快速安装命令

在新的终端窗口中执行：

```bash
# 1. 激活conda环境
conda activate ai-auto-touch

# 2. 安装vLLM（可能需要5-10分钟，请耐心等待）
# 注意：vLLM 0.12.0 需要 transformers<5，所以使用正确的版本范围
pip install "vllm>=0.12.0" "transformers>=4.56.0,<5"

# 3. 验证安装
python -c "import vllm; print(f'vLLM版本: {vllm.__version__}')"
```

## 如果安装很慢或卡住

### 方案1：使用国内镜像（加速）

```bash
conda activate ai-auto-touch
pip install "vllm>=0.12.0" "transformers>=4.56.0,<5" -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 方案2：分步安装

```bash
conda activate ai-auto-touch

# 先安装基础依赖
pip install "transformers>=4.56.0,<5"

# 再安装vLLM
pip install "vllm>=0.12.0"
```

### 方案3：如果vLLM安装失败（macOS常见问题）

**注意**：vLLM 主要支持 Linux + CUDA，在 macOS 上可能无法正常工作。

如果安装失败，可以：

1. **使用CPU版本的替代方案**（功能受限）：
```bash
pip install vllm --extra-index-url https://download.pytorch.org/whl/cpu
```

2. **或跳过vLLM，使用其他方案**：
   - 继续使用 `local_api.py`（功能受限）
   - 使用 Docker 运行 vLLM
   - 在 Linux 服务器上运行

## 安装完成后

安装成功后，运行：

```bash
cd backend
./start_vllm.sh
```

## 检查安装进度

如果想知道安装进度，可以在另一个终端查看：

```bash
# 查看pip进程
ps aux | grep pip

# 或查看pip缓存
ls -lh ~/.cache/pip/
```

