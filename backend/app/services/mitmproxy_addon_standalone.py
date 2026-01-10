"""
Mitmproxy addon - 独立版本（不依赖其他模块）
使用全局变量存储，通过文件共享数据
"""

import logging
from mitmproxy import http
from datetime import datetime
import json
from pathlib import Path
import threading

logger = logging.getLogger(__name__)

# 全局流量存储
FLOWS = []
FLOWS_LOCK = threading.Lock()
MAX_FLOWS = 1000

# 数据文件路径（用于与 API 共享数据）
DATA_FILE_SIMPLE = Path.home() / ".mitmproxy" / "flows_simple.json"  # 简化版，用于列表
DATA_FILE_FULL = Path.home() / ".mitmproxy" / "flows_full.json"  # 完整版，用于详情
DATA_FILE_SIMPLE.parent.mkdir(parents=True, exist_ok=True)


def save_flows_async():
    """异步保存流量数据（不阻塞）"""
    def save():
        try:
            with FLOWS_LOCK:
                flows_copy = FLOWS.copy()
            
            # 保存简化版（用于列表显示）
            simplified = []
            for flow in flows_copy[-100:]:  # 只保存最近 100 条
                simplified.append({
                    "id": flow.get("id"),
                    "timestamp": flow.get("timestamp"),
                    "method": flow.get("method"),
                    "url": flow.get("url"),
                    "host": flow.get("host"),
                    "port": flow.get("port"),
                    "path": flow.get("path"),
                    "scheme": flow.get("scheme"),
                    "request_size": flow.get("request_size"),
                    "status": flow.get("status"),
                    "response_size": flow.get("response_size"),
                    "duration": flow.get("duration"),
                })
            
            with open(DATA_FILE_SIMPLE, 'w', encoding='utf-8') as f:
                json.dump(simplified, f)
            
            # 保存完整版（用于详情查看）
            with open(DATA_FILE_FULL, 'w', encoding='utf-8') as f:
                json.dump(flows_copy[-100:], f)
                
        except Exception as e:
            logger.error(f"保存流量数据失败: {e}")
    
    # 在后台线程中保存
    thread = threading.Thread(target=save, daemon=True)
    thread.start()


class TrafficCapture:
    """Addon to capture HTTP/HTTPS traffic"""
    
    def __init__(self):
        self.save_counter = 0
    
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
                "request_content": flow.request.text[:1000] if flow.request.text else "",  # 只保存前 1000 字符
                "status": None,
                "response_size": None,
                "response_headers": None,
                "response_content": None,
                "duration": None,
            }
            
            # 保存到全局列表
            with FLOWS_LOCK:
                FLOWS.append(flow_data)
                if len(FLOWS) > MAX_FLOWS:
                    FLOWS.pop(0)
            
            # 每 10 个请求保存一次
            self.save_counter += 1
            if self.save_counter >= 10:
                self.save_counter = 0
                save_flows_async()
            
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
            with FLOWS_LOCK:
                for flow_data in reversed(FLOWS):
                    if flow_data.get("id") == flow.id:
                        flow_data["status"] = flow.response.status_code
                        flow_data["response_size"] = len(flow.response.content) if flow.response.content else 0
                        flow_data["response_headers"] = dict(flow.response.headers)
                        flow_data["response_content"] = flow.response.text[:1000] if flow.response.text else ""  # 只保存前 1000 字符
                        flow_data["duration"] = duration
                        flow_data["timestamp_end"] = flow.response.timestamp_end
                        break
            
            # 每 10 个响应保存一次
            self.save_counter += 1
            if self.save_counter >= 10:
                self.save_counter = 0
                save_flows_async()
                    
        except Exception as e:
            logger.error(f"处理响应失败: {e}")


# Mitmproxy addon 入口
addons = [TrafficCapture()]
