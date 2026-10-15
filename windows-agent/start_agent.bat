@echo off
setlocal enabledelayedexpansion

title Myraa Windows Automation Local Agent

echo ========================================================
echo       MYRAA - WINDOWS PC LOCAL AUTOMATION AGENT
echo       লোকালহোস্ট অটোমেশন সহকারী (Localhost Automation Agent)
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Check Python installation
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in your system PATH.
    echo অনুগ্রহ করে https://www.python.org/ থেকে Python 3 ইনস্টল করুন।
    echo ("Add Python to PATH" অপশনটি টিক দিতে ভুলবেন না)
    echo.
    pause
    exit /b 1
)

:: 2. Ensure config.json exists or generate
if not exist "config.json" (
    if exist "config.example.json" (
        echo [*] Initializing config.json from config.example.json...
        copy "config.example.json" "config.json" >nul
    )
)

:: 3. Optional Virtual Environment and Dependencies
if not exist "venv\Scripts\activate.bat" (
    echo [*] Checking Python environment...
    python -m venv venv >nul 2>nul
)

if exist "venv\Scripts\python.exe" (
    echo [*] Trying FastAPI engine...
    call venv\Scripts\python.exe -m pip install -r requirements.txt >nul 2>nul
    set "PY_RUN=venv\Scripts\python.exe"
) else (
    set "PY_RUN=python"
)

echo.
echo ========================================================
echo   Starting Myraa Local Agent on http://127.0.0.1:41199
echo   Status: Listening for authenticated desktop commands
echo   Press Ctrl+C at any time to stop the agent.
echo ========================================================
echo.

%PY_RUN% agent.py
if %errorlevel% neq 0 (
    echo.
    echo [*] Falling back to system python standard library engine...
    python agent.py
)

if %errorlevel% neq 0 (
    echo.
    echo [!] Agent process exited with code %errorlevel%.
    pause
)
