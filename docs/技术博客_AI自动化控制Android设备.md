# 开源了！用自然语言控制手机的 AI 自动化平台

> 告别繁琐的自动化脚本，只需一句话，AI 就能帮你操作手机

## 写在前面

你是否遇到过这些场景：

- 📱 需要在多台测试机上重复相同的操作
- 🤖 想要自动化测试 App，但学习成本太高
- 📊 需要批量采集 App 数据，手动操作太累
- 🎮 想要录制操作流程，但现有工具不够智能

今天，我要分享一个开源项目 **AI Auto Touch**，它能让你用自然语言控制 Android 设备，无需编写复杂的自动化脚本。

## 项目简介

**AI Auto Touch** 是一个基于 AI 大模型的 Android 设备自动化控制平台。它的核心亮点是：

✨ **用自然语言控制手机** - 不需要学习复杂的 API，只需要用日常语言描述你想做什么

🎯 **AI 自动理解屏幕** - 集成了清华大学开源的 AutoGLM 多模态大模型，能够理解屏幕内容并执行操作

🚀 **开箱即用** - 提供完整的 Web 界面，支持实时屏幕显示和直接操作

🔌 **易于集成** - 完整的 REST API，方便二次开发和集成到现有系统

**GitHub 地址**: https://github.com/github653224/ai-auto-touch

## 核心功能演示

### 1. AI 智能控制

这是最核心的功能。你只需要用自然语言描述任务，AI 就能自动执行。

**示例 1：社交媒体操作**
```
打开小红书，搜索博主"热爱技术的小牛"，看下这个博主是干什么的，值得关注吗
```

AI 会自动：
1. 打开小红书 App
2. 找到搜索框并点击
3. 输入博主名称
4. 分析博主主页内容
5. 给出是否值得关注的建议

**示例 2：应用自动化**
```
打开抖音，刷 10 个视频，点赞包含"美食"的视频
```

AI 会自动：
1. 打开抖音
2. 识别视频内容
3. 判断是否包含"美食"
4. 自动点赞并继续刷下一个

**示例 3：信息查询**
```
打开淘宝，搜索"机械键盘"，查看前三个商品价格
```

AI 会自动完成整个流程，并返回价格信息。

### 2. 实时屏幕显示与控制

除了 AI 控制，还提供了传统的手动控制方式：

- 📺 **实时屏幕镜像** - 基于 scrcpy，延迟低于 50ms
- 🖱️ **直接点击控制** - 点击屏幕图像即可在真机上操作
- ⌨️ **虚拟按键** - Home、返回、切换应用等常用按键
- 📝 **文本输入** - 直接在 Web 界面输入文字发送到设备
- 🎮 **手势控制** - 支持滑动、长按、滚动等操作

![实时屏幕显示与控制](docs/images/实时显示屏幕并控制.png)

### 3. 批量设备管理

支持同时连接和控制多台设备：

- 📱 自动扫描所有连接的设备
- 🔄 统一下发指令到多台设备
- 📊 独立显示每台设备的执行结果
- 🎯 适合批量测试和数据采集场景

### 4. 操作历史与系统设置

- 📝 **操作历史** - 记录所有操作，支持搜索、筛选、导出
- ⚙️ **系统设置** - 完整的配置管理，包括屏幕质量、AI 参数等
- 📊 **统计分析** - 操作成功率、执行时间等数据统计

## 技术架构

### 技术栈

**后端**
- FastAPI - 高性能 Python Web 框架
- AutoGLM - 清华大学开源的多模态大模型
- scrcpy - Google 开源的屏幕镜像工具
- ADB - Android 调试桥

**前端**
- React 18 + TypeScript
- Ant Design - 企业级 UI 组件库
- Redux Toolkit - 状态管理
- WebSocket - 实时通信

### 架构设计

```
┌─────────────────────────────────────────────────┐
│                  Web 前端界面                    │
│  (React + TypeScript + Ant Design)              │
└─────────────────┬───────────────────────────────┘
                  │ REST API + WebSocket
┌─────────────────▼───────────────────────────────┐
│              FastAPI 后端服务                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ 设备管理 │  │ AI 服务  │  │ 屏幕服务 │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌───▼────┐ ┌─▼────────┐
│ AutoGLM  │ │  ADB   │ │  scrcpy  │
│  AI模型  │ │ 设备控制│ │ 屏幕镜像 │
└──────────┘ └────────┘ └──────────┘
```

### 核心实现

#### 1. AI 控制流程

```python
# 简化的 AI 控制流程
async def execute_ai_command(device_id: str, command: str):
    # 1. 获取当前屏幕截图
    screenshot = await capture_screen(device_id)
    
    # 2. 调用 AutoGLM 模型分析
    response = await autoglm_client.chat.completions.create(
        model="autoglm-phone",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": command},
                {"type": "image_url", "image_url": {"url": screenshot}}
            ]
        }]
    )
    
    # 3. 解析 AI 返回的操作指令
    actions = parse_ai_response(response)
    
    # 4. 执行具体操作
    for action in actions:
        await execute_action(device_id, action)
        await asyncio.sleep(0.5)  # 等待操作完成
```

#### 2. 屏幕坐标转换

```typescript
// 浏览器坐标转设备坐标
const handleScreenClick = (e: React.MouseEvent) => {
  const rect = e.currentTarget.getBoundingClientRect();
  
  // 计算点击位置相对于图片的坐标
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // 转换为设备物理坐标
  const deviceX = Math.round((x / rect.width) * deviceWidth);
  const deviceY = Math.round((y / rect.height) * deviceHeight);
  
  // 发送点击指令
  await phoneControlApi.tap(deviceId, deviceX, deviceY);
};
```

#### 3. 实时屏幕流

```python
# WebSocket 实时推送屏幕截图
async def stream_screen(websocket: WebSocket, device_id: str):
    while True:
        # 使用 scrcpy 截图
        screenshot = await scrcpy_service.capture_screenshot(device_id)
        
        # 压缩为 JPEG
        jpeg_data = compress_image(screenshot, quality=80)
        
        # 转为 base64
        base64_data = base64.b64encode(jpeg_data).decode()
        
        # 推送到前端
        await websocket.send_json({
            "type": "frame",
            "data": f"data:image/jpeg;base64,{base64_data}"
        })
        
        await asyncio.sleep(0.1)  # 10 FPS
```

## 快速开始

### 1. 环境准备

```bash
# 安装 ADB 和 scrcpy
brew install android-platform-tools scrcpy  # macOS
sudo apt install android-tools-adb scrcpy  # Ubuntu

# 克隆项目
git clone https://github.com/github653224/ai-auto-touch.git
cd ai-auto-touch
```

### 2. 配置 AI 模型

支持两种方式：

**方式 A：使用云端 API（推荐）**

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 API Key
```

获取 API Key：https://open.bigmodel.cn/

**方式 B：本地部署（需要 GPU）**

```bash
# 需要 NVIDIA GPU，显存 ≥ 24GB
pip install vllm>=0.12.0
bash start_model.sh
```

### 3. 启动服务

```bash
# 后端
cd backend
pip install -r requirements.txt
bash start_backend.sh

# 前端
cd frontend
npm install
npm run dev
```

### 4. 连接设备

1. 手机开启 USB 调试
2. USB 连接到电脑
3. 浏览器打开 http://localhost:5173
4. 点击"扫描设备"

## 实际应用场景

### 场景 1：App 自动化测试

```python
# 自动化测试脚本
test_cases = [
    "打开应用，检查首页是否正常显示",
    "点击登录按钮，输入测试账号密码，检查是否登录成功",
    "进入个人中心，检查用户信息是否正确",
    "退出登录，检查是否返回登录页"
]

for case in test_cases:
    result = await ai_control(device_id, case)
    assert result.success, f"测试失败: {case}"
```

### 场景 2：批量数据采集

```python
# 批量采集商品信息
command = """
打开淘宝，搜索"机械键盘"
记录前 20 个商品的：
- 商品名称
- 价格
- 销量
- 店铺名称
"""

data = await ai_control(device_id, command)
save_to_excel(data)
```

### 场景 3：多设备批量操作

```python
# 同时控制多台设备
devices = ["device1", "device2", "device3"]

async def batch_control(command: str):
    tasks = [
        ai_control(device, command) 
        for device in devices
    ]
    results = await asyncio.gather(*tasks)
    return results

# 批量执行
await batch_control("打开微信，给'文件传输助手'发送'测试消息'")
```

### 场景 4：UI 自动化录制

```python
# 录制操作流程
recorder = OperationRecorder(device_id)

# 开始录制
recorder.start()

# 执行操作（可以是 AI 控制或手动操作）
await ai_control(device_id, "打开设置，进入 WLAN")

# 停止录制并保存
script = recorder.stop()
script.save("wifi_settings.json")

# 回放
await script.replay(device_id)
```

## 技术亮点

### 1. 多模态 AI 理解

AutoGLM 是清华大学开源的多模态大模型，专门针对手机操作场景优化：

- 🎯 **屏幕理解** - 能够识别 UI 元素、文字、图标
- 🧠 **意图理解** - 理解用户的自然语言指令
- 📱 **操作规划** - 自动规划操作步骤
- 🔄 **反馈学习** - 根据执行结果调整策略

### 2. 低延迟屏幕镜像

基于 scrcpy 实现的屏幕镜像，延迟低于 50ms：

- 🚀 **硬件加速** - 使用设备硬件编码器
- 📦 **高效传输** - 优化的数据传输协议
- 🎨 **质量可调** - 支持动态调整分辨率和码率

### 3. 完整的 API 设计

提供 40+ 控制接口，覆盖所有常用操作：

```typescript
// 基础控制
tap(x, y)              // 点击
swipe(x1, y1, x2, y2)  // 滑动
longPress(x, y)        // 长按

// 文本输入
inputText(text)        // 输入文字
clearText()            // 清除文字

// 按键操作
pressHome()            // Home 键
pressBack()            // 返回键
pressAppSwitch()       // 切换应用

// 应用控制
startApp(package)      // 启动应用
stopApp(package)       // 停止应用
getCurrentApp()        // 获取当前应用

// 系统操作
unlockScreen()         // 解锁屏幕
screenshot()           // 截图
getScreenSize()        // 获取屏幕尺寸
```

### 4. 实时通信

使用 WebSocket 实现实时通信：

- 📺 实时屏幕流推送
- 📝 AI 执行日志实时显示
- 🔔 设备状态变化通知
- 📊 操作结果实时反馈

## 性能优化

### 1. 屏幕传输优化

```python
# 动态调整图片质量
def adaptive_quality(fps: float) -> int:
    if fps < 5:
        return 60  # 降低质量提高帧率
    elif fps > 15:
        return 90  # 提高质量
    return 80

# 智能跳帧
def should_skip_frame(current_frame, last_frame) -> bool:
    # 如果画面变化不大，跳过此帧
    diff = calculate_diff(current_frame, last_frame)
    return diff < threshold
```

### 2. 并发控制

```python
# 使用信号量限制并发
semaphore = asyncio.Semaphore(5)  # 最多 5 个并发请求

async def controlled_request():
    async with semaphore:
        return await make_request()
```

### 3. 缓存策略

```python
# 缓存设备信息
@lru_cache(maxsize=100)
def get_device_info(device_id: str):
    return adb.get_device_info(device_id)

# 缓存屏幕尺寸
device_screen_cache = {}
```

## 遇到的挑战与解决方案

### 挑战 1：坐标转换精度

**问题**：浏览器显示的图片尺寸与设备实际尺寸不同，导致点击位置不准确。

**解决方案**：
```typescript
// 精确的坐标转换算法
const convertCoordinates = (
  clickX: number, 
  clickY: number,
  imageWidth: number,
  imageHeight: number,
  deviceWidth: number,
  deviceHeight: number
) => {
  // 考虑图片缩放比例
  const scaleX = deviceWidth / imageWidth;
  const scaleY = deviceHeight / imageHeight;
  
  return {
    x: Math.round(clickX * scaleX),
    y: Math.round(clickY * scaleY)
  };
};
```

### 挑战 2：AI 响应延迟

**问题**：AI 模型推理需要时间，用户体验不好。

**解决方案**：
1. 使用 WebSocket 实时推送执行进度
2. 显示 AI 思考过程和中间步骤
3. 支持取消正在执行的任务

### 挑战 3：多设备并发

**问题**：同时控制多台设备时，资源竞争导致性能下降。

**解决方案**：
1. 使用异步 I/O 提高并发能力
2. 为每个设备分配独立的资源
3. 实现请求队列和优先级调度

## 未来规划

### 短期计划（1-3 个月）

- [ ] 📹 **操作录制与回放** - 录制操作流程，支持回放和编辑
- [ ] 🎯 **元素识别优化** - 提高 UI 元素识别准确率
- [ ] 📊 **数据导出功能** - 支持导出操作数据为 Excel/CSV
- [ ] 🌐 **多语言支持** - 支持英文、日文等多语言界面

### 中期计划（3-6 个月）

- [ ] ☁️ **云端设备管理** - 支持远程设备接入和控制
- [ ] 🤖 **更多 AI 模型** - 支持 GPT-4V、Claude 等模型
- [ ] 📱 **iOS 支持** - 扩展支持 iOS 设备控制
- [ ] 🔌 **插件系统** - 支持自定义插件扩展功能

### 长期计划（6-12 个月）

- [ ] 🎮 **可视化流程编排** - 拖拽式自动化流程设计
- [ ] 🧪 **AI 测试生成** - 根据 App 自动生成测试用例
- [ ] 📈 **性能监控** - 实时监控 App 性能指标
- [ ] 🌍 **SaaS 服务** - 提供云端 SaaS 服务

## 开源协议与贡献

本项目采用 **MIT 开源协议**，欢迎大家使用、修改和分发。

### 如何贡献

我们欢迎各种形式的贡献：

1. 🐛 **提交 Bug** - 发现问题请提 Issue
2. 💡 **功能建议** - 有好的想法欢迎讨论
3. 📝 **完善文档** - 帮助改进文档
4. 💻 **提交代码** - 欢迎提交 Pull Request

### 贡献指南

```bash
# 1. Fork 项目
# 2. 创建特性分支
git checkout -b feature/AmazingFeature

# 3. 提交更改
git commit -m 'Add some AmazingFeature'

# 4. 推送到分支
git push origin feature/AmazingFeature

# 5. 开启 Pull Request
```

## 致谢

感谢以下开源项目：

- [AutoGLM](https://github.com/THUDM/AutoGLM) - 清华大学开源的多模态大模型
- [scrcpy](https://github.com/Genymobile/scrcpy) - Google 开源的屏幕镜像工具
- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的 Python Web 框架
- [React](https://reactjs.org/) - 强大的前端框架

## 写在最后

这个项目从想法到实现，花费了大量的时间和精力。开源出来希望能帮助到有需要的人，也希望能得到大家的反馈和建议。

如果你觉得这个项目有用，欢迎：

- ⭐ 给项目点个 Star
- 🔗 分享给更多的人
- 💬 提出你的建议和想法
- 🤝 参与项目开发

**项目地址**：https://github.com/github653224/ai-auto-touch

**技术交流**：欢迎在 GitHub Issues 中讨论

---

## 相关链接

- 📖 [完整文档](https://github.com/github653224/ai-auto-touch/blob/master/README.md)
- 🚀 [快速开始](https://github.com/github653224/ai-auto-touch/blob/master/docs/QUICK_START.md)
- 📱 [手机控制 API](https://github.com/github653224/ai-auto-touch/blob/master/docs/PHONE_CONTROL.md)
- 🤖 [模型配置](https://github.com/github653224/ai-auto-touch/blob/master/docs/MODEL_SETUP.md)
- 🔧 [故障排除](https://github.com/github653224/ai-auto-touch/blob/master/TROUBLESHOOTING.md)

---

**关注公众号「你的公众号名称」，获取更多技术干货！**

如果你对 AI、自动化、移动开发感兴趣，欢迎关注我，后续会分享更多实战经验和技术文章。




autoglm-gui \
  --base-url https://open.bigmodel.cn/api/paas/v4 \
  --model autoglm-phone \
  --apikey fefc2ff6f8de471ca04d9e6e3e39ee70.fWFYMYaGABxBUyGk