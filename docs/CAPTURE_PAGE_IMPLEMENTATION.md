# 抓包页面实施计划

## 目标

创建一个抓包页面，左侧显示手机屏幕和控制按钮，右侧显示 mitmproxy Web 界面。

## 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  Header: 设备名称 | 返回按钮 | 代理状态                        │
├──────────────────────────┬──────────────────────────────────┤
│   左侧 (40%)             │   右侧 (60%)                     │
│  ┌──────────────────┐   │  ┌────────────────────────────┐ │
│  │  手机屏幕显示     │   │  │   mitmproxy Web 界面       │ │
│  │  (可触摸操作)     │   │  │   (iframe 嵌入)           │ │
│  └──────────────────┘   │  └────────────────────────────┘ │
│  ┌──────────────────┐   │                                  │
│  │  系统按键         │   │                                  │
│  │  常用操作         │   │                                  │
│  │  手势操作         │   │                                  │
│  │  代理控制         │   │                                  │
│  └──────────────────┘   │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

## 实施步骤

### 步骤 1: 创建路由和基础页面 ✅

文件: `frontend/src/pages/CaptureView.tsx`

- 添加路由 `/device/:deviceId/capture`
- 创建基础布局
- 左右分栏

### 步骤 2: 实现 MitmproxyViewer 组件 ✅

文件: `frontend/src/components/MitmproxyViewer.tsx`

功能:
- 检查 mitmweb 状态
- 如果未运行，自动启动
- 显示 iframe
- 加载状态提示

### 步骤 3: 实现 PhoneScreen 组件

文件: `frontend/src/components/PhoneScreen.tsx`

功能:
- 显示 scrcpy 视频流
- 支持触摸操作（点击、长按、滑动）
- 坐标转换

### 步骤 4: 实现 PhoneControlPanel 组件

文件: `frontend/src/components/PhoneControlPanel.tsx`

功能:
- 系统按键（返回、主页、多任务）
- 常用操作（截图、录屏、旋转、音量、电源）
- 手势操作（上滑、下滑、左滑、右滑）
- 代理控制（设置代理、清除代理、安装证书）

### 步骤 5: 添加后端控制 API

文件: `backend/app/api/phone_control_api.py`

新增接口:
- POST `/control/{device_id}/tap` - 点击
- POST `/control/{device_id}/long-press` - 长按
- POST `/control/{device_id}/swipe` - 滑动
- POST `/control/{device_id}/key` - 按键
- POST `/control/{device_id}/screenshot` - 截图
- POST `/control/{device_id}/set-proxy` - 设置代理
- POST `/control/{device_id}/clear-proxy` - 清除代理
- POST `/control/{device_id}/install-cert` - 安装证书

### 步骤 6: 在设备列表添加入口

文件: `frontend/src/components/DeviceCard.tsx`

- 添加"抓包"按钮
- 点击跳转到抓包页面

### 步骤 7: 测试和优化

- 功能测试
- 性能优化
- UI 调整

## 技术要点

### 触摸事件处理

```typescript
// 坐标转换
const deviceX = Math.round((x / rect.width) * deviceWidth);
const deviceY = Math.round((y / rect.height) * deviceHeight);

// 点击
await fetch(`/api/v1/control/${deviceId}/tap`, {
  method: 'POST',
  body: JSON.stringify({ x: deviceX, y: deviceY })
});

// 滑动
await fetch(`/api/v1/control/${deviceId}/swipe`, {
  method: 'POST',
  body: JSON.stringify({ x1, y1, x2, y2, duration: 300 })
});
```

### 自动启动 mitmweb

```typescript
useEffect(() => {
  // 检查状态
  const status = await checkStatus(deviceId);
  
  if (status.status !== 'online') {
    // 启动 mitmweb
    await startMitmweb(deviceId);
  }
  
  setProxyUrl(`/api/v1/mitmproxy/proxy/${deviceId}/`);
}, [deviceId]);
```

### 代理设置

```bash
# 设置代理
adb shell settings put global http_proxy <host>:<port>

# 清除代理
adb shell settings put global http_proxy :0
```

## 当前进度

- [x] 后端 mitmproxy 反向代理 API
- [x] 后端 mitmproxy 进程管理服务
- [x] 升级 mitmproxy 到 11.0.2
- [x] 测试 iframe 嵌入
- [ ] 前端抓包页面
- [ ] 前端控制组件
- [ ] 后端控制 API
- [ ] 集成测试

## 下一步

开始实现前端页面和组件。

---

**文档版本**: v1.0  
**创建日期**: 2026-01-09  
**作者**: AI Auto Touch Team
