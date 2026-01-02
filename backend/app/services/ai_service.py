import asyncio
import json
import subprocess
import os
from pathlib import Path
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.device_service import DeviceManager
from app.utils.logger_utils import logger

class AIService:
    """AI服务管理器"""
    
    def __init__(self):
        self.device_manager = DeviceManager()
        # 获取 main.py 的绝对路径
        # 假设 backend 和 Open-AutoGLM 在同一父目录下
        backend_dir = Path(__file__).parent.parent.parent
        self.main_py_path = backend_dir.parent / "Open-AutoGLM" / "main.py"
        
        if not self.main_py_path.exists():
            logger.warning(f"未找到 main.py 文件: {self.main_py_path}")
            logger.info("将尝试使用环境变量中的路径或相对路径")
            # 尝试使用环境变量或默认路径
            main_py_env = os.getenv("AUTOGLM_MAIN_PY_PATH")
            if main_py_env and Path(main_py_env).exists():
                self.main_py_path = Path(main_py_env)
            else:
                # 默认路径
                self.main_py_path = Path("/Users/rock/Documents/ai-auto-touch/Open-AutoGLM/main.py")
        
        logger.info(f"使用 main.py 路径: {self.main_py_path}")
    
    async def get_service_status(self) -> Dict[str, Any]:
        """获取AI服务状态"""
        return {
            "status": "running",
            "model_name": settings.AUTOGLM_MODEL_NAME,
            "base_url": settings.AUTOGLM_BASE_URL,
            "api_key_configured": bool(settings.AUTOGLM_API_KEY and settings.AUTOGLM_API_KEY != "EMPTY"),
            "max_steps": settings.AUTOGLM_MAX_STEPS,
            "main_py_path": str(self.main_py_path),
            "main_py_exists": self.main_py_path.exists()
        }
    
    async def execute_natural_language_command(
        self,
        device_id: str,
        command: str,
        verbose: bool = True,
        max_steps: Optional[int] = None,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """执行自然语言指令 - 通过调用 main.py 执行，支持实时日志"""
        try:
            # 导入广播函数（避免循环导入）
            from app.api.ai_websocket_api import broadcast_ai_log
            
            # 确保设备已连接
            if not await self.device_manager.connect_device(device_id):
                raise Exception(f"设备 {device_id} 未连接")
            
            # 检查 main.py 是否存在
            if not self.main_py_path.exists():
                raise Exception(f"未找到 main.py 文件: {self.main_py_path}")
            
            # 广播开始执行
            await broadcast_ai_log(device_id, "info", f"开始执行指令: {command}")
            
            # 执行指令
            logger.info(f"设备 {device_id} 执行指令: {command}")
            
            # 使用传入的模型配置，如果没有则使用配置文件中的默认配置
            model_base_url = base_url or settings.AUTOGLM_BASE_URL
            model_model_name = model_name or settings.AUTOGLM_MODEL_NAME
            model_api_key = api_key if api_key is not None else settings.AUTOGLM_API_KEY
            max_steps_value = max_steps or settings.AUTOGLM_MAX_STEPS
            
            # 广播配置信息
            await broadcast_ai_log(device_id, "info", f"使用模型: {model_model_name}", {
                "base_url": model_base_url,
                "model": model_model_name,
                "max_steps": max_steps_value
            })
            
            # 构建命令行参数
            cmd = [
                "python3",
                "-u",  # 禁用Python输出缓冲，确保实时输出
                str(self.main_py_path),
                "--base-url", model_base_url,
                "--model", model_model_name,
                "--apikey", model_api_key,
                "--device-id", device_id,
                "--max-steps", str(max_steps_value),
            ]
            
            # 如果不需要详细输出，添加 --quiet 参数
            if not verbose:
                cmd.append("--quiet")
            
            # 添加任务指令（用引号包裹，防止特殊字符问题）
            cmd.append(command)
            
            logger.info(f"执行命令: {' '.join(cmd)}")
            
            # 设置工作目录为 main.py 所在目录
            work_dir = self.main_py_path.parent
            
            # 设置环境变量
            env = os.environ.copy()
            env["PHONE_AGENT_DEVICE_ID"] = device_id
            env["PHONE_AGENT_BASE_URL"] = model_base_url
            env["PHONE_AGENT_MODEL"] = model_model_name
            env["PHONE_AGENT_API_KEY"] = model_api_key
            env["PHONE_AGENT_MAX_STEPS"] = str(max_steps_value)
            # 禁用Python输出缓冲，确保实时输出
            env["PYTHONUNBUFFERED"] = "1"
            
            # 广播启动进程
            await broadcast_ai_log(device_id, "info", "启动 AI 代理进程...")
            
            # 在异步上下文中执行 subprocess，实时读取输出
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(work_dir),
                env=env,
                # 禁用缓冲以获得更实时的输出
                bufsize=0
            )
            
            # 实时读取并广播输出
            stdout_lines = []
            stderr_lines = []
            
            async def read_stdout():
                """实时读取标准输出"""
                buffer = b''
                while True:
                    try:
                        # 读取小块数据而不是等待完整行
                        chunk = await process.stdout.read(1024)
                        if not chunk:
                            # 处理缓冲区中剩余的数据
                            if buffer:
                                line_text = buffer.decode('utf-8', errors='ignore').strip()
                                if line_text:
                                    stdout_lines.append(line_text)
                                    await self._parse_and_broadcast_log(device_id, line_text, broadcast_ai_log)
                            break
                        
                        buffer += chunk
                        
                        # 处理完整的行
                        while b'\n' in buffer:
                            line, buffer = buffer.split(b'\n', 1)
                            line_text = line.decode('utf-8', errors='ignore').strip()
                            if line_text:
                                stdout_lines.append(line_text)
                                # 解析并广播不同类型的日志
                                await self._parse_and_broadcast_log(device_id, line_text, broadcast_ai_log)
                        
                        # 如果缓冲区太大，也处理一下（防止内存问题）
                        if len(buffer) > 8192:  # 8KB
                            line_text = buffer.decode('utf-8', errors='ignore').strip()
                            if line_text:
                                stdout_lines.append(line_text)
                                await self._parse_and_broadcast_log(device_id, line_text, broadcast_ai_log)
                            buffer = b''
                            
                    except Exception as e:
                        logger.error(f"读取stdout时出错: {e}")
                        break
            
            async def read_stderr():
                """实时读取错误输出"""
                buffer = b''
                while True:
                    try:
                        chunk = await process.stderr.read(1024)
                        if not chunk:
                            if buffer:
                                line_text = buffer.decode('utf-8', errors='ignore').strip()
                                if line_text:
                                    stderr_lines.append(line_text)
                                    await broadcast_ai_log(device_id, "error", f"错误: {line_text}")
                            break
                        
                        buffer += chunk
                        
                        while b'\n' in buffer:
                            line, buffer = buffer.split(b'\n', 1)
                            line_text = line.decode('utf-8', errors='ignore').strip()
                            if line_text:
                                stderr_lines.append(line_text)
                                await broadcast_ai_log(device_id, "error", f"错误: {line_text}")
                        
                        if len(buffer) > 8192:
                            line_text = buffer.decode('utf-8', errors='ignore').strip()
                            if line_text:
                                stderr_lines.append(line_text)
                                await broadcast_ai_log(device_id, "error", f"错误: {line_text}")
                            buffer = b''
                            
                    except Exception as e:
                        logger.error(f"读取stderr时出错: {e}")
                        break
            
            # 并发读取输出
            try:
                await asyncio.wait_for(
                    asyncio.gather(
                        read_stdout(),
                        read_stderr(),
                        process.wait()
                    ),
                    timeout=3600.0
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                await broadcast_ai_log(device_id, "error", "任务执行超时（超过1小时）")
                raise Exception("任务执行超时（超过1小时）")
            
            # 获取完整输出
            stdout_text = '\n'.join(stdout_lines)
            stderr_text = '\n'.join(stderr_lines)
            
            # 检查返回码
            if process.returncode != 0:
                error_msg = f"执行失败 (返回码: {process.returncode})"
                if stderr_text:
                    error_msg += f"\n错误信息: {stderr_text}"
                logger.error(error_msg)
                await broadcast_ai_log(device_id, "error", error_msg)
                raise Exception(error_msg)
            
            # 从输出中提取结果
            result_text = stdout_text.strip()
            
            # 尝试从输出中提取结果信息
            result_lines = result_text.split('\n')
            final_result = None
            
            # 查找 "Result:" 行
            for line in reversed(result_lines):
                if "Result:" in line or "任务完成" in line or "Task completed" in line:
                    # 提取结果内容
                    if "Result:" in line:
                        final_result = line.split("Result:", 1)[1].strip()
                    else:
                        final_result = line.strip()
                    break
            
            # 如果没有找到明确的结果行，使用最后几行作为结果
            if not final_result:
                final_result = '\n'.join(result_lines[-5:]) if result_lines else result_text
            
            # 广播执行完成
            await broadcast_ai_log(device_id, "info", f"执行完成: {final_result}")
            
            # 记录执行结果
            execution_result = {
                "command": command,
                "device_id": device_id,
                "result": final_result or "任务执行完成",
                "stdout": stdout_text,
                "stderr": stderr_text,
                "return_code": process.returncode,
                "success": True
            }
            
            logger.info(f"指令执行完成: {execution_result['result']}")
            return execution_result
            
        except asyncio.TimeoutError:
            error_msg = "任务执行超时（超过1小时）"
            logger.error(error_msg)
            # 导入广播函数
            from app.api.ai_websocket_api import broadcast_ai_log
            await broadcast_ai_log(device_id, "error", error_msg)
            return {
                "command": command,
                "device_id": device_id,
                "error": error_msg,
                "success": False
            }
        except Exception as e:
            logger.error(f"执行自然语言指令失败: {str(e)}", exc_info=True)
            # 导入广播函数
            from app.api.ai_websocket_api import broadcast_ai_log
            await broadcast_ai_log(device_id, "error", f"执行失败: {str(e)}")
            return {
                "command": command,
                "device_id": device_id,
                "error": str(e),
                "success": False
            }
    
    async def _parse_and_broadcast_log(self, device_id: str, line: str, broadcast_func):
        """解析日志行并广播相应类型的消息"""
        line_lower = line.lower()
        
        # 检测不同类型的日志
        if "step" in line_lower and ("/" in line or "步骤" in line):
            # 步骤信息
            await broadcast_func(device_id, "step", line)
        elif "request" in line_lower or "请求" in line_lower:
            # API 请求
            await broadcast_func(device_id, "model_request", line)
        elif "response" in line_lower or "响应" in line_lower:
            # API 响应
            await broadcast_func(device_id, "model_response", line)
        elif "action" in line_lower or "操作" in line_lower or "点击" in line_lower or "输入" in line_lower:
            # 设备操作
            await broadcast_func(device_id, "action", line)
        elif "error" in line_lower or "错误" in line_lower or "failed" in line_lower:
            # 错误信息
            await broadcast_func(device_id, "error", line)
        else:
            # 一般信息
            await broadcast_func(device_id, "info", line)

