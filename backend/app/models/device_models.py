"""设备相关数据模型"""
from pydantic import BaseModel, Field
from typing import Optional


class DeviceInfo(BaseModel):
    """设备信息模型"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "device_id": "192.168.1.100:5555",
                "model": "Xiaomi 12",
                "status": "online",
                "ip": "192.168.1.100",
                "port": 5555
            }
        }
    }
    
    device_id: str = Field(..., description="设备ID")
    model: Optional[str] = Field(None, description="设备型号")
    status: str = Field(default="offline", description="设备状态: online/offline")
    ip: Optional[str] = Field(None, description="设备IP地址")
    port: Optional[int] = Field(None, description="设备端口")


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
