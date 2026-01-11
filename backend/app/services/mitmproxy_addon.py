"""
Mitmproxy addon for capturing and storing HTTP/HTTPS traffic
"""

import logging
from mitmproxy import http
from typing import Dict, List
from datetime import datetime
import json
from pathlib import Path
import threading

logger = logging.getLogger(__name__)


class TrafficCapture:
    """Addon to capture HTTP/HTTPS traffic"""
    
    def __init__(self):
        self.flows: List[Dict] = []
        self.max_flows = 1000  # 最多保存 1000 条记录
        self.lock = threading.Lock()
        self.save_counter = 0  # 保存计数器
        self.save_interval = 10  # 每 10 个请求保存一次
        
        # 数据文件路径
        self.data_dir = Path.home() / ".mitmproxy" / "traffic_data"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.data_file = self.data_dir / "flows.json"
        
        # 加载已有数据
        self._load_flows()
    
    def _load_flows(self):
        """从文件加载流量数据"""
        try:
            if self.data_file.exists():
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    self.flows = json.load(f)
                logger.info(f"加载了 {len(self.flows)} 条流量记录")
        except Exception as e:
            logger.error(f"加载流量数据失败: {e}")
            self.flows = []
    
    def _save_flows(self):
        """保存流量数据到文件（异步，不阻塞）"""
        try:
            # 使用线程异步保存，避免阻塞主流程
            import threading
            
            def save_in_background():
                try:
                    with self.lock:
                        flows_copy = self.flows.copy()
                    with open(self.data_file, 'w', encoding='utf-8') as f:
                        json.dump(flows_copy, f, ensure_ascii=False)
                except Exception as e:
                    logger.error(f"后台保存流量数据失败: {e}")
            
            thread = threading.Thread(target=save_in_background, daemon=True)
            thread.start()
        except Exception as e:
            logger.error(f"启动保存线程失败: {e}")
    
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
                "request_headers": dict(flow.request.headers),
                "request_size": len(flow.request.content) if flow.request.content else 0,
                "status": None,
                "response_headers": None,
                "response_size": None,
                "duration": None,
            }
            
            with self.lock:
                # 保存到列表
                self.flows.append(flow_data)
                
                # 限制列表大小
                if len(self.flows) > self.max_flows:
                    self.flows.pop(0)
                
                # 增加计数器
                self.save_counter += 1
            
            # 每 N 个请求保存一次
            if self.save_counter >= self.save_interval:
                self.save_counter = 0
                self._save_flows()
                
        except Exception as e:
            logger.error(f"处理请求失败: {e}")
    
    def response(self, flow: http.HTTPFlow) -> None:
        """处理响应"""
        try:
            with self.lock:
                # 查找对应的请求记录
                for flow_data in reversed(self.flows):
                    if flow_data["id"] == flow.id:
                        # 更新响应信息
                        flow_data["status"] = flow.response.status_code
                        flow_data["response_headers"] = dict(flow.response.headers)
                        flow_data["response_size"] = len(flow.response.content) if flow.response.content else 0
                        
                        # 计算耗时
                        if flow.request.timestamp_start and flow.response.timestamp_end:
                            duration_ms = (flow.response.timestamp_end - flow.request.timestamp_start) * 1000
                            flow_data["duration"] = round(duration_ms, 2)
                        
                        break
                
                # 增加计数器
                self.save_counter += 1
            
            # 每 N 个响应保存一次
            if self.save_counter >= self.save_interval:
                self.save_counter = 0
                self._save_flows()
                    
        except Exception as e:
            logger.error(f"处理响应失败: {e}")
    
    def get_flows(self, limit: int = 100) -> List[Dict]:
        """获取最近的流量记录"""
        with self.lock:
            return self.flows[-limit:]
    
    def clear_flows(self):
        """清空流量记录"""
        with self.lock:
            self.flows.clear()
        self._save_flows()


# 全局实例
_traffic_capture = None


def get_traffic_capture() -> TrafficCapture:
    """获取全局 TrafficCapture 实例"""
    global _traffic_capture
    if _traffic_capture is None:
        _traffic_capture = TrafficCapture()
    return _traffic_capture


# Mitmproxy addon 入口
addons = [get_traffic_capture()]
