"""
设备锁定服务
管理设备的独占访问，防止多用户冲突
"""

import time
import uuid
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class DeviceLock:
    """设备锁信息"""
    
    def __init__(self, session_id: str, user_id: str, user_name: str):
        self.session_id = session_id
        self.user_id = user_id
        self.user_name = user_name
        self.locked_at = datetime.now()
        self.last_heartbeat = datetime.now()
    
    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "locked_at": self.locked_at.isoformat(),
            "last_heartbeat": self.last_heartbeat.isoformat(),
            "locked_duration": int((datetime.now() - self.locked_at).total_seconds()),
        }


class DeviceLockService:
    """设备锁定服务"""
    
    def __init__(self, heartbeat_timeout: int = 30):
        """
        Args:
            heartbeat_timeout: 心跳超时时间（秒），超过此时间未收到心跳则自动释放锁
        """
        # device_id -> DeviceLock
        self.locks: Dict[str, DeviceLock] = {}
        self.heartbeat_timeout = heartbeat_timeout
    
    def acquire_lock(
        self, 
        device_id: str, 
        user_id: str, 
        user_name: str,
        force: bool = False
    ) -> Tuple[bool, Optional[str], Optional[dict]]:
        """
        获取设备锁
        
        Args:
            device_id: 设备 ID
            user_id: 用户 ID
            user_name: 用户名称
            force: 是否强制获取（管理员权限）
        
        Returns:
            (success, session_id, lock_info)
            - success: 是否成功获取锁
            - session_id: 会话 ID（成功时返回）
            - lock_info: 当前锁信息（失败时返回，显示谁占用了设备）
        """
        # 清理过期的锁
        self._cleanup_expired_locks()
        
        # 检查设备是否已被锁定
        if device_id in self.locks:
            existing_lock = self.locks[device_id]
            
            # 如果是同一个用户，返回现有会话
            if existing_lock.user_id == user_id:
                logger.info(f"用户 {user_name} 重新连接到设备 {device_id}")
                existing_lock.last_heartbeat = datetime.now()
                return True, existing_lock.session_id, None
            
            # 如果是其他用户且不强制，返回失败
            if not force:
                logger.warning(
                    f"设备 {device_id} 已被用户 {existing_lock.user_name} 占用，"
                    f"拒绝用户 {user_name} 的访问请求"
                )
                return False, None, existing_lock.to_dict()
            
            # 强制获取，释放现有锁
            logger.warning(
                f"用户 {user_name} 强制获取设备 {device_id}，"
                f"释放用户 {existing_lock.user_name} 的锁"
            )
            del self.locks[device_id]
        
        # 创建新锁
        session_id = str(uuid.uuid4())
        lock = DeviceLock(session_id, user_id, user_name)
        self.locks[device_id] = lock
        
        logger.info(
            f"用户 {user_name} 成功获取设备 {device_id} 的锁，"
            f"会话 ID: {session_id}"
        )
        
        return True, session_id, None
    
    def release_lock(
        self, 
        device_id: str, 
        session_id: str
    ) -> Tuple[bool, str]:
        """
        释放设备锁
        
        Args:
            device_id: 设备 ID
            session_id: 会话 ID
        
        Returns:
            (success, message)
        """
        if device_id not in self.locks:
            return False, "设备未被锁定"
        
        lock = self.locks[device_id]
        
        # 验证会话 ID
        if lock.session_id != session_id:
            return False, "会话 ID 不匹配，无法释放锁"
        
        # 释放锁
        del self.locks[device_id]
        logger.info(
            f"用户 {lock.user_name} 释放了设备 {device_id} 的锁，"
            f"会话 ID: {session_id}"
        )
        
        return True, "锁已释放"
    
    def heartbeat(
        self, 
        device_id: str, 
        session_id: str
    ) -> Tuple[bool, str]:
        """
        发送心跳，保持锁活跃
        
        Args:
            device_id: 设备 ID
            session_id: 会话 ID
        
        Returns:
            (success, message)
        """
        if device_id not in self.locks:
            return False, "设备未被锁定"
        
        lock = self.locks[device_id]
        
        # 验证会话 ID
        if lock.session_id != session_id:
            return False, "会话 ID 不匹配"
        
        # 更新心跳时间
        lock.last_heartbeat = datetime.now()
        
        return True, "心跳已更新"
    
    def get_lock_info(self, device_id: str) -> Optional[dict]:
        """
        获取设备锁信息
        
        Args:
            device_id: 设备 ID
        
        Returns:
            锁信息字典，如果未锁定则返回 None
        """
        self._cleanup_expired_locks()
        
        if device_id not in self.locks:
            return None
        
        return self.locks[device_id].to_dict()
    
    def is_locked(self, device_id: str) -> bool:
        """
        检查设备是否被锁定
        
        Args:
            device_id: 设备 ID
        
        Returns:
            是否被锁定
        """
        self._cleanup_expired_locks()
        return device_id in self.locks
    
    def list_all_locks(self) -> Dict[str, dict]:
        """
        列出所有设备锁
        
        Returns:
            设备 ID -> 锁信息的字典
        """
        self._cleanup_expired_locks()
        return {
            device_id: lock.to_dict()
            for device_id, lock in self.locks.items()
        }
    
    def _cleanup_expired_locks(self):
        """清理过期的锁（心跳超时）"""
        now = datetime.now()
        expired_devices = []
        
        for device_id, lock in self.locks.items():
            time_since_heartbeat = (now - lock.last_heartbeat).total_seconds()
            if time_since_heartbeat > self.heartbeat_timeout:
                expired_devices.append(device_id)
                logger.warning(
                    f"设备 {device_id} 的锁已过期（心跳超时 {time_since_heartbeat:.1f}s），"
                    f"自动释放用户 {lock.user_name} 的锁"
                )
        
        for device_id in expired_devices:
            del self.locks[device_id]


# 全局单例
_device_lock_service: Optional[DeviceLockService] = None


def get_device_lock_service() -> DeviceLockService:
    """获取设备锁定服务单例"""
    global _device_lock_service
    if _device_lock_service is None:
        _device_lock_service = DeviceLockService(heartbeat_timeout=30)
    return _device_lock_service
