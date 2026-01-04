@echo off
chcp 65001 >nul
REM 前端启动脚本 (Windows)
REM AI 驱动设备自动化平台

echo ==========================================
echo   AI 驱动设备自动化平台 - 前端服务
echo ==========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i

echo ✅ Node.js 版本: %NODE_VERSION%
echo ✅ npm 版本: %NPM_VERSION%
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    echo.
)

REM 启动前端服务
echo 🚀 启动前端开发服务器...
echo 📍 访问地址: http://localhost:3002
echo.
echo 💡 提示: 按 Ctrl+C 停止服务
echo ==========================================
echo.

npm run dev -- --host --port 3002 --clearScreen false
