import asyncio
import subprocess
from typing import List, Dict, Any, Optional
from app.models.device_models import DeviceInfo
from app.core.config import settings
from app.utils.adb_utils import run_adb_command
from app.utils.logger_utils import logger

class DeviceManager:
    """设备管理器"""
    
    def __init__(self):
        self.devices: Dict[str, DeviceInfo] = {}
        self.connected_devices: Dict[str, asyncio.subprocess.Process] = {}
    
    async def scan_devices(self) -> List[DeviceInfo]:
        """扫描可用设备"""
        try:
            # 执行adb devices命令
            result = await run_adb_command("devices")
            lines = result.stdout.split("\n")
            
            devices = []
            for line in lines[1:]:
                if line.strip() and "device" in line and not "offline" in line:
                    device_id = line.split()[0].strip()
                    if device_id:
                        # 获取设备详细信息
                        device_info = await self.get_device_info(device_id)
                        devices.append(device_info)
                        self.devices[device_id] = device_info
            
            logger.info(f"扫描到 {len(devices)} 台设备")
            return devices
        except Exception as e:
            logger.error(f"扫描设备失败: {str(e)}")
            raise
    
    async def get_all_devices(self) -> List[DeviceInfo]:
        """获取所有设备信息"""
        await self.scan_devices()
        return list(self.devices.values())
    
    async def get_device_info(self, device_id: str) -> DeviceInfo:
        """获取设备详细信息"""
        try:
            # 获取设备型号
            model = await run_adb_command(f"-s {device_id} shell getprop ro.product.model")
            # 获取Android版本
            android_version = await run_adb_command(f"-s {device_id} shell getprop ro.build.version.release")
            # 获取设备名称
            name = await run_adb_command(f"-s {device_id} shell getprop ro.product.name")
            
            return DeviceInfo(
                device_id=device_id,
                name=name.stdout.strip() if name.stdout else None,
                model=model.stdout.strip() if model.stdout else None,
                android_version=android_version.stdout.strip() if android_version else None,
                status="connected",
                screen_size=None,
                battery=None
            )
        except Exception as e:
            logger.error(f"获取设备 {device_id} 信息失败: {str(e)}")
            return DeviceInfo(
                device_id=device_id,
                status="disconnected"
            )
    
    async def connect_device(self, device_id: str) -> bool:
        """连接设备"""
        try:
            if device_id in self.connected_devices:
                return True
            
            # 确保设备在线
            result = await run_adb_command(f"-s {device_id} get-state")
            if "device" not in result.stdout:
                return False
            
            # 更新设备状态
            self.devices[device_id].status = "connected"
            logger.info(f"设备 {device_id} 连接成功")
            return True
        except Exception as e:
            logger.error(f"连接设备 {device_id} 失败: {str(e)}")
            return False
    
    async def disconnect_device(self, device_id: str) -> bool:
        """断开设备"""
        try:
            if device_id in self.connected_devices:
                self.connected_devices[device_id].terminate()
                del self.connected_devices[device_id]
            
            if device_id in self.devices:
                self.devices[device_id].status = "disconnected"
            
            logger.info(f"设备 {device_id} 断开连接")
            return True
        except Exception as e:
            logger.error(f"断开设备 {device_id} 失败: {str(e)}")
            return False
    
    async def execute_adb_command(self, device_id: str, command: str) -> Dict[str, Any]:
        """执行ADB命令"""
        try:
            # 确保设备已连接
            if not await self.connect_device(device_id):
                raise Exception(f"设备 {device_id} 未连接")
            
            # 执行命令
            result = await run_adb_command(f"-s {device_id} {command}")
            
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode
            }
        except Exception as e:
            logger.error(f"执行ADB命令失败: {str(e)}")
            raise

