"""
手机控制服务
提供各种手机控制功能，包括点击、滑动、输入文本、按键等
"""
import asyncio
import re
from typing import Dict, Any, Optional, Tuple, List
from app.utils.adb_utils import run_adb_command, get_adb_path
from app.utils.logger_utils import logger


class PhoneControlService:
    """手机控制服务类"""
    
    def __init__(self):
        self.adb_path = get_adb_path()
    
    # ==================== 基础控制 ====================
    
    async def tap(self, device_id: str, x: int, y: int) -> Dict[str, Any]:
        """
        点击屏幕指定位置
        
        Args:
            device_id: 设备ID
            x: X坐标
            y: Y坐标
        """
        try:
            # 使用 motionevent 代替 tap，更快速
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(f"-s {device_id} shell input motionevent DOWN {x} {y}", wait=False)
            await asyncio.sleep(0.01)  # 短暂延迟
            await run_adb_command(f"-s {device_id} shell input motionevent UP {x} {y}", wait=False)
            logger.info(f"设备 {device_id}: 点击坐标 ({x}, {y})")
            return {
                "success": True,
                "action": "tap",
                "coordinates": {"x": x, "y": y},
                "message": f"已点击坐标 ({x}, {y})"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 点击失败 - {str(e)}")
            return {
                "success": False,
                "action": "tap",
                "error": str(e)
            }
    
    async def swipe(
        self, 
        device_id: str, 
        x1: int, 
        y1: int, 
        x2: int, 
        y2: int, 
        duration: int = 300
    ) -> Dict[str, Any]:
        """
        滑动屏幕
        
        Args:
            device_id: 设备ID
            x1, y1: 起始坐标
            x2, y2: 结束坐标
            duration: 滑动持续时间（毫秒）
        """
        try:
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(
                f"-s {device_id} shell input swipe {x1} {y1} {x2} {y2} {duration}",
                wait=False
            )
            logger.info(f"设备 {device_id}: 滑动 ({x1},{y1}) -> ({x2},{y2}), 持续 {duration}ms")
            return {
                "success": True,
                "action": "swipe",
                "from": {"x": x1, "y": y1},
                "to": {"x": x2, "y": y2},
                "duration": duration,
                "message": f"已滑动 ({x1},{y1}) -> ({x2},{y2})"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 滑动失败 - {str(e)}")
            return {
                "success": False,
                "action": "swipe",
                "error": str(e)
            }
    
    async def long_press(
        self, 
        device_id: str, 
        x: int, 
        y: int, 
        duration: int = 1000
    ) -> Dict[str, Any]:
        """
        长按屏幕指定位置
        
        Args:
            device_id: 设备ID
            x, y: 坐标
            duration: 长按持续时间（毫秒）
        """
        try:
            # 长按实际上是一个起点和终点相同的滑动
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(
                f"-s {device_id} shell input swipe {x} {y} {x} {y} {duration}",
                wait=False
            )
            logger.info(f"设备 {device_id}: 长按坐标 ({x}, {y}), 持续 {duration}ms")
            return {
                "success": True,
                "action": "long_press",
                "coordinates": {"x": x, "y": y},
                "duration": duration,
                "message": f"已长按坐标 ({x}, {y})"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 长按失败 - {str(e)}")
            return {
                "success": False,
                "action": "long_press",
                "error": str(e)
            }
    
    # ==================== 文本输入 ====================
    
    async def input_text(self, device_id: str, text: str) -> Dict[str, Any]:
        """
        输入文本
        
        Args:
            device_id: 设备ID
            text: 要输入的文本
        """
        try:
            # 转义特殊字符
            escaped_text = text.replace(' ', '%s').replace('&', '\\&')
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(
                f"-s {device_id} shell input text \"{escaped_text}\"",
                wait=False
            )
            logger.info(f"设备 {device_id}: 输入文本 '{text}'")
            return {
                "success": True,
                "action": "input_text",
                "text": text,
                "message": f"已输入文本: {text}"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 输入文本失败 - {str(e)}")
            return {
                "success": False,
                "action": "input_text",
                "error": str(e)
            }
    
    async def clear_text(self, device_id: str, count: int = 100) -> Dict[str, Any]:
        """
        清除文本（通过发送删除键）
        
        Args:
            device_id: 设备ID
            count: 删除次数
        """
        try:
            # 不等待命令完成，避免阻塞视频流
            for _ in range(min(count, 50)):  # 限制最多50次，避免过长
                await run_adb_command(f"-s {device_id} shell input keyevent KEYCODE_DEL", wait=False)
            logger.info(f"设备 {device_id}: 清除文本 {count} 次")
            return {
                "success": True,
                "action": "clear_text",
                "count": count,
                "message": f"已清除文本"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 清除文本失败 - {str(e)}")
            return {
                "success": False,
                "action": "clear_text",
                "error": str(e)
            }
    
    # ==================== 按键操作 ====================
    
    async def press_key(self, device_id: str, keycode: str) -> Dict[str, Any]:
        """
        按下按键
        
        Args:
            device_id: 设备ID
            keycode: 按键代码（如 KEYCODE_HOME, KEYCODE_BACK 等）
        """
        try:
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(
                f"-s {device_id} shell input keyevent {keycode}",
                wait=False
            )
            logger.info(f"设备 {device_id}: 按下按键 {keycode}")
            return {
                "success": True,
                "action": "press_key",
                "keycode": keycode,
                "message": f"已按下按键: {keycode}"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 按键失败 - {str(e)}")
            return {
                "success": False,
                "action": "press_key",
                "error": str(e)
            }
    
    async def press_home(self, device_id: str) -> Dict[str, Any]:
        """按下Home键"""
        return await self.press_key(device_id, "KEYCODE_HOME")
    
    async def press_back(self, device_id: str) -> Dict[str, Any]:
        """按下返回键"""
        return await self.press_key(device_id, "KEYCODE_BACK")
    
    async def press_menu(self, device_id: str) -> Dict[str, Any]:
        """按下菜单键"""
        return await self.press_key(device_id, "KEYCODE_MENU")
    
    async def press_power(self, device_id: str) -> Dict[str, Any]:
        """按下电源键"""
        return await self.press_key(device_id, "KEYCODE_POWER")
    
    async def press_volume_up(self, device_id: str) -> Dict[str, Any]:
        """按下音量+键"""
        return await self.press_key(device_id, "KEYCODE_VOLUME_UP")
    
    async def press_volume_down(self, device_id: str) -> Dict[str, Any]:
        """按下音量-键"""
        return await self.press_key(device_id, "KEYCODE_VOLUME_DOWN")
    
    async def press_enter(self, device_id: str) -> Dict[str, Any]:
        """按下回车键"""
        return await self.press_key(device_id, "KEYCODE_ENTER")
    
    async def press_app_switch(self, device_id: str) -> Dict[str, Any]:
        """按下应用切换键（最近任务）"""
        return await self.press_key(device_id, "KEYCODE_APP_SWITCH")
    
    # ==================== 屏幕控制 ====================
    
    async def get_screen_size(self, device_id: str) -> Dict[str, Any]:
        """
        获取屏幕尺寸
        """
        try:
            result = await run_adb_command(f"-s {device_id} shell wm size")
            # 解析输出: Physical size: 1080x2400
            match = re.search(r'(\d+)x(\d+)', result.stdout)
            if match:
                width, height = int(match.group(1)), int(match.group(2))
                logger.info(f"设备 {device_id}: 屏幕尺寸 {width}x{height}")
                return {
                    "success": True,
                    "width": width,
                    "height": height,
                    "message": f"屏幕尺寸: {width}x{height}"
                }
            else:
                raise ValueError("无法解析屏幕尺寸")
        except Exception as e:
            logger.error(f"设备 {device_id}: 获取屏幕尺寸失败 - {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def screenshot(self, device_id: str, save_path: str = "/sdcard/screenshot.png") -> Dict[str, Any]:
        """
        截图
        
        Args:
            device_id: 设备ID
            save_path: 保存路径（设备上的路径）
        """
        try:
            result = await run_adb_command(
                f"-s {device_id} shell screencap -p {save_path}"
            )
            logger.info(f"设备 {device_id}: 截图保存到 {save_path}")
            return {
                "success": True,
                "action": "screenshot",
                "path": save_path,
                "message": f"截图已保存到: {save_path}"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 截图失败 - {str(e)}")
            return {
                "success": False,
                "action": "screenshot",
                "error": str(e)
            }
    
    async def screen_on(self, device_id: str) -> Dict[str, Any]:
        """唤醒屏幕"""
        try:
            # 检查屏幕状态
            result = await run_adb_command(
                f"-s {device_id} shell dumpsys power | grep 'mHoldingDisplay'"
            )
            if 'false' in result.stdout.lower():
                # 屏幕已关闭，唤醒
                await self.press_power(device_id)
                await asyncio.sleep(0.5)
            
            logger.info(f"设备 {device_id}: 屏幕已唤醒")
            return {
                "success": True,
                "action": "screen_on",
                "message": "屏幕已唤醒"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 唤醒屏幕失败 - {str(e)}")
            return {
                "success": False,
                "action": "screen_on",
                "error": str(e)
            }
    
    async def screen_off(self, device_id: str) -> Dict[str, Any]:
        """关闭屏幕"""
        try:
            await self.press_power(device_id)
            logger.info(f"设备 {device_id}: 屏幕已关闭")
            return {
                "success": True,
                "action": "screen_off",
                "message": "屏幕已关闭"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 关闭屏幕失败 - {str(e)}")
            return {
                "success": False,
                "action": "screen_off",
                "error": str(e)
            }
    
    # ==================== 应用控制 ====================
    
    async def start_app(self, device_id: str, package_name: str, activity: Optional[str] = None) -> Dict[str, Any]:
        """
        启动应用
        
        Args:
            device_id: 设备ID
            package_name: 包名
            activity: Activity名称（可选）
        """
        try:
            if activity:
                cmd = f"-s {device_id} shell am start -n {package_name}/{activity}"
            else:
                cmd = f"-s {device_id} shell monkey -p {package_name} -c android.intent.category.LAUNCHER 1"
            
            result = await run_adb_command(cmd)
            logger.info(f"设备 {device_id}: 启动应用 {package_name}")
            return {
                "success": True,
                "action": "start_app",
                "package": package_name,
                "activity": activity,
                "message": f"已启动应用: {package_name}"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 启动应用失败 - {str(e)}")
            return {
                "success": False,
                "action": "start_app",
                "error": str(e)
            }
    
    async def stop_app(self, device_id: str, package_name: str) -> Dict[str, Any]:
        """
        停止应用
        
        Args:
            device_id: 设备ID
            package_name: 包名
        """
        try:
            result = await run_adb_command(
                f"-s {device_id} shell am force-stop {package_name}"
            )
            logger.info(f"设备 {device_id}: 停止应用 {package_name}")
            return {
                "success": True,
                "action": "stop_app",
                "package": package_name,
                "message": f"已停止应用: {package_name}"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 停止应用失败 - {str(e)}")
            return {
                "success": False,
                "action": "stop_app",
                "error": str(e)
            }
    
    async def clear_app_data(self, device_id: str, package_name: str) -> Dict[str, Any]:
        """
        清除应用数据
        
        Args:
            device_id: 设备ID
            package_name: 包名
        """
        try:
            result = await run_adb_command(
                f"-s {device_id} shell pm clear {package_name}"
            )
            logger.info(f"设备 {device_id}: 清除应用数据 {package_name}")
            return {
                "success": True,
                "action": "clear_app_data",
                "package": package_name,
                "message": f"已清除应用数据: {package_name}"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 清除应用数据失败 - {str(e)}")
            return {
                "success": False,
                "action": "clear_app_data",
                "error": str(e)
            }
    
    async def get_current_app(self, device_id: str) -> Dict[str, Any]:
        """
        获取当前运行的应用
        """
        try:
            result = await run_adb_command(
                f"-s {device_id} shell dumpsys window | grep mCurrentFocus"
            )
            # 解析输出: mCurrentFocus=Window{xxx u0 com.example.app/com.example.MainActivity}
            match = re.search(r'([a-zA-Z0-9.]+)/([a-zA-Z0-9.]+)', result.stdout)
            if match:
                package = match.group(1)
                activity = match.group(2)
                logger.info(f"设备 {device_id}: 当前应用 {package}/{activity}")
                return {
                    "success": True,
                    "package": package,
                    "activity": activity,
                    "message": f"当前应用: {package}"
                }
            else:
                return {
                    "success": False,
                    "message": "无法获取当前应用"
                }
        except Exception as e:
            logger.error(f"设备 {device_id}: 获取当前应用失败 - {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # ==================== 手势操作 ====================
    
    async def scroll_up(self, device_id: str, distance: int = 500) -> Dict[str, Any]:
        """向上滚动"""
        screen_size = await self.get_screen_size(device_id)
        if not screen_size.get("success"):
            return screen_size
        
        width = screen_size["width"]
        height = screen_size["height"]
        x = width // 2
        y1 = height * 2 // 3
        y2 = y1 - distance
        
        return await self.swipe(device_id, x, y1, x, y2, 300)
    
    async def scroll_down(self, device_id: str, distance: int = 500) -> Dict[str, Any]:
        """向下滚动"""
        screen_size = await self.get_screen_size(device_id)
        if not screen_size.get("success"):
            return screen_size
        
        width = screen_size["width"]
        height = screen_size["height"]
        x = width // 2
        y1 = height // 3
        y2 = y1 + distance
        
        return await self.swipe(device_id, x, y1, x, y2, 300)
    
    async def scroll_left(self, device_id: str, distance: int = 500) -> Dict[str, Any]:
        """向左滚动"""
        screen_size = await self.get_screen_size(device_id)
        if not screen_size.get("success"):
            return screen_size
        
        width = screen_size["width"]
        height = screen_size["height"]
        y = height // 2
        x1 = width * 2 // 3
        x2 = x1 - distance
        
        return await self.swipe(device_id, x1, y, x2, y, 300)
    
    async def scroll_right(self, device_id: str, distance: int = 500) -> Dict[str, Any]:
        """向右滚动"""
        screen_size = await self.get_screen_size(device_id)
        if not screen_size.get("success"):
            return screen_size
        
        width = screen_size["width"]
        height = screen_size["height"]
        y = height // 2
        x1 = width // 3
        x2 = x1 + distance
        
        return await self.swipe(device_id, x1, y, x2, y, 300)
    
    # ==================== 系统操作 ====================
    
    async def unlock_screen(self, device_id: str) -> Dict[str, Any]:
        """解锁屏幕（向上滑动）"""
        try:
            # 先唤醒屏幕
            await self.screen_on(device_id)
            await asyncio.sleep(0.5)
            
            # 向上滑动解锁
            screen_size = await self.get_screen_size(device_id)
            if screen_size.get("success"):
                width = screen_size["width"]
                height = screen_size["height"]
                x = width // 2
                y1 = height * 4 // 5
                y2 = height // 5
                await self.swipe(device_id, x, y1, x, y2, 500)
            
            logger.info(f"设备 {device_id}: 解锁屏幕")
            return {
                "success": True,
                "action": "unlock_screen",
                "message": "屏幕已解锁"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 解锁屏幕失败 - {str(e)}")
            return {
                "success": False,
                "action": "unlock_screen",
                "error": str(e)
            }
    
    async def open_notification(self, device_id: str) -> Dict[str, Any]:
        """打开通知栏"""
        try:
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(
                f"-s {device_id} shell cmd statusbar expand-notifications",
                wait=False
            )
            logger.info(f"设备 {device_id}: 打开通知栏")
            return {
                "success": True,
                "action": "open_notification",
                "message": "通知栏已打开"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 打开通知栏失败 - {str(e)}")
            return {
                "success": False,
                "action": "open_notification",
                "error": str(e)
            }
    
    async def open_quick_settings(self, device_id: str) -> Dict[str, Any]:
        """打开快捷设置"""
        try:
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(
                f"-s {device_id} shell cmd statusbar expand-settings",
                wait=False
            )
            logger.info(f"设备 {device_id}: 打开快捷设置")
            return {
                "success": True,
                "action": "open_quick_settings",
                "message": "快捷设置已打开"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 打开快捷设置失败 - {str(e)}")
            return {
                "success": False,
                "action": "open_quick_settings",
                "error": str(e)
            }
    
    async def close_notification(self, device_id: str) -> Dict[str, Any]:
        """关闭通知栏"""
        try:
            # 不等待命令完成，避免阻塞视频流
            await run_adb_command(
                f"-s {device_id} shell cmd statusbar collapse",
                wait=False
            )
            logger.info(f"设备 {device_id}: 关闭通知栏")
            return {
                "success": True,
                "action": "close_notification",
                "message": "通知栏已关闭"
            }
        except Exception as e:
            logger.error(f"设备 {device_id}: 关闭通知栏失败 - {str(e)}")
            return {
                "success": False,
                "action": "close_notification",
                "error": str(e)
            }


# 全局实例
phone_control_service = PhoneControlService()
