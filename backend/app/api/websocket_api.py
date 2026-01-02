from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
from app.services.scrcpy_service import ScrcpyManager
from app.utils.logger_utils import logger

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
        # 确保停止截图流（这是截图模式的 WebSocket，只停止截图流）
        await scrcpy_manager.stop_screen_stream(device_id)

@router.websocket("/h264/{device_id}")
async def websocket_h264(websocket: WebSocket, device_id: str):
    """H264 实时视频流（基于 scrcpy server 或截图模式）"""
    await websocket.accept()
    stream_task = None
    try:
        import asyncio
        logger.info(f"H264 WebSocket 连接已建立: {device_id}")
        # 启动 H264 流（在后台运行，不阻塞）
        stream_task = asyncio.create_task(scrcpy_manager.start_h264_stream(device_id, websocket))
        
        # 保持连接，接收心跳或二进制数据
        # 不阻塞在 receive() 上，让流任务独立运行
        while True:
            try:
                # 使用超时接收，避免阻塞流任务
                try:
                    message = await asyncio.wait_for(websocket.receive(), timeout=0.5)
                    
                    if message.get("type") == "websocket.receive":
                        if "text" in message:
                            data = message["text"]
                            if data == "ping":
                                await websocket.send_text("pong")
                            else:
                                # 尝试解析JSON配置消息
                                try:
                                    import json
                                    config = json.loads(data)
                                    if config.get("type") == "config":
                                        # 更新流配置
                                        max_size = config.get("max_size", 1080)
                                        bit_rate = config.get("bit_rate", 8000000)
                                        # 将Mbps转换为bps
                                        if isinstance(bit_rate, (int, float)) and bit_rate < 1000000:
                                            bit_rate = int(bit_rate * 1000000)
                                        
                                        # 更新配置
                                        scrcpy_manager.h264_configs[device_id] = {
                                            'max_size': max_size,
                                            'bit_rate': bit_rate
                                        }
                                        logger.info(f"设备 {device_id}: 更新H264配置 - max_size={max_size}, bit_rate={bit_rate}")
                                        
                                        # 如果流正在运行，需要重启以应用新配置
                                        if device_id in scrcpy_manager.h264_streams:
                                            logger.info(f"设备 {device_id}: 配置已更新，需要重启流以应用新配置")
                                            # 取消旧的流任务
                                            if stream_task and not stream_task.done():
                                                stream_task.cancel()
                                                try:
                                                    await stream_task
                                                except asyncio.CancelledError:
                                                    pass
                                            # 停止当前流
                                            await scrcpy_manager.stop_h264_stream(device_id)
                                            # 重新启动流
                                            stream_task = asyncio.create_task(scrcpy_manager.start_h264_stream(device_id, websocket, max_size, bit_rate))
                                            await websocket.send_json({
                                                "type": "config_updated",
                                                "message": f"配置已更新: 分辨率={max_size}p, 比特率={bit_rate/1000000:.1f}Mbps"
                                            })
                                except (json.JSONDecodeError, KeyError, ValueError):
                                    # 不是配置消息，忽略
                                    pass
                        # 忽略二进制数据（由流处理）
                except asyncio.TimeoutError:
                    # 超时是正常的，继续循环保持连接
                    # 检查流任务是否还在运行
                    continue
            except WebSocketDisconnect:
                logger.info(f"H264 WebSocket 连接断开: {device_id}")
                break
            except Exception as e:
                # 如果接收消息失败，可能是连接断开
                error_msg = str(e)
                if "disconnect" in error_msg.lower() or "closed" in error_msg.lower():
                    logger.info(f"H264 WebSocket 连接已关闭: {device_id}")
                else:
                    logger.error(f"H264 WebSocket 接收消息失败: {str(e)}")
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        # 确保停止 H264 流
        await scrcpy_manager.stop_h264_stream(device_id)
        # 取消流任务（如果还在运行）
        if 'stream_task' in locals():
            stream_task.cancel()
            try:
                await stream_task
            except asyncio.CancelledError:
                pass

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

