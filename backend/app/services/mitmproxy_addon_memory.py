"""
Mitmproxy addon - 内存存储版本（不写文件，避免卡顿）
"""

import logging
from mitmproxy import http
from datetime import datetime
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.services.traffic_store import get_traffic_store

logger = logging.getLogger(__name__)

# 获取全局存储实例
traffic_store = get_traffic_store()


class TrafficCapture:
    """Addon to capture HTTP/HTTPS traffic"""
    
    def request(self, flow: http.HTTPFlow) -> None:
        """处理请求"""
        try:
            # 构建 URL
            scheme = flow.request.scheme
            host = flow.request.host
            port = flow.request.port
            path = flow.request.path
            
            if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
                url = f"{scheme}://{host}{path}"
            else:
                url = f"{scheme}://{host}:{port}{path}"
            
            # 记录请求信息
            flow_data = {
                "id": flow.id,
                "timestamp": datetime.now().isoformat(),
                "timestamp_start": flow.timestamp_start,
                "method": flow.request.method,
                "url": url,
                "host": host,
                "port": port,
                "path": path,
                "scheme": scheme,
                "request_size": len(flow.request.content) if flow.request.content else 0,
                "request_headers": dict(flow.request.headers),
                "request_content": flow.request.text if flow.request.text else "",
                "status": None,
                "response_size": None,
                "response_headers": None,
                "response_content": None,
                "duration": None,
            }
            
            # 保存到内存
            traffic_store.add_flow(flow_data)
            
        except Exception as e:
            logger.error(f"处理请求失败: {e}")
    
    def response(self, flow: http.HTTPFlow) -> None:
        """处理响应"""
        try:
            # 计算耗时
            duration = None
            if flow.request.timestamp_start and flow.response.timestamp_end:
                duration_ms = (flow.response.timestamp_end - flow.request.timestamp_start) * 1000
                duration = round(duration_ms, 2)
            
            # 更新响应信息
            updates = {
                "status": flow.response.status_code,
                "response_size": len(flow.response.content) if flow.response.content else 0,
                "response_headers": dict(flow.response.headers),
                "response_content": flow.response.text if flow.response.text else "",
                "duration": duration,
                "timestamp_end": flow.response.timestamp_end,
            }
            
            traffic_store.update_flow(flow.id, updates)
                    
        except Exception as e:
            logger.error(f"处理响应失败: {e}")


# Mitmproxy addon 入口
addons = [TrafficCapture()]
