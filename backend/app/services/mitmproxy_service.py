"""
mitmproxy 服务管理
负责启动、停止和管理 mitmweb 进程
"""

import subprocess
import psutil
import logging
from typing import Dict, Optional, Tuple
import socket
from pathlib import Path

logger = logging.getLogger(__name__)


class MitmproxyService:
    """mitmproxy 服务管理类"""
    
    def __init__(self):
        # 存储设备的 mitmweb 进程信息
        # device_id -> {"process": subprocess.Popen, "proxy_port": int, "web_port": int}
        self.processes: Dict[str, dict] = {}
        
        # 端口分配范围
        self.base_proxy_port = 8091
        self.base_web_port = 8191
        self.max_devices = 50
        
        # mitmproxy 证书路径
        self.mitm_cert_path = Path.home() / ".mitmproxy"
    
    def _get_local_ip(self) -> str:
        """获取本机局域网 IP 地址"""
        try:
            # 创建一个 UDP socket 连接到外部地址（不会真正发送数据）
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception:
            return "127.0.0.1"
    
    def _find_free_port(self, start_port: int, max_attempts: int = 50) -> int:
        """查找可用端口"""
        for i in range(max_attempts):
            port = start_port + i
            if self._is_port_available(port):
                return port
        raise RuntimeError(f"无法找到可用端口 (起始端口: {start_port})")
    
    def _is_port_available(self, port: int) -> bool:
        """检查端口是否可用"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return True
            except OSError:
                return False
    
    def _allocate_ports(self, device_id: str) -> Tuple[int, int]:
        """为设备分配端口"""
        # 检查是否已经分配
        if device_id in self.processes:
            info = self.processes[device_id]
            return info["proxy_port"], info["web_port"]
        
        # 查找可用端口
        proxy_port = self._find_free_port(self.base_proxy_port)
        web_port = self._find_free_port(self.base_web_port)
        
        logger.info(f"为设备 {device_id} 分配端口: proxy={proxy_port}, web={web_port}")
        return proxy_port, web_port
    
    def start_mitmweb(self, device_id: str) -> dict:
        """
        为设备启动 mitmweb
        
        Returns:
            dict: {
                "success": bool,
                "device_id": str,
                "proxy_port": int,
                "web_port": int,
                "proxy_host": str,
                "message": str
            }
        """
        # 检查是否已经运行
        if device_id in self.processes:
            process_info = self.processes[device_id]
            if self._is_process_running(process_info["process"]):
                logger.info(f"设备 {device_id} 的 mitmweb 已在运行")
                return {
                    "success": True,
                    "device_id": device_id,
                    "proxy_port": process_info["proxy_port"],
                    "web_port": process_info.get("web_port"),
                    "proxy_host": self._get_local_ip(),
                    "message": "mitmweb already running"
                }
        
        try:
            # 分配端口
            proxy_port = self._find_free_port(self.base_proxy_port)
            web_port = self._find_free_port(self.base_web_port)
            
            # 获取 addon 文件路径
            addon_path = Path(__file__).parent / "mitmproxy_addon_standalone.py"
            
            # 启动 mitmweb 进程
            cmd = [
                "mitmweb",
                "--listen-host", "0.0.0.0",  # 监听所有网络接口，允许手机连接
                "--listen-port", str(proxy_port),
                "--web-host", "127.0.0.1",  # Web 界面只监听本地
                "--web-port", str(web_port),
                "--no-web-open-browser",
                "--ssl-insecure",  # 忽略上游服务器的 SSL 证书错误
                "--set", "block_global=false",
                "--set", "stream_large_bodies=1m",  # 流式传输大文件（超过 1MB 不存储）
                "--set", "content_view_lines_cutoff=100",  # 限制内容显示行数，减少渲染负担
                "--set", "web_debug=false",  # 禁用 web 调试模式
                "--set", "termlog_verbosity=warn",  # 降低日志级别
                "-s", str(addon_path),  # 加载我们的 addon
            ]
            
            logger.info(f"启动 mitmweb: {' '.join(cmd)}")
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # 等待启动
            import time
            time.sleep(2)
            
            # 检查进程是否成功启动
            if not self._is_process_running(process):
                stderr = process.stderr.read() if process.stderr else ""
                raise RuntimeError(f"mitmweb 启动失败: {stderr}")
            
            # 保存进程信息
            self.processes[device_id] = {
                "process": process,
                "proxy_port": proxy_port,
                "web_port": web_port,
                "pid": process.pid
            }
            
            logger.info(f"mitmweb 启动成功: device={device_id}, pid={process.pid}")
            
            return {
                "success": True,
                "device_id": device_id,
                "proxy_port": proxy_port,
                "web_port": web_port,
                "proxy_host": self._get_local_ip(),
                "message": "mitmweb started successfully"
            }
            
        except Exception as e:
            logger.error(f"启动 mitmweb 失败: {e}")
            return {
                "success": False,
                "device_id": device_id,
                "message": str(e)
            }
    
    def stop_mitmweb(self, device_id: str) -> dict:
        """
        停止设备的 mitmweb
        
        Returns:
            dict: {"success": bool, "message": str}
        """
        if device_id not in self.processes:
            return {
                "success": False,
                "message": f"Device {device_id} not found"
            }
        
        try:
            process_info = self.processes[device_id]
            process = process_info["process"]
            
            # 终止进程
            if self._is_process_running(process):
                process.terminate()
                
                # 等待进程结束
                import time
                time.sleep(1)
                
                # 如果还没结束，强制杀死
                if self._is_process_running(process):
                    process.kill()
                    logger.warning(f"强制杀死 mitmweb 进程: device={device_id}, pid={process.pid}")
                else:
                    logger.info(f"mitmweb 进程已停止: device={device_id}, pid={process.pid}")
            
            # 移除记录
            del self.processes[device_id]
            
            return {
                "success": True,
                "message": "mitmweb stopped successfully"
            }
            
        except Exception as e:
            logger.error(f"停止 mitmweb 失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def get_status(self, device_id: str) -> dict:
        """
        获取设备的 mitmweb 状态
        
        Returns:
            dict: {
                "status": "online" | "offline" | "not_found",
                "device_id": str,
                "proxy_port": int,
                "web_port": int,
                "pid": int
            }
        """
        if device_id not in self.processes:
            return {
                "status": "not_found",
                "device_id": device_id
            }
        
        process_info = self.processes[device_id]
        process = process_info["process"]
        
        if self._is_process_running(process):
            return {
                "status": "online",
                "device_id": device_id,
                "proxy_port": process_info["proxy_port"],
                "web_port": process_info.get("web_port"),
                "proxy_host": self._get_local_ip(),
                "pid": process_info["pid"]
            }
        else:
            # 进程已死，清理记录
            del self.processes[device_id]
            return {
                "status": "offline",
                "device_id": device_id
            }
    
    def list_all(self) -> list:
        """列出所有设备的 mitmweb 状态"""
        result = []
        for device_id in list(self.processes.keys()):
            status = self.get_status(device_id)
            result.append(status)
        return result
    
    def _is_process_running(self, process: subprocess.Popen) -> bool:
        """检查进程是否在运行"""
        if process.poll() is None:
            return True
        return False
    
    def get_cert_path(self) -> Path:
        """获取 mitmproxy 证书路径"""
        cert_file = self.mitm_cert_path / "mitmproxy-ca-cert.cer"
        if not cert_file.exists():
            logger.warning(f"证书文件不存在: {cert_file}")
        return cert_file
    
    def cleanup_all(self):
        """清理所有 mitmweb 进程"""
        logger.info("清理所有 mitmweb 进程")
        for device_id in list(self.processes.keys()):
            self.stop_mitmweb(device_id)


# 全局单例
_mitmproxy_service = None

def get_mitmproxy_service() -> MitmproxyService:
    """获取 mitmproxy 服务单例"""
    global _mitmproxy_service
    if _mitmproxy_service is None:
        _mitmproxy_service = MitmproxyService()
    return _mitmproxy_service
