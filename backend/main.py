import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from app.api import device_api, ai_api, websocket_api, ai_websocket_api, phone_control_api, mitmproxy_api, frida_api, device_lock_api
from app.api.video_stream_api import sio, get_stream_status, reset_all_streams
from app.core.config import settings

# 创建FastAPI应用
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 集成 Socket.IO（用于视频流）
socket_app = socketio.ASGIApp(sio, app)

# 注册路由
app.include_router(device_api.router, prefix=settings.API_V1_STR + "/devices", tags=["设备管理"])
app.include_router(ai_api.router, prefix=settings.API_V1_STR + "/ai", tags=["AI控制"])
app.include_router(phone_control_api.router, prefix=settings.API_V1_STR + "/control", tags=["手机控制"])
app.include_router(websocket_api.router, prefix=settings.API_V1_STR + "/ws", tags=["实时通信"])
app.include_router(ai_websocket_api.router, prefix=settings.API_V1_STR + "/ws", tags=["AI实时日志"])
app.include_router(mitmproxy_api.router, tags=["mitmproxy 抓包"])
app.include_router(frida_api.router, tags=["Frida SSL Unpinning"])
app.include_router(device_lock_api.router, tags=["设备锁定"])

# 根路由
@app.get("/")
async def root():
    return {
        "message": "AI 驱动设备自动化平台 API 服务",
        "docs_url": "/docs",
        "version": settings.VERSION
    }


# 调试端点：获取视频流状态
@app.get("/api/v1/debug/stream-status")
async def debug_stream_status():
    """获取当前视频流状态（用于调试）"""
    return get_stream_status()


# 调试端点：重置所有视频流
@app.post("/api/v1/debug/reset-streams")
async def debug_reset_streams():
    """重置所有视频流（用于调试）"""
    reset_all_streams()
    return {"message": "All streams reset"}


if __name__ == "__main__":
    uvicorn.run(
        "main:socket_app",  # 使用 socket_app 而不是 app
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS
    )

