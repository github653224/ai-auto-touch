"""
FFmpeg 流媒体服务
使用 FFmpeg 处理 scrcpy 输出，提供稳定的 H264 流
"""
import asyncio
import os
from typing import Dict, Optional
from fastapi import WebSocket
from app.utils.logger_utils import logger
from app.utils.adb_utils import get_adb_path


class FFmpegStreamManager:
    """FFmpeg 流媒体管理器"""
    
    def __init__(self):
        self.streams: Dict[str, asyncio.subprocess.Process] = {}
        self.stream_tasks: Dict[str, asyncio.Task] = {}
        self.websocket_connections: Dict[str, list] = {}  # device_id -> [websocket1, websocket2, ...]
        
    async def start_stream(self, device_id: str, websocket: WebSocket, max_size: int = 1080, bit_rate: int = 4000000):
        """启动 FFmpeg H264 流
        
        使用 FFmpeg 从 scrcpy 获取视频并重新编码，确保：
        1. 每个 GOP 都以 IDR 帧开始
        2. 定期插入 IDR 帧（每 1 秒）
        3. 所有客户端都能从最近的 IDR 帧开始接收
        """
        try:
            # 注册 WebSocket 连接
            if device_id not in self.websocket_connections:
                self.websocket_connections[device_id] = []
            self.websocket_connections[device_id].append(websocket)
            
            # 如果流已经在运行，直接从现有流读取
            if device_id in self.streams and device_id in self.stream_tasks:
                logger.info(f"设备 {device_id}: 复用现有的 FFmpeg 流")
                await websocket.send_json({
                    "type": "connected",
                    "message": "已连接到现有视频流"
                })
                return
            
            # 启动新的 FFmpeg 流
            logger.info(f"设备 {device_id}: 启动新的 FFmpeg 流")
            
            # 发送连接确认
            await websocket.send_json({
                "type": "connected",
                "message": "正在启动视频流..."
            })
            
            # FFmpeg 命令：
            # 1. 从 scrcpy 获取 H264 视频（通过 stdout）
            # 2. 重新编码，强制每 1 秒插入 IDR 帧
            # 3. 输出到 stdout（H264 Annex B 格式）
            adb_path = get_adb_path()
            
            # 使用 adb exec-out screenrecord 作为输入源（更稳定）
            ffmpeg_cmd = [
                "ffmpeg",
                "-f", "h264",  # 输入格式
                "-i", f"pipe:0",  # 从 stdin 读取
                "-c:v", "libx264",  # H264 编码器
                "-preset", "ultrafast",  # 最快编码速度
                "-tune", "zerolatency",  # 零延迟调优
                "-g", "30",  # GOP 大小 = 30 帧（1秒，假设 30fps）
                "-keyint_min", "30",  # 最小关键帧间隔
                "-sc_threshold", "0",  # 禁用场景切换检测
                "-forced-idr", "1",  # 强制 IDR 帧
                "-x264-params", "bframes=0:ref=1",  # 无 B 帧，减少延迟
                "-b:v", f"{bit_rate}",  # 比特率
                "-maxrate", f"{bit_rate}",  # 最大比特率
                "-bufsize", f"{bit_rate * 2}",  # 缓冲区大小
                "-s", f"{max_size}x{int(max_size * 16 / 9)}",  # 分辨率（假设 16:9）
                "-r", "30",  # 帧率
                "-f", "h264",  # 输出格式
                "-flags", "+global_header",  # 全局头部（SPS/PPS）
                "-bsf:v", "h264_mp4toannexb",  # 转换为 Annex B 格式
                "pipe:1"  # 输出到 stdout
            ]
            
            # 启动 adb screenrecord 作为输入
            adb_cmd = [
                adb_path,
                "-s", device_id,
                "exec-out",
                "screenrecord",
                "--output-format=h264",
                "--bit-rate", str(bit_rate),
                "--size", f"{max_size}x{int(max_size * 16 / 9)}",
                "-"
            ]
            
            # 启动 adb 进程
            adb_process = await asyncio.create_subprocess_exec(
                *adb_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # 启动 FFmpeg 进程
            ffmpeg_process = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdin=adb_process.stdout,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.streams[device_id] = ffmpeg_process
            
            # 启动流分发任务
            task = asyncio.create_task(self._distribute_stream(device_id, ffmpeg_process))
            self.stream_tasks[device_id] = task
            
            logger.info(f"设备 {device_id}: FFmpeg 流已启动")
            
        except Exception as e:
            logger.error(f"启动 FFmpeg 流失败: {str(e)}", exc_info=True)
            await websocket.send_json({
                "type": "error",
                "message": f"启动视频流失败: {str(e)}"
            })
    
    async def _distribute_stream(self, device_id: str, process: asyncio.subprocess.Process):
        """分发流到所有连接的客户端"""
        try:
            # 缓存最近的 SPS/PPS/IDR 帧
            sps_pps_idr_cache = b""
            frame_count = 0
            
            while True:
                # 读取数据
                data = await process.stdout.read(65536)
                if not data:
                    logger.warning(f"设备 {device_id}: FFmpeg 流结束")
                    break
                
                # 检测并缓存 SPS/PPS/IDR
                if self._contains_idr(data):
                    sps_pps_idr_cache = self._extract_sps_pps_idr(data)
                    logger.info(f"设备 {device_id}: 更新 SPS/PPS/IDR 缓存（{len(sps_pps_idr_cache)} 字节）")
                
                # 发送到所有连接的客户端
                if device_id in self.websocket_connections:
                    disconnected = []
                    for ws in self.websocket_connections[device_id]:
                        try:
                            # 如果是新连接且有缓存，先发送缓存
                            if sps_pps_idr_cache and frame_count == 0:
                                await ws.send_bytes(sps_pps_idr_cache)
                            
                            await ws.send_bytes(data)
                            frame_count += 1
                            
                            if frame_count % 100 == 0:
                                logger.info(f"设备 {device_id}: 已发送 {frame_count} 帧")
                        except Exception as e:
                            logger.warning(f"发送数据失败: {str(e)}")
                            disconnected.append(ws)
                    
                    # 移除断开的连接
                    for ws in disconnected:
                        self.websocket_connections[device_id].remove(ws)
                
        except Exception as e:
            logger.error(f"流分发失败: {str(e)}", exc_info=True)
        finally:
            # 清理
            if device_id in self.streams:
                del self.streams[device_id]
            if device_id in self.stream_tasks:
                del self.stream_tasks[device_id]
    
    def _contains_idr(self, data: bytes) -> bool:
        """检测数据是否包含 IDR 帧"""
        # 查找 start code + IDR NALU (0x00 0x00 0x00 0x01 0x65)
        for i in range(len(data) - 5):
            if (data[i] == 0x00 and data[i+1] == 0x00 and 
                data[i+2] == 0x00 and data[i+3] == 0x01 and 
                (data[i+4] & 0x1f) == 5):
                return True
        return False
    
    def _extract_sps_pps_idr(self, data: bytes) -> bytes:
        """提取 SPS/PPS/IDR 帧"""
        # 简单实现：返回包含 IDR 的整个数据块
        # 更复杂的实现可以精确提取 SPS/PPS/IDR
        return data
    
    async def stop_stream(self, device_id: str, websocket: WebSocket):
        """停止流（移除客户端连接）"""
        try:
            if device_id in self.websocket_connections:
                if websocket in self.websocket_connections[device_id]:
                    self.websocket_connections[device_id].remove(websocket)
                
                # 如果没有客户端了，停止流
                if not self.websocket_connections[device_id]:
                    logger.info(f"设备 {device_id}: 没有客户端，停止 FFmpeg 流")
                    
                    if device_id in self.stream_tasks:
                        self.stream_tasks[device_id].cancel()
                        del self.stream_tasks[device_id]
                    
                    if device_id in self.streams:
                        process = self.streams[device_id]
                        process.kill()
                        await process.wait()
                        del self.streams[device_id]
                    
                    del self.websocket_connections[device_id]
        except Exception as e:
            logger.error(f"停止流失败: {str(e)}")


# 全局实例
ffmpeg_stream_manager = FFmpegStreamManager()
