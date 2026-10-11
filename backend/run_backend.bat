@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Dang khoi chay FastAPI Server cho du an IRS (Port 8000)
echo ========================================================

:: 1. Uu tien dung Virtual Environment trong thu muc backend
if exist ".venv\Scripts\python.exe" (
    echo [OK] Su dung Virtual Environment: .venv
    ".venv\Scripts\python.exe" main.py
    goto end
)

:: 2. Neu chua co .venv thi tu dong tao va cai dat dependencies
echo [INFO] Dang tu dong tao Virtual Environment .venv...
where uv >nul 2>nul
if %errorlevel% equ 0 (
    uv venv --python 3.13 .venv
    uv pip install -r requirements.txt --python .venv\Scripts\python.exe
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        py -3 -m venv .venv
    ) else (
        python -m venv .venv
    )
    if exist ".venv\Scripts\pip.exe" (
        ".venv\Scripts\pip.exe" install -r requirements.txt
    )
)

if exist ".venv\Scripts\python.exe" (
    echo [OK] Cai dat hoan tat, bat dau khoi chay server...
    ".venv\Scripts\python.exe" main.py
    goto end
)

:: 3. Fallback
where py >nul 2>nul
if %errorlevel% equ 0 (
    py -3 main.py
) else (
    python main.py
)

:end
pause
endlocal
