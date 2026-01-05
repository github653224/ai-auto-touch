"""AI 相关数据模型"""
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict


class NLCommandRequest(BaseModel):
    """自然语言命令请求模型（不包含 device_id，用于 API 路径参数）"""
    model_config = {
        "protected_namespaces": (),
        "json_schema_extra": {
            "example": {
                "command": "打开微信",
                "verbose": False,
                "max_steps": 10,
                "base_url": "https://open.bigmodel.cn/api/paas/v4",
                "model_name": "glm-4-plus",
                "api_key": "your-api-key"
            }
        }
    }
    
    command: str = Field(..., description="自然语言指令")
    verbose: bool = Field(default=False, description="是否输出详细日志")
    max_steps: int = Field(default=10, description="最大执行步数")
    base_url: Optional[str] = Field(None, description="AI模型服务地址")
    model_name: Optional[str] = Field(None, description="AI模型名称")
    api_key: Optional[str] = Field(None, description="API密钥")


class NLCommand(BaseModel):
    """自然语言命令模型"""
    model_config = {
        "protected_namespaces": (),
        "json_schema_extra": {
            "example": {
                "device_id": "192.168.1.100:5555",
                "command": "打开微信",
                "verbose": False,
                "max_steps": 10,
                "base_url": "https://open.bigmodel.cn/api/paas/v4",
                "model_name": "glm-4-plus",
                "api_key": "your-api-key"
            }
        }
    }
    
    device_id: str = Field(..., description="目标设备ID")
    command: str = Field(..., description="自然语言指令")
    verbose: bool = Field(default=False, description="是否输出详细日志")
    max_steps: int = Field(default=10, description="最大执行步数")
    base_url: Optional[str] = Field(None, description="AI模型服务地址")
    model_name: Optional[str] = Field(None, description="AI模型名称")
    api_key: Optional[str] = Field(None, description="API密钥")


class AIResponse(BaseModel):
    """AI 响应模型"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "result": {
                    "steps": 3,
                    "actions": ["点击微信图标", "等待应用启动"],
                    "final_state": "微信已打开"
                },
                "device_id": "192.168.1.100:5555",
                "error": None
            }
        }
    }
    
    success: bool = Field(..., description="执行是否成功")
    result: Dict[str, Any] = Field(..., description="执行结果")
    device_id: str = Field(..., description="设备ID")
    error: Optional[str] = Field(None, description="错误信息")
