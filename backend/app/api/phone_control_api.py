"""
手机控制 API
提供手机控制的 HTTP 接口
"""
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.phone_control_service import phone_control_service

router = APIRouter()


# ==================== 请求模型 ====================

class TapRequest(BaseModel):
    x: int
    y: int


class SwipeRequest(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int
    duration: int = 300


class LongPressRequest(BaseModel):
    x: int
    y: int
    duration: int = 1000


class TextInputRequest(BaseModel):
    text: str


class KeyPressRequest(BaseModel):
    keycode: str


class AppRequest(BaseModel):
    package_name: str
    activity: Optional[str] = None


class ScrollRequest(BaseModel):
    distance: int = 500


# ==================== 基础控制 ====================

@router.post("/{device_id}/tap")
async def tap(device_id: str, request: TapRequest):
    """点击屏幕指定位置"""
    try:
        # 创建后台任务，不等待完成
        asyncio.create_task(phone_control_service.tap(device_id, request.x, request.y))
        # 立即返回，不阻塞
        return {
            "success": True,
            "action": "tap",
            "coordinates": {"x": request.x, "y": request.y},
            "message": f"点击命令已发送 ({request.x}, {request.y})"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/swipe")
async def swipe(device_id: str, request: SwipeRequest):
    """滑动屏幕"""
    try:
        asyncio.create_task(phone_control_service.swipe(
            device_id, 
            request.x1, 
            request.y1, 
            request.x2, 
            request.y2, 
            request.duration
        ))
        return {
            "success": True,
            "action": "swipe",
            "message": "滑动命令已发送"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/long-press")
async def long_press(device_id: str, request: LongPressRequest):
    """长按屏幕指定位置"""
    try:
        result = await phone_control_service.long_press(
            device_id, 
            request.x, 
            request.y, 
            request.duration
        )
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 文本输入 ====================

@router.post("/{device_id}/input-text")
async def input_text(device_id: str, request: TextInputRequest):
    """输入文本"""
    try:
        asyncio.create_task(phone_control_service.input_text(device_id, request.text))
        return {"success": True, "action": "input_text", "message": "文本输入命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/clear-text")
async def clear_text(device_id: str, count: int = 100):
    """清除文本"""
    try:
        asyncio.create_task(phone_control_service.clear_text(device_id, count))
        return {"success": True, "action": "clear_text", "message": "清除文本命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 按键操作 ====================

@router.post("/{device_id}/press-key")
async def press_key(device_id: str, request: KeyPressRequest):
    """按下按键"""
    try:
        result = await phone_control_service.press_key(device_id, request.keycode)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-home")
async def press_home(device_id: str):
    """按下Home键"""
    try:
        asyncio.create_task(phone_control_service.press_home(device_id))
        return {"success": True, "action": "press_home", "message": "Home键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-back")
async def press_back(device_id: str):
    """按下返回键"""
    try:
        asyncio.create_task(phone_control_service.press_back(device_id))
        return {"success": True, "action": "press_back", "message": "返回键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-menu")
async def press_menu(device_id: str):
    """按下菜单键"""
    try:
        asyncio.create_task(phone_control_service.press_menu(device_id))
        return {"success": True, "action": "press_menu", "message": "菜单键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-power")
async def press_power(device_id: str):
    """按下电源键"""
    try:
        asyncio.create_task(phone_control_service.press_power(device_id))
        return {"success": True, "action": "press_power", "message": "电源键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-volume-up")
async def press_volume_up(device_id: str):
    """按下音量+键"""
    try:
        asyncio.create_task(phone_control_service.press_volume_up(device_id))
        return {"success": True, "action": "press_volume_up", "message": "音量+键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-volume-down")
async def press_volume_down(device_id: str):
    """按下音量-键"""
    try:
        asyncio.create_task(phone_control_service.press_volume_down(device_id))
        return {"success": True, "action": "press_volume_down", "message": "音量-键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-enter")
async def press_enter(device_id: str):
    """按下回车键"""
    try:
        asyncio.create_task(phone_control_service.press_enter(device_id))
        return {"success": True, "action": "press_enter", "message": "回车键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/press-app-switch")
async def press_app_switch(device_id: str):
    """按下应用切换键（最近任务）"""
    try:
        asyncio.create_task(phone_control_service.press_app_switch(device_id))
        return {"success": True, "action": "press_app_switch", "message": "应用切换键命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 屏幕控制 ====================

@router.get("/{device_id}/screen-size")
async def get_screen_size(device_id: str):
    """获取屏幕尺寸"""
    try:
        result = await phone_control_service.get_screen_size(device_id)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/screenshot")
async def screenshot(device_id: str, save_path: str = "/sdcard/screenshot.png"):
    """截图"""
    try:
        result = await phone_control_service.screenshot(device_id, save_path)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/screen-on")
async def screen_on(device_id: str):
    """唤醒屏幕"""
    try:
        result = await phone_control_service.screen_on(device_id)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/screen-off")
async def screen_off(device_id: str):
    """关闭屏幕"""
    try:
        result = await phone_control_service.screen_off(device_id)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 应用控制 ====================

@router.post("/{device_id}/start-app")
async def start_app(device_id: str, request: AppRequest):
    """启动应用"""
    try:
        result = await phone_control_service.start_app(
            device_id, 
            request.package_name, 
            request.activity
        )
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/stop-app")
async def stop_app(device_id: str, request: AppRequest):
    """停止应用"""
    try:
        result = await phone_control_service.stop_app(device_id, request.package_name)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/clear-app-data")
async def clear_app_data(device_id: str, request: AppRequest):
    """清除应用数据"""
    try:
        result = await phone_control_service.clear_app_data(device_id, request.package_name)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{device_id}/current-app")
async def get_current_app(device_id: str):
    """获取当前运行的应用"""
    try:
        result = await phone_control_service.get_current_app(device_id)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "操作失败"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 手势操作 ====================

@router.post("/{device_id}/scroll-up")
async def scroll_up(device_id: str, request: ScrollRequest):
    """向上滚动"""
    try:
        asyncio.create_task(phone_control_service.scroll_up(device_id, request.distance))
        return {"success": True, "action": "scroll_up", "message": "向上滚动命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/scroll-down")
async def scroll_down(device_id: str, request: ScrollRequest):
    """向下滚动"""
    try:
        asyncio.create_task(phone_control_service.scroll_down(device_id, request.distance))
        return {"success": True, "action": "scroll_down", "message": "向下滚动命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/scroll-left")
async def scroll_left(device_id: str, request: ScrollRequest):
    """向左滚动"""
    try:
        asyncio.create_task(phone_control_service.scroll_left(device_id, request.distance))
        return {"success": True, "action": "scroll_left", "message": "向左滚动命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/scroll-right")
async def scroll_right(device_id: str, request: ScrollRequest):
    """向右滚动"""
    try:
        asyncio.create_task(phone_control_service.scroll_right(device_id, request.distance))
        return {"success": True, "action": "scroll_right", "message": "向右滚动命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 系统操作 ====================

@router.post("/{device_id}/unlock-screen")
async def unlock_screen(device_id: str):
    """解锁屏幕（向上滑动）"""
    try:
        asyncio.create_task(phone_control_service.unlock_screen(device_id))
        return {"success": True, "action": "unlock_screen", "message": "向上滑动命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/swipe-down")
async def swipe_down(device_id: str):
    """向下滑动屏幕"""
    try:
        asyncio.create_task(phone_control_service.swipe_down(device_id))
        return {"success": True, "action": "swipe_down", "message": "向下滑动命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/open-notification")
async def open_notification(device_id: str):
    """打开通知栏"""
    try:
        asyncio.create_task(phone_control_service.open_notification(device_id))
        return {"success": True, "action": "open_notification", "message": "打开通知栏命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/open-quick-settings")
async def open_quick_settings(device_id: str):
    """打开快捷设置"""
    try:
        asyncio.create_task(phone_control_service.open_quick_settings(device_id))
        return {"success": True, "action": "open_quick_settings", "message": "打开快捷设置命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{device_id}/close-notification")
async def close_notification(device_id: str):
    """关闭通知栏"""
    try:
        asyncio.create_task(phone_control_service.close_notification(device_id))
        return {"success": True, "action": "close_notification", "message": "关闭通知栏命令已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
