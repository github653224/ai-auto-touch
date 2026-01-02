# 快速启动指南

5 分钟快速启动 AI Auto Touch 项目。

## 前置条件

- ✅ Python 3.8 - 3.11
- ✅ Node.js 14 - 18
- ✅ ADB 和 scrcpy 已安装
- ✅ Android 设备已开启 USB 调试

## 快速启动（3 步）

### 步骤 1: 克隆项目

```bash
git clone https://github.com/your-username/ai-auto-touch.git
cd ai-auto-touch
```

### 步骤 2: 配置 AI 模型服务

#### 方式 A: 使用远程 API（推荐）

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key
```

在 `.env` 中配置：
```bash
AUTOGLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
AUTOGLM_MODEL_NAME=autoglm-phone
AUTOGLM_API_KEY=your-api-key-here
```

获取 API Key: https://open.bigmodel.cn/

#### 方式 B: 本地部署（需要 GPU）

```bash
# 安装 vLLM
pip install vllm>=0.12.0 transformers>=4.56.0

# 配置
cd backend
cp .env.example .env
```

在 `.env` 中配置：
```bash
AUTOGLM_BASE_URL=http://localhost:8000/v1
AUTOGLM_MODEL_NAME=autoglm-phone-9b
AUTOGLM_API_KEY=EMPTY
```

### 步骤 3: 启动服务

打开 3 个终端窗口：

**终端 1 - AI 模型服务（仅本地部署需要）**
```bash
cd backend
bash start_model.sh
```

**终端 2 - 后端服务**
```bash
cd backend
pip install -r requirements.txt
bash start_backend.sh
```

**终端 3 - 前端服务**
```bash
cd frontend
npm install
npm run dev
```

## 验证安装

1. **检查后端**: http://localhost:8001/docs
2. **检查前端**: http://localhost:5173
3. **连接设备**: 在前端点击"扫描设备"

## 第一次使用

### 1. 连接设备

```bash
# 检查设备连接
adb devices
```

### 2. 扫描设备

- 打开 http://localhost:5173
- 点击"设备管理" → "扫描设备"
- 选择设备并连接

### 3. AI 控制

- 点击"AI 控制"
- 输入指令，例如：`打开微信`
- 点击"执行指令"

## 常见问题

### Q: 找不到 ADB 命令

```bash
# macOS
brew install android-platform-tools

# Ubuntu/Linux
sudo apt install android-tools-adb
```

### Q: 设备未授权

在设备上点击"允许 USB 调试"，勾选"始终允许"

### Q: 后端启动失败

检查：
1. Python 版本（3.8-3.11）
2. 依赖已安装
3. 端口 8001 未被占用
4. `.env` 配置正确

## 停止服务

```bash
cd backend
bash stop_all.sh
```

或在每个终端按 `Ctrl+C`

---

**需要帮助？** 查看 [完整文档](../README.md) 或提交 [Issue](https://github.com/your-username/ai-auto-touch/issues)
