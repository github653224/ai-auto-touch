"""Socket.IO server for Scrcpy video streaming."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import socketio

from app.utils.logger_utils import logger
from app.utils.scrcpy_protocol import ScrcpyMediaStreamPacket
from app.services.scrcpy_video_stream import ScrcpyStreamer

# 创建 Socket.IO 服务器
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)

# 每个 Socket 连接一个 streamer（参考 AutoGLM-GUI 的稳定实现）
_socket_streamers: dict[str, ScrcpyStreamer] = {}  # Key: sid
_stream_tasks: dict[str, asyncio.Task] = {}  # Key: sid
_device_locks: dict[str, asyncio.Lock] = {}  # 设备锁，防止同时启动多个 scrcpy 服务器


async def _stop_stream_for_sid(sid: str) -> None:
    """停止指定 Socket 的视频流"""
    task = _stream_tasks.pop(sid, None)
    if task:
        task.cancel()

    streamer = _socket_streamers.pop(sid, None)
    if streamer:
        streamer.stop()


def stop_streamers(device_id: str | None = None) -> None:
    """Stop active scrcpy streamers (all or by device)."""
    sids = list(_socket_streamers.keys())
    for sid in sids:
        streamer = _socket_streamers.get(sid)
        if not streamer:
            continue
        if device_id and streamer.device_id != device_id:
            continue
        task = _stream_tasks.pop(sid, None)
        if task:
            task.cancel()
        streamer.stop()
        _socket_streamers.pop(sid, None)


async def _stream_packets(sid: str, streamer: ScrcpyStreamer) -> None:
    """将视频流发送到指定客户端"""
    try:
        async for packet in streamer.iter_packets():
            payload = _packet_to_payload(packet)
            await sio.emit("video-data", payload, to=sid)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception("Video streaming failed: %s", exc)
        try:
            await sio.emit("error", {"message": str(exc)}, to=sid)
        except Exception:
            pass
    finally:
        await _stop_stream_for_sid(sid)


def _packet_to_payload(packet: ScrcpyMediaStreamPacket) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": packet.type,
        "data": packet.data,
        "timestamp": int(time.time() * 1000),
    }
    if packet.type == "data":
        payload["keyframe"] = packet.keyframe
        payload["pts"] = packet.pts
    return payload


@sio.event
async def connect(sid: str, environ: dict) -> None:
    logger.info("Socket.IO client connected: %s", sid)


@sio.event
async def disconnect(sid: str) -> None:
    logger.info("Socket.IO client disconnected: %s", sid)
    # 立即停止该客户端的视频流
    await _stop_stream_for_sid(sid)


@sio.on("connect-device")
async def connect_device(sid: str, data: dict | None) -> None:
    payload = data or {}
    device_id = payload.get("device_id") or payload.get("deviceId")
    if not device_id:
        await sio.emit(
            "error",
            {"message": "Device ID is required"},
            to=sid,
        )
        return
    
    max_size = int(payload.get("maxSize") or 1280)
    bit_rate = int(payload.get("bitRate") or 4_000_000)

    # 停止该 Socket 的任何现有流
    await _stop_stream_for_sid(sid)

    # 获取或创建设备锁
    if device_id not in _device_locks:
        _device_locks[device_id] = asyncio.Lock()
    
    device_lock = _device_locks[device_id]
    
    # 获取设备锁，防止同时启动多个 scrcpy 服务器
    async with device_lock:
        logger.debug(f"Acquired device lock for {device_id}, sid: {sid}")
        
        # 停止同一设备的其他流（来自其他 Socket）
        sids_to_stop = [
            s
            for s, streamer in _socket_streamers.items()
            if s != sid and streamer.device_id == device_id
        ]
        for s in sids_to_stop:
            logger.info(f"Stopping existing stream for device {device_id} from sid {s}")
            await _stop_stream_for_sid(s)
        
        # 创建新的 streamer
        streamer = ScrcpyStreamer(
            device_id=device_id,
            max_size=max_size,
            bit_rate=bit_rate,
        )

        try:
            await streamer.start()
            metadata = await streamer.read_video_metadata()
            
            # 发送元数据
            await sio.emit(
                "video-metadata",
                {
                    "deviceName": metadata.device_name,
                    "width": metadata.width,
                    "height": metadata.height,
                    "codec": metadata.codec,
                },
                to=sid,
            )
            
            # 保存 streamer 和启动流任务
            _socket_streamers[sid] = streamer
            _stream_tasks[sid] = asyncio.create_task(_stream_packets(sid, streamer))
            
            logger.info(f"Stream started for device {device_id}, sid {sid}")
            
        except Exception as exc:
            streamer.stop()
            logger.exception("Failed to start scrcpy stream: %s", exc)
            await sio.emit("error", {"message": str(exc)}, to=sid)
            return


# 调试函数：获取当前状态
def get_stream_status() -> dict:
    """获取当前视频流状态（用于调试）"""
    return {
        "streamers": {
            sid: streamer.device_id 
            for sid, streamer in _socket_streamers.items()
        },
        "tasks": list(_stream_tasks.keys()),
    }


def reset_all_streams() -> None:
    """重置所有视频流（用于调试）"""
    logger.warning("Resetting all video streams")
    stop_streamers()
    _device_locks.clear()
