#!/usr/bin/env python3
"""
注册 mitmweb 到反向代理
"""

import sys
import requests
import argparse

def register_mitmweb(device_id: str, proxy_port: int, web_port: int, api_url: str = "http://localhost:8000"):
    """注册 mitmweb 到反向代理"""
    
    # 导入 API 模块
    sys.path.insert(0, '/Users/rock/Documents/ai-auto-touch/backend')
    from app.api.mitmproxy_api import register_mitmweb as register_func
    
    # 注册
    register_func(device_id, proxy_port, web_port)
    
    print(f"✅ 已注册 mitmweb:")
    print(f"   设备 ID: {device_id}")
    print(f"   代理端口: {proxy_port}")
    print(f"   Web 端口: {web_port}")
    print(f"")
    print(f"📝 访问地址:")
    print(f"   反向代理: {api_url}/api/v1/mitmproxy/proxy/{device_id}/")
    print(f"   状态检查: {api_url}/api/v1/mitmproxy/device/{device_id}/status")
    print(f"")
    print(f"🎯 在前端使用:")
    print(f'   <iframe src="{api_url}/api/v1/mitmproxy/proxy/{device_id}/" />')


def check_status(device_id: str, api_url: str = "http://localhost:8000"):
    """检查 mitmweb 状态"""
    try:
        response = requests.get(f"{api_url}/api/v1/mitmproxy/device/{device_id}/status", timeout=5)
        data = response.json()
        
        print(f"设备状态: {data.get('status')}")
        if data.get('status') == 'online':
            print(f"✅ mitmweb 在线")
            print(f"   代理端口: {data.get('proxy_port')}")
            print(f"   Web 端口: {data.get('web_port')}")
            print(f"   代理 URL: {api_url}{data.get('proxy_url')}")
        else:
            print(f"❌ mitmweb 离线")
    except Exception as e:
        print(f"❌ 检查失败: {e}")


def list_devices(api_url: str = "http://localhost:8000"):
    """列出所有设备"""
    try:
        response = requests.get(f"{api_url}/api/v1/mitmproxy/devices", timeout=5)
        data = response.json()
        
        devices = data.get('devices', [])
        if not devices:
            print("没有已注册的设备")
            return
        
        print(f"已注册的设备 ({len(devices)}):")
        for device in devices:
            print(f"")
            print(f"  设备 ID: {device['device_id']}")
            print(f"  代理端口: {device['proxy_port']}")
            print(f"  Web 端口: {device['web_port']}")
            print(f"  代理 URL: {api_url}{device['proxy_url']}")
    except Exception as e:
        print(f"❌ 获取设备列表失败: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="管理 mitmweb 反向代理")
    parser.add_argument("action", choices=["register", "status", "list"], help="操作类型")
    parser.add_argument("--device-id", default="test-device", help="设备 ID")
    parser.add_argument("--proxy-port", type=int, default=8091, help="代理端口")
    parser.add_argument("--web-port", type=int, default=8191, help="Web 端口")
    parser.add_argument("--api-url", default="http://localhost:8000", help="API 地址")
    
    args = parser.parse_args()
    
    if args.action == "register":
        register_mitmweb(args.device_id, args.proxy_port, args.web_port, args.api_url)
    elif args.action == "status":
        check_status(args.device_id, args.api_url)
    elif args.action == "list":
        list_devices(args.api_url)
