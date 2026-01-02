import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import device_api, ai_api, websocket_api, ai_websocket_api, phone_control_api
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

# 注册路由
app.include_router(device_api.router, prefix=settings.API_V1_STR + "/devices", tags=["设备管理"])
app.include_router(ai_api.router, prefix=settings.API_V1_STR + "/ai", tags=["AI控制"])
app.include_router(phone_control_api.router, prefix=settings.API_V1_STR + "/control", tags=["手机控制"])
app.include_router(websocket_api.router, prefix=settings.API_V1_STR + "/ws", tags=["实时通信"])
app.include_router(ai_websocket_api.router, prefix=settings.API_V1_STR + "/ws", tags=["AI实时日志"])

# 根路由
@app.get("/")
async def root():
    return {
        "message": "群控手机平台 API 服务",
        "docs_url": "/docs",
        "version": settings.VERSION
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS
    )

