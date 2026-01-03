AI 驱动设备自动化平台 - 智能Android设备管理系统

![项目LOGO](https://via.placeholder.com/400x100?text=Phone+Control+Platform)  

项目概述

本项目是一款基于 FastAPI + React + Open-AutoGLM 开发的 AI 驱动设备自动化平台，核心功能是通过自然语言指令实现多台Android设备的批量管理与自动化操作，集成低延迟屏幕镜像、设备状态监控等能力，适用于自动化测试、批量运维、场景化操作等场景。

核心优势

- AI智能驱动：集成Open-AutoGLM大模型，支持自然语言转设备操作，无需手动编写ADB命令

- 低延迟屏幕流：基于scrcpy实现<50ms延迟的实时屏幕显示，支持多设备同时预览

- 多设备协同：支持100+设备同时在线管理，批量执行指令或个性化操作

- 全平台兼容：后端支持Linux/macOS/Windows，前端支持Web/桌面/移动端访问

- 易扩展架构：微服务设计，支持AI模型、设备控制模块的独立升级

技术栈选型

模块

核心技术

版本要求

核心作用

后端框架

FastAPI

≥0.111.0

高性能异步API服务，自动生成接口文档

AI核心

Open-AutoGLM

最新稳定版

自然语言理解、屏幕内容分析、操作规划

前端框架

React + TypeScript

React≥18，TS≥5.2

类型安全的现代化前端界面

设备控制

ADB + scrcpy

ADB≥1.0.41，scrcpy≥2.4

Android设备通信、屏幕镜像传输

实时通信

WebSocket

≥12.0

设备状态推送、屏幕流传输

部署工具

Docker + Docker Compose

Docker≥20.10

环境一致性保障，一键部署

环境准备

1. 基础依赖安装

1.1 通用依赖（所有系统）

- Python：3.8~3.11（推荐3.10，避免3.12以上版本的兼容性问题）
        # 检查版本
python --version  # 或 python3 --version
# 安装（以macOS为例）
brew install python@3.10

- Node.js：14~18（推荐16 LTS）
        # 检查版本
node --version
# 安装（以macOS为例）
brew install node@16

- Git：用于版本控制
        brew install git  # macOS
sudo apt install git  # Ubuntu
# Windows：下载安装 https://git-scm.com/

1.2 设备控制依赖（ADB + scrcpy）

macOS

# 安装ADB
brew install android-platform-tools
# 安装scrcpy
brew install scrcpy
# 验证安装
adb --version
scrcpy --version

Windows

1. ADB：下载 Platform Tools，解压后添加到系统环境变量

2. scrcpy：下载 最新版本，解压后添加到环境变量

3. 验证：命令提示符输入 adb --version 和 scrcpy --version

Ubuntu/Linux

# 安装ADB
sudo apt update && sudo apt install android-tools-adb
# 安装scrcpy
sudo apt install scrcpy
# 验证安装
adb --version
scrcpy --version

1.3 Open-AutoGLM 部署

项目核心AI模块，支持本地部署或远程调用，推荐本地部署以降低延迟：

# 1. 克隆Open-AutoGLM仓库
git clone https://github.com/zai-org/Open-AutoGLM.git
cd Open-AutoGLM

# 2. 安装依赖（建议创建虚拟环境）
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate  # Windows

pip install -r requirements.txt

# 3. 下载预训练模型（以autoglm-phone-9b为例）
# 方式1：Hugging Face下载
pip install huggingface-hub
huggingface-cli download zai-org/autoglm-phone-9b --local-dir ./models/autoglm-phone-9b

# 方式2：使用模型加速链接（参考项目README）

# 4. 启动模型服务（默认端口8000）
python -m phone_agent.server --model-path ./models/autoglm-phone-9b --port 8000

1.4 Docker环境（可选，推荐）

用于快速部署整套服务，避免环境冲突：

# macOS安装
brew install docker
# 启动Docker应用后验证
docker --version
docker-compose --version

项目部署

1. 项目获取


# 克隆项目（替换为你的仓库地址）
git clone https://github.com/your-username/ai-auto-touch.git
cd ai-auto-touch

# 或本地创建目录（参考项目结构）
mkdir -p ai_auto_touch/{backend,frontend}
# 按前文代码示例创建对应文件

2. 本地开发环境部署

2.1 后端启动

# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（可选，也可修改config.py）
# 方式1：创建.env文件
echo "AUTOGLM_BASE_URL=http://localhost:8000/v1" > .env
echo "ADB_PATH=adb" >> .env
echo "SCRCPY_PATH=scrcpy" >> .env

# 方式2：直接设置环境变量（临时生效）
export AUTOGLM_BASE_URL=http://localhost:8000/v1  # macOS/Linux
# set AUTOGLM_BASE_URL=http://localhost:8000/v1  # Windows

# 启动后端服务（默认端口8000，避免与Open-AutoGLM冲突可修改为8001）
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# 验证：访问 http://localhost:8001/docs 查看API文档

2.2 前端启动

# 进入前端目录（新终端窗口）
cd frontend

# 安装依赖
npm install

# 配置后端API地址（可选）
# 方式1：创建.env文件
echo "VITE_API_URL=http://localhost:8001" > .env

# 方式2：直接修改src/api/deviceApi.ts中的API_BASE_URL

# 启动前端服务（默认端口3000）
npm run dev

# 验证：访问 http://localhost:3000 进入前端界面

3. Docker Compose 一键部署（推荐）

项目根目录提供docker-compose.yml，支持一键启动后端、前端、Redis服务（需提前部署Open-AutoGLM）：

# 1. 配置docker-compose.yml（关键修改）
# 修改AUTOGLM_BASE_URL为你的Open-AutoGLM服务地址
# 确保设备ADB服务可被容器访问（macOS需开启Docker的文件共享）

# 2. 启动所有服务
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 停止服务
docker-compose down

# 5. 查看日志
docker-compose logs -f backend  # 查看后端日志
docker-compose logs -f frontend  # 查看前端日志

项目结构详解


ai_auto_touch/
├── backend/                 # 后端代码（FastAPI）
│   ├── app/                 # 应用核心
│   │   ├── api/             # API路由（设备/AI/WebSocket）
│   │   │   ├── device_api.py # 设备管理接口（扫描/连接/命令执行）
│   │   │   ├── ai_api.py    # AI控制接口（自然语言指令）
│   │   │   └── websocket_api.py # 实时通信接口（屏幕流/状态）
│   │   ├── core/            # 核心配置
│   │   │   └── config.py    # 项目配置（端口/AI地址/ADB路径）
│   │   ├── models/          # 数据模型（Pydantic）
│   │   ├── services/        # 业务服务
│   │   │   ├── device_service.py # 设备管理服务（ADB交互）
│   │   │   ├── ai_service.py    # AI服务（Open-AutoGLM调用）
│   │   │   └── scrcpy_service.py # 屏幕流服务（scrcpy集成）
│   │   └── utils/           # 工具函数
│   │       ├── adb_utils.py # ADB命令执行工具
│   │       └── logger_utils.py # 日志工具
│   ├── requirements.txt     # 后端依赖列表
│   ├── main.py              # 后端入口文件
│   └── Dockerfile.dev       # 开发环境Docker配置
├── frontend/                # 前端代码（React + TS）
│   ├── public/              # 静态资源
│   ├── src/
│   │   ├── features/        # Redux状态管理
│   │   │   ├── deviceSlice.ts # 设备状态管理
│   │   │   └── aiSlice.ts    # AI操作状态管理
│   │   ├── pages/           # 页面组件
│   │   │   ├── DeviceManager.tsx # 设备管理页面
│   │   │   ├── ScreenDisplay.tsx # 屏幕显示页面
│   │   │   └── AIControl.tsx    # AI控制页面
│   │   ├── api/             # 前端API调用
│   │   ├── App.tsx          # 主应用组件
│   │   └── main.tsx         # 前端入口文件
│   ├── package.json         # 前端依赖
│   └── vite.config.ts       # Vite配置
├── docker-compose.yml       # Docker Compose配置
├── .gitignore               # Git忽略文件
└── README.md                # 本说明文档

快速使用指南

1. 设备准备

1. Android设备开启「开发者模式」：设置 → 关于手机 → 连续点击「版本号」7次

2. 开启「USB调试」：开发者选项 → 勾选「USB调试」「USB安装」

3. （可选）开启「无线调试」：支持无USB连接（Android 11+）

4. 连接设备：通过USB线连接电脑，或通过无线调试配对
        # 无线调试配对（示例）
adb pair 192.168.1.100:38472  # 设备端显示的IP和端口
adb connect 192.168.1.100:39547

5. 验证连接：adb devices 查看已连接设备列表

2. 系统启动流程

1. 启动Open-AutoGLM服务（参考1.3节，确保端口8000可用）

2. 启动后端服务（端口8001，参考2.1节）

3. 启动前端服务（端口3000，参考2.2节）

4. 访问前端：浏览器打开 http://localhost:3000

3. 核心功能使用

3.1 设备管理

1. 进入「设备管理」页面，点击「扫描设备」按钮

2. 系统自动识别已连接的Android设备，显示设备ID、型号、Android版本

3. 点击「连接」按钮：建立设备与平台的通信链路

4. 操作按钮说明：
        「查看屏幕」：跳转至实时屏幕显示页面

5. 「AI控制」：跳转至自然语言控制页面

6. 「断开」：断开设备连接（不影响ADB连接）

3.2 实时屏幕显示

1. 从设备管理页面点击「查看屏幕」，或直接进入「屏幕显示」页面选择设备

2. 系统自动启动scrcpy屏幕流，默认分辨率1080p，码率2Mbps

3. 功能调节：
        视频质量：1-5Mbps滑动调节，高码率更清晰但占用带宽更高

4. 分辨率：支持480p/720p/1080p/4K切换

5. 全屏显示：点击「全屏」按钮进入全屏模式，ESC键退出

6. 注意：多设备同时显示时，建议降低单设备码率（≤2Mbps）

3.3 AI智能控制

核心功能，支持自然语言指令转化为设备操作，示例场景：

单设备控制

1. 进入「AI智能控制」页面，选择已连接的设备

2. 输入自然语言指令，例如：
        「打开抖音，搜索‘美食教程’，点赞第一个视频」

3. 「打开微信，给‘文件传输助手’发送‘测试消息’」

4. 「截图当前屏幕并保存到SD卡根目录」

5. 点击「执行指令」，系统会：
        通过Open-AutoGLM解析指令意图

6. 获取设备当前屏幕状态进行分析

7. 生成ADB操作序列并执行

8. 在「执行结果」区域显示操作步骤和结果

批量设备控制

1. 点击「批量操作」按钮，打开批量控制弹窗

2. 勾选需要操作的多台设备（仅显示已连接设备）

3. 输入统一指令，例如：「打开浏览器，访问www.baidu.com」

4. 点击「执行批量指令」，系统会并行执行并返回每台设备的结果

操作历史查询

切换至「操作历史」标签页，可查看所有设备的指令执行记录，包括：

- 执行设备ID、指令内容、执行时间

- 详细的操作步骤和执行结果

- 支持「清空历史」功能

配置说明

1. 后端配置（backend/app/core/config.py）

class Settings(BaseSettings):
    # 项目基本配置
    PROJECT_NAME: str = "群控手机平台"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    HOST: str = "0.0.0.0"  # 允许外部访问
    PORT: int = 8001       # 避免与Open-AutoGLM冲突
    DEBUG: bool = True     # 开发环境开启，生产环境关闭
    
    # ADB与scrcpy配置
    ADB_PATH: str = "adb"  # 若未添加环境变量，填写完整路径（如/opt/homebrew/bin/adb）
    SCRCPY_PATH: str = "scrcpy"
    MAX_DEVICES: int = 100 # 最大支持设备数
    
    # Open-AutoGLM配置（关键）
    AUTOGLM_BASE_URL: str = "http://localhost:8000/v1"  # 模型服务地址
    AUTOGLM_MODEL_NAME: str = "autoglm-phone-9b"       # 模型名称
    AUTOGLM_MAX_STEPS: int = 100  # 单指令最大操作步骤
    
    # 屏幕流配置
    SCREENSHOT_INTERVAL: int = 1  # 截图间隔（秒），用于AI分析

2. 前端配置（frontend/.env）

# 后端API地址（开发环境）
VITE_API_URL=http://localhost:8001

# 生产环境配置（示例）
# VITE_API_URL=https://api.your-domain.com

3. Docker Compose配置（docker-compose.yml）

关键配置项，需根据实际环境修改：


version: '3.8'
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8001:8001"
    environment:
      - AUTOGLM_BASE_URL=http://host.docker.internal:8000/v1  # macOS/Windwos
      # - AUTOGLM_BASE_URL=http://172.17.0.1:8000/v1  # Linux
      - ADB_PATH=adb
      - SCRCPY_PATH=scrcpy
    volumes:
      - ./backend:/app
      - /dev/bus/usb:/dev/bus/usb  # 映射USB设备（关键）
    privileged: true  # 允许访问USB设备

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8001
    volumes:
      - ./frontend:/app
      - /app/node_modules

常见问题（FAQ）

1. 设备连接问题

- 问题：扫描设备无结果，adb devices显示空列表
        解决方案：
        检查USB线是否正常，更换线材或USB端口

- 设备端确认「允许USB调试」弹窗（部分设备需重新插拔）

- 重启ADB服务：adb kill-server && adb start-server

- Windows系统需安装设备驱动（参考手机品牌官网）

- 问题：无线调试连接失败
        解决方案：
        确保设备与电脑在同一局域网

- 重新获取配对码：设备端 → 开发者选项 → 无线调试 → 配对设备

- 检查防火墙是否阻止ADB端口（默认5555）

2. 屏幕流相关问题

- 问题：屏幕显示黑屏或卡顿
        解决方案：
        降低视频质量和分辨率（如1Mbps + 720p）

- 关闭设备端「护眼模式」「深色模式」尝试

- 更新scrcpy到最新版本：brew upgrade scrcpy（macOS）

- USB连接改为「文件传输」模式（部分设备）

- 问题：Docker环境下无法启动屏幕流
        解决方案：
        确认docker-compose.yml中已配置privileged: true和USB映射

- 重启Docker服务：sudo systemctl restart docker（Linux）

- macOS需在Docker设置中开启「文件共享」对应目录

3. AI服务问题

- 问题：执行指令提示「AI服务连接失败」
        解决方案：
        检查Open-AutoGLM服务是否启动：访问http://localhost:8000/docs

- 确认后端配置AUTOGLM_BASE_URL与服务地址一致

- Linux环境下，Docker容器访问本地服务需用172.17.0.1而非localhost

- 问题：指令解析错误或执行失败
        解决方案：
        指令描述更具体，例如：「打开微信（图标在桌面第一行第二个）」

- 检查设备是否已安装对应应用

- 查看Open-AutoGLM日志，确认模型是否正常加载

4. 性能问题

- 问题：多设备同时操作时卡顿
        解决方案：
        降低单设备屏幕流码率（≤1Mbps）和分辨率（720p以下）

- 增加电脑内存（推荐16GB以上），关闭其他占用资源的程序

- 后端服务增加workers：uvicorn main:app --workers 4

进阶开发

1. 接口扩展

新增API接口步骤：

1. 在backend/app/api目录下创建新的路由文件（如task_api.py）

2. 定义Pydantic模型（backend/app/models/）

3. 实现业务逻辑（backend/app/services/）

4. 在main.py中注册路由

2. AI功能定制

修改Open-AutoGLM指令解析逻辑：

# 1. 进入Open-AutoGLM目录
cd Open-AutoGLM

# 2. 修改指令解析模板（示例）
vi phone_agent/prompt/templates.py

# 3. 重新训练微调模型（针对特定场景）
python -m phone_agent.finetune --data-path ./data/your-data.json --model-path ./models/autoglm-phone-9b

3. 前端组件扩展

新增页面步骤：

1. 在frontend/src/pages目录下创建新组件

2. 在App.tsx中配置路由

3. （如需状态管理）在features目录下创建对应的slice

4. 编写API调用函数（frontend/src/api/）

贡献指南

1. Fork本项目到个人仓库

2. 创建特性分支：git checkout -b feature/your-feature

3. 提交代码：git commit -m "feat: 新增XX功能"

4. 推送分支：git push origin feature/your-feature

5. 创建Pull Request，描述功能细节和测试情况

许可证

本项目采用 MIT 许可证，详情请查看LICENSE文件：

MIT License

Copyright (c) 2024 AI 驱动设备自动化平台开发团队

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

联系方式

- 项目维护：your-email@example.com

- GitHub仓库：https://github.com/your-username/ai-auto-touch

- 问题反馈：通过GitHub Issues提交

---

最后更新时间：2025年12月9日

版本：v1.0.0
