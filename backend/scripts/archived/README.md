# 已归档的启动脚本

这个目录包含已被新脚本替代的旧启动脚本。

## 归档原因

这些脚本的功能已被 `start_all.sh` 统一启动脚本替代：

- **start.sh** - 通用启动脚本（自动检测conda/venv）
- **start_conda.sh** - Conda环境启动脚本

## 当前推荐使用的脚本

### 统一启动（推荐）
```bash
./start_all.sh      # 启动所有服务
./stop_all.sh        # 停止所有服务
```

### 单独启动（如需单独调试）
```bash
./start_vllm.sh           # 仅启动AI模型服务（vLLM）
./start_local_model.sh    # 仅启动本地模型服务
```

## 如果需要恢复旧脚本

如果需要使用旧的启动方式，可以从这个目录复制回去：

```bash
cp scripts/archived/start.sh .
cp scripts/archived/start_conda.sh .
```

