"""
mitmproxy 反向代理 API
用于移除 X-Frame-Options 限制，允许 iframe 嵌入
"""

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, Response
import httpx
import asyncio
import logging
from app.services.mitmproxy_service import get_mitmproxy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mitmproxy", tags=["mitmproxy"])

# 获取 mitmproxy 服务实例
mitmproxy_service = get_mitmproxy_service()


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
    # 获取设备的 mitmweb 状态
    status = mitmproxy_service.get_status(device_id)
    if status["status"] not in ["online"]:
        return Response(
            content=f"Device {device_id} not found or mitmweb not started",
            status_code=404
        )
    
    web_port = status["web_port"]
    
    # 构建目标 URL
    target_url = f"http://127.0.0.1:{web_port}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    logger.debug(f"代理请求: {request.method} {target_url}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
            
            # 移除 content-encoding 头，因为 httpx 已经自动解压了内容
            response_headers.pop("content-encoding", None)
            
            # 移除 content-length 和 transfer-encoding，避免冲突
            response_headers.pop("content-length", None)
            response_headers.pop("transfer-encoding", None)
            
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
    
    except httpx.TimeoutException:
        logger.error(f"代理请求超时: {target_url}")
        return Response(
            content=f"Proxy timeout: mitmweb on port {web_port} is not responding",
            status_code=504
        )
    
    except httpx.ConnectError:
        logger.error(f"无法连接到 mitmweb: {target_url}")
        return Response(
            content=f"Cannot connect to mitmweb on port {web_port}",
            status_code=503
        )
    except Exception as e:
        logger.error(f"代理请求失败: {e}", exc_info=True)
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
    
    # 获取设备的 mitmweb 状态
    status = mitmproxy_service.get_status(device_id)
    if status["status"] not in ["online"]:
        await websocket.close(code=1008, reason=f"Device {device_id} not found")
        return
    
    web_port = status["web_port"]
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


@router.post("/start/{device_id}")
async def start_mitmweb_for_device(device_id: str):
    """为设备启动 mitmweb"""
    result = mitmproxy_service.start_mitmweb(device_id)
    return result


@router.post("/stop/{device_id}")
async def stop_mitmweb_for_device(device_id: str):
    """停止设备的 mitmweb"""
    result = mitmproxy_service.stop_mitmweb(device_id)
    return result


@router.post("/register")
async def register_device(device_id: str, proxy_port: int, web_port: int):
    """手动注册设备的 mitmweb 端口（用于测试）"""
    # 这个接口保留用于手动测试
    # 实际使用时应该调用 /start/{device_id}
    logger.warning(f"使用手动注册接口: device={device_id}")
    return {
        "success": True,
        "device_id": device_id,
        "proxy_port": proxy_port,
        "web_port": web_port,
        "proxy_url": f"/api/v1/mitmproxy/proxy/{device_id}/",
        "message": "Device registered successfully (manual)"
    }


@router.get("/devices")
async def list_devices():
    """获取所有已注册的设备"""
    devices = mitmproxy_service.list_all()
    return {"devices": devices}


@router.get("/device/{device_id}/status")
async def get_device_status(device_id: str):
    """获取设备的 mitmweb 状态"""
    status = mitmproxy_service.get_status(device_id)
    return status


@router.get("/device/{device_id}/flows")
async def get_device_flows(device_id: str, limit: int = 100):
    """获取设备的抓包流量记录（从文件）"""
    # 检查设备是否在线
    status = mitmproxy_service.get_status(device_id)
    if status["status"] != "online":
        return {
            "success": False,
            "message": f"Device {device_id} not found or mitmweb not started",
            "flows": []
        }
    
    # 从文件读取流量记录
    try:
        from pathlib import Path
        import json
        
        data_file = Path.home() / ".mitmproxy" / "flows_simple.json"
        
        if data_file.exists():
            with open(data_file, 'r', encoding='utf-8') as f:
                flows = json.load(f)
            
            return {
                "success": True,
                "device_id": device_id,
                "flows": flows[-limit:] if len(flows) > limit else flows
            }
        else:
            return {
                "success": True,
                "device_id": device_id,
                "flows": []
            }
                
    except Exception as e:
        logger.error(f"获取流量数据失败: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "flows": []
        }


@router.get("/device/{device_id}/flow/{flow_id}")
async def get_flow_detail(device_id: str, flow_id: str):
    """获取单个流量的详细信息（从 addon 的全局变量）"""
    status = mitmproxy_service.get_status(device_id)
    if status["status"] != "online":
        return {
            "success": False,
            "message": f"Device {device_id} not found or mitmweb not started"
        }
    
    try:
        # 从 addon 的数据文件读取完整数据
        from pathlib import Path
        import json
        
        # 读取完整的流量数据（addon 保存的）
        data_file = Path.home() / ".mitmproxy" / "flows_full.json"
        
        if not data_file.exists():
            return {
                "success": False,
                "message": "No flow data available"
            }
        
        with open(data_file, 'r', encoding='utf-8') as f:
            flows = json.load(f)
        
        # 查找指定的流量
        flow = None
        for f in flows:
            if f.get("id") == flow_id:
                flow = f
                break
        
        if not flow:
            return {
                "success": False,
                "message": f"Flow not found: {flow_id}"
            }
        
        # 构建详情响应
        return {
            "success": True,
            "flow": {
                "id": flow.get("id"),
                "request": {
                    "method": flow.get("method"),
                    "url": flow.get("url"),
                    "headers": list(flow.get("request_headers", {}).items()),
                    "content": flow.get("request_content", ""),
                },
                "response": {
                    "status_code": flow.get("status"),
                    "reason": "OK" if flow.get("status") == 200 else "Error",
                    "headers": list(flow.get("response_headers", {}).items()) if flow.get("response_headers") else [],
                    "content": flow.get("response_content", ""),
                } if flow.get("status") else None
            }
        }
                
    except Exception as e:
        logger.error(f"获取流量详情失败: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e)
        }


@router.post("/device/{device_id}/clear")
async def clear_device_flows(device_id: str):
    """清空设备的抓包记录（从内存）"""
    status = mitmproxy_service.get_status(device_id)
    if status["status"] != "online":
        return {
            "success": False,
            "message": f"Device {device_id} not found or mitmweb not started"
        }
    
    try:
        from app.services.traffic_store import get_traffic_store
        
        traffic_store = get_traffic_store()
        traffic_store.clear()
        
        return {
            "success": True,
            "message": "Flows cleared"
        }
                
    except Exception as e:
        logger.error(f"清空流量数据失败: {e}")
        return {
            "success": False,
            "message": str(e)
        }
