# 更新日志

所有重要的项目变更都会记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-01-02

### 新增

#### 核心功能
- 🎉 首次发布
- 🤖 AI 智能控制功能，支持自然语言指令
- 📱 实时屏幕镜像（H264 视频流 + 截图模式）
- 🎯 多设备批量管理
- 🖥️ AI 控制台界面（终端风格），实时显示执行过程
- 📡 WebSocket 实时通信
- 🔌 完整的 RESTful API

#### AI 模型支持
- ✅ 支持远程 API 服务（智谱 AI、ModelScope 等）
- ✅ 支持本地部署（vLLM）
- ✅ 支持任何 OpenAI 兼容 API
- ✅ 实时日志流输出（无缓冲）

#### 文档和工具
- 📚 详细的使用文档（README.md）
- 📖 模型部署指南（docs/MODEL_DEPLOYMENT_GUIDE.md）
- 🚀 快速启动指南（docs/QUICK_START.md）
- 🤝 贡献指南（CONTRIBUTING.md）
- 📋 开源检查清单（docs/OPENSOURCE_CHECKLIST.md）
- 🔧 完善的启动脚本（带详细注释）
- ⚙️ 详细的配置文件模板（.env.example）

### 技术栈
- 后端：FastAPI + Python 3.8-3.11
- 前端：React 18 + TypeScript + Redux Toolkit
- AI 模型：Open-AutoGLM (AutoGLM-Phone-9B)
- 模型推理：vLLM 0.12+
- 设备控制：ADB + scrcpy
- 实时通信：WebSocket

### 已知问题
- 部分 Android 设备可能需要额外的 USB 驱动
- 无线 ADB 连接在某些网络环境下可能不稳定
- 本地部署 AI 模型需要较高的 GPU 性能（显存 ≥ 24GB）

---

## 版本说明

### 版本号格式
- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

### 变更类型
- **新增**：新功能
- **变更**：现有功能的变更
- **弃用**：即将移除的功能
- **移除**：已移除的功能
- **修复**：Bug 修复
- **安全**：安全相关的修复