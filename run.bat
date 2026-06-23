@echo off
setlocal enabledelayedexpansion
cls
title Location Independent Voting System Launcher

:menu
cls
echo =====================================================================
echo    Location Independent Blockchain-Based Secure Voting System
echo =====================================================================
echo.
echo Please select an option:
echo.
echo   [1] Check System Prerequisites (Node, npm, Docker, MySQL)
echo   [2] Install / Update Dependencies (Backend & Frontend)
echo   [3] Seed Database (Populate test candidates and 50 voters)
echo   [4] Start System Locally (Native Node.js server + React Dev)
echo   [5] Start System via Docker Compose (Containerized setup)
echo   [6] Full Local Run (Prerequisites check -> Install -> Seed -> Start)
echo   [7] Exit
echo.
echo =====================================================================
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto check_prereqs
if "%choice%"=="2" goto install_deps
if "%choice%"=="3" goto seed_db
if "%choice%"=="4" goto start_local
if "%choice%"=="5" goto start_docker
if "%choice%"=="6" goto full_run
if "%choice%"=="7" goto end

echo Invalid choice, please try again.
pause
goto menu

:check_prereqs
cls
echo [CHECKING PREREQUISITES]
echo.
set "passed=1"

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js v18+.
    set "passed=0"
) else (
    for /f "tokens=*" %%i in ('node -v') do set "node_ver=%%i"
    echo [ OK  ] Node.js is installed (!node_ver!)
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH.
    set "passed=0"
) else (
    echo [ OK  ] npm is installed
)

:: Check Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN ] Docker is not installed or not running. (Only required for option 5)
) else (
    for /f "tokens=*" %%i in ('docker --version') do set "dock_ver=%%i"
    echo [ OK  ] Docker is installed (!dock_ver!)
)

:: Check MySQL port 3306
netstat -ano | findstr 3306 >nul
if %errorlevel% neq 0 (
    echo [ERROR] MySQL (Port 3306) is NOT listening. Please start your MySQL database server.
    set "passed=0"
) else (
    echo [ OK  ] MySQL is running and listening on port 3306
)

echo.
if "!passed!"=="1" (
    echo ✅ All core local prerequisites met!
) else (
    echo ❌ Some prerequisites are missing. Please fix them.
)
pause
goto menu

:install_deps
cls
echo [INSTALLING DEPENDENCIES]
echo.
echo Installing Backend dependencies...
cd backend
cmd /c npm install
if %errorlevel% neq 0 (
    echo ❌ Backend npm install failed.
    cd ..
    pause
    goto menu
)
cd ..

echo.
echo Installing Frontend dependencies...
cd frontend
cmd /c npm install
if %errorlevel% neq 0 (
    echo ❌ Frontend npm install failed.
    cd ..
    pause
    goto menu
)
cd ..

echo.
echo ✅ Dependencies installed successfully!
pause
goto menu

:seed_db
cls
echo [SEEDING DATABASE]
echo.
cd backend
if not exist "node_modules" (
    echo [WARNING] node_modules not found in backend directory. Installing first...
    cmd /c npm install
)
cmd /c npm run seed
if %errorlevel% neq 0 (
    echo ❌ Seeding failed. Ensure MySQL is running and backend/.env contains correct credentials.
) else (
    echo ✅ Database seeded successfully!
)
cd ..
pause
goto menu

:start_local
cls
echo [STARTING LOCAL SYSTEM]
echo.

:: Verify environment file exists
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo [INFO] backend/.env not found. Creating from .env.example...
        copy backend\.env.example backend\.env
        echo [IMPORTANT] Please open backend/.env and verify database credentials before starting.
        pause
    ) else (
        echo [ERROR] backend/.env and .env.example are missing. Cannot configure system.
        pause
        goto menu
    )
)

:: Verify dependencies
if not exist "backend\node_modules" (
    echo [WARNING] Backend node_modules not found. Installing...
    cd backend && cmd /c npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo [WARNING] Frontend node_modules not found. Installing...
    cd frontend && cmd /c npm install && cd ..
)

echo Starting Backend Server in a new window...
start "Voting Backend" cmd /k "cd backend && npm start"

echo Starting Frontend Server in a new window...
start "Voting Frontend" cmd /k "cd frontend && npm start"

echo.
echo ✅ System is launching!
echo Backend logs: Check the newly opened "Voting Backend" window (running on http://localhost:5001)
echo Frontend app: Check the newly opened "Voting Frontend" window (running on http://localhost:3000)
echo.
pause
goto menu

:start_docker
cls
echo [STARTING DOCKER COMPOSE]
echo.
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH. Cannot run option 5.
    pause
    goto menu
)
echo Bootstrapping system containers...
docker compose -f docker/docker-compose.yml up --build
pause
goto menu

:full_run
cls
echo [FULL AUTOMATED LOCAL SETUP & START]
echo.

echo 1. Checking Prerequisites...
netstat -ano | findstr 3306 >nul
if %errorlevel% neq 0 (
    echo [ERROR] MySQL is not running on port 3306. Please start MySQL and run again.
    pause
    goto menu
)

echo 2. Installing Backend and Frontend dependencies...
cd backend && cmd /c npm install && cd ..
cd frontend && cmd /c npm install && cd ..

echo 3. Seeding Database...
cd backend && cmd /c npm run seed && cd ..

echo 4. Launching Servers...
start "Voting Backend" cmd /k "cd backend && npm start"
start "Voting Frontend" cmd /k "cd frontend && npm start"

echo.
echo ✅ System successfully set up and launched locally!
pause
goto menu

:end
echo Thank you for using the Voting System Launcher. Goodbye!
exit /b
