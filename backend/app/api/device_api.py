from fastapi import APIRouter, HTTPException
from app.models.device_models import DeviceInfo, DeviceCommand
from app.services.device_service import DeviceManager

router = APIRouter()
device_manager = DeviceManager()

@router.get("/", response_model=list[DeviceInfo])
async def get_all_devices():
    """获取所有已连接设备"""
    try:
        devices = await device_manager.get_all_devices()
        return devices
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scan")
async def scan_devices():
    """扫描可用设备"""
    try:
        devices = await device_manager.scan_devices()
        return {"success": True, "devices": devices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{device_id}/connect")
async def connect_device(device_id: str):
    """连接指定设备"""
    try:
        result = await device_manager.connect_device(device_id)
        return {"success": result, "device_id": device_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{device_id}/disconnect")
async def disconnect_device(device_id: str):
    """断开指定设备"""
    try:
        result = await device_manager.disconnect_device(device_id)
        return {"success": result, "device_id": device_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{device_id}/command")
async def execute_device_command(device_id: str, command: DeviceCommand):
    """执行ADB命令"""
    try:
        result = await device_manager.execute_adb_command(device_id, command.command)
        return {"success": True, "result": result, "device_id": device_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

