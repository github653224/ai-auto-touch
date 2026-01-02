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
        # 截图流与 H264 流分别使用独立的标志，避免互相影响
        self.streaming_flags: Dict[str, bool] = {}          # 截图流
        self.h264_streaming_flags: Dict[str, bool] = {}     # H264 流
        self.scrcpy_processes: Dict[str, subprocess.Popen] = {}
        self.h264_processes: Dict[str, asyncio.subprocess.Process] = {}
        self.h264_configs: Dict[str, dict] = {}  # H264流配置（max_size, bit_rate）
        self.scrcpy_server_path = self._find_scrcpy_server()
        self.scrcpy_forward_ports: Dict[str, int] = {}  # device_id -> port
        self.scrcpy_sockets: Dict[str, socket.socket] = {}  # device_id -> socket
        # 添加帧缓存：缓存最近的 SPS/PPS/IDR 帧，用于新连接时立即发送
        self.h264_frame_cache: Dict[str, dict] = {}  # device_id -> {'sps': bytes, 'pps': bytes, 'idr': bytes}
    
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
            
            logger.info(f"设备 {device_id} 屏幕流已启动（截图模式）")
            
        except Exception as e:
            logger.error(f"启动屏幕流失败: {str(e)}", exc_info=True)
            await websocket.send_json({
                "type": "error",
                "message": f"启动屏幕流失败: {str(e)}"
            })
    
    async def stream_scrcpy_video(self, device_id: str, websocket: WebSocket):
        """使用优化的截图模式传输屏幕流（JPEG格式，最低质量最快速度）"""
        adb_path = get_adb_path()
        
        try:
            logger.info(f"设备 {device_id} 开始极速截图模式流传输（JPEG 低质量 + 低分辨率）")
            frame_count = 0
            
            # 发送初始化消息
            try:
                await websocket.send_json({
                    "type": "connected",
                    "message": "截图模式已连接（极速模式）"
                })
            except Exception as e:
                logger.warning(f"设备 {device_id} 发送连接消息失败: {e}")

            while self.streaming_flags.get(device_id, False):
                try:
                    # 检查WebSocket连接状态
                    if device_id not in self.websocket_connections:
                        logger.warning(f"设备 {device_id} WebSocket连接已断开，停止视频流")
                        break
                    
                    # 极速模式：
                    # 使用高清截图（原始分辨率，高质量 JPEG）
                    # JPEG 质量 95（高质量）
                    # 保持原始分辨率，确保清晰度
                    cmd = (
                        f"{adb_path} -s {device_id} exec-out screencap -p | "
                        f"ffmpeg -f image2pipe -i - "
                        f"-f image2pipe -vcodec mjpeg -q:v 2 -"
                    )
                    
                    process = await asyncio.create_subprocess_shell(
                        cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.DEVNULL,
                        env=os.environ.copy()
                    )
                    
                    try:
                        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=2.0)
                        if process.returncode == 0 and stdout and len(stdout) > 100:
                            # 直接发送二进制 JPEG 数据
                            if device_id not in self.websocket_connections:
                                logger.info(f"设备 {device_id} 连接已断开，停止发送")
                                break
                            try:
                                await websocket.send_bytes(stdout)
                                frame_count += 1
                                if frame_count == 1:
                                    logger.info(f"设备 {device_id} ✅ 已发送第1帧 JPEG（大小: {len(stdout)} 字节，极速模式）")
                                elif frame_count % 50 == 0:
                                    logger.info(f"设备 {device_id} 已发送 {frame_count} 帧（最新帧: {len(stdout)} 字节）")
                            except Exception as send_error:
                                error_msg = str(send_error)
                                if "websocket.close" in error_msg or "response already completed" in error_msg:
                                    logger.info(f"设备 {device_id} WebSocket连接已关闭")
                                else:
                                    logger.error(f"发送视频数据失败: {error_msg}")
                                break
                        else:
                            if frame_count <= 3:
                                logger.warning(f"设备 {device_id} 截图失败: returncode={process.returncode}, 数据大小={len(stdout) if stdout else 0}")
                            await asyncio.sleep(0.03)
                    except asyncio.TimeoutError:
                        if process.returncode is None:
                            process.kill()
                        if frame_count <= 3:
                            logger.warning(f"设备 {device_id} 截图超时")
                        await asyncio.sleep(0.03)
                    except Exception as e:
                        if process.returncode is None:
                            process.kill()
                        if frame_count <= 3:
                            logger.warning(f"设备 {device_id} 截图异常: {str(e)}")
                        await asyncio.sleep(0.03)
                    
                    # 极速模式：目标 30fps（每帧 33ms）
                    # 实际帧率会受截图速度限制，通常在 20-30fps
                    await asyncio.sleep(0.033)
                    
                except asyncio.CancelledError:
                    logger.info(f"设备 {device_id} 视频流任务已取消")
                    break
                except Exception as e:
                    logger.error(f"视频流循环异常: {str(e)}")
                    await asyncio.sleep(0.05)
            
            logger.info(f"设备 {device_id} 视频流任务结束（共 {frame_count} 帧）")
            
        except Exception as e:
            logger.error(f"视频流异常: {str(e)}", exc_info=True)
        finally:
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

    async def start_h264_stream(self, device_id: str, websocket: WebSocket, max_size: int = 1080, bit_rate: int = 4000000):
        """启动H264实时视频流
        
        Args:
            device_id: 设备ID
            websocket: WebSocket连接
            max_size: 最大分辨率（像素），默认1080
            bit_rate: 比特率（bps），默认4000000 (4Mbps)
        """
        try:
            # 立即发送连接确认消息，避免前端超时
            try:
                await websocket.send_json({
                    "type": "connected",
                    "message": "连接已建立，正在初始化视频流..."
                })
            except Exception as e:
                logger.warning(f"发送连接确认消息失败: {str(e)}")
            
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
            self.h264_streaming_flags[device_id] = True
            # 注意：H264 模式不应该设置 streaming_flags，避免触发截图模式
            
            logger.info(f"设备 {device_id}: WebSocket连接已注册到 websocket_connections")
            logger.info(f"设备 {device_id}: 当前 websocket_connections 中的设备: {list(self.websocket_connections.keys())}")

            # 存储配置参数（如果不存在则使用默认值）
            if device_id not in self.h264_configs:
                self.h264_configs[device_id] = {
                    'max_size': max_size,
                    'bit_rate': bit_rate
                }
            else:
                # 更新配置
                self.h264_configs[device_id]['max_size'] = max_size
                self.h264_configs[device_id]['bit_rate'] = bit_rate
            
            # 优先使用 python-scrcpy-client 获取 H264 原始流
            task = asyncio.create_task(self._stream_h264_scrcpy_client(device_id, websocket))
            self.h264_streams[device_id] = task
            logger.info(f"设备 {device_id} H264 视频流已启动（python-scrcpy-client 模式），配置: max_size={max_size}, bit_rate={bit_rate}")
            
            # 等待一小段时间，确保任务开始运行和连接注册完成
            await asyncio.sleep(0.2)
        except Exception as e:
            logger.error(f"启动H264视频流失败: {str(e)}", exc_info=True)
            # 只清理 H264 相关的标志，不影响截图模式
            if device_id in self.h264_streaming_flags:
                self.h264_streaming_flags[device_id] = False
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except:
                pass

    async def stop_h264_stream(self, device_id: str):
        """停止H264视频流"""
        try:
            # 设置停止标志（只设置 H264 标志，不影响截图模式）
            self.h264_streaming_flags[device_id] = False

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

            # 关闭 socket 连接
            if device_id in self.scrcpy_sockets:
                try:
                    self.scrcpy_sockets[device_id].close()
                except Exception:
                    pass
                del self.scrcpy_sockets[device_id]

            # 移除端口转发
            if device_id in self.scrcpy_forward_ports:
                port = self.scrcpy_forward_ports[device_id]
                try:
                    await run_adb_command(f"-s {device_id} forward --remove tcp:{port}")
                except Exception:
                    pass
                del self.scrcpy_forward_ports[device_id]

            # 移除 WebSocket 连接（仅当没有截图流在运行且是 H264 流时）
            # 注意：截图模式和 H264 模式使用不同的 WebSocket 端点，但共享 websocket_connections
            # 如果截图流还在运行，不要删除 websocket_connections
            if device_id in self.websocket_connections and device_id not in self.screen_streams:
                del self.websocket_connections[device_id]

            logger.info(f"设备 {device_id} H264 视频流已停止")
        except Exception as e:
            logger.error(f"停止H264视频流失败: {str(e)}")

    async def _stop_scrcpy_client(self, device_id: str):
        """停止并清理 python-scrcpy-client 客户端（已废弃，保留以兼容旧代码）"""
        # 此方法已不再使用，但保留以避免其他代码调用时出错
        pass

    async def _stream_h264_scrcpy_client(self, device_id: str, websocket: WebSocket):
        """
        使用 adb screenrecord + FFmpeg 重新编码，确保 IDR 帧
        FFmpeg 会强制每秒插入一个 IDR 帧，并确保每个连接都从 IDR 帧开始
        """
        adb_path = get_adb_path()
        
        try:
            # 获取配置参数
            config = self.h264_configs.get(device_id, {})
            stream_max_size = config.get('max_size', 1080)
            stream_bit_rate = config.get('bit_rate', 4000000)
            
            logger.info(f"设备 {device_id}: 使用 screenrecord + FFmpeg 模式（最稳定方案）")
            logger.info(f"设备 {device_id}: 配置 - max_size={stream_max_size}, bit_rate={stream_bit_rate}")
            
            # 发送连接确认
            try:
                await websocket.send_json({
                    "type": "connected",
                    "message": "H264 流已连接（FFmpeg 模式）"
                })
            except Exception as e:
                logger.warning(f"设备 {device_id}: 发送连接确认失败: {e}")
                return
            
            # 启动 adb screenrecord
            adb_cmd = [
                adb_path, "-s", device_id,
                "exec-out",
                "screenrecord",
                "--output-format=h264",
                "--bit-rate", str(stream_bit_rate),
                "--size", f"{stream_max_size}x{int(stream_max_size * 2340 / 1080)}",
                "--time-limit", "180",
                "-"
            ]
            
            # FFmpeg 命令：重新编码，强制每秒一个 IDR 帧
            ffmpeg_cmd = [
                "ffmpeg",
                "-i", "pipe:0",  # 从 stdin 读取（screenrecord 输出）
                "-c:v", "libx264",  # H264 编码
                "-preset", "ultrafast",  # 最快速度
                "-tune", "zerolatency",  # 零延迟
                "-g", "30",  # GOP 大小 30 帧（1秒）
                "-keyint_min", "30",  # 最小关键帧间隔
                "-sc_threshold", "0",  # 禁用场景切换检测
                "-forced-idr", "1",  # 强制 IDR 帧
                "-x264-params", "bframes=0:ref=1",  # 无 B 帧
                "-b:v", str(stream_bit_rate),
                "-maxrate", str(stream_bit_rate),
                "-bufsize", str(stream_bit_rate * 2),
                "-f", "h264",  # 输出 H264
                "-flags", "+global_header",  # 全局头部
                "-bsf:v", "h264_mp4toannexb",  # Annex B 格式
                "-loglevel", "error",  # 只显示错误
                "pipe:1"  # 输出到 stdout
            ]
            
            logger.info(f"设备 {device_id}: 启动 screenrecord + FFmpeg 管道...")
            
            while self.h264_streaming_flags.get(device_id, False):
                try:
                    # 启动 adb screenrecord
                    adb_process = await asyncio.create_subprocess_exec(
                        *adb_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    
                    # 启动 FFmpeg，输入来自 screenrecord
                    ffmpeg_process = await asyncio.create_subprocess_exec(
                        *ffmpeg_cmd,
                        stdin=adb_process.stdout,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    
                    logger.info(f"设备 {device_id}: FFmpeg 管道已启动，开始传输数据")
                    
                    frame_count = 0
                    # 读取并发送数据
                    while self.h264_streaming_flags.get(device_id, False):
                        try:
                            data = await asyncio.wait_for(ffmpeg_process.stdout.read(65536), timeout=5.0)
                            if not data:
                                logger.info(f"设备 {device_id}: FFmpeg 输出结束，准备重启")
                                break
                            
                            # 发送数据
                            try:
                                await websocket.send_bytes(data)
                                frame_count += 1
                                
                                if frame_count == 1:
                                    logger.info(f"设备 {device_id}: ✅ 已发送第一个数据块（{len(data)} 字节）")
                                elif frame_count % 100 == 0:
                                    logger.info(f"设备 {device_id}: 已发送 {frame_count} 个数据块")
                            except Exception as send_err:
                                error_msg = str(send_err)
                                if "closed" in error_msg.lower() or "disconnect" in error_msg.lower():
                                    logger.info(f"设备 {device_id}: WebSocket 连接已关闭")
                                    return
                                else:
                                    logger.error(f"设备 {device_id}: 发送数据失败: {send_err}")
                                    return
                        except asyncio.TimeoutError:
                            # 检查进程是否还在运行
                            if ffmpeg_process.returncode is not None:
                                logger.warning(f"设备 {device_id}: FFmpeg 进程已退出")
                                break
                            continue
                    
                    # 清理进程
                    if ffmpeg_process.returncode is None:
                        ffmpeg_process.kill()
                        await ffmpeg_process.wait()
                    if adb_process.returncode is None:
                        adb_process.kill()
                        await adb_process.wait()
                    
                    # 如果还需要继续流，等待一小段时间后重启
                    if self.h264_streaming_flags.get(device_id, False):
                        logger.info(f"设备 {device_id}: 等待 1 秒后重启管道")
                        await asyncio.sleep(1)
                    else:
                        break
                        
                except Exception as e:
                    logger.error(f"设备 {device_id}: FFmpeg 管道异常: {str(e)}")
                    if self.h264_streaming_flags.get(device_id, False):
                        await asyncio.sleep(2)
                    else:
                        break
            
            logger.info(f"设备 {device_id}: FFmpeg 流结束")
            
        except Exception as e:
            logger.error(f"设备 {device_id}: FFmpeg 模式失败: {str(e)}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"视频流错误: {str(e)}"
                })
            except:
                pass
        
        try:
            # 0. 先清理可能存在的旧 server 进程和端口转发
            # 检查是否有旧的端口转发
            if device_id in self.scrcpy_forward_ports:
                old_port = self.scrcpy_forward_ports[device_id]
                logger.info(f"设备 {device_id}: 清理旧的端口转发 tcp:{old_port}")
                try:
                    await run_adb_command(f"-s {device_id} forward --remove tcp:{old_port}")
                except Exception:
                    pass
                del self.scrcpy_forward_ports[device_id]
            
            # 检查是否有旧的 socket
            if device_id in self.scrcpy_sockets:
                try:
                    self.scrcpy_sockets[device_id].close()
                except Exception:
                    pass
                del self.scrcpy_sockets[device_id]
            
            # 尝试清理可能存在的 scrcpy server 进程（通过 adb shell killall）
            try:
                await run_adb_command(f"-s {device_id} shell killall app_process")
                await asyncio.sleep(0.5)  # 等待进程终止
                logger.info(f"设备 {device_id}: 已清理旧的 app_process 进程")
            except Exception:
                pass  # 如果没有进程，忽略错误
            
            # 1. 推送 scrcpy-server 到设备
            logger.info(f"设备 {device_id}: 推送 scrcpy-server 到设备...")
            
            # 在推送前检查连接是否还活着
            try:
                await websocket.send_json({"type": "status", "message": "正在推送 scrcpy-server..."})
            except Exception as e:
                error_msg = str(e)
                if "closed" in error_msg.lower() or "disconnect" in error_msg.lower():
                    logger.warning(f"设备 {device_id}: WebSocket连接已关闭，无法推送 scrcpy-server")
                    return
                else:
                    logger.debug(f"设备 {device_id}: 发送状态消息失败（非致命）: {e}")
            
            push_result = await run_adb_command(f"-s {device_id} push {self.scrcpy_server_path} /data/local/tmp/scrcpy-server.jar")
            if push_result.returncode != 0:
                error_msg = f"推送 scrcpy-server 失败: {push_result.stderr.decode('utf-8', errors='ignore')[:200]}"
                logger.error(f"设备 {device_id}: {error_msg}")
                try:
                    await websocket.send_json({"type": "error", "message": error_msg})
                except:
                    pass
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            # 2. 设置端口转发（使用动态端口）
            import random
            local_port = random.randint(10000, 65535)
            
            # 在设置端口转发前检查连接
            try:
                await websocket.send_json({"type": "status", "message": "正在设置端口转发..."})
            except Exception as e:
                error_msg = str(e)
                if "closed" in error_msg.lower() or "disconnect" in error_msg.lower():
                    logger.warning(f"设备 {device_id}: WebSocket连接已关闭，无法设置端口转发")
                    return
                else:
                    logger.debug(f"设备 {device_id}: 发送状态消息失败（非致命）: {e}")
            
            forward_result = await run_adb_command(f"-s {device_id} forward tcp:{local_port} localabstract:scrcpy")
            if forward_result.returncode != 0:
                error_msg = f"端口转发失败: {forward_result.stderr.decode('utf-8', errors='ignore')[:200]}"
                logger.error(f"设备 {device_id}: {error_msg}")
                try:
                    await websocket.send_json({"type": "error", "message": error_msg})
                except:
                    pass
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            self.scrcpy_forward_ports[device_id] = local_port
            logger.info(f"设备 {device_id}: 端口转发成功，本地端口: {local_port}")
            
            # 3. 启动 scrcpy server（后台运行）
            scrcpy_version = "3.3.3"  # 从路径推断的版本
            
            # 获取配置参数（如果存在）
            config = self.h264_configs.get(device_id, {})
            stream_max_size = config.get('max_size', 1080)  # 默认1080p
            stream_bit_rate = config.get('bit_rate', 4000000)  # 默认4Mbps
            
            # 注意：scrcpy 3.3.3 不支持 bit_rate 参数，使用 video_bit_rate 代替
            # 添加 intra_refresh_period 参数，每 1 秒发送一次 IDR 帧（30 帧）
            server_cmd = (
                f"CLASSPATH=/data/local/tmp/scrcpy-server.jar "
                f"app_process / com.genymobile.scrcpy.Server "
                f"{scrcpy_version} "
                f"log_level=info "
                f"tunnel_forward=true "
                f"control=false "
                f"video_codec=h264 "
                f"audio=false "
                f"max_size={stream_max_size} "
                f"max_fps=30 "
                f"video_bit_rate={stream_bit_rate} "
                f"intra_refresh_period=1"  # 每1秒发送一次IDR帧
            )
            
            logger.info(f"设备 {device_id}: scrcpy server 配置 - max_size={stream_max_size}, video_bit_rate={stream_bit_rate}, intra_refresh_period=1s")
            
            logger.info(f"设备 {device_id}: 启动 scrcpy server...")
            server_process = await asyncio.create_subprocess_exec(
                adb_path, "-s", device_id, "shell", server_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
                env=os.environ.copy()
            )
            
            # 等待 server 启动
            await asyncio.sleep(1.5)
            
            # 检查 server 是否还在运行
            if server_process.returncode is not None:
                stderr_output = b""
                try:
                    _, stderr_output = await server_process.communicate()
                except Exception:
                    pass
                stderr_text = stderr_output.decode("utf-8", errors="ignore")[:400] if stderr_output else "无错误输出"
                error_msg = f"scrcpy server 启动失败 (退出码: {server_process.returncode})，stderr: {stderr_text}"
                logger.error(f"设备 {device_id}: {error_msg}")
                await websocket.send_json({"type": "error", "message": error_msg})
                await self._stream_h264_fallback(device_id, websocket)
                return
            
                logger.info(f"设备 {device_id}: scrcpy server 已启动")
            
            # 在连接 socket 前检查 WebSocket 连接
            try:
                await websocket.send_json({"type": "status", "message": "正在连接 scrcpy server..."})
            except Exception as e:
                error_msg = str(e)
                if "closed" in error_msg.lower() or "disconnect" in error_msg.lower():
                    logger.warning(f"设备 {device_id}: WebSocket连接已关闭，无法连接 scrcpy server")
                    return
                else:
                    logger.debug(f"设备 {device_id}: 发送状态消息失败（非致命）: {e}")
            
            # 4. 连接到 socket 获取 H264 流
            logger.info(f"设备 {device_id}: 连接到 scrcpy server (localhost:{local_port})...")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5.0)
            
            def recv_exact(n: int, timeout: float) -> bytes:
                """阻塞读取n字节，允许分段，超时返回空（同步函数）"""
                sock.settimeout(timeout)
                chunks = []
                total = 0
                while total < n:
                    try:
                        data_chunk = sock.recv(n - total)
                    except socket.timeout:
                        return b""
                    if not data_chunk:
                        return b""
                    chunks.append(data_chunk)
                    total += len(data_chunk)
                return b"".join(chunks)
            
            try:
                sock.connect(("localhost", local_port))
                self.scrcpy_sockets[device_id] = sock
                logger.info(f"设备 {device_id}: 已连接到 scrcpy server")
                
                # scrcpy 协议：发送设备名称（64字节，null 填充）
                device_name_bytes = device_id.encode('utf-8')[:63]
                device_name_bytes = device_name_bytes.ljust(64, b'\x00')
                await asyncio.to_thread(sock.send, device_name_bytes)
                logger.info(f"设备 {device_id}: 已发送设备名称（64字节）")
                
                # scrcpy 协议：读取 server 的初始消息（设备信息）
                # scrcpy 3.3.3 的初始消息格式：
                # - 设备名称：64字节（null 填充）
                # - 宽度：2字节（大端，无符号短整型）
                # - 高度：2字节（大端，无符号短整型）
                # 共68字节
                initial_data = await asyncio.to_thread(recv_exact, 68, 2.0)
                if len(initial_data) != 68:
                    logger.error(f"设备 {device_id}: server 初始消息不完整，期望68字节，实际{len(initial_data)}字节")
                    logger.error(f"设备 {device_id}: 收到的数据（hex）: {initial_data.hex() if initial_data else '空'}")
                    sock.close()
                    await self._stream_h264_fallback(device_id, websocket)
                    return
                
                # 添加详细的调试日志
                logger.info(f"设备 {device_id}: 初始消息完整数据（hex）: {initial_data.hex()}")
                logger.info(f"设备 {device_id}: 初始消息前32字节（hex）: {initial_data[:32].hex()}")
                logger.info(f"设备 {device_id}: 初始消息后8字节（hex）: {initial_data[60:68].hex() if len(initial_data) >= 68 else '不足68字节'}")
                logger.info(f"设备 {device_id}: 位置64-66字节（hex）: {initial_data[64:66].hex() if len(initial_data) >= 66 else '不足66字节'} (宽度)")
                logger.info(f"设备 {device_id}: 位置66-68字节（hex）: {initial_data[66:68].hex() if len(initial_data) >= 68 else '不足68字节'} (高度)")
                
                device_name = initial_data[0:64].rstrip(b'\x00').decode('utf-8', errors='ignore')
                
                # 解析宽度和高度（大端字节序）
                width_bytes = initial_data[64:66]
                height_bytes = initial_data[66:68]
                width = struct.unpack(">H", width_bytes)[0]
                height = struct.unpack(">H", height_bytes)[0]
                
                logger.info(f"设备 {device_id}: 设备信息 - 设备名: {device_name}, 分辨率: {width}x{height}")
                
                # 验证分辨率合理性（正常手机分辨率范围：240-4320）
                if width < 240 or width > 4320 or height < 240 or height > 4320:
                    logger.warning(f"设备 {device_id}: 分辨率异常 {width}x{height}，可能是协议解析错误，但继续尝试透传")
                    logger.warning(f"设备 {device_id}: 宽度字节: {width_bytes.hex()} = {width}, 高度字节: {height_bytes.hex()} = {height}")
                    # 不立即退出，继续尝试透传（分辨率信息对透传不是必需的）
                    # 注意：分辨率解析错误不影响 H264 数据透传，因为 H264 流本身包含分辨率信息
                
                # 设置较短的超时用于读取视频流
                sock.settimeout(2.0)
                
            except Exception as e:
                logger.error(f"设备 {device_id}: 连接 scrcpy server 失败: {str(e)}", exc_info=True)
                if sock:
                    sock.close()
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            # 5. 纯透传模式：读取原始 H264 数据并直接发送
            logger.info(f"设备 {device_id}: 开始纯透传 H264 流...")
            logger.info(f"设备 {device_id}: 检查连接状态 - h264_streaming_flags={self.h264_streaming_flags.get(device_id, False)}, websocket_connections={device_id in self.websocket_connections}")
            logger.info(f"设备 {device_id}: 当前 websocket_connections 中的设备: {list(self.websocket_connections.keys())}")
            
            # 确保连接存在（如果不存在，尝试使用传入的 websocket 参数）
            if device_id not in self.websocket_connections:
                logger.warning(f"设备 {device_id}: WebSocket连接不在字典中，使用传入的 websocket 参数")
                # 重新注册连接
                self.websocket_connections[device_id] = websocket
                logger.info(f"设备 {device_id}: 已重新注册 WebSocket 连接")
            
            frame_count = 0
            buffer = b""
            first_chunk = True
            bad_header_count = 0
            use_raw_mode = False  # 如果协议解析失败，切换到原始模式
            
            # 立即发送一个连接确认消息，避免前端超时
            try:
                await websocket.send_json({
                    "type": "connected",
                    "message": "H264 流已连接，正在接收数据..."
                })
                logger.info(f"设备 {device_id}: ✅ 已发送连接确认消息")
            except Exception as e:
                error_msg = str(e)
                if "closed" in error_msg.lower() or "disconnect" in error_msg.lower():
                    logger.error(f"设备 {device_id}: WebSocket连接已关闭，无法发送确认消息")
                    return
                else:
                    logger.warning(f"设备 {device_id}: 发送连接确认消息失败: {e}")
            
            # 如果有缓存的 SPS/PPS/IDR 帧，立即发送给新连接的客户端
            if device_id in self.h264_frame_cache:
                cache = self.h264_frame_cache[device_id]
                try:
                    if 'sps' in cache:
                        await websocket.send_bytes(cache['sps'])
                        logger.info(f"设备 {device_id}: 📤 已发送缓存的 SPS 帧（{len(cache['sps'])} 字节）")
                    if 'pps' in cache:
                        await websocket.send_bytes(cache['pps'])
                        logger.info(f"设备 {device_id}: 📤 已发送缓存的 PPS 帧（{len(cache['pps'])} 字节）")
                    if 'idr' in cache:
                        await websocket.send_bytes(cache['idr'])
                        logger.info(f"设备 {device_id}: 📤 已发送缓存的 IDR 帧（{len(cache['idr'])} 字节）")
                    logger.info(f"设备 {device_id}: ✅ 已发送所有缓存的关键帧，客户端应该可以立即开始解码")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 发送缓存帧失败: {e}")
            else:
                logger.info(f"设备 {device_id}: ⚠️ 没有缓存的关键帧，客户端需要等待下一个 IDR 帧")
            
            while self.h264_streaming_flags.get(device_id, False):
                try:
                    # 检查连接状态（简化检查，避免频繁发送心跳消息）
                    # 只在第一次循环时检查，之后依赖数据读取的错误来判断连接状态
                    # 不频繁检查连接状态，避免影响性能
                    
                    # 从 socket 读取数据（64KB 缓冲区）
                    try:
                        data = await asyncio.to_thread(sock.recv, 65536)
                        if not data:
                            logger.warning(f"设备 {device_id}: scrcpy server 连接断开（收到空数据）")
                            break
                        
                        if first_chunk:
                            logger.info(f"设备 {device_id}: ✅ 收到第一个数据包（大小: {len(data)} 字节）")
                            logger.info(f"设备 {device_id}: 前32字节（hex）: {data[:min(32, len(data))].hex()}")
                            # 检查是否包含 H264 start code
                            if b'\x00\x00\x00\x01' in data[:200] or b'\x00\x00\x01' in data[:200]:
                                logger.info(f"设备 {device_id}: ✅ 检测到 H264 start code，数据格式正确")
                                # 如果第一个数据包就包含 start code，直接切换到提取模式
                                use_raw_mode = True
                            first_chunk = False
                        
                        # 如果协议解析失败次数过多，切换到 H264 提取模式
                        if use_raw_mode or bad_header_count >= 10:
                            if not use_raw_mode:
                                logger.warning(f"设备 {device_id}: 协议解析失败次数过多，切换到 H264 提取模式")
                                use_raw_mode = True
                                buffer = b""  # 清空缓冲区
                            
                            # H264 提取模式：从数据中提取 H264 NALU（跳过协议头部）
                            # 查找 H264 start code (0x00000001 或 0x000001) 并提取 NALU
                            temp_buffer = buffer + data if buffer else data
                            buffer = b""
                            
                            # 查找第一个 start code
                            first_start = -1
                            for i in range(len(temp_buffer)):
                                if i + 4 <= len(temp_buffer) and temp_buffer[i:i+4] == b'\x00\x00\x00\x01':
                                    first_start = i
                                    break
                                if i + 3 <= len(temp_buffer) and temp_buffer[i:i+3] == b'\x00\x00\x01':
                                    first_start = i
                                    break
                            
                            if first_start < 0:
                                # 没找到 start code，可能是数据还没到，保留到下次
                                buffer = temp_buffer
                                if len(buffer) > 1000:  # 如果缓冲区太大，可能数据格式不对
                                    logger.warning(f"设备 {device_id}: 缓冲区过大且未找到 start code，清空缓冲区")
                                    buffer = b""
                                continue
                            
                            # 从第一个 start code 开始提取
                            i = first_start
                            nalu_count = 0
                            while i < len(temp_buffer):
                                # 查找当前 start code
                                if i + 4 <= len(temp_buffer) and temp_buffer[i:i+4] == b'\x00\x00\x00\x01':
                                    start_pos = i
                                    start_code_len = 4
                                elif i + 3 <= len(temp_buffer) and temp_buffer[i:i+3] == b'\x00\x00\x01':
                                    start_pos = i
                                    start_code_len = 3
                                else:
                                    # 没找到 start code，保留剩余数据
                                    buffer = temp_buffer[i:]
                                    break
                                
                                # 查找下一个 start code
                                next_start = -1
                                search_start = start_pos + start_code_len
                                for j in range(search_start, len(temp_buffer)):
                                    if j + 4 <= len(temp_buffer) and temp_buffer[j:j+4] == b'\x00\x00\x00\x01':
                                        next_start = j
                                        break
                                    if j + 3 <= len(temp_buffer) and temp_buffer[j:j+3] == b'\x00\x00\x01':
                                        next_start = j
                                        break
                                
                                if next_start > 0:
                                    # 提取完整的 NALU（包含 start code）
                                    nalu_data = temp_buffer[start_pos:next_start]
                                    i = next_start
                                else:
                                    # 最后一个 NALU，可能不完整，保留到下次
                                    if start_pos < len(temp_buffer):
                                        buffer = temp_buffer[start_pos:]
                                    break
                                
                                # 发送 H264 NALU 数据（包含 start code）
                                if len(nalu_data) > start_code_len:  # 确保有实际数据（不只是 start code）
                                    try:
                                        # 检查 NALU 类型
                                        nalu_type = (nalu_data[start_code_len] & 0x1f) if len(nalu_data) > start_code_len else 0
                                        nalu_type_name = {5: "IDR", 7: "SPS", 8: "PPS", 1: "P帧"}.get(nalu_type, f"类型{nalu_type}")
                                        
                                        # 缓存 SPS/PPS/IDR 帧，用于新连接时立即发送
                                        if nalu_type == 7:  # SPS
                                            if device_id not in self.h264_frame_cache:
                                                self.h264_frame_cache[device_id] = {}
                                            self.h264_frame_cache[device_id]['sps'] = nalu_data
                                            logger.info(f"设备 {device_id}: 🔖 已缓存 SPS 帧（{len(nalu_data)} 字节）")
                                        elif nalu_type == 8:  # PPS
                                            if device_id not in self.h264_frame_cache:
                                                self.h264_frame_cache[device_id] = {}
                                            self.h264_frame_cache[device_id]['pps'] = nalu_data
                                            logger.info(f"设备 {device_id}: 🔖 已缓存 PPS 帧（{len(nalu_data)} 字节）")
                                        elif nalu_type == 5:  # IDR
                                            if device_id not in self.h264_frame_cache:
                                                self.h264_frame_cache[device_id] = {}
                                            self.h264_frame_cache[device_id]['idr'] = nalu_data
                                            logger.info(f"设备 {device_id}: 🔖 已缓存 IDR 帧（{len(nalu_data)} 字节）")
                                        
                                        await websocket.send_bytes(nalu_data)
                                        frame_count += 1
                                        nalu_count += 1
                                        
                                        # 对于前 20 个 NALU 或 SPS/PPS/IDR，都记录详细信息
                                        if frame_count <= 20 or nalu_type in (5, 7, 8):
                                            logger.info(f"设备 {device_id}: 已透传第 {frame_count} 个 H264 NALU（大小: {len(nalu_data)} 字节，类型: {nalu_type_name}/{nalu_type}）")
                                        elif frame_count % 100 == 0:
                                            logger.info(f"设备 {device_id}: 已透传第 {frame_count} 个 H264 NALU（大小: {len(nalu_data)} 字节，类型: {nalu_type_name}）")
                                    except Exception as send_err:
                                        error_msg = str(send_err)
                                        if "websocket.close" in error_msg.lower() or "closed" in error_msg.lower():
                                            logger.info(f"设备 {device_id}: WebSocket连接已关闭")
                                        else:
                                            logger.error(f"设备 {device_id}: 发送 H264 NALU 失败: {send_err}")
                                        break
                            
                            if nalu_count > 0 and frame_count <= 5:
                                logger.info(f"设备 {device_id}: 本次提取了 {nalu_count} 个 NALU，累计 {frame_count} 个")
                            continue
                        
                        buffer += data
                        
                        # scrcpy 协议：每个包前面有 12 字节头部
                        # 头部格式：type(1) + flags(1) + size(4字节大端) + timestamp(6字节大端)
                        while len(buffer) >= 12:
                            # 解析头部
                            packet_type = buffer[0]
                            flags = buffer[1]
                            packet_size = struct.unpack(">I", buffer[2:6])[0]
                            
                            # 验证包大小合理性（防止解析错误）
                            if packet_size > 10 * 1024 * 1024:  # 超过 10MB
                                bad_header_count += 1
                                if bad_header_count <= 3:
                                    logger.warning(f"设备 {device_id}: 包大小异常: {packet_size} 字节，type={packet_type}, flags={flags} (第 {bad_header_count} 次)")
                                    logger.warning(f"设备 {device_id}: 头部12字节（hex）: {buffer[:12].hex()}")
                                
                                # 尝试查找 H264 start code (0x00000001 或 0x000001) 来重新对齐
                                start_code_pos = -1
                                for i in range(min(200, len(buffer))):
                                    if i + 4 <= len(buffer):
                                        if buffer[i:i+4] == b'\x00\x00\x00\x01':
                                            start_code_pos = i
                                            break
                                    if start_code_pos < 0 and i + 3 <= len(buffer):
                                        if buffer[i:i+3] == b'\x00\x00\x01':
                                            start_code_pos = i
                                            break
                                
                                if start_code_pos > 0:
                                    logger.info(f"设备 {device_id}: 找到 H264 start code 在位置 {start_code_pos}，重新对齐")
                                    buffer = buffer[start_code_pos:]
                                else:
                                    buffer = buffer[1:]  # 丢弃一个字节重新对齐
                                continue
                            
                            if len(buffer) < 12 + packet_size:
                                # 数据不完整，继续读取
                                break
                            
                            # 提取 H264 数据（跳过12字节头部）
                            h264_data = buffer[12:12+packet_size]
                            buffer = buffer[12+packet_size:]
                            
                            # 只处理视频包（type 0），直接透传
                            if packet_type == 0 and h264_data:
                                try:
                                    await websocket.send_bytes(h264_data)
                                    frame_count += 1
                                    bad_header_count = 0  # 重置错误计数
                                    if frame_count <= 5 or frame_count % 100 == 0:
                                        logger.info(f"设备 {device_id}: 已透传第 {frame_count} 帧 H264 数据（大小: {len(h264_data)} 字节）")
                                except Exception as send_err:
                                    error_msg = str(send_err)
                                    if "websocket.close" in error_msg.lower() or "closed" in error_msg.lower():
                                        logger.info(f"设备 {device_id}: WebSocket连接已关闭")
                                    else:
                                        logger.error(f"设备 {device_id}: 发送 H264 数据失败: {send_err}")
                                    break
                            elif packet_type != 0:
                                # 忽略非视频包（控制消息等），但也要移除头部
                                buffer = buffer[12+packet_size:] if len(buffer) >= 12+packet_size else buffer[12:]
                                
                    except socket.timeout:
                        # 超时是正常的，继续循环
                        continue
                    except Exception as e:
                        logger.error(f"设备 {device_id}: 读取 scrcpy 数据失败: {str(e)}", exc_info=True)
                        break
                        
                except asyncio.CancelledError:
                    logger.info(f"设备 {device_id}: H264 任务被取消")
                    break
                except Exception as e:
                    logger.error(f"设备 {device_id}: H264流异常: {str(e)}")
                    await asyncio.sleep(0.1)
            
            logger.info(f"设备 {device_id}: H264 纯透传流结束（共发送 {frame_count} 帧）")
            
        except Exception as e:
            logger.error(f"设备 {device_id}: H264 纯透传模式失败: {str(e)}", exc_info=True)
            await self._stream_h264_fallback(device_id, websocket)
        finally:
            # 清理资源
            if sock and device_id in self.scrcpy_sockets:
                try:
                    sock.close()
                    logger.info(f"设备 {device_id}: 已关闭 scrcpy socket")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 关闭 socket 失败: {str(e)}")
                del self.scrcpy_sockets[device_id]
            
            if local_port and device_id in self.scrcpy_forward_ports:
                try:
                    await run_adb_command(f"-s {device_id} forward --remove tcp:{local_port}")
                    logger.info(f"设备 {device_id}: 已移除端口转发 tcp:{local_port}")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 移除端口转发失败: {str(e)}")
                del self.scrcpy_forward_ports[device_id]
            
            if server_process and server_process.returncode is None:
                try:
                    server_process.kill()
                    await server_process.wait()
                    logger.info(f"设备 {device_id}: 已终止 scrcpy server 进程")
                except Exception as e:
                    logger.warning(f"设备 {device_id}: 终止 server 进程失败: {str(e)}")

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
            # scrcpy 3.3.3 使用 key=value 格式的参数
            # 参考：https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/Server.java
            # 精简参数，避免服务器版本不识别的选项导致退出
            # 只保留通用且在 3.3.3 可用的关键参数
            server_cmd = (
                f"CLASSPATH=/data/local/tmp/scrcpy-server.jar "
                f"app_process / com.genymobile.scrcpy.Server "
                f"{scrcpy_version} "
                f"log_level=info "
                # 使用 adb forward 时应设置 tunnel_forward=true，避免本地套接字连接被拒绝
                f"tunnel_forward=true "
                # 只拉视频流，关闭控制通道，避免双路 socket 阻塞
                f"control=false "
                f"video_codec=h264 "
                f"audio=false "
                f"stay_awake=true "
                f"power_off_on_close=false"
            )
            
            logger.info(f"设备 {device_id}: 启动 scrcpy server...")
            logger.debug(f"设备 {device_id}: server 命令: {server_cmd}")
            
            # 启动 server（在后台运行）。为了排查立即退出的问题，保留 stderr。
            server_process = await asyncio.create_subprocess_exec(
                adb_path, "-s", device_id, "shell", server_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
                env=os.environ.copy()
            )
            
            # 等待 server 启动（给足够时间）
            await asyncio.sleep(1.5)
            
            # 检查 server 是否还在运行
            if server_process.returncode is not None:
                # 读取 stderr 便于定位失败原因
                stderr_output = b""
                try:
                    _, stderr_output = await server_process.communicate()
                except Exception:
                    pass
                stderr_text = stderr_output.decode("utf-8", errors="ignore")[:400] if stderr_output else "无错误输出"
                error_msg = f"scrcpy server 启动失败 (退出码: {server_process.returncode})，stderr: {stderr_text}"
                logger.error(f"设备 {device_id}: {error_msg}")
                # 发送错误通知
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": error_msg
                    })
                except Exception:
                    pass
                await self._stream_h264_fallback(device_id, websocket)
                return
            
            logger.info(f"设备 {device_id}: scrcpy server 已启动（PID: {server_process.pid if hasattr(server_process, 'pid') else 'N/A'}）")
            
            # 4. 连接到 socket 获取 H264 流
            logger.info(f"设备 {device_id}: 连接到 scrcpy server (localhost:{local_port})...")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10.0)  # 增加超时时间

            def recv_exact(n: int, timeout: float) -> bytes:
                """阻塞读取n字节，允许分段，超时返回空"""
                sock.settimeout(timeout)
                chunks = []
                total = 0
                while total < n:
                    try:
                        data_chunk = sock.recv(n - total)
                    except socket.timeout:
                        return b""
                    if not data_chunk:
                        return b""
                    chunks.append(data_chunk)
                    total += len(data_chunk)
                return b"".join(chunks)


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
                # 第一个消息是设备信息，格式：设备名称(64字节) + 宽度(2字节) + 高度(2字节) 共68字节
                initial_data = await asyncio.to_thread(recv_exact, 68, 2.0)
                if len(initial_data) != 68:
                    logger.error(f"设备 {device_id}: server 初始消息不完整，期望68字节，实际{len(initial_data)}字节，回退截图模式")
                    sock.close()
                    await self._stream_h264_fallback(device_id, websocket)
                    return
                device_name = initial_data[0:64].rstrip(b'\x00').decode('utf-8', errors='ignore')
                width = struct.unpack(">H", initial_data[64:66])[0]
                height = struct.unpack(">H", initial_data[66:68])[0]
                logger.info(f"设备 {device_id}: 设备信息 - 设备名: {device_name}, 分辨率: {width}x{height}")
                
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
            bad_header_count = 0
            first_packet = True
            
            logger.info(f"设备 {device_id}: 开始读取 H264 流...")
            
            while self.h264_streaming_flags.get(device_id, False):
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
                            
                            # 检查包大小是否合理
                            if packet_size > 10 * 1024 * 1024:  # 超过 10MB
                                bad_header_count += 1
                                logger.error(f"设备 {device_id}: 包大小异常: {packet_size} 字节，可能协议解析错误（累计 {bad_header_count} 次）")
                                # 丢弃一个字节重新对齐
                                buffer = buffer[1:]
                                if bad_header_count >= 5:
                                    logger.error(f"设备 {device_id}: 连续解析错误过多，切换到 scrcpy stdout 管道模式")
                                    sock.close()
                                    await self._stream_h264_stdout(device_id, websocket)
                                    return
                                continue
                            
                            # 检查缓冲区中是否有足够的数据
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
        """H264 流回退方案：使用优化的截图模式（降低分辨率和质量）"""
        adb_path = get_adb_path()
        frame_count = 0
        
        logger.info(f"设备 {device_id} 使用优化的截图模式作为 H264 流回退")

        # 使用 H264 独立标志，避免被截图流的停止逻辑影响
        self.h264_streaming_flags[device_id] = True
        
        # 获取配置的分辨率（用于截图质量控制）
        config = self.h264_configs.get(device_id, {})
        max_size = config.get('max_size', 720)  # 截图模式默认720p
        
        # 立即发送通知消息，告诉前端已切换到截图模式
        try:
            await websocket.send_json({
                "type": "fallback",
                "message": "scrcpy server 不可用，已切换到截图模式",
                "mode": "screenshot"
            })
            logger.info(f"设备 {device_id} 已发送回退通知消息")
        except Exception as e:
            logger.warning(f"设备 {device_id} 发送回退通知失败: {str(e)}")
        
        if device_id not in self.h264_streaming_flags or not self.h264_streaming_flags[device_id]:
            await asyncio.sleep(0.5)
        
        # 尽快发送第一帧，避免前端等待超时
        try:
            cmd_parts_first = [adb_path, "-s", device_id, "exec-out", "screencap", "-p"]
            process_first = await asyncio.create_subprocess_exec(
                *cmd_parts_first,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=os.environ.copy()
            )
            stdout_first, stderr_first = await asyncio.wait_for(process_first.communicate(), timeout=5.0)
            if process_first.returncode == 0 and stdout_first and len(stdout_first) > 0:
                await websocket.send_bytes(stdout_first)
                frame_count += 1
                logger.info(f"设备 {device_id} 已发送第一帧（PNG，大小: {len(stdout_first)} 字节）")
            else:
                error_msg = stderr_first.decode('utf-8', errors='ignore')[:200] if stderr_first else "未知错误"
                logger.error(f"设备 {device_id} 截图失败: {error_msg}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"截图失败: {error_msg}"
                })
        except asyncio.TimeoutError:
            logger.error(f"设备 {device_id} 截图超时")
            await websocket.send_json({
                "type": "error",
                "message": "截图超时，请检查设备连接"
            })
        except Exception as e:
            logger.error(f"设备 {device_id} 发送第一帧失败: {str(e)}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"截图失败: {str(e)}"
                })
            except:
                pass
        
        loop_iteration = 0
        logger.info(f"设备 {device_id} 开始截图循环，streaming_flags={self.streaming_flags.get(device_id, False)}")
        
        while self.h264_streaming_flags.get(device_id, False):
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
                
                # 使用JPEG格式截图，大幅减少数据量（PNG通常2-5MB，JPEG只有100-300KB）
                # 注意：部分Android版本不支持-j参数，需要回退到PNG
                cmd_parts = [adb_path, "-s", device_id, "exec-out", "screencap", "-p"]
                # 尝试使用JPEG格式（如果设备支持）
                # cmd_parts = [adb_path, "-s", device_id, "exec-out", "screencap", "-j", "-q", "80"]
                process = await asyncio.create_subprocess_exec(
                    *cmd_parts,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=os.environ.copy()
                )
                
                try:
                    # 优化超时时间：减少到 1.5 秒，加快响应
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=1.5)
                    if process.returncode == 0 and stdout and len(stdout) > 0:
                        try:
                            # 直接发送二进制数据（PNG格式），前端会自动识别
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
                        await asyncio.sleep(0.03)  # 减少等待时间
                except asyncio.TimeoutError:
                    if process.returncode is None:
                        process.kill()
                    logger.warning(f"设备 {device_id} 截图超时，跳过此帧（循环迭代: {loop_iteration}）")
                    await asyncio.sleep(0.03)  # 减少等待时间
                except Exception as e:
                    if process.returncode is None:
                        process.kill()
                    logger.warning(f"截图异常: {str(e)}（循环迭代: {loop_iteration}）")
                    await asyncio.sleep(0.03)  # 减少等待时间
                
                # 控制帧率：减少延迟，提高响应速度
                # 进一步优化：减少到 0.02 秒，提高帧率到约 50 FPS（如果截图速度足够快）
                await asyncio.sleep(0.02)  # 从 0.05 秒减少到 0.02 秒，大幅提高帧率
                
            except asyncio.CancelledError:
                logger.info(f"设备 {device_id} H264 任务被取消")
                break
            except Exception as e:
                logger.error(f"H264流异常: {str(e)}")
                await asyncio.sleep(0.1)
        
        logger.info(f"设备 {device_id} H264 视频流任务结束（共发送 {frame_count} 帧，截图模式）")

    async def _stream_h264_stdout(self, device_id: str, websocket: WebSocket):
        """
        通过 scrcpy 可执行文件的 stdout 直接拉取 H.264，避免解析 scrcpy socket 协议
        """
        scrcpy_path = get_scrcpy_path()
        frame_count = 0

        # 确保设备已连接
        if not await self.device_manager.connect_device(device_id):
            error_msg = f"设备 {device_id} 未连接，无法启动 stdout 流"
            logger.error(error_msg)
            try:
                await websocket.send_json({"type": "error", "message": error_msg})
            except Exception:
                pass
            return

        # 启动 scrcpy 进程：只输出视频到 stdout，不显示，不控制
        # 使用较保守的参数提升兼容性
        args = [
            scrcpy_path,
            "-s", device_id,
            "--no-playback",  # 替换 --no-display（已被移除）
            "--no-control",
            "--no-audio",
            "--max-size", "1080",
            "--video-bit-rate", "8000000",
            "--record-format", "mkv",  # 3.3.3 需要指定格式
            "--record", "-",  # 输出到 stdout
        ]

        logger.info(f"设备 {device_id}: 启动 scrcpy stdout 流: {' '.join(args)}")

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=os.environ.copy(),
            )
        except Exception as e:
            error_msg = f"设备 {device_id} 启动 scrcpy stdout 失败: {e}"
            logger.error(error_msg, exc_info=True)
            try:
                await websocket.send_json({"type": "error", "message": error_msg})
            except Exception:
                pass
            return

        # 读取 stdout 并转发
        try:
            assert proc.stdout is not None
            while self.h264_streaming_flags.get(device_id, False):
                chunk = await proc.stdout.read(65536)  # 64KB
                if not chunk:
                    # 进程结束或无数据
                    if proc.returncode is not None:
                        logger.info(f"设备 {device_id}: scrcpy stdout 结束，returncode={proc.returncode}")
                        break
                    await asyncio.sleep(0.01)
                    continue
                try:
                    await websocket.send_bytes(chunk)
                    frame_count += 1
                    if frame_count <= 5 or frame_count % 100 == 0:
                        logger.info(f"设备 {device_id}: stdout 已发送 {frame_count} 个 chunk，大小 {len(chunk)}")
                except Exception as send_err:
                    logger.error(f"设备 {device_id}: 发送 stdout 数据失败: {send_err}")
                    break
        except asyncio.CancelledError:
            logger.info(f"设备 {device_id}: stdout 任务被取消")
        except Exception as e:
            logger.error(f"设备 {device_id}: stdout 流异常: {e}", exc_info=True)
        finally:
            # 关闭进程与资源
            try:
                if proc.returncode is None:
                    proc.kill()
            except Exception:
                pass

            stderr_text = ""
            try:
                _, stderr_data = await proc.communicate()
                stderr_text = stderr_data.decode("utf-8", errors="ignore") if stderr_data else ""
            except Exception:
                pass

            logger.info(f"设备 {device_id}: stdout 模式结束（chunk 数: {frame_count}，returncode={proc.returncode}，stderr前200字: {stderr_text[:200] if stderr_text else '无'}）")

            # 若进程异常退出且未发送数据，告知前端
            if proc.returncode not in (0, None) and frame_count == 0:
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"scrcpy stdout 退出码 {proc.returncode}，stderr: {stderr_text[:200] if stderr_text else '无'}"
                    })
                except Exception:
                    pass

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
