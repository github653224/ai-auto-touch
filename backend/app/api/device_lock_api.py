"""
设备锁定 API
提供设备独占访问的接口
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from pydantic import BaseModel
import logging

from app.services.device_lock_service import get_device_lock_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/device-lock", tags=["device-lock"])

# 获取设备锁定服务
device_lock_service = get_device_lock_service()


class AcquireLockRequest(BaseModel):
    """获取锁请求"""
    user_id: str
    user_name: str
    force: bool = False


class ReleaseLockRequest(BaseModel):
    """释放锁请求"""
    session_id: str


class HeartbeatRequest(BaseModel):
    """心跳请求"""
    session_id: str


@router.post("/device/{device_id}/acquire")
async def acquire_device_lock(
    device_id: str,
    request: AcquireLockRequest
):
    """
    获取设备锁
    
    Args:
        device_id: 设备 ID
        request: 包含 user_id, user_name, force
    
    Returns:
        {
            "success": bool,
            "session_id": str (成功时),
            "message": str,
            "lock_info": dict (失败时，显示当前占用者信息)
        }
    """
    success, session_id, lock_info = device_lock_service.acquire_lock(
        device_id=device_id,
        user_id=request.user_id,
        user_name=request.user_name,
        force=request.force
    )
    
    if success:
        return {
            "success": True,
            "session_id": session_id,
            "message": "设备锁获取成功"
        }
    else:
        return {
            "success": False,
            "message": f"设备正在被 {lock_info['user_name']} 使用",
            "lock_info": lock_info
        }


@router.post("/device/{device_id}/release")
async def release_device_lock(
    device_id: str,
    request: ReleaseLockRequest
):
    """
    释放设备锁
    
    Args:
        device_id: 设备 ID
        request: 包含 session_id
    
    Returns:
        {
            "success": bool,
            "message": str
        }
    """
    success, message = device_lock_service.release_lock(
        device_id=device_id,
        session_id=request.session_id
    )
    
    return {
        "success": success,
        "message": message
    }


@router.post("/device/{device_id}/heartbeat")
async def device_lock_heartbeat(
    device_id: str,
    request: HeartbeatRequest
):
    """
    发送心跳，保持锁活跃
    
    Args:
        device_id: 设备 ID
        request: 包含 session_id
    
    Returns:
        {
            "success": bool,
            "message": str
        }
    """
    success, message = device_lock_service.heartbeat(
        device_id=device_id,
        session_id=request.session_id
    )
    
    if not success:
        # 心跳失败，可能是锁已被释放或被其他用户抢占
        return {
            "success": False,
            "message": message,
            "should_disconnect": True  # 提示前端断开连接
        }
    
    return {
        "success": True,
        "message": message
    }


@router.get("/device/{device_id}/status")
async def get_device_lock_status(device_id: str):
    """
    获取设备锁状态
    
    Args:
        device_id: 设备 ID
    
    Returns:
        {
            "locked": bool,
            "lock_info": dict (如果被锁定)
        }
    """
    lock_info = device_lock_service.get_lock_info(device_id)
    
    if lock_info:
        return {
            "locked": True,
            "lock_info": lock_info
        }
    else:
        return {
            "locked": False
        }


@router.get("/locks")
async def list_all_device_locks():
    """
    列出所有设备锁
    
    Returns:
        {
            "locks": {
                "device_id": lock_info,
                ...
            }
        }
    """
    locks = device_lock_service.list_all_locks()
    return {
        "locks": locks
    }


@router.post("/device/{device_id}/force-release")
async def force_release_device_lock(device_id: str):
    """
    强制释放设备锁（管理员功能）
    
    Args:
        device_id: 设备 ID
    
    Returns:
        {
            "success": bool,
            "message": str
        }
    """
    lock_info = device_lock_service.get_lock_info(device_id)
    
    if not lock_info:
        return {
            "success": False,
            "message": "设备未被锁定"
        }
    
    # 直接删除锁
    success, message = device_lock_service.release_lock(
        device_id=device_id,
        session_id=lock_info["session_id"]
    )
    
    return {
        "success": success,
        "message": message
    }
