import asyncio
import subprocess
from typing import Dict, Any, Optional
from fastapi import WebSocket
from app.core.config import settings
from app.services.device_service import DeviceManager
from app.utils.logger_utils import logger

class ScrcpyManager:
    """Scrcpy服务管理器"""
    
    def __init__(self):
        self.device_manager = DeviceManager()
        self.screen_streams: Dict[str, asyncio.subprocess.Process] = {}
        self.websocket_connections: Dict[str, WebSocket] = {}
    
    async def start_screen_stream(self, device_id: str, websocket: WebSocket):
        """启动屏幕流传输"""
        try:
            # 确保设备已连接
            if not await self.device_manager.connect_device(device_id):
                raise Exception(f"设备 {device_id} 未连接")
            
            # 停止已有流
            if device_id in self.screen_streams:
                await self.stop_screen_stream(device_id)
            
            # 启动scrcpy视频流
            cmd = [
                settings.SCRCPY_PATH,
                "-s", device_id,
                "--no-control",
                "--no-display",
                "--bit-rate", "2M",
                "--max-size", "1080",
                "--codec", "h264",
                "--tcpip",
                "-N",
                "-"
            ]
            
            # 启动子进程
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.screen_streams[device_id] = process
            self.websocket_connections[device_id] = websocket
            
            # 读取视频流并发送到WebSocket
            async def stream_video():
                while process.returncode is None:
                    try:
                        data = await process.stdout.read(4096)
                        if not data:
                            break
                        # 通过WebSocket发送视频数据
                        await websocket.send_bytes(data)
                    except Exception as e:
                        logger.error(f"发送视频流失败: {str(e)}")
                        break
            
            # 启动视频流传输
            asyncio.create_task(stream_video())
            
            logger.info(f"设备 {device_id} 屏幕流已启动")
        except Exception as e:
            logger.error(f"启动屏幕流失败: {str(e)}")
            raise
    
    async def stop_screen_stream(self, device_id: str):
        """停止屏幕流传输"""
        try:
            if device_id in self.screen_streams:
                process = self.screen_streams[device_id]
                if process.returncode is None:
                    process.terminate()
                    await process.wait()
                del self.screen_streams[device_id]
            
            if device_id in self.websocket_connections:
                del self.websocket_connections[device_id]
            
            logger.info(f"设备 {device_id} 屏幕流已停止")
        except Exception as e:
            logger.error(f"停止屏幕流失败: {str(e)}")
    
    async def push_device_status(self, websocket: WebSocket):
        """推送设备状态"""
        try:
            while True:
                # 获取所有设备状态
                devices = await self.device_manager.get_all_devices()
                status_data = {
                    "type": "device_status",
                    "devices": [device.model_dump() for device in devices]
                }
                
                # 发送状态数据
                await websocket.send_json(status_data)
                
                # 每隔5秒更新一次
                await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"推送设备状态失败: {str(e)}")
            raise

