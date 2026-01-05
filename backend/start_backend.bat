@echo off
chcp 65001 >nul
REM 后端启动脚本 (Windows)
REM AI 驱动设备自动化平台

echo ==========================================
echo   AI 驱动设备自动化平台 - 后端服务
echo ==========================================
echo.

REM 配置项
set PORT=8001
set CONDA_ENV_NAME=ai-auto-touch

REM 检查 Python 是否安装
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Python
    echo 请先安装 Python: https://www.python.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✅ Python 版本: %PYTHON_VERSION%
echo.

REM 检查端口占用
echo 检查端口 %PORT%...
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo ⚠️  警告: 端口 %PORT% 已被占用
    
    REM 获取占用端口的进程 PID
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do set PID=%%a
    
    echo    进程 PID: %PID%
    
    REM 获取进程名称
    for /f "tokens=1" %%b in ('tasklist /FI "PID eq %PID%" /NH') do set PROCESS_NAME=%%b
    echo    进程名称: %PROCESS_NAME%
    echo.
    echo 请选择操作:
    echo   1) 自动停止并重启
    echo   2) 手动处理
    echo   3) 取消启动
    echo.
    set /p choice="请输入选项 [1-3]: "
    
    if "%choice%"=="1" (
        echo 正在停止进程 %PID%...
        taskkill /PID %PID% /F >nul 2>nul
        timeout /t 2 /nobreak >nul
        echo ✅ 已停止现有服务
    ) else if "%choice%"=="2" (
        echo.
        echo 请手动停止占用端口的进程:
        echo   taskkill /PID %PID% /F
        pause
        exit /b 1
    ) else (
        echo 取消启动
        exit /b 1
    )
) else (
    echo ✅ 端口 %PORT% 可用
)
echo.

REM 检查 conda 是否安装
where conda >nul 2>nul
if %errorlevel% equ 0 (
    echo 检测到 conda，尝试激活环境: %CONDA_ENV_NAME%...
    call conda activate %CONDA_ENV_NAME% 2>nul
    if %errorlevel% equ 0 (
        echo ✅ 已激活 conda 环境: %CONDA_ENV_NAME%
    ) else (
        echo ⚠️  conda 环境 %CONDA_ENV_NAME% 不存在
        echo 提示: 创建环境: conda create -n %CONDA_ENV_NAME% python=3.10
        echo 将使用系统默认 Python 环境
    )
) else (
    REM 检查是否有虚拟环境
    if exist "venv\Scripts\activate.bat" (
        echo 检测到虚拟环境，激活中...
        call venv\Scripts\activate.bat
        echo ✅ 已激活虚拟环境
    ) else (
        echo 使用系统默认 Python 环境
        echo 提示: 建议创建虚拟环境: python -m venv venv
    )
)
echo.

REM 检查 AI 模型服务配置
echo 检查 AI 模型服务配置...
if exist ".env" (
    REM 简单检查配置文件
    findstr /C:"AUTOGLM_BASE_URL" .env >nul 2>nul
    if %errorlevel% equ 0 (
        echo ✅ 配置文件已存在
    ) else (
        echo ⚠️  警告: .env 文件可能不完整
    )
) else (
    echo ⚠️  警告: 未找到 .env 文件
    echo 提示: 复制 .env.example 并配置: copy .env.example .env
    echo.
    set /p continue="是否继续启动? (y/n): "
    if /i not "%continue%"=="y" exit /b 1
)
echo.

REM 检查并安装依赖
echo 检查 Python 依赖...
python -c "import fastapi" 2>nul
if %errorlevel% neq 0 (
    echo 安装依赖...
    pip install -r requirements.txt
) else (
    echo ✅ 依赖已安装
)
echo.

REM 启动服务
echo ==========================================
echo 启动后端服务
echo ==========================================
echo 服务地址: http://localhost:%PORT%
echo API 文档: http://localhost:%PORT%/docs
echo 交互式文档: http://localhost:%PORT%/redoc
echo.
echo 按 Ctrl+C 停止服务
echo ==========================================
echo.

REM 启动后端服务
uvicorn main:socket_app --host 0.0.0.0 --port %PORT% --reload
