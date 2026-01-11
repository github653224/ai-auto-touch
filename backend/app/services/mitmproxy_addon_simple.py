"""
Mitmproxy addon - 简化版，只记录在内存中
"""

import logging
from mitmproxy import http
from typing import Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)


class TrafficCapture:
    """Addon to capture HTTP/HTTPS traffic"""
    
    def __init__(self):
        self.flows: List[Dict] = []
        self.max_flows = 500  # 最多保存 500 条记录
    
    def request(self, flow: http.HTTPFlow) -> None:
        """处理请求"""
        try:
            # 记录请求信息
            flow_data = {
                "id": flow.id,
                "timestamp": datetime.now().isoformat(),
                "method": flow.request.method,
                "url": flow.request.pretty_url,
                "host": flow.request.host,
                "port": flow.request.port,
                "path": flow.request.path,
                "scheme": flow.request.scheme,
                "request_size": len(flow.request.content) if flow.request.content else 0,
                "status": None,
                "response_size": None,
                "duration": None,
            }
            
            # 保存到列表
            self.flows.append(flow_data)
            
            # 限制列表大小
            if len(self.flows) > self.max_flows:
                self.flows.pop(0)
                
        except Exception as e:
            logger.error(f"处理请求失败: {e}")
    
    def response(self, flow: http.HTTPFlow) -> None:
        """处理响应"""
        try:
            # 查找对应的请求记录
            for flow_data in reversed(self.flows):
                if flow_data["id"] == flow.id:
                    # 更新响应信息
                    flow_data["status"] = flow.response.status_code
                    flow_data["response_size"] = len(flow.response.content) if flow.response.content else 0
                    
                    # 计算耗时
                    if flow.request.timestamp_start and flow.response.timestamp_end:
                        duration_ms = (flow.response.timestamp_end - flow.request.timestamp_start) * 1000
                        flow_data["duration"] = round(duration_ms, 2)
                    
                    break
                    
        except Exception as e:
            logger.error(f"处理响应失败: {e}")


# 全局实例
_traffic_capture = TrafficCapture()


# Mitmproxy addon 入口
addons = [_traffic_capture]
