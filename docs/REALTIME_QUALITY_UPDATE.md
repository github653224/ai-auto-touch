# 实时画质设置功能

## 功能说明

在屏幕显示页面的"设备与画质设置"菜单中，画质和分辨率设置现在可以实时生效，无需重新连接。

## 工作原理

### 前端实现

1. **useH264Player Hook 增强**
   - 添加了 `updateConfig` 函数，可以通过 WebSocket 发送实时配置更新
   - 当用户调整画质或分辨率时，立即通过 WebSocket 发送配置消息

2. **ScreenDisplay 页面更新**
   - `handleQualityChange`: 调整视频质量时，如果在视频模式下会立即生效
   - `handleResolutionChange`: 调整分辨率时，如果在视频模式下会立即生效
   - 截图模式下仍然需要重新连接才能生效

### 后端实现

后端 WebSocket 端点 (`/api/v1/ws/h264/{device_id}`) 已支持接收配置更新消息：

1. 接收 JSON 格式的配置消息：
   ```json
   {
     "type": "config",
     "max_size": 1080,
     "bit_rate": 4
   }
   ```

2. 更新配置并重启视频流以应用新设置

3. 发送确认消息：
   ```json
   {
     "type": "config_updated",
     "message": "配置已更新: 分辨率=1080p, 比特率=4.0Mbps"
   }
   ```

## 使用方法

1. 在屏幕显示页面，确保使用"低延迟视频"模式（H264模式）
2. 在右侧"设备与画质设置"标签页中：
   - 拖动"视频质量"滑块调整比特率（1-5 Mbps）
   - 拖动"分辨率"滑块调整分辨率（480p-4K）
3. 调整后会立即看到提示"视频质量已调整为 X Mbps"或"分辨率已调整为 Xp"
4. 视频流会自动重启并应用新配置，通常在1-2秒内完成

## 注意事项

- 实时配置更新仅在"低延迟视频"模式（H264模式）下可用
- 截图模式下的配置更改需要重新连接才能生效
- 配置更新时视频流会短暂中断（1-2秒），这是正常现象
- 如果 WebSocket 未连接，配置更改将在下次连接时生效

## 技术细节

### 前端代码位置
- `frontend/src/hooks/useH264Player.ts`: 添加了 `updateConfig` 函数
- `frontend/src/pages/ScreenDisplay.tsx`: 更新了画质和分辨率调整处理函数

### 后端代码位置
- `backend/app/api/websocket_api.py`: WebSocket 端点处理配置消息
- `backend/app/services/scrcpy_service.py`: H264 流管理和配置存储
