import asyncio
import json
from typing import Dict, Any, Optional
from phone_agent import PhoneAgent
from phone_agent.model import ModelConfig
from app.core.config import settings
from app.services.device_service import DeviceManager
from app.utils.logger_utils import logger

class AIService:
    """AI服务管理器"""
    
    def __init__(self):
        self.device_manager = DeviceManager()
        self.agent_instances: Dict[str, PhoneAgent] = {}
        self._init_agents()
    
    def _init_agents(self):
        """初始化PhoneAgent实例"""
        try:
            model_config = ModelConfig(
                base_url=settings.AUTOGLM_BASE_URL,
                model_name=settings.AUTOGLM_MODEL_NAME
            )
            # 创建默认Agent
            self.default_agent = PhoneAgent(model_config=model_config)
            logger.info("Open-AutoGLM Agent 初始化成功")
        except Exception as e:
            logger.error(f"初始化Agent失败: {str(e)}")
            raise
    
    async def get_service_status(self) -> Dict[str, Any]:
        """获取AI服务状态"""
        return {
            "status": "running",
            "model_name": settings.AUTOGLM_MODEL_NAME,
            "base_url": settings.AUTOGLM_BASE_URL,
            "max_steps": settings.AUTOGLM_MAX_STEPS,
            "active_agents": len(self.agent_instances)
        }
    
    async def execute_natural_language_command(
        self,
        device_id: str,
        command: str,
        verbose: bool = True,
        max_steps: Optional[int] = None
    ) -> Dict[str, Any]:
        """执行自然语言指令"""
        try:
            # 确保设备已连接
            if not await self.device_manager.connect_device(device_id):
                raise Exception(f"设备 {device_id} 未连接")
            
            # 执行指令
            logger.info(f"设备 {device_id} 执行指令: {command}")
            
            # 这里需要确保ADB_DEVICE_ID环境变量正确设置
            import os
            os.environ["ADB_DEVICE_ID"] = device_id
            
            # PhoneAgent可能没有config属性，直接调用run方法
            # verbose和max_steps参数可能通过run方法的参数传递，或者不需要设置
            # 先尝试安全地设置config（如果存在）
            try:
                if hasattr(self.default_agent, 'config'):
                    if hasattr(self.default_agent.config, 'verbose'):
                        self.default_agent.config.verbose = verbose
                    if hasattr(self.default_agent.config, 'max_steps'):
                        self.default_agent.config.max_steps = max_steps or settings.AUTOGLM_MAX_STEPS
            except Exception as config_error:
                logger.warning(f"无法设置Agent配置: {config_error}，继续执行...")
            
            # 执行Open-AutoGLM指令
            # run方法可能接受额外的参数，但为了兼容性，先只传递command
            result = await asyncio.to_thread(self.default_agent.run, command)
            
            # 记录执行结果
            execution_result = {
                "command": command,
                "device_id": device_id,
                "result": result,
                "success": True
            }
            
            logger.info(f"指令执行完成: {execution_result}")
            return execution_result
        except Exception as e:
            logger.error(f"执行自然语言指令失败: {str(e)}")
            return {
                "command": command,
                "device_id": device_id,
                "error": str(e),
                "success": False
            }

