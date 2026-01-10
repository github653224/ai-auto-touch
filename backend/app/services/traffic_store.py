"""
流量数据存储 - 使用内存存储，避免文件 I/O
"""

from typing import List, Dict, Optional
from datetime import datetime
import threading


class TrafficStore:
    """流量数据存储（单例）"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.flows: List[Dict] = []
        self.max_flows = 1000
        self.data_lock = threading.Lock()
        self._initialized = True
    
    def add_flow(self, flow_data: Dict):
        """添加流量记录"""
        with self.data_lock:
            self.flows.append(flow_data)
            if len(self.flows) > self.max_flows:
                self.flows.pop(0)
    
    def update_flow(self, flow_id: str, updates: Dict):
        """更新流量记录"""
        with self.data_lock:
            for flow in reversed(self.flows):
                if flow.get("id") == flow_id:
                    flow.update(updates)
                    break
    
    def get_flows(self, limit: int = 100) -> List[Dict]:
        """获取最近的流量记录"""
        with self.data_lock:
            return self.flows[-limit:] if len(self.flows) > limit else self.flows.copy()
    
    def get_flow(self, flow_id: str) -> Optional[Dict]:
        """获取单个流量记录"""
        with self.data_lock:
            for flow in reversed(self.flows):
                if flow.get("id") == flow_id:
                    return flow.copy()
        return None
    
    def clear(self):
        """清空所有流量记录"""
        with self.data_lock:
            self.flows.clear()
    
    def get_count(self) -> int:
        """获取流量记录数量"""
        with self.data_lock:
            return len(self.flows)


# 全局单例
def get_traffic_store() -> TrafficStore:
    """获取流量存储单例"""
    return TrafficStore()
