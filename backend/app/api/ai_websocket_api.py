"""
AI WebSocket API - 实时 AI 交互日志
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.ai_service import AIService
from app.utils.logger_utils import logger
import json
import asyncio
from typing import Dict

router = APIRouter()
ai_service = AIService()

# 存储活跃的 WebSocket 连接
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/ai-logs/{device_id}")
async def ai_logs_websocket(websocket: WebSocket, device_id: str):
    """AI 日志 WebSocket 连接"""
    await websocket.accept()
    
    # 存储连接
    connection_key = f"ai_logs_{device_id}"
    active_connections[connection_key] = websocket
    
    logger.info(f"AI 日志 WebSocket 已连接: {device_id}")
    
    try:
        # 发送连接确认
        await websocket.send_json({
            "type": "connected",
            "message": f"AI 日志流已连接 - 设备 {device_id}",
            "device_id": device_id
        })
        
        # 保持连接活跃
        while True:
            try:
                # 接收客户端消息（心跳等）
                message = await asyncio.wait_for(websocket.receive(), timeout=30.0)
                
                if message.get("type") == "websocket.receive":
                    data = message.get("text")
                    if data:
                        try:
                            parsed = json.loads(data)
                            if parsed.get("type") == "ping":
                                await websocket.send_json({"type": "pong"})
                        except json.JSONDecodeError:
                            pass
                            
            except asyncio.TimeoutError:
                # 发送心跳
                await websocket.send_json({"type": "heartbeat"})
                
    except WebSocketDisconnect:
        logger.info(f"AI 日志 WebSocket 已断开: {device_id}")
    except Exception as e:
        logger.error(f"AI 日志 WebSocket 错误: {str(e)}")
    finally:
        # 清理连接
        if connection_key in active_connections:
            del active_connections[connection_key]

async def broadcast_ai_log(device_id: str, log_type: str, message: str, data: dict = None):
    """广播 AI 日志到对应设备的 WebSocket 连接"""
    connection_key = f"ai_logs_{device_id}"
    
    if connection_key in active_connections:
        websocket = active_connections[connection_key]
        
        try:
            log_data = {
                "type": "ai_log",
                "log_type": log_type,  # info, step, model_request, model_response, action, error
                "message": message,
                "device_id": device_id,
                "timestamp": asyncio.get_event_loop().time(),
                "data": data or {}
            }
            
            await websocket.send_json(log_data)
            
        except Exception as e:
            logger.warning(f"发送 AI 日志失败: {str(e)}")
            # 连接可能已断开，清理
            if connection_key in active_connections:
                del active_connections[connection_key]

# 导出广播函数供其他模块使用
__all__ = ["router", "broadcast_ai_log"]