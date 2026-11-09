@echo off

echo =========================================
echo   Intrusive Thoughts - Installation
echo =========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 20+ from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

:: Install dependencies
echo [INFO] Installing npm dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install npm dependencies.
    pause
    exit /b 1
)
echo [INFO] Dependencies installed successfully.
echo.

:: Setup environment variables
if exist ".env.local" goto env_exists

echo [INFO] Setting up environment variables (see .env.example for details)...
set /p NVIDIA_API_KEY="NVIDIA API key (nvapi-..., from https://build.nvidia.com): "
set /p SUPABASE_URL="Supabase project URL (https://<ref>.supabase.co): "
set /p SUPABASE_SECRET_KEY="Supabase SECRET key (sb_secret_... or service_role; server-only): "
(
    echo NVIDIA_API_KEY=%NVIDIA_API_KEY%
    echo SUPABASE_URL=%SUPABASE_URL%
    echo SUPABASE_SECRET_KEY=%SUPABASE_SECRET_KEY%
) > .env.local
echo [INFO] .env.local created.
goto end_env

:env_exists
echo [INFO] .env.local already exists. Skipping environment setup.

:end_env
echo.
echo =========================================
echo   Installation Complete!
echo =========================================
echo.
echo One more step if you haven't done it yet: open your Supabase project's
echo SQL Editor and run supabase/setup-database.sql (safe to re-run).
echo.
echo To start the application, run:
echo    npm run dev
echo.
pause
