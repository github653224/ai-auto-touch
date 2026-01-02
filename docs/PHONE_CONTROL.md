# 手机控制功能文档

## 📖 概述

手机控制功能允许你通过 Web 界面直接控制 Android 设备，无需编写代码。支持点击、滑动、文本输入、按键操作等常用功能。

## ✨ 功能特性

### 1. 直接屏幕交互
- **点击屏幕图像** - 点击屏幕显示区域会自动转换坐标并在真实设备上执行点击
- **坐标自动转换** - 浏览器坐标自动转换为设备物理坐标
- **实时反馈** - 每次操作都有成功/失败提示

### 2. 虚拟按键
- **Home 键** - 返回主屏幕
- **返回键** - 返回上一页
- **切换键** - 切换应用（最近任务）
- **菜单键** - 打开菜单
- **电源键** - 锁屏/唤醒

### 3. 音量控制
- **音量+** - 增加音量
- **音量-** - 减少音量

### 4. 滚动控制
- **向上滚动** - 页面向上滚动
- **向下滚动** - 页面向下滚动
- **向左滚动** - 页面向左滚动
- **向右滚动** - 页面向右滚动

### 5. 文本输入
- **输入框** - 输入要发送到设备的文本
- **发送按钮** - 将文本发送到设备当前焦点输入框
- **清除按钮** - 清除设备输入框内容
- **回车发送** - 按回车键快速发送文本

### 6. 系统操作
- **解锁屏幕** - 唤醒并解锁设备
- **打开通知栏** - 下拉通知栏
- **打开快捷设置** - 打开快捷设置面板
- **关闭通知栏** - 收起通知栏

## 🚀 快速开始

### 1. 连接设备

1. 用 USB 连接 Android 设备到电脑
2. 在设备上启用"USB 调试"
3. 打开浏览器访问 `http://localhost:5173`
4. 在设备列表中选择你的设备

### 2. 开始控制

#### 方式 1: 直接点击屏幕（推荐）
```
点击屏幕显示区域的任意位置 → 设备会在对应位置执行点击
```

#### 方式 2: 使用虚拟按键
```
点击右侧的 Home、返回、切换等按钮 → 设备执行对应操作
```

#### 方式 3: 输入文本
```
1. 在设备上打开输入框（如搜索框）
2. 在 UI 输入框输入文字
3. 点击"发送"按钮
4. 文字出现在设备上
```

## 📱 使用示例

### 示例 1: 切换应用
```
1. 点击 [切换] 按钮
2. 显示最近任务列表
3. 点击屏幕上的应用切换到该应用
```

### 示例 2: 打开应用
```
1. 点击 [Home] 按钮返回主屏幕
2. 点击屏幕上的应用图标
3. 应用打开
```

### 示例 3: 搜索内容
```
1. 打开浏览器或应用
2. 点击搜索框
3. 在 UI 输入框输入"Hello World"
4. 点击 [发送] 按钮
5. 文字出现在设备搜索框中
```

### 示例 4: 浏览网页
```
1. 打开浏览器
2. 使用 [↑] [↓] 按钮滚动页面
3. 点击屏幕上的链接
4. 使用 [返回] 按钮返回上一页
```

### 示例 5: 发送消息
```
1. 打开聊天应用
2. 点击输入框
3. 在 UI 输入框输入消息
4. 点击 [发送] 按钮
5. 消息发送到设备
```

## 🔌 API 使用

### REST API

所有控制功能都提供 REST API，可以通过编程方式调用。

#### 基础 URL
```
http://localhost:8001/api/v1/control/{device_id}
```

#### 点击屏幕
```bash
curl -X POST "http://localhost:8001/api/v1/control/YOUR_DEVICE_ID/tap" \
  -H "Content-Type: application/json" \
  -d '{"x": 500, "y": 1000}'
```

#### 滑动屏幕
```bash
curl -X POST "http://localhost:8001/api/v1/control/YOUR_DEVICE_ID/swipe" \
  -H "Content-Type: application/json" \
  -d '{"x1": 100, "y1": 200, "x2": 300, "y2": 400, "duration": 300}'
```

#### 输入文本
```bash
curl -X POST "http://localhost:8001/api/v1/control/YOUR_DEVICE_ID/input-text" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World"}'
```

#### 按 Home 键
```bash
curl -X POST "http://localhost:8001/api/v1/control/YOUR_DEVICE_ID/press-home"
```

#### 切换应用
```bash
curl -X POST "http://localhost:8001/api/v1/control/YOUR_DEVICE_ID/press-app-switch"
```

#### 获取屏幕尺寸
```bash
curl "http://localhost:8001/api/v1/control/YOUR_DEVICE_ID/screen-size"
```

### Python 示例

```python
import requests

device_id = "YOUR_DEVICE_ID"
base_url = "http://localhost:8001/api/v1/control"

# 点击屏幕
response = requests.post(
    f"{base_url}/{device_id}/tap",
    json={"x": 500, "y": 1000}
)
print(response.json())

# 输入文本
response = requests.post(
    f"{base_url}/{device_id}/input-text",
    json={"text": "Hello World"}
)
print(response.json())

# 按 Home 键
response = requests.post(f"{base_url}/{device_id}/press-home")
print(response.json())

# 切换应用
response = requests.post(f"{base_url}/{device_id}/press-app-switch")
print(response.json())
```

### JavaScript 示例

```javascript
const deviceId = "YOUR_DEVICE_ID"
const baseUrl = "http://localhost:8001/api/v1/control"

// 点击屏幕
fetch(`${baseUrl}/${deviceId}/tap`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ x: 500, y: 1000 })
})
.then(res => res.json())
.then(data => console.log(data))

// 输入文本
fetch(`${baseUrl}/${deviceId}/input-text`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "Hello World" })
})
.then(res => res.json())
.then(data => console.log(data))

// 按 Home 键
fetch(`${baseUrl}/${deviceId}/press-home`, { method: 'POST' })
.then(res => res.json())
.then(data => console.log(data))
```

## 📋 完整 API 列表

### 基础控制
- `POST /tap` - 点击屏幕
- `POST /swipe` - 滑动屏幕
- `POST /long-press` - 长按屏幕

### 文本输入
- `POST /input-text` - 输入文本
- `POST /clear-text` - 清除文本

### 按键操作
- `POST /press-key` - 按下任意按键
- `POST /press-home` - Home 键
- `POST /press-back` - 返回键
- `POST /press-menu` - 菜单键
- `POST /press-power` - 电源键
- `POST /press-volume-up` - 音量+
- `POST /press-volume-down` - 音量-
- `POST /press-enter` - 回车键
- `POST /press-app-switch` - 应用切换键

### 屏幕控制
- `GET /screen-size` - 获取屏幕尺寸
- `POST /screenshot` - 截图
- `POST /screen-on` - 唤醒屏幕
- `POST /screen-off` - 关闭屏幕

### 应用控制
- `POST /start-app` - 启动应用
- `POST /stop-app` - 停止应用
- `POST /clear-app-data` - 清除应用数据
- `GET /current-app` - 获取当前应用

### 手势操作
- `POST /scroll-up` - 向上滚动
- `POST /scroll-down` - 向下滚动
- `POST /scroll-left` - 向左滚动
- `POST /scroll-right` - 向右滚动

### 系统操作
- `POST /unlock-screen` - 解锁屏幕
- `POST /open-notification` - 打开通知栏
- `POST /open-quick-settings` - 打开快捷设置
- `POST /close-notification` - 关闭通知栏

## 🔧 故障排除

### 问题 1: 设备未显示
**解决方案**:
1. 确保 USB 调试已启用
2. 检查 ADB 连接：`adb devices`
3. 重新连接 USB 线

### 问题 2: 点击位置不准确
**解决方案**:
1. 检查屏幕尺寸是否正确显示
2. 尝试全屏模式
3. 调整浏览器缩放为 100%

### 问题 3: 文本输入失败
**解决方案**:
1. 确保设备输入框已获得焦点
2. 检查输入法是否已启用
3. 尝试先点击输入框再发送文本

### 问题 4: 按键无响应
**解决方案**:
1. 检查设备连接状态
2. 查看浏览器控制台错误信息
3. 重新连接设备

### 问题 5: 滚动不生效
**解决方案**:
1. 确保当前页面可以滚动
2. 尝试调整滚动距离
3. 检查设备屏幕尺寸是否正确

## 💡 高级用法

### 自动化脚本

```python
import requests
import time

device_id = "YOUR_DEVICE_ID"
base_url = "http://localhost:8001/api/v1/control"

def tap(x, y):
    requests.post(f"{base_url}/{device_id}/tap", json={"x": x, "y": y})
    time.sleep(0.5)

def input_text(text):
    requests.post(f"{base_url}/{device_id}/input-text", json={"text": text})
    time.sleep(0.5)

def press_home():
    requests.post(f"{base_url}/{device_id}/press-home")
    time.sleep(0.5)

# 自动化流程：打开应用并搜索
press_home()           # 返回主屏幕
tap(500, 1000)        # 点击应用图标
time.sleep(2)         # 等待应用打开
tap(500, 200)         # 点击搜索框
input_text("Hello")   # 输入搜索内容
tap(900, 200)         # 点击搜索按钮
```

### 批量操作

```python
# 批量控制多个设备
devices = ["device1", "device2", "device3"]

for device_id in devices:
    # 在每个设备上执行相同操作
    requests.post(f"{base_url}/{device_id}/press-home")
    time.sleep(1)
    requests.post(f"{base_url}/{device_id}/tap", json={"x": 500, "y": 1000})
```

## 📚 相关文档

- [API 参考文档](API_REFERENCE.md)
- [快速开始指南](QUICK_START.md)
- [故障排除](../TROUBLESHOOTING.md)

## 🤝 贡献

如果你发现 bug 或有功能建议，欢迎提交 Issue 或 Pull Request。

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。
