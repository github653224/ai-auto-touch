# mitmproxy 反向代理测试指南

## 概述

本文档介绍如何测试 mitmweb 的反向代理功能，解决 `X-Frame-Options: DENY` 导致的 iframe 嵌入问题。

## 架构说明

```
┌─────────────┐
│   浏览器     │
│  (iframe)   │
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────────────────┐
│  FastAPI 反向代理                │
│  /api/v1/mitmproxy/proxy/{id}/  │
│                                  │
│  功能:                           │
│  - 移除 X-Frame-Options         │
│  - 移除 Content-Security-Policy │
│  - 添加 CORS 头                 │
└──────┬──────────────────────────┘
       │ HTTP (127.0.0.1)
       ↓
┌─────────────┐
│  mitmweb    │
│  (10.4.2)   │
│  :8191      │
└─────────────┘
```

## 测试步骤

### 1. 启动 mitmweb

```bash
# 方式一：使用测试脚本（旧版本，有 X-Frame-Options）
cd backend
bash test_mitmweb.sh

# 方式二：使用反向代理脚本（推荐）
bash start_mitmweb_proxy.sh test-device 8091 8191
```

**参数说明:**
- `test-device`: 设备 ID
- `8091`: 代理端口（手机流量通过此端口）
- `8191`: Web 端口（Web 界面端口）

### 2. 启动 FastAPI 后端

```bash
cd backend
source ~/miniconda3/etc/profile.d/conda.sh
conda activate ai-auto-touch
python main.py
```

后端将在 `http://localhost:8000` 启动。

### 3. 注册 mitmweb 到反向代理

```bash
cd backend
python register_mitmweb.py register --device-id test-device --proxy-port 8091 --web-port 8191
```

**输出示例:**
```
✅ 已注册 mitmweb:
   设备 ID: test-device
   代理端口: 8091
   Web 端口: 8191

📝 访问地址:
   反向代理: http://localhost:8000/api/v1/mitmproxy/proxy/test-device/
   状态检查: http://localhost:8000/api/v1/mitmproxy/device/test-device/status
```

### 4. 检查状态

```bash
# 检查单个设备状态
python register_mitmweb.py status --device-id test-device

# 列出所有设备
python register_mitmweb.py list
```

### 5. 测试 iframe 嵌入

#### 方式一：使用测试页面

```bash
# 启动测试服务器（如果还没启动）
python3 -m http.server 8192 --directory backend
```

访问测试页面:
- **对比测试**: http://localhost:8192/test_iframe_proxy.html
- **简单测试**: http://localhost:8192/test_iframe.html

#### 方式二：使用 curl 测试

```bash
# 测试直接访问（有 X-Frame-Options）
curl -I http://localhost:8191/

# 测试反向代理访问（无 X-Frame-Options）
curl -I http://localhost:8000/api/v1/mitmproxy/proxy/test-device/
```

**预期结果:**

直接访问:
```
HTTP/1.1 200 OK
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; ...
```

反向代理访问:
```
HTTP/1.1 200 OK
access-control-allow-origin: *
access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
(没有 X-Frame-Options 和 Content-Security-Policy)
```

## API 端点

### 1. 反向代理访问

```
GET /api/v1/mitmproxy/proxy/{device_id}/{path}
```

**示例:**
```bash
# 访问 mitmweb 首页
curl http://localhost:8000/api/v1/mitmproxy/proxy/test-device/

# 访问 API
curl http://localhost:8000/api/v1/mitmproxy/proxy/test-device/flows
```

### 2. 检查设备状态

```
GET /api/v1/mitmproxy/device/{device_id}/status
```

**响应示例:**
```json
{
  "status": "online",
  "device_id": "test-device",
  "proxy_port": 8091,
  "web_port": 8191,
  "proxy_url": "/api/v1/mitmproxy/proxy/test-device/"
}
```

### 3. 列出所有设备

```
GET /api/v1/mitmproxy/devices
```

**响应示例:**
```json
{
  "devices": [
    {
      "device_id": "test-device",
      "proxy_port": 8091,
      "web_port": 8191,
      "proxy_url": "/api/v1/mitmproxy/proxy/test-device/",
      "ws_url": "/api/v1/mitmproxy/ws/test-device"
    }
  ]
}
```

### 4. WebSocket 代理

```
WS /api/v1/mitmproxy/ws/{device_id}
```

用于实时更新流量数据。

## 前端集成

### React 组件示例

```typescript
import React from 'react';

interface MitmproxyViewerProps {
  deviceId: string;
}

const MitmproxyViewer: React.FC<MitmproxyViewerProps> = ({ deviceId }) => {
  const proxyUrl = `/api/v1/mitmproxy/proxy/${deviceId}/`;
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <iframe
        src={proxyUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px'
        }}
        title="mitmproxy 抓包工具"
        sandbox="allow-same-origin allow-scripts allow-forms"
      />
    </div>
  );
};

export default MitmproxyViewer;
```

### 检查状态

```typescript
async function checkMitmproxyStatus(deviceId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/v1/mitmproxy/device/${deviceId}/status`
    );
    const data = await response.json();
    return data.status === 'online';
  } catch (error) {
    console.error('检查 mitmproxy 状态失败:', error);
    return false;
  }
}
```

## 故障排查

### 问题 1: iframe 显示空白

**可能原因:**
1. mitmweb 未启动
2. FastAPI 后端未启动
3. 设备未注册

**解决方法:**
```bash
# 检查 mitmweb 是否运行
ps aux | grep mitmweb

# 检查 FastAPI 是否运行
curl http://localhost:8000/

# 检查设备状态
curl http://localhost:8000/api/v1/mitmproxy/device/test-device/status
```

### 问题 2: 403 或 404 错误

**可能原因:**
1. 设备 ID 不正确
2. 端口配置错误

**解决方法:**
```bash
# 列出所有已注册设备
curl http://localhost:8000/api/v1/mitmproxy/devices

# 重新注册设备
python register_mitmweb.py register --device-id test-device
```

### 问题 3: 仍然显示 X-Frame-Options 错误

**可能原因:**
1. 直接访问了 mitmweb，而不是反向代理
2. 浏览器缓存

**解决方法:**
```bash
# 确认使用反向代理 URL
# 正确: http://localhost:8000/api/v1/mitmproxy/proxy/test-device/
# 错误: http://localhost:8191/

# 清除浏览器缓存或使用无痕模式
```

### 问题 4: WebSocket 连接失败

**可能原因:**
1. WebSocket 代理未实现
2. 防火墙阻止

**解决方法:**
```bash
# 检查 WebSocket 端点
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:8000/api/v1/mitmproxy/ws/test-device
```

## 性能优化

### 1. 启用 HTTP/2

```python
# 在 uvicorn 启动时启用
uvicorn.run(
    "main:socket_app",
    host="0.0.0.0",
    port=8000,
    http="h11",  # 或 "httptools"
)
```

### 2. 启用响应缓存

```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

# 初始化缓存
FastAPICache.init(InMemoryBackend())
```

### 3. 限制并发连接

```python
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware

class ConnectionLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_connections: int = 100):
        super().__init__(app)
        self.max_connections = max_connections
        self.current_connections = 0
```

## 安全建议

### 1. 生产环境配置

```python
# 只允许特定来源
response_headers["access-control-allow-origin"] = "https://yourdomain.com"

# 添加认证
from fastapi import Header, HTTPException

async def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
```

### 2. 限制访问 IP

```python
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class IPWhitelistMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, allowed_ips: list):
        super().__init__(app)
        self.allowed_ips = allowed_ips
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        if client_ip not in self.allowed_ips:
            return Response("Forbidden", status_code=403)
        return await call_next(request)
```

### 3. 使用 HTTPS

```bash
# 使用 SSL 证书
uvicorn main:app \
  --host 0.0.0.0 \
  --port 443 \
  --ssl-keyfile /path/to/key.pem \
  --ssl-certfile /path/to/cert.pem
```

## 参考资料

- [mitmproxy 官方文档](https://docs.mitmproxy.org/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [X-Frame-Options MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
- [CORS MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**文档版本**: v1.0  
**创建日期**: 2026-01-09  
**作者**: AI Auto Touch Team
