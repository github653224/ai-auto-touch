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
            logger.debug(f"ADB devices 原始输出: {repr(result.stdout)}")
            lines = result.stdout.split("\n")
            logger.debug(f"ADB devices 总行数: {len(lines)}")
            
            devices = []
            for idx, line in enumerate(lines[1:], start=1):  # 跳过第一行 "List of devices attached"
                original_line = line
                line = line.strip()
                logger.debug(f"处理第 {idx} 行: {repr(original_line)} -> 处理后: {repr(line)}")
                
                if not line:
                    continue
                
                # 检查是否是设备行（包含 "device" 且不包含 "offline"）
                line_lower = line.lower()
                has_device = "device" in line_lower
                has_offline = "offline" in line_lower
                
                if has_device and not has_offline:
                    # 分割行，获取设备ID（第一列）
                    parts = line.split()
                    
                    if len(parts) >= 2:
                        device_id = parts[0].strip()
                        status = parts[1].strip().lower()
                        logger.debug(f"  设备ID: {device_id}, 状态: {status}")
                        
                        # 只处理状态为 "device" 的设备
                        if device_id and status == "device":
                            logger.info(f"发现设备: {device_id}")
                            try:
                                # 获取设备详细信息
                                device_info = await self.get_device_info(device_id)
                                devices.append(device_info)
                                self.devices[device_id] = device_info
                                logger.info(f"成功添加设备: {device_id}")
                            except Exception as e:
                                logger.warning(f"获取设备 {device_id} 信息失败: {str(e)}")
                                # 即使获取详细信息失败，也添加基本设备信息
                                device_info = DeviceInfo(
                                    device_id=device_id,
                                    status="connected"
                                )
                                devices.append(device_info)
                                self.devices[device_id] = device_info
                                logger.info(f"添加基本设备信息: {device_id}")
                    else:
                        logger.debug(f"  行格式不正确，部分数量: {len(parts)}")
            
            logger.info(f"扫描到 {len(devices)} 台设备")
            return devices
        except Exception as e:
            logger.error(f"扫描设备失败: {str(e)}", exc_info=True)
            raise
    
    async def get_all_devices(self) -> List[DeviceInfo]:
        """获取所有设备信息"""
        await self.scan_devices()
        return list(self.devices.values())
    
    async def get_device_info(self, device_id: str) -> DeviceInfo:
        """获取设备详细信息"""
        try:
            # 获取设备型号
            model_result = await run_adb_command(f"-s {device_id} shell getprop ro.product.model")
            # 获取Android版本
            android_result = await run_adb_command(f"-s {device_id} shell getprop ro.build.version.release")
            # 获取设备名称
            name_result = await run_adb_command(f"-s {device_id} shell getprop ro.product.name")
            
            model = model_result.stdout.strip() if model_result.stdout else None
            android_version = android_result.stdout.strip() if android_result.stdout else None
            name = name_result.stdout.strip() if name_result.stdout else None
            
            return DeviceInfo(
                device_id=device_id,
                name=name if name else None,
                model=model if model else None,
                android_version=android_version if android_version else None,
                status="connected",
                screen_size=None,
                battery=None
            )
        except Exception as e:
            logger.warning(f"获取设备 {device_id} 详细信息失败: {str(e)}，使用基本信息")
            # 即使获取详细信息失败，也返回基本设备信息
            return DeviceInfo(
                device_id=device_id,
                name=None,
                model=None,
                android_version=None,
                status="connected",
                screen_size=None,
                battery=None
            )
    
    async def connect_device(self, device_id: str) -> bool:
        """连接设备"""
        try:
            # 如果设备已经在设备列表中且状态为已连接，直接返回
            if device_id in self.devices and self.devices[device_id].status == "connected":
                return True
            
            # 确保设备在线
            result = await run_adb_command(f"-s {device_id} get-state")
            if result.returncode != 0 or "device" not in result.stdout:
                logger.warning(f"设备 {device_id} 状态检查失败: {result.stdout}")
                return False
            
            # 确保设备在设备列表中
            if device_id not in self.devices:
                # 获取设备信息
                device_info = await self.get_device_info(device_id)
                self.devices[device_id] = device_info
            
            # 更新设备状态
            if device_id in self.devices:
                self.devices[device_id].status = "connected"
            
            logger.info(f"设备 {device_id} 连接成功")
            return True
        except KeyError as e:
            # KeyError通常是因为设备不在列表中
            logger.warning(f"设备 {device_id} 不在设备列表中，尝试获取设备信息...")
            try:
                device_info = await self.get_device_info(device_id)
                self.devices[device_id] = device_info
                self.devices[device_id].status = "connected"
                logger.info(f"设备 {device_id} 连接成功（已添加到列表）")
                return True
            except Exception as e2:
                logger.error(f"连接设备 {device_id} 失败: {str(e2)}")
                return False
        except Exception as e:
            error_msg = str(e) if str(e) else f"未知错误"
            logger.error(f"连接设备 {device_id} 失败: {error_msg}")
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

