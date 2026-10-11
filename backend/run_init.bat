@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Khoi tao va Migration du lieu MongoDB IRS
echo ========================================================

if exist ".venv\Scripts\python.exe" (
    echo [OK] Su dung Virtual Environment: .venv
    ".venv\Scripts\python.exe" init_mongo.py
    goto end
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    py -3 init_mongo.py
) else (
    python init_mongo.py
)

:end
pause
endlocal
