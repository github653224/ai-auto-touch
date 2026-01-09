# mitmproxy 抓包功能集成方案 V2.0

## 问题分析

### 当前遇到的问题

**iframe 嵌入 403 错误的原因：**

1. **X-Frame-Options 限制**
   - mitmweb 默认设置 `X-Frame-Options: DENY`
   - 浏览器阻止在 iframe 中加载

2. **CORS 跨域限制**
   - mitmweb 的 API 默认只允许同源访问
   - 跨域请求被浏览器拦截

3. **CVE-2025-23217 安全修复**
   - mitmproxy 11.1.2+ 版本增加了 API 认证
   - 需要 token 才能访问 API

## 解决方案

### 方案一：使用反向代理（推荐）⭐

通过 Nginx/FastAPI 反向代理 mitmweb，移除安全头并添加 CORS 支持。

#### 架构图

```
前端 (React)
    ↓ HTTP
FastAPI 反向代理
    ↓ 移除 X-Frame-Options
    ↓ 添加 CORS 头
mitmweb (127.0.0.1:8181)
```

#### 实现代码

**后端反向代理 (FastAPI)**

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import httpx

app = FastAPI()

# mitmweb 代理配置
MITMWEB_PROXIES = {}  # device_id -> port

@app.api_route("/proxy/{device_id}/mitmweb/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_mitmweb(device_id: str, path: str, request: Request):
    """
    反向代理 mitmweb 请求，移除安全限制
    """
    # 获取设备的 mitmweb 端口
    web_port = MITMWEB_PROXIES.get(device_id)
    if not web_port:
        return {"error": "Proxy not found"}
    
    # 构建目标 URL
    target_url = f"http://127.0.0.1:{web_port}/{path}"
    
    # 转发请求
    async with httpx.AsyncClient() as client:
        # 复制请求头（排除 Host）
        headers = dict(request.headers)
        headers.pop("host", None)
        
        # 发送请求到 mitmweb
        response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=await request.body(),
            params=request.query_params
        )
        
        # 修改响应头
        response_headers = dict(response.headers)
        
        # 移除安全限制头
        response_headers.pop("x-frame-options", None)
        response_headers.pop("content-security-policy", None)
        
        # 添加 CORS 头
        response_headers["access-control-allow-origin"] = "*"
        response_headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response_headers["access-control-allow-headers"] = "*"
        
        # 返回响应
        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=response_headers,
            media_type=response.headers.get("content-type")
        )

# WebSocket 代理（用于实时更新）
@app.websocket("/proxy/{device_id}/mitmweb/updates")
async def proxy_websocket(websocket: WebSocket, device_id: str):
    await websocket.accept()
    
    web_port = MITMWEB_PROXIES.get(device_id)
    if not web_port:
        await websocket.close()
        return
    
    # 连接到 mitmweb 的 WebSocket
    async with websockets.connect(f"ws://127.0.0.1:{web_port}/updates") as mitmweb_ws:
        # 双向转发消息
        async def forward_to_client():
            async for message in mitmweb_ws:
                await websocket.send_text(message)
        
        async def forward_to_mitmweb():
            while True:
                data = await websocket.receive_text()
                await mitmweb_ws.send(data)
        
        await asyncio.gather(
            forward_to_client(),
            forward_to_mitmweb()
        )
```

**前端使用**

```typescript
// 通过反向代理访问 mitmweb
const ProxyViewer: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const proxyUrl = `/api/v1/proxy/${deviceId}/mitmweb/`;
  
  return (
    <iframe
      src={proxyUrl}
      style={{ width: '100%', height: '800px', border: 'none' }}
      title="mitmweb"
    />
  );
};
```

---

### 方案二：使用旧版本 mitmproxy

使用 mitmproxy 10.x 版本，该版本没有严格的安全限制。

#### 推荐版本

- **mitmproxy 10.4.2** (2024-08-15)
  - 稳定版本
  - 没有 CVE-2025-23217 的认证限制
  - X-Frame-Options 可以通过参数禁用

#### 安装指定版本

```bash
# 卸载当前版本
pip uninstall mitmproxy

# 安装 10.4.2 版本
pip install mitmproxy==10.4.2
```

#### 启动参数

```bash
mitmweb \
  --listen-port 8081 \
  --web-port 8181 \
  --web-host 0.0.0.0 \
  --no-web-open-browser \
  --set block_global=false \
  --set web_open_browser=false
```

**注意：** 10.x 版本的 mitmweb 默认不设置 X-Frame-Options，可以直接嵌入 iframe。

---

### 方案三：自定义 mitmproxy 插件

编写 mitmproxy 插件，移除响应头限制。

#### 插件代码

```python
# remove_frame_options.py
from mitmproxy import http

class RemoveFrameOptions:
    def response(self, flow: http.HTTPFlow) -> None:
        """移除 X-Frame-Options 头"""
        if "x-frame-options" in flow.response.headers:
            del flow.response.headers["x-frame-options"]
        
        if "content-security-policy" in flow.response.headers:
            del flow.response.headers["content-security-policy"]
        
        # 添加 CORS 头
        flow.response.headers["access-control-allow-origin"] = "*"

addons = [RemoveFrameOptions()]
```

#### 使用插件

```bash
mitmweb \
  --listen-port 8081 \
  --web-port 8181 \
  --web-host 0.0.0.0 \
  -s remove_frame_options.py
```

---

### 方案四：使用 mitmproxy API 自建界面

不使用 mitmweb，直接调用 mitmproxy API 构建自定义界面。

#### 架构

```
前端 (React)
    ↓ REST API
FastAPI 后端
    ↓ Python API
mitmproxy (mitmdump)
```

#### 实现

```python
from mitmproxy import options, master
from mitmproxy.tools import dump

class FlowCapture:
    def __init__(self):
        self.flows = []
    
    def request(self, flow):
        self.flows.append({
            "id": flow.id,
            "method": flow.request.method,
            "url": flow.request.url,
            "timestamp": flow.timestamp_start
        })
    
    def response(self, flow):
        for f in self.flows:
            if f["id"] == flow.id:
                f["status_code"] = flow.response.status_code
                f["size"] = len(flow.response.content)

# FastAPI 端点
@app.get("/api/v1/proxy/{device_id}/flows")
async def get_flows(device_id: str):
    """获取流量列表"""
    capture = flow_captures.get(device_id)
    if not capture:
        return []
    return capture.flows

@app.get("/api/v1/proxy/{device_id}/flow/{flow_id}")
async def get_flow_detail(device_id: str, flow_id: str):
    """获取流量详情"""
    # 返回请求/响应详情
    pass
```

---

## 推荐方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **方案一：反向代理** | ✅ 安全<br>✅ 使用最新版本<br>✅ 完整功能 | ⚠️ 需要额外开发 | ⭐⭐⭐⭐⭐ |
| **方案二：旧版本** | ✅ 简单<br>✅ 开箱即用 | ❌ 有安全漏洞<br>❌ 不推荐生产环境 | ⭐⭐⭐ |
| **方案三：插件** | ✅ 灵活<br>✅ 可定制 | ⚠️ 需要维护插件 | ⭐⭐⭐⭐ |
| **方案四：自建界面** | ✅ 完全控制<br>✅ 定制化 | ❌ 开发量大<br>❌ 需要重新实现 UI | ⭐⭐ |

---

## 最终推荐方案

### 🎯 推荐：方案一（反向代理）+ 方案二（旧版本）组合

**开发阶段：**
- 使用 mitmproxy 10.4.2 快速验证功能
- 直接 iframe 嵌入，无需额外开发

**生产环境：**
- 升级到最新版本 mitmproxy
- 使用 FastAPI 反向代理
- 确保安全性和稳定性

---

## 实施步骤

### 第一阶段：快速验证（1-2 天）

```bash
# 1. 安装旧版本
pip install mitmproxy==10.4.2

# 2. 启动 mitmweb
mitmweb --listen-port 8081 --web-port 8181 --web-host 0.0.0.0

# 3. 前端直接嵌入
<iframe src="http://localhost:8181" />
```

### 第二阶段：反向代理开发（3-5 天）

1. 实现 FastAPI 反向代理端点
2. 处理 HTTP 请求转发
3. 处理 WebSocket 连接
4. 移除安全头，添加 CORS

### 第三阶段：升级和测试（2-3 天）

1. 升级到 mitmproxy 最新版本
2. 测试反向代理功能
3. 性能优化
4. 安全加固

---

## 版本兼容性测试

| mitmproxy 版本 | iframe 嵌入 | 认证要求 | 推荐使用 |
|---------------|------------|---------|---------|
| 10.4.2 | ✅ 可以 | ❌ 无 | ✅ 开发环境 |
| 11.0.x | ❌ 不可以 | ❌ 无 | ❌ 不推荐 |
| 11.1.0-11.1.1 | ❌ 不可以 | ❌ 无 | ❌ 有漏洞 |
| 11.1.2+ | ❌ 不可以 | ✅ 需要 | ✅ 生产环境（需反向代理） |

---

## 安全建议

1. **开发环境**
   - 可以使用 10.4.2 版本
   - 仅在本地网络使用
   - 不要暴露到公网

2. **生产环境**
   - 必须使用最新版本
   - 通过反向代理访问
   - 添加认证和授权
   - 限制访问 IP

3. **网络隔离**
   - mitmweb 只监听 127.0.0.1
   - 通过反向代理对外提供服务
   - 使用防火墙规则限制访问

---

## 参考资料

- [mitmproxy 官方文档](https://docs.mitmproxy.org/)
- [CVE-2025-23217 详情](https://nvd.nist.gov/vuln/detail/CVE-2025-23217)
- [mitmproxy GitHub Issues #4626](https://github.com/mitmproxy/mitmproxy/issues/4626)
- [X-Frame-Options MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)

---

**文档版本**: v2.0  
**创建日期**: 2026-01-06  
**最后更新**: 2026-01-06  
**作者**: AI Auto Touch Team
