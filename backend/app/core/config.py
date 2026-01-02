from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    # 项目基本配置
    PROJECT_NAME: str = "群控手机平台"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8001))  # 默认8001，避免与AI模型服务(8000)冲突
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"
    WORKERS: int = int(os.getenv("WORKERS", 1))
    
    # ADB配置
    ADB_PATH: str = os.getenv("ADB_PATH", "adb")
    SCRCPY_PATH: str = os.getenv("SCRCPY_PATH", "scrcpy")
    
    # Open-AutoGLM配置
    AUTOGLM_BASE_URL: str = os.getenv("AUTOGLM_BASE_URL", "http://localhost:8000/v1")
    AUTOGLM_MODEL_NAME: str = os.getenv("AUTOGLM_MODEL_NAME", "autoglm-phone-9b")
    AUTOGLM_API_KEY: str = os.getenv("AUTOGLM_API_KEY", "EMPTY")
    AUTOGLM_MAX_STEPS: int = int(os.getenv("AUTOGLM_MAX_STEPS", 100))
    
    # 设备配置
    MAX_DEVICES: int = int(os.getenv("MAX_DEVICES", 100))
    SCREENSHOT_INTERVAL: int = int(os.getenv("SCREENSHOT_INTERVAL", 1))  # 截图间隔(秒)

settings = Settings()

