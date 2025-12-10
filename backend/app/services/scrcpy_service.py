import asyncio
import os
import subprocess
import base64
from typing import Dict, Any, Optional
from fastapi import WebSocket
from app.core.config import settings
from app.services.device_service import DeviceManager
from app.utils.logger_utils import logger
from app.utils.adb_utils import run_adb_command, get_adb_path

def get_scrcpy_path() -> str:
    """获取scrcpy的完整路径"""
    scrcpy_path = settings.SCRCPY_PATH
    
    # 如果路径是 "scrcpy"，尝试从PATH中查找
    if scrcpy_path == "scrcpy":
        import shutil
        # 尝试多个可能的路径
        possible_paths = [
            shutil.which("scrcpy"),  # 从PATH查找
            "/usr/local/bin/scrcpy",
            "/usr/bin/scrcpy",
            "/opt/homebrew/bin/scrcpy",
        ]
        
        for path in possible_paths:
            if path and os.path.exists(path) and os.access(path, os.X_OK):
                logger.debug(f"找到scrcpy路径: {path}")
                return path
        
        # 如果都找不到，返回 "scrcpy"（可能在某些环境中可用）
        logger.warning("无法找到scrcpy完整路径，使用 'scrcpy'（可能在某些环境中可用）")
        return "scrcpy"
    
    return scrcpy_path

class ScrcpyManager:
    """Scrcpy服务管理器"""
    
    def __init__(self):
        self.device_manager = DeviceManager()
        self.screen_streams: Dict[str, asyncio.Task] = {}
        self.websocket_connections: Dict[str, WebSocket] = {}
        self.streaming_flags: Dict[str, bool] = {}
        self.scrcpy_processes: Dict[str, subprocess.Popen] = {}
    
    async def start_screen_stream(self, device_id: str, websocket: WebSocket):
        """启动屏幕流传输（使用scrcpy实时流）"""
        try:
            # 先扫描设备，确保设备在列表中
            try:
                await self.device_manager.scan_devices()
            except Exception as e:
                logger.warning(f"扫描设备失败: {str(e)}")
            
            # 确保设备已连接
            try:
                device_info = await self.device_manager.connect_device(device_id)
                if not device_info:
                    # 再次尝试连接
                    await asyncio.sleep(0.5)
                    device_info = await self.device_manager.connect_device(device_id)
                    if not device_info:
                        error_msg = f"设备 {device_id} 未连接，请确保设备已通过ADB连接"
                        logger.error(error_msg)
                        await websocket.send_json({
                            "type": "error",
                            "message": error_msg
                        })
                        return
            except Exception as e:
                error_msg = f"连接设备 {device_id} 失败: {str(e)}"
                logger.error(error_msg)
                await websocket.send_json({
                    "type": "error",
                    "message": error_msg
                })
                return
            
            # 如果已有流在运行，先停止
            if device_id in self.screen_streams:
                await self.stop_screen_stream(device_id)
            
            # 保存WebSocket连接
            self.websocket_connections[device_id] = websocket
            self.streaming_flags[device_id] = True
            
            # 启动scrcpy实时流任务
            task = asyncio.create_task(self.stream_scrcpy_video(device_id, websocket))
            self.screen_streams[device_id] = task
            
            logger.info(f"设备 {device_id} 屏幕流已启动（scrcpy实时流模式）")
            
        except Exception as e:
            logger.error(f"启动屏幕流失败: {str(e)}", exc_info=True)
            await websocket.send_json({
                "type": "error",
                "message": f"启动屏幕流失败: {str(e)}"
            })
    
    async def stream_scrcpy_video(self, device_id: str, websocket: WebSocket):
        """使用scrcpy传输实时视频流"""
        scrcpy_path = get_scrcpy_path()
        adb_path = get_adb_path()
        
        try:
            # 使用scrcpy的server模式，输出H.264视频流
            # scrcpy --record=- 会输出到stdout，但我们需要实时流
            # 更好的方式是使用 scrcpy-server 并通过 adb forward 转发
            
            # 方案1: 使用scrcpy的--record=-输出到stdout（H.264流）
            # 但这需要处理H.264编码，前端需要解码
            # 
            # 方案2: 使用adb shell screenrecord（但这不是实时流）
            #
            # 方案3: 使用scrcpy的--record=-并通过WebSocket转发H.264流
            # 前端使用HLS.js或WebCodecs API解码
            
            # 暂时使用优化的截图方式，但提高帧率到接近实时
            # 后续可以改为真正的H.264流
            
            logger.info(f"设备 {device_id} 开始实时视频流（优化截图模式）")
            frame_count = 0
            
            while self.streaming_flags.get(device_id, False):
                try:
                    # 检查WebSocket连接状态
                    if device_id not in self.websocket_connections:
                        logger.warning(f"设备 {device_id} WebSocket连接已断开，停止视频流")
                        break
                    
                    # 使用adb exec-out截图（返回原始二进制数据）
                    # 注意：Android的screencap命令默认输出PNG格式
                    # 某些设备可能支持-j参数输出JPEG，但为了兼容性，先使用PNG
                    # 如果设备响应慢，可以考虑降低分辨率或使用压缩
                    adb_path = get_adb_path()
                    cmd_parts = [adb_path, "-s", device_id, "exec-out", "screencap", "-p"]
                    process = await asyncio.create_subprocess_exec(
                        *cmd_parts,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        env=os.environ.copy()
                    )
                    
                    try:
                        # 超时时间设置为5秒（截图可能需要一些时间，特别是高分辨率设备）
                        logger.debug(f"设备 {device_id} 开始截图...")
                        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5.0)
                        logger.debug(f"设备 {device_id} 截图完成: returncode={process.returncode}, stdout长度={len(stdout) if stdout else 0}")
                        
                        if process.returncode == 0 and stdout and len(stdout) > 0:
                            # 直接使用二进制数据
                            base64_data = base64.b64encode(stdout).decode('utf-8')
                            
                            # 检查连接是否还存在
                            if device_id not in self.websocket_connections:
                                logger.info(f"设备 {device_id} 连接已断开，停止发送")
                                break
                            
                            # 发送JSON格式的截图数据（PNG格式）
                            try:
                                await websocket.send_json({
                                    "type": "screenshot",
                                    "data": f"data:image/png;base64,{base64_data}",
                                    "frame": frame_count
                                })
                                frame_count += 1
                                
                                # 每10帧打印一次日志（便于调试）
                                if frame_count % 10 == 0 or frame_count <= 3:
                                    logger.info(f"设备 {device_id} 已发送 {frame_count} 帧 (大小: {len(stdout)} 字节, base64长度: {len(base64_data)} 字符)")
                                    
                            except Exception as send_error:
                                error_msg = str(send_error)
                                if "websocket.close" in error_msg or "response already completed" in error_msg:
                                    logger.info(f"设备 {device_id} WebSocket连接已关闭")
                                else:
                                    logger.error(f"发送视频数据失败: {error_msg}")
                                break
                        else:
                            if stderr:
                                error_msg = stderr.decode('utf-8', errors='ignore')[:100]
                                logger.warning(f"设备 {device_id} 截图失败: returncode={process.returncode}, error={error_msg}")
                            # 如果失败，短暂等待后继续
                            await asyncio.sleep(0.1)
                    except asyncio.TimeoutError:
                        if process.returncode is None:
                            process.kill()
                        logger.warning(f"设备 {device_id} 截图超时（可能设备响应慢）")
                        await asyncio.sleep(0.1)
                    except Exception as e:
                        if process.returncode is None:
                            process.kill()
                        logger.warning(f"设备 {device_id} 截图异常: {str(e)}")
                        await asyncio.sleep(0.1)
                    
                    # 控制帧率：截图需要约3秒（高分辨率设备）
                    # 实际帧率约为每秒0.3帧，但我们会尽量快速发送
                    # 注意：如果需要更高帧率，可以考虑降低分辨率或使用真正的scrcpy视频流
                    await asyncio.sleep(0.0)  # 不额外延迟，尽快发送下一帧
                    
                except asyncio.CancelledError:
                    logger.info(f"设备 {device_id} 视频流任务已取消")
                    break
                except Exception as e:
                    logger.error(f"视频流循环异常: {str(e)}")
                    await asyncio.sleep(0.1)
            
            logger.info(f"设备 {device_id} 视频流任务结束")
            
        except Exception as e:
            logger.error(f"视频流异常: {str(e)}", exc_info=True)
        finally:
            # 清理
            if device_id in self.streaming_flags:
                self.streaming_flags[device_id] = False
            if device_id in self.websocket_connections:
                del self.websocket_connections[device_id]
    
    async def stop_screen_stream(self, device_id: str):
        """停止屏幕流传输"""
        try:
            # 设置停止标志
            self.streaming_flags[device_id] = False
            
            # 取消任务
            if device_id in self.screen_streams:
                task = self.screen_streams[device_id]
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                del self.screen_streams[device_id]
            
            # 关闭scrcpy进程（如果有）
            if device_id in self.scrcpy_processes:
                process = self.scrcpy_processes[device_id]
                try:
                    process.terminate()
                    await asyncio.wait_for(asyncio.create_task(asyncio.to_thread(process.wait)), timeout=2)
                except asyncio.TimeoutError:
                    process.kill()
                del self.scrcpy_processes[device_id]
            
            # 移除WebSocket连接
            if device_id in self.websocket_connections:
                del self.websocket_connections[device_id]
            
            logger.info(f"设备 {device_id} 屏幕流已停止")
            
        except Exception as e:
            logger.error(f"停止屏幕流失败: {str(e)}")
    
    async def push_device_status(self, websocket: WebSocket):
        """推送设备状态更新"""
        try:
            devices = await self.device_manager.get_all_devices()
            await websocket.send_json({
                "type": "device_status",
                "devices": [device.dict() for device in devices]
            })
        except Exception as e:
            logger.error(f"推送设备状态失败: {str(e)}")
