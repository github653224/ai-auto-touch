"""
Frida API - SSL Pinning 绕过
"""

from fastapi import APIRouter
from app.services.frida_service import get_frida_service

router = APIRouter(prefix="/api/v1/frida", tags=["frida"])

frida_service = get_frida_service()


@router.get("/check")
async def check_frida():
    """检查 Frida 是否已安装"""
    installed = frida_service.check_frida_installed()
    return {
        "installed": installed,
        "message": "Frida is installed" if installed else "Frida not found. Run: pip install frida-tools"
    }


@router.get("/device/{device_id}/status")
async def check_frida_server_status(device_id: str):
    """检查设备上的 Frida Server 状态"""
    running = frida_service.check_frida_server_running(device_id)
    return {
        "device_id": device_id,
        "running": running,
        "message": "Frida server is running" if running else "Frida server not running"
    }


@router.post("/device/{device_id}/start-server")
async def start_frida_server(device_id: str):
    """启动设备上的 Frida Server"""
    result = frida_service.start_frida_server(device_id)
    return result


@router.post("/device/{device_id}/inject")
async def inject_ssl_unpinning(device_id: str, package_name: str):
    """
    向指定 APP 注入 SSL Unpinning 脚本
    
    Args:
        device_id: 设备 ID
        package_name: APP 包名，例如：
            - 今日头条: com.ss.android.article.news
            - 抖音: com.ss.android.ugc.aweme
            - 微信: com.tencent.mm
    """
    result = frida_service.inject_ssl_unpinning(device_id, package_name)
    return result


@router.post("/stop")
async def stop_injection():
    """停止 Frida 注入"""
    result = frida_service.stop_injection()
    return result
