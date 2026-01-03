import asyncio
import os
import shutil
from typing import Dict, Any
from app.core.config import settings
from app.utils.logger_utils import logger

def get_adb_path() -> str:
    """获取ADB的完整路径"""
    adb_path = settings.ADB_PATH
    
    # 如果路径是 "adb"，尝试从PATH中查找
    if adb_path == "adb":
        # 尝试多个可能的路径
        possible_paths = [
            shutil.which("adb"),  # 从PATH查找
            "/usr/local/bin/adb",
            "/usr/bin/adb",
            "/opt/homebrew/bin/adb",
            os.path.expanduser("~/Library/Android/sdk/platform-tools/adb"),
            "/Users/rock/Documents/test_tools/android_sdk/platform-tools/adb",  # 用户的实际路径
        ]
        
        for path in possible_paths:
            if path and os.path.exists(path) and os.access(path, os.X_OK):
                logger.debug(f"找到adb路径: {path}")
                return path
        
        # 如果都找不到，返回 "adb"（可能在某些环境中可用）
        logger.warning("无法找到adb完整路径，使用 'adb'（可能在某些环境中可用）")
        return "adb"
    
    return adb_path

class CommandResult:
    """命令执行结果"""
    def __init__(self, stdout: str, stderr: str, returncode: int):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode

async def run_adb_command(command: str, timeout: int = 30, wait: bool = True) -> CommandResult:
    """执行ADB命令
    
    Args:
        command: ADB命令（不包含 adb 本身）
        timeout: 超时时间（秒）
        wait: 是否等待命令完成（False 时立即返回，用于控制命令）
    """
    try:
        # 获取ADB路径
        adb_path = get_adb_path()
        
        # 构建完整命令
        cmd = f"{adb_path} {command}"
        logger.debug(f"执行ADB命令: {cmd}")
        
        # 执行命令（使用列表形式，更安全）
        cmd_parts = [adb_path] + command.split()
        process = await asyncio.create_subprocess_exec(
            *cmd_parts,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=os.environ.copy()  # 确保环境变量正确传递
        )
        
        # 如果不等待，立即返回
        if not wait:
            logger.debug(f"ADB命令已启动（不等待完成）: {cmd}")
            return CommandResult(stdout="", stderr="", returncode=0)
        
        # 等待命令完成
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        
        # 解码输出
        stdout_str = stdout.decode('utf-8', errors='ignore') if stdout else ""
        stderr_str = stderr.decode('utf-8', errors='ignore') if stderr else ""
        
        logger.debug(f"ADB命令执行完成: returncode={process.returncode}")
        if stderr_str:
            logger.warning(f"ADB命令stderr: {stderr_str[:200]}")
        
        return CommandResult(
            stdout=stdout_str,
            stderr=stderr_str,
            returncode=process.returncode
        )
    except asyncio.TimeoutError:
        logger.error(f"ADB命令执行超时: {command}")
        raise
    except Exception as e:
        logger.error(f"执行ADB命令失败: {str(e)}", exc_info=True)
        raise

