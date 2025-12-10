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
        # 保持连接，接收心跳
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
            except Exception as e:
                # 如果接收消息失败，可能是连接断开
                break
    except WebSocketDisconnect:
        pass  # 正常断开
    except Exception as e:
        # 尝试发送错误消息（如果连接还在）
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        # 确保停止流
        await scrcpy_manager.stop_screen_stream(device_id)

@router.websocket("/api/v1/ws/h264/{device_id}")
async def websocket_h264(websocket: WebSocket, device_id: str):
    """H264 实时视频流（基于 screenrecord）"""
    await websocket.accept()
    try:
        await scrcpy_manager.start_h264_stream(device_id, websocket)
        # 保持连接，接收心跳
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        await scrcpy_manager.stop_h264_stream(device_id)

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

