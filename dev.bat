@echo off
chcp 65001 >nul 2>&1
title Stock ^& Logis - Dev Server
cd /d c:\Claude_Project

echo ========================================
echo   Stock ^& Logis - Dev Server
echo   Less Stock, More Profit
echo ========================================
echo.

:: Node.js 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다.
    pause
    exit /b 1
)

:: node_modules 확인
if not exist "node_modules" (
    echo [INFO] node_modules가 없습니다. 패키지 설치 중...
    npm install
    echo.
)

:: .env.local 확인
if not exist ".env.local" (
    echo [WARN] .env.local 파일이 없습니다.
    echo        .env.local.example을 참고하여 생성해 주세요.
    echo.
)

echo [INFO] Dev server 시작 중...
echo [INFO] http://localhost:3000
echo.

:: 3초 후 브라우저 자동 열기
start /b "" cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"

npm run dev
pause
