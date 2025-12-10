import asyncio
from typing import Dict, Any
from app.core.config import settings
from app.utils.logger_utils import logger

class CommandResult:
    """命令执行结果"""
    def __init__(self, stdout: str, stderr: str, returncode: int):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode

async def run_adb_command(command: str, timeout: int = 30) -> CommandResult:
    """执行ADB命令"""
    try:
        # 构建完整命令
        cmd = f"{settings.ADB_PATH} {command}"
        logger.debug(f"执行ADB命令: {cmd}")
        
        # 执行命令
        process = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # 等待命令完成
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        
        # 解码输出
        stdout_str = stdout.decode('utf-8', errors='ignore')
        stderr_str = stderr.decode('utf-8', errors='ignore')
        
        return CommandResult(
            stdout=stdout_str,
            stderr=stderr_str,
            returncode=process.returncode
        )
    except asyncio.TimeoutError:
        logger.error(f"ADB命令执行超时: {command}")
        raise
    except Exception as e:
        logger.error(f"执行ADB命令失败: {str(e)}")
        raise

