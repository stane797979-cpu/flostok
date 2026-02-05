@echo off
cd /d "%~dp0"
cls

echo ============================================================
echo           호무로 스마트 발주 시스템
echo ============================================================
echo.
echo [1단계] 시스템 시작 중...
echo.
echo 잠깐! 중요한 안내:
echo  - 이 창을 절대 닫지 마세요!
echo  - 브라우저가 자동으로 열립니다
echo  - 10~20초 정도 기다려주세요
echo.
echo [2단계] 크롬 브라우저 자동 실행...
echo.

timeout /t 3 /nobreak > nul

REM 크롬 실행 (여러 경로 시도)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:8501"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "http://localhost:8501"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" "http://localhost:8501"
) else (
    echo 크롬을 찾을 수 없습니다. 기본 브라우저로 실행합니다.
    start "" "http://localhost:8501"
)

echo [3단계] 웹 서버 실행 중...
echo.
echo ============================================================
echo  시스템이 실행 중입니다!
echo
echo  접속 주소: http://localhost:8501
echo
echo  종료하려면 이 창을 닫거나 Ctrl+C를 누르세요
echo ============================================================
echo.

python -m streamlit run smart_procurement.py
