"""
mitmproxy 反向代理 API
用于移除 X-Frame-Options 限制，允许 iframe 嵌入
"""

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, Response
import httpx
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mitmproxy", tags=["mitmproxy"])

# 存储设备的 mitmweb 端口映射
# device_id -> {"proxy_port": 8091, "web_port": 8191}
MITMWEB_PORTS = {}


def register_mitmweb(device_id: str, proxy_port: int, web_port: int):
    """注册设备的 mitmweb 端口"""
    MITMWEB_PORTS[device_id] = {
        "proxy_port": proxy_port,
        "web_port": web_port
    }
    logger.info(f"注册 mitmweb: device={device_id}, proxy_port={proxy_port}, web_port={web_port}")


def unregister_mitmweb(device_id: str):
    """注销设备的 mitmweb"""
    if device_id in MITMWEB_PORTS:
        del MITMWEB_PORTS[device_id]
        logger.info(f"注销 mitmweb: device={device_id}")


@router.api_route(
    "/proxy/{device_id}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
)
async def proxy_mitmweb(device_id: str, path: str, request: Request):
    """
    反向代理 mitmweb 请求
    
    移除安全限制头：
    - X-Frame-Options
    - Content-Security-Policy
    - X-XSS-Protection
    - X-Content-Type-Options
    
    添加 CORS 支持
    """
    # 获取设备的 mitmweb 端口
    ports = MITMWEB_PORTS.get(device_id)
    if not ports:
        return Response(
            content=f"Device {device_id} not found or mitmweb not started",
            status_code=404
        )
    
    web_port = ports["web_port"]
    
    # 构建目标 URL
    target_url = f"http://127.0.0.1:{web_port}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    logger.debug(f"代理请求: {request.method} {target_url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 复制请求头（排除 Host）
            headers = dict(request.headers)
            headers.pop("host", None)
            
            # 发送请求到 mitmweb
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=await request.body(),
            )
            
            # 修改响应头
            response_headers = dict(response.headers)
            
            # 移除安全限制头
            response_headers.pop("x-frame-options", None)
            response_headers.pop("content-security-policy", None)
            response_headers.pop("x-xss-protection", None)
            response_headers.pop("x-content-type-options", None)
            
            # 添加 CORS 头
            response_headers["access-control-allow-origin"] = "*"
            response_headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response_headers["access-control-allow-headers"] = "*"
            response_headers["access-control-allow-credentials"] = "true"
            
            # 返回响应
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get("content-type")
            )
    
    except httpx.ConnectError:
        logger.error(f"无法连接到 mitmweb: {target_url}")
        return Response(
            content=f"Cannot connect to mitmweb on port {web_port}",
            status_code=503
        )
    except Exception as e:
        logger.error(f"代理请求失败: {e}")
        return Response(
            content=f"Proxy error: {str(e)}",
            status_code=500
        )


@router.websocket("/ws/{device_id}")
async def proxy_websocket(websocket: WebSocket, device_id: str):
    """
    WebSocket 反向代理
    用于 mitmweb 的实时更新
    """
    await websocket.accept()
    
    # 获取设备的 mitmweb 端口
    ports = MITMWEB_PORTS.get(device_id)
    if not ports:
        await websocket.close(code=1008, reason=f"Device {device_id} not found")
        return
    
    web_port = ports["web_port"]
    ws_url = f"ws://127.0.0.1:{web_port}/updates"
    
    logger.info(f"WebSocket 代理: {device_id} -> {ws_url}")
    
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", ws_url) as response:
                # 转发消息
                async for chunk in response.aiter_bytes():
                    await websocket.send_bytes(chunk)
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket 断开: {device_id}")
    except Exception as e:
        logger.error(f"WebSocket 代理失败: {e}")
        await websocket.close(code=1011, reason=str(e))


@router.get("/devices")
async def list_devices():
    """获取所有已注册的设备"""
    return {
        "devices": [
            {
                "device_id": device_id,
                "proxy_port": ports["proxy_port"],
                "web_port": ports["web_port"],
                "proxy_url": f"/api/v1/mitmproxy/proxy/{device_id}/",
                "ws_url": f"/api/v1/mitmproxy/ws/{device_id}"
            }
            for device_id, ports in MITMWEB_PORTS.items()
        ]
    }


@router.get("/device/{device_id}/status")
async def get_device_status(device_id: str):
    """获取设备的 mitmweb 状态"""
    ports = MITMWEB_PORTS.get(device_id)
    if not ports:
        return {"status": "not_found"}
    
    web_port = ports["web_port"]
    
    # 检查 mitmweb 是否在线
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"http://127.0.0.1:{web_port}/")
            return {
                "status": "online",
                "device_id": device_id,
                "proxy_port": ports["proxy_port"],
                "web_port": web_port,
                "proxy_url": f"/api/v1/mitmproxy/proxy/{device_id}/"
            }
    except:
        return {
            "status": "offline",
            "device_id": device_id,
            "proxy_port": ports["proxy_port"],
            "web_port": web_port
        }
