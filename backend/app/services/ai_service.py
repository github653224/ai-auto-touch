import asyncio
import json
from typing import Dict, Any, Optional
from phone_agent import PhoneAgent
from phone_agent.model import ModelConfig
from phone_agent.agent import AgentConfig
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
            # 创建默认Agent（device_id会在执行时动态设置）
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
            
            # 设置环境变量（某些组件可能会读取）
            import os
            os.environ["ADB_DEVICE_ID"] = device_id
            
            # 为每个设备创建独立的Agent实例，确保device_id正确传递
            if device_id not in self.agent_instances:
                model_config = ModelConfig(
                    base_url=settings.AUTOGLM_BASE_URL,
                    model_name=settings.AUTOGLM_MODEL_NAME
                )
                agent_config = AgentConfig(
                    device_id=device_id,
                    verbose=verbose,
                    max_steps=max_steps or settings.AUTOGLM_MAX_STEPS
                )
                self.agent_instances[device_id] = PhoneAgent(
                    model_config=model_config,
                    agent_config=agent_config
                )
                logger.info(f"为设备 {device_id} 创建了新的Agent实例")
            else:
                # 更新现有Agent的配置
                agent = self.agent_instances[device_id]
                if hasattr(agent, 'agent_config'):
                    agent.agent_config.verbose = verbose
                    if max_steps:
                        agent.agent_config.max_steps = max_steps
            
            # 使用设备特定的Agent执行指令
            agent = self.agent_instances[device_id]
            result = await asyncio.to_thread(agent.run, command)
            
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
            logger.error(f"执行自然语言指令失败: {str(e)}", exc_info=True)
            return {
                "command": command,
                "device_id": device_id,
                "error": str(e),
                "success": False
            }

