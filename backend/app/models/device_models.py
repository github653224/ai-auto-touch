"""设备相关数据模型"""
from pydantic import BaseModel, Field
from typing import Optional


class DeviceInfo(BaseModel):
    """设备信息模型"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "device_id": "192.168.1.100:5555",
                "name": "Xiaomi_12_CN",
                "model": "Xiaomi 12",
                "android_version": "13",
                "status": "connected",
                "ip": "192.168.1.100",
                "port": 5555,
                "screen_size": "1080x2400",
                "battery": "85%"
            }
        }
    }
    
    device_id: str = Field(..., description="设备ID")
    name: Optional[str] = Field(None, description="设备名称")
    model: Optional[str] = Field(None, description="设备型号")
    android_version: Optional[str] = Field(None, description="Android 版本")
    status: str = Field(default="offline", description="设备状态: connected/disconnected/offline")
    ip: Optional[str] = Field(None, description="设备IP地址")
    port: Optional[int] = Field(None, description="设备端口")
    screen_size: Optional[str] = Field(None, description="屏幕尺寸")
    battery: Optional[str] = Field(None, description="电池电量")


class DeviceCommand(BaseModel):
    """设备命令模型"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "command": "shell input tap 500 1000",
                "timeout": 30
            }
        }
    }
    
    command: str = Field(..., description="ADB命令")
    timeout: Optional[int] = Field(30, description="命令超时时间（秒）")
