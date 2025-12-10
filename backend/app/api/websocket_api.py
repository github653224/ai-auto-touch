from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.scrcpy_service import ScrcpyManager

router = APIRouter()
scrcpy_manager = ScrcpyManager()

@router.websocket("/screen/{device_id}")
async def websocket_screen(websocket: WebSocket, device_id: str):
    """设备屏幕实时传输WebSocket"""
    await websocket.accept()
    try:
        # 启动scrcpy视频流
        await scrcpy_manager.start_screen_stream(device_id, websocket)
        # 保持连接
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await scrcpy_manager.stop_screen_stream(device_id)
    except Exception as e:
        await websocket.send_text(f"error: {str(e)}")
        await scrcpy_manager.stop_screen_stream(device_id)

@router.websocket("/device-status")
async def websocket_device_status(websocket: WebSocket):
    """设备状态实时推送WebSocket"""
    await websocket.accept()
    try:
        # 推送设备状态
        await scrcpy_manager.push_device_status(websocket)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_text(f"error: {str(e)}")

