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

# 每个设备一个 streamer，多个客户端共享
_device_streamers: dict[str, ScrcpyStreamer] = {}
_stream_tasks: dict[str, asyncio.Task] = {}
_device_locks: dict[str, asyncio.Lock] = {}  # 设备锁，防止同时启动多个流
_device_clients: dict[str, set[str]] = {}  # 每个设备的客户端列表


async def _get_device_lock(device_id: str) -> asyncio.Lock:
    """获取设备锁"""
    if device_id not in _device_locks:
        _device_locks[device_id] = asyncio.Lock()
    return _device_locks[device_id]


async def _stop_stream_for_device(device_id: str) -> None:
    """停止设备的视频流"""
    task = _stream_tasks.pop(device_id, None)
    if task:
        task.cancel()

    streamer = _device_streamers.pop(device_id, None)
    if streamer:
        streamer.stop()
    
    # 清理客户端列表
    _device_clients.pop(device_id, None)


def stop_streamers(device_id: str | None = None) -> None:
    """Stop active scrcpy streamers (all or by device)."""
    if device_id:
        device_ids = [device_id]
    else:
        device_ids = list(_device_streamers.keys())
    
    for did in device_ids:
        task = _stream_tasks.pop(did, None)
        if task:
            task.cancel()
        streamer = _device_streamers.pop(did, None)
        if streamer:
            streamer.stop()
        _device_clients.pop(did, None)


async def _broadcast_packets(device_id: str, streamer: ScrcpyStreamer) -> None:
    """广播视频流到所有连接的客户端"""
    try:
        async for packet in streamer.iter_packets():
            # 获取该设备的所有客户端
            clients = _device_clients.get(device_id, set())
            if not clients:
                logger.warning(f"No clients for device {device_id}, stopping stream")
                break
            
            payload = _packet_to_payload(packet)
            
            # 广播到所有客户端
            for sid in list(clients):
                try:
                    await sio.emit("video-data", payload, to=sid)
                except Exception as e:
                    logger.error(f"Failed to send to client {sid}: {e}")
                    # 客户端可能已断开，从列表中移除
                    clients.discard(sid)
                    
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception("Video streaming failed: %s", exc)
        # 通知所有客户端
        clients = _device_clients.get(device_id, set())
        for sid in list(clients):
            try:
                await sio.emit("error", {"message": str(exc)}, to=sid)
            except Exception:
                pass
    finally:
        await _stop_stream_for_device(device_id)


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
    
    # 从所有设备的客户端列表中移除该客户端
    for device_id, clients in list(_device_clients.items()):
        if sid in clients:
            clients.discard(sid)
            logger.info(f"Client {sid} removed from device {device_id}, remaining clients: {len(clients)}")
            
            # 如果没有客户端了，停止该设备的流
            if not clients:
                logger.info(f"No more clients for device {device_id}, stopping stream")
                await _stop_stream_for_device(device_id)


@sio.on("connect-device")
async def connect_device(sid: str, data: dict | None) -> None:
    payload = data or {}
    device_id = payload.get("device_id") or payload.get("deviceId")
    max_size = int(payload.get("maxSize") or 1280)
    bit_rate = int(payload.get("bitRate") or 4_000_000)

    # 获取设备锁，防止同时启动多个流
    device_lock = await _get_device_lock(device_id)
    
    async with device_lock:
        # 检查该设备是否已有流在运行
        existing_streamer = _device_streamers.get(device_id)
        
        if existing_streamer:
            # 已有流在运行，直接加入客户端列表
            logger.info(f"Device {device_id} stream already running, adding client {sid}")
            
            # 添加到客户端列表
            if device_id not in _device_clients:
                _device_clients[device_id] = set()
            _device_clients[device_id].add(sid)
            
            # 发送元数据给新客户端
            try:
                metadata = existing_streamer.video_metadata
                if metadata:
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
                    logger.info(f"Sent metadata to new client {sid}")
                else:
                    logger.warning(f"No metadata available for device {device_id}")
            except Exception as exc:
                logger.exception(f"Failed to send metadata to client {sid}: {exc}")
                await sio.emit("error", {"message": str(exc)}, to=sid)
            
            return
        
        # 没有流在运行，创建新的流
        logger.info(f"Starting new stream for device {device_id}")
        
        streamer = ScrcpyStreamer(
            device_id=device_id,
            max_size=max_size,
            bit_rate=bit_rate,
        )

        try:
            await streamer.start()
            metadata = await streamer.read_video_metadata()
            
            # 添加到客户端列表
            if device_id not in _device_clients:
                _device_clients[device_id] = set()
            _device_clients[device_id].add(sid)
            
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
            
            logger.info(f"Stream started for device {device_id}, client {sid}")
            
        except Exception as exc:
            streamer.stop()
            logger.exception("Failed to start scrcpy stream: %s", exc)
            await sio.emit("error", {"message": str(exc)}, to=sid)
            return

        _device_streamers[device_id] = streamer
        _stream_tasks[device_id] = asyncio.create_task(_broadcast_packets(device_id, streamer))
