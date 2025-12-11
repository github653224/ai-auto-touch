import asyncio
import os
import subprocess
import base64
import socket
import struct
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
        self.h264_streams: Dict[str, asyncio.Task] = {}
        self.websocket_connections: Dict[str, WebSocket] = {}
        self.streaming_flags: Dict[str, bool] = {}
        self.scrcpy_processes: Dict[str, subprocess.Popen] = {}
        self.h264_processes: Dict[str, asyncio.subprocess.Process] = {}
        self.scrcpy_server_path = self._find_scrcpy_server()
        self.scrcpy_forward_ports: Dict[str, int] = {}  # device_id -> port
        self.scrcpy_sockets: Dict[str, socket.socket] = {}  # device_id -> socket
    
    def _find_scrcpy_server(self) -> Optional[str]:
        """查找 scrcpy-server 文件"""
        import shutil
        possible_paths = [
            "/opt/homebrew/Cellar/scrcpy/3.3.3/share/scrcpy/scrcpy-server",
            "/opt/homebrew/share/scrcpy/scrcpy-server",
            "/usr/local/share/scrcpy/scrcpy-server",
            shutil.which("scrcpy-server"),
        ]
        for path in possible_paths:
            if path and os.path.exists(path):
                logger.info(f"找到 scrcpy-server: {path}")
                return path
        logger.warning("未找到 scrcpy-server，H264 流将使用截图模式")
        return None
        self.scrcpy_server_path = self._find_scrcpy_server()
        self.scrcpy_forward_ports: Dict[str, int] = {}  # device_id -> port
    
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
    
    # ------------------------------------------------------------------
    # H264 实时视频流（基于 screenrecord --output-format=h264）
    # ------------------------------------------------------------------

    async def start_h264_stream(self, device_id: str, websocket: WebSocket):
        """启动H264实时视频流"""
        try:
            # 确保设备已连接
            if not await self.device_manager.connect_device(device_id):
                error_msg = f"设备 {device_id} 未连接"
                logger.error(error_msg)
                await websocket.send_json({"type": "error", "message": error_msg})
                return

            # 如果已有流在运行，先停止（但保留 streaming_flags 状态）
            if device_id in self.h264_streams:
                old_task = self.h264_streams[device_id]
                if not old_task.done():
                    old_task.cancel()
                    try:
                        await old_task
                    except asyncio.CancelledError:
                        pass
                del self.h264_streams[device_id]

            # 先设置标志和连接，确保任务启动时状态正确
            self.websocket_connections[device_id] = websocket
            self.streaming_flags[device_id] = True

            # 启动任务
            task = asyncio.create_task(self._stream_h264(device_id, websocket))
            self.h264_streams[device_id] = task
            logger.info(f"设备 {device_id} H264 视频流已启动")
            
            # 等待一小段时间，确保任务开始运行
            await asyncio.sleep(0.1)
        except Exception as e:
            logger.error(f"启动H264视频流失败: {str(e)}", exc_info=True)
            self.streaming_flags[device_id] = False
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except:
                pass

    async def stop_h264_stream(self, device_id: str):
        """停止H264视频流"""
        try:
            self.streaming_flags[device_id] = False

            # 取消任务
            if device_id in self.h264_streams:
                task = self.h264_streams[device_id]
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                del self.h264_streams[device_id]

            # 终止进程
            if device_id in self.h264_processes:
                proc = self.h264_processes[device_id]
                if proc.returncode is None:
                    proc.kill()
                    try:
                        await proc.wait()
                    except Exception:
                        pass
                del self.h264_processes[device_id]

            if device_id in self.websocket_connections:
                del self.websocket_connections[device_id]

            logger.info(f"设备 {device_id} H264 视频流已停止")
        except Exception as e:
            logger.error(f"停止H264视频流失败: {str(e)}")

    async def _stream_h264(self, device_id: str, websocket: WebSocket):
        """
        使用 scrcpy server 模式获取真正的 H264 原始流
        如果 scrcpy-server 不可用，回退到截图模式
        """
        adb_path = get_adb_path()
        server_process = None
        
        # 检查是否有 scrcpy-server
        if not self.scrcpy_server_path:
            logger.warning(f"设备 {device_id}: scrcpy-server 不可用，使用截图模式作为回退")
            await self._stream_h264_fallback(device_id, websocket)
            return
        
        try:
            # 1. 推送 scrcpy-server 到设备
            logger.info(f"设备 {device_id}: 推送 scrcpy-server 到设备...")
            push_result = await run_adb_command(f"-s {device_id} push {self.scrcpy_server_path} /data/local/tmp/scrcpy-server.jar")
            if push_result.returncode != 0:
                logger.error(f"设备 {device_id}: 推送 scrcpy-server 失败: {push_result.stderr}")
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            # 2. 设置端口转发（使用动态端口）
            import random
            local_port = random.randint(10000, 65535)
            forward_result = await run_adb_command(f"-s {device_id} forward tcp:{local_port} localabstract:scrcpy")
            if forward_result.returncode != 0:
                logger.error(f"设备 {device_id}: 端口转发失败: {forward_result.stderr}")
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            self.scrcpy_forward_ports[device_id] = local_port
            logger.info(f"设备 {device_id}: 端口转发成功，本地端口: {local_port}")
            
            # 3. 启动 scrcpy server
            # scrcpy server 参数格式：版本 日志级别 码率 最大FPS 裁剪 发送帧率 锁定屏幕方向 保持屏幕开启 关闭屏幕 显示触摸 控制 音频 音频编解码器 音频比特率 音频采样率 音频声道 视频编解码器 视频编码器 视频比特率 最大分辨率 视频编码参数 裁剪 发送帧率 锁定屏幕方向 保持屏幕开启 关闭屏幕 显示触摸 控制 音频 音频编解码器 音频比特率 音频采样率 音频声道
            # 获取 scrcpy 版本（从 server 文件名或通过命令获取）
            # scrcpy 3.3.3 对应的版本号是 "3.3.3"
            scrcpy_version = "3.3.3"  # 从 /opt/homebrew/Cellar/scrcpy/3.3.3/ 路径获取
            # 简化版本：只启动视频流，不需要音频和控制
            # 参数说明：版本 日志级别 码率 最大FPS 裁剪 发送帧率 锁定屏幕方向 保持屏幕开启 关闭屏幕 显示触摸 控制 音频 音频编解码器 音频比特率 音频采样率 音频声道 视频编解码器 视频编码器 视频比特率 最大分辨率 视频编码参数
            server_cmd = (
                f"CLASSPATH=/data/local/tmp/scrcpy-server.jar "
                f"app_process / com.genymobile.scrcpy.Server "
                f"{scrcpy_version} 0 8000000 0 -1 false - true true 0 false false - - false 0 0 0 0 false"
            )
            
            logger.info(f"设备 {device_id}: 启动 scrcpy server...")
            logger.debug(f"设备 {device_id}: server 命令: {server_cmd}")
            
            # 启动 server（在后台运行，不等待输出，避免阻塞）
            server_process = await asyncio.create_subprocess_exec(
                adb_path, "-s", device_id, "shell", server_cmd,
                stdout=asyncio.subprocess.DEVNULL,  # 不读取输出，避免阻塞
                stderr=asyncio.subprocess.DEVNULL,
                env=os.environ.copy()
            )
            
            # 等待 server 启动（给足够时间）
            await asyncio.sleep(1.5)
            
            # 检查 server 是否还在运行
            if server_process.returncode is not None:
                logger.error(f"设备 {device_id}: scrcpy server 立即退出，returncode={server_process.returncode}")
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            logger.info(f"设备 {device_id}: scrcpy server 已启动（PID: {server_process.pid if hasattr(server_process, 'pid') else 'N/A'}）")
            
            # 4. 连接到 socket 获取 H264 流
            logger.info(f"设备 {device_id}: 连接到 scrcpy server (localhost:{local_port})...")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10.0)  # 增加超时时间
            try:
                sock.connect(("localhost", local_port))
                self.scrcpy_sockets[device_id] = sock
                logger.info(f"设备 {device_id}: 已连接到 scrcpy server")
                
                # scrcpy 协议：需要先发送设备名称（64字节，null 填充）
                device_name_bytes = device_id.encode('utf-8')[:63]  # 最多63字节
                device_name_bytes = device_name_bytes.ljust(64, b'\x00')  # 填充到64字节
                await asyncio.to_thread(sock.send, device_name_bytes)
                logger.info(f"设备 {device_id}: 已发送设备名称（64字节）")
                
                # scrcpy 协议：读取 server 的初始消息（设备信息）
                # 第一个消息是设备信息，格式：设备名称(64字节) + 宽度(2字节) + 高度(2字节)
                sock.settimeout(5.0)  # 设置超时用于初始消息
                try:
                    initial_data = await asyncio.to_thread(sock.recv, 68)
                    if initial_data:
                        logger.info(f"设备 {device_id}: 收到 server 初始消息（大小: {len(initial_data)} 字节），前16字节: {initial_data[:16].hex()}")
                        if len(initial_data) >= 68:
                            device_name = initial_data[0:64].rstrip(b'\x00').decode('utf-8', errors='ignore')
                            width = struct.unpack(">H", initial_data[64:66])[0]
                            height = struct.unpack(">H", initial_data[66:68])[0]
                            logger.info(f"设备 {device_id}: 设备信息 - 设备名: {device_name}, 分辨率: {width}x{height}")
                        else:
                            logger.warning(f"设备 {device_id}: server 初始消息不完整，期望68字节，实际{len(initial_data)}字节")
                    else:
                        logger.warning(f"设备 {device_id}: server 未发送初始消息（收到空数据）")
                except socket.timeout:
                    logger.warning(f"设备 {device_id}: 等待 server 初始消息超时（5秒），可能协议不同，继续尝试读取视频流...")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 读取初始消息失败: {str(e)}，继续尝试读取视频流...")
                
                # 恢复较长的超时时间用于读取视频流
                sock.settimeout(2.0)  # 设置为2秒，避免长时间阻塞
                logger.info(f"设备 {device_id}: 准备开始接收 H264 流...")
                
            except Exception as e:
                logger.error(f"设备 {device_id}: 连接 scrcpy server 失败: {str(e)}", exc_info=True)
                sock.close()
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            # 5. 读取并发送 H264 流
            frame_count = 0
            buffer = b""
            first_packet = True
            
            logger.info(f"设备 {device_id}: 开始读取 H264 流...")
            
            while self.streaming_flags.get(device_id, False):
                try:
                    if device_id not in self.websocket_connections:
                        logger.warning(f"设备 {device_id}: WebSocket连接已断开")
                        break
                    
                    # 从 socket 读取数据
                    try:
                        data = await asyncio.to_thread(sock.recv, 65536)  # 64KB 缓冲区
                        if not data:
                            logger.warning(f"设备 {device_id}: scrcpy server 连接断开（收到空数据）")
                            break
                        
                        if first_packet:
                            logger.info(f"设备 {device_id}: ✅ 收到第一个数据包（大小: {len(data)} 字节）")
                            logger.info(f"设备 {device_id}: 前32字节（hex）: {data[:32].hex()}")
                            logger.info(f"设备 {device_id}: 前32字节（ascii，可打印字符）: {''.join(chr(b) if 32 <= b < 127 else '.' for b in data[:32])}")
                            first_packet = False
                        
                        buffer += data
                        
                        # scrcpy 协议：每个包前面有 12 字节的头部
                        # 头部格式：type(1) + flags(1) + size(4) + timestamp(6)
                        while len(buffer) >= 12:
                            # 解析头部
                            packet_type = buffer[0]
                            flags = buffer[1]
                            packet_size = struct.unpack(">I", buffer[2:6])[0]
                            timestamp = struct.unpack(">Q", b"\x00\x00" + buffer[6:12])[0]
                            
                            if packet_size > 10 * 1024 * 1024:  # 超过 10MB，可能是解析错误
                                logger.error(f"设备 {device_id}: 包大小异常: {packet_size} 字节，可能协议解析错误")
                                buffer = buffer[1:]  # 跳过第一个字节，重新对齐
                                continue
                            
                            if len(buffer) < 12 + packet_size:
                                # 数据不完整，继续读取
                                break
                            
                            # 提取 H264 数据
                            h264_data = buffer[12:12+packet_size]
                            buffer = buffer[12+packet_size:]
                            
                            # 只处理视频包（type 0）
                            if packet_type == 0 and h264_data:
                                try:
                                    await websocket.send_bytes(h264_data)
                                    frame_count += 1
                                    if frame_count <= 10 or frame_count % 100 == 0:
                                        logger.info(f"设备 {device_id} 已发送 {frame_count} 帧 H264 数据（大小: {len(h264_data)} 字节，包类型: {packet_type}）")
                                except Exception as send_err:
                                    error_msg = str(send_err)
                                    if "websocket.close" in error_msg.lower() or "closed" in error_msg.lower():
                                        logger.info(f"设备 {device_id} WebSocket连接已关闭")
                                    else:
                                        logger.error(f"发送 H264 数据失败: {send_err}")
                                    break
                            elif packet_type != 0:
                                # 忽略非视频包（控制消息等）
                                if frame_count == 0:
                                    logger.debug(f"设备 {device_id}: 收到非视频包（类型: {packet_type}），忽略")
                    except socket.timeout:
                        # 超时是正常的，继续（但记录一下，避免长时间无数据）
                        if frame_count == 0:
                            logger.warning(f"设备 {device_id}: socket 读取超时，尚未收到任何数据")
                        continue
                    except Exception as e:
                        logger.error(f"读取 scrcpy 数据失败: {str(e)}", exc_info=True)
                        break
                        
                except asyncio.CancelledError:
                    logger.info(f"设备 {device_id} H264 任务被取消")
                    break
                except Exception as e:
                    logger.error(f"H264流异常: {str(e)}")
                    await asyncio.sleep(0.1)
            
            logger.info(f"设备 {device_id} H264 视频流任务结束（共发送 {frame_count} 帧，scrcpy server 模式）")
            
        except Exception as e:
            logger.error(f"设备 {device_id} scrcpy server 模式失败: {str(e)}", exc_info=True)
            await self._stream_h264_fallback(device_id, websocket)
        finally:
            # 清理
            if device_id in self.scrcpy_sockets:
                try:
                    self.scrcpy_sockets[device_id].close()
                    logger.info(f"设备 {device_id}: 已关闭 scrcpy socket")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 关闭 socket 失败: {str(e)}")
                del self.scrcpy_sockets[device_id]
            
            if device_id in self.scrcpy_forward_ports:
                port = self.scrcpy_forward_ports[device_id]
                try:
                    await run_adb_command(f"-s {device_id} forward --remove tcp:{port}")
                    logger.info(f"设备 {device_id}: 已移除端口转发 tcp:{port}")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 移除端口转发失败: {str(e)}")
                del self.scrcpy_forward_ports[device_id]
            
            # 清理 server 进程
            if server_process and server_process.returncode is None:
                try:
                    server_process.kill()
                    await server_process.wait()
                    logger.info(f"设备 {device_id}: 已终止 scrcpy server 进程")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 终止 server 进程失败: {str(e)}")
    
    async def _stream_h264_fallback(self, device_id: str, websocket: WebSocket):
        """H264 流回退方案：使用截图模式"""
        adb_path = get_adb_path()
        frame_count = 0
        
        logger.info(f"设备 {device_id} 使用截图模式作为 H264 流回退")
        
        if device_id not in self.streaming_flags or not self.streaming_flags[device_id]:
            await asyncio.sleep(0.5)
        
        # 发送第一帧
        try:
            cmd_parts_first = [adb_path, "-s", device_id, "exec-out", "screencap", "-p"]
            process_first = await asyncio.create_subprocess_exec(
                *cmd_parts_first,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=os.environ.copy()
            )
            stdout_first, _ = await asyncio.wait_for(process_first.communicate(), timeout=5.0)
            if process_first.returncode == 0 and stdout_first and len(stdout_first) > 0:
                await websocket.send_bytes(stdout_first)
                frame_count += 1
                logger.info(f"设备 {device_id} 已发送第一帧（PNG，大小: {len(stdout_first)} 字节）")
        except Exception as e:
            logger.warning(f"设备 {device_id} 发送第一帧失败: {str(e)}")
        
        loop_iteration = 0
        logger.info(f"设备 {device_id} 开始截图循环，streaming_flags={self.streaming_flags.get(device_id, False)}")
        
        while self.streaming_flags.get(device_id, False):
            loop_iteration += 1
            try:
                # 检查连接状态
                if device_id not in self.websocket_connections:
                    logger.warning(f"设备 {device_id} WebSocket连接已断开（不在连接列表中），循环迭代: {loop_iteration}")
                    break
                
                if not self.streaming_flags.get(device_id, False):
                    logger.info(f"设备 {device_id} streaming_flags 已设置为 False，停止流，循环迭代: {loop_iteration}")
                    break
                
                if loop_iteration <= 3 or loop_iteration % 20 == 0:
                    logger.debug(f"设备 {device_id} 截图循环迭代 {loop_iteration}，streaming_flags={self.streaming_flags.get(device_id, False)}")
                
                cmd_parts = [adb_path, "-s", device_id, "exec-out", "screencap", "-p"]
                process = await asyncio.create_subprocess_exec(
                    *cmd_parts,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=os.environ.copy()
                )
                
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5.0)
                    if process.returncode == 0 and stdout and len(stdout) > 0:
                        try:
                            await websocket.send_bytes(stdout)
                            frame_count += 1
                            if frame_count <= 10 or frame_count % 30 == 0:
                                logger.info(f"设备 {device_id} 已发送 {frame_count} 帧（PNG，大小: {len(stdout)} 字节，循环迭代: {loop_iteration}）")
                        except Exception as send_err:
                            error_msg = str(send_err)
                            if "websocket.close" in error_msg.lower() or "closed" in error_msg.lower():
                                logger.info(f"设备 {device_id} WebSocket连接已关闭，停止发送")
                            else:
                                logger.error(f"发送数据失败: {send_err}")
                            break
                    else:
                        if stderr:
                            error_msg = stderr.decode('utf-8', errors='ignore')[:100]
                            logger.warning(f"截图失败: {error_msg}")
                        await asyncio.sleep(0.1)
                except asyncio.TimeoutError:
                    if process.returncode is None:
                        process.kill()
                    logger.warning(f"设备 {device_id} 截图超时，跳过此帧（循环迭代: {loop_iteration}）")
                    await asyncio.sleep(0.1)
                except Exception as e:
                    if process.returncode is None:
                        process.kill()
                    logger.warning(f"截图异常: {str(e)}（循环迭代: {loop_iteration}）")
                    await asyncio.sleep(0.1)
                
                # 控制帧率：减少延迟，提高响应速度
                await asyncio.sleep(0.1)  # 从 0.2 秒减少到 0.1 秒，提高帧率
                
            except asyncio.CancelledError:
                logger.info(f"设备 {device_id} H264 任务被取消")
                break
            except Exception as e:
                logger.error(f"H264流异常: {str(e)}")
                await asyncio.sleep(0.1)
        
        logger.info(f"设备 {device_id} H264 视频流任务结束（共发送 {frame_count} 帧，截图模式）")

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
