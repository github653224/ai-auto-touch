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

_socket_streamers: dict[str, ScrcpyStreamer] = {}
_stream_tasks: dict[str, asyncio.Task] = {}
_device_locks: dict[str, asyncio.Lock] = {}  # 设备锁，防止同时启动多个流


async def _get_device_lock(device_id: str) -> asyncio.Lock:
    """获取设备锁"""
    if device_id not in _device_locks:
        _device_locks[device_id] = asyncio.Lock()
    return _device_locks[device_id]


async def _stop_stream_for_sid(sid: str) -> None:
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
    await _stop_stream_for_sid(sid)


@sio.on("connect-device")
async def connect_device(sid: str, data: dict | None) -> None:
    payload = data or {}
    device_id = payload.get("device_id") or payload.get("deviceId")
    max_size = int(payload.get("maxSize") or 1280)
    bit_rate = int(payload.get("bitRate") or 4_000_000)

    # 获取设备锁，防止同时启动多个流
    device_lock = await _get_device_lock(device_id)
    
    async with device_lock:
        # 停止该 sid 的旧流
        await _stop_stream_for_sid(sid)
        
        # 停止该设备的所有其他流
        stop_streamers(device_id)
        
        # 等待一下，确保旧流完全停止
        await asyncio.sleep(0.5)

        streamer = ScrcpyStreamer(
            device_id=device_id,
            max_size=max_size,
            bit_rate=bit_rate,
        )

        try:
            await streamer.start()
            metadata = await streamer.read_video_metadata()
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
        except Exception as exc:
            streamer.stop()
            logger.exception("Failed to start scrcpy stream: %s", exc)
            await sio.emit("error", {"message": str(exc)}, to=sid)
            return

        _socket_streamers[sid] = streamer
        _stream_tasks[sid] = asyncio.create_task(_stream_packets(sid, streamer))
