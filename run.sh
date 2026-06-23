#!/bin/bash

# Location Independent Voting System Launcher (Bash / Unix)

# Clear terminal screen
clear

# Function to clean up background processes
cleanup() {
    echo -e "\n\n[INFO] Stopping backend and frontend servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit
}

# Trap exit signals
trap cleanup INT TERM EXIT

show_menu() {
    echo "====================================================================="
    echo "   Location Independent Blockchain-Based Secure Voting System"
    echo "====================================================================="
    echo
    echo "Please select an option:"
    echo
    echo "  [1] Check System Prerequisites (Node, npm, Docker, MySQL)"
    echo "  [2] Install / Update Dependencies (Backend & Frontend)"
    echo "  [3] Seed Database (Populate test candidates and 50 voters)"
    echo "  [4] Start System Locally (Native Node.js server + React Dev)"
    echo "  [5] Start System via Docker Compose (Containerized setup)"
    echo "  [6] Full Local Run (Prerequisites check -> Install -> Seed -> Start)"
    echo "  [7] Exit"
    echo
    echo "====================================================================="
    read -p "Enter choice (1-7): " choice
}

check_prereqs() {
    clear
    echo "[CHECKING PREREQUISITES]"
    echo
    passed=1

    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "\033[31m[ERROR] Node.js is not installed. Please install Node.js v18+.\033[0m"
        passed=0
    else
        echo -e "\033[32m[ OK  ] Node.js is installed ($(node -v))\033[0m"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "\033[31m[ERROR] npm is not installed.\033[0m"
        passed=0
    else
        echo -e "\033[32m[ OK  ] npm is installed\033[0m"
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "\033[33m[WARN ] Docker is not installed or running.\033[0m"
    else
        echo -e "\033[32m[ OK  ] Docker is installed ($(docker --version | awk '{print $3}' | tr -d ','))\033[0m"
    fi

    # Check MySQL Port (3306)
    if command -v nc &> /dev/null; then
        if nc -z localhost 3306 &> /dev/null; then
            echo -e "\033[32m[ OK  ] MySQL is running and listening on port 3306\033[0m"
        else
            echo -e "\033[31m[ERROR] MySQL (Port 3306) is NOT listening.\033[0m"
            passed=0
        fi
    elif command -v lsof &> /dev/null; then
        if lsof -i :3306 &> /dev/null; then
            echo -e "\033[32m[ OK  ] MySQL is running and listening on port 3306\033[0m"
        else
            echo -e "\033[31m[ERROR] MySQL (Port 3306) is NOT listening.\033[0m"
            passed=0
        fi
    else
        # Fallback check using bash socket (if enabled)
        if (echo > /dev/tcp/127.0.0.1/3306) &> /dev/null; then
            echo -e "\033[32m[ OK  ] MySQL is running and listening on port 3306\033[0m"
        else
            echo -e "\033[33m[WARN ] Could not verify MySQL port 3306 (netcat/lsof missing).\033[0m"
        fi
    fi

    echo
    if [ $passed -eq 1 ]; then
        echo -e "\033[32m✅ All core local prerequisites met!\033[0m"
    else
        echo -e "\033[31m❌ Some prerequisites are missing. Please fix them.\033[0m"
    fi
    read -p "Press Enter to continue..."
}

install_deps() {
    clear
    echo "[INSTALLING DEPENDENCIES]"
    echo
    echo "Installing Backend dependencies..."
    cd backend && npm install
    if [ $? -ne 0 ]; then
        echo -e "\033[31m❌ Backend npm install failed.\033[0m"
        cd ..
        read -p "Press Enter to continue..."
        return
    fi
    cd ..

    echo
    echo "Installing Frontend dependencies..."
    cd frontend && npm install
    if [ $? -ne 0 ]; then
        echo -e "\033[31m❌ Frontend npm install failed.\033[0m"
        cd ..
        read -p "Press Enter to continue..."
        return
    fi
    cd ..

    echo -e "\n\033[32m✅ Dependencies installed successfully!\033[0m"
    read -p "Press Enter to continue..."
}

seed_db() {
    clear
    echo "[SEEDING DATABASE]"
    echo
    cd backend
    if [ ! -d "node_modules" ]; then
        echo "Backend node_modules not found. Installing first..."
        npm install
    fi
    npm run seed
    if [ $? -ne 0 ]; then
        echo -e "\033[31m❌ Seeding failed. Ensure MySQL is running and backend/.env contains correct credentials.\033[0m"
    else
        echo -e "\033[32m✅ Database seeded successfully!\033[0m"
    fi
    cd ..
    read -p "Press Enter to continue..."
}

start_local() {
    clear
    echo "[STARTING LOCAL SYSTEM]"
    echo

    # Verify environment file exists
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            echo "[INFO] backend/.env not found. Creating from .env.example..."
            cp backend/.env.example backend/.env
            echo -e "\033[33m[IMPORTANT] Please verify database credentials in backend/.env before running.\033[0m"
            read -p "Press Enter to continue..."
        else
            echo -e "\033[31m[ERROR] backend/.env and .env.example are missing. Cannot configure system.\033[0m"
            read -p "Press Enter to continue..."
            return
        fi
    fi

    # Verify dependencies
    if [ ! -d "backend/node_modules" ]; then
        echo "Backend dependencies missing. Installing..."
        cd backend && npm install && cd ..
    fi
    if [ ! -d "frontend/node_modules" ]; then
        echo "Frontend dependencies missing. Installing..."
        cd frontend && npm install && cd ..
    fi

    echo "Starting backend server in the background..."
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..

    # Short delay to let backend bind port
    sleep 2

    echo "Starting frontend server in the background..."
    cd frontend
    npm start &
    FRONTEND_PID=$!
    cd ..

    echo
    echo -e "\033[32m✅ Servers started!\033[0m"
    echo "Backend is running on: http://localhost:5001"
    echo "Frontend is running on: http://localhost:3000"
    echo
    echo "Press Ctrl+C at any time to shut down both servers and exit."
    
    # Wait on background tasks
    wait $BACKEND_PID $FRONTEND_PID
}

start_docker() {
    clear
    echo "[STARTING DOCKER COMPOSE]"
    echo
    if ! command -v docker &> /dev/null; then
        echo -e "\033[31m[ERROR] Docker is not installed or running. Cannot use Docker Compose.\033[0m"
        read -p "Press Enter to continue..."
        return
    fi
    docker compose -f docker/docker-compose.yml up --build
    read -p "Press Enter to continue..."
}

full_run() {
    clear
    echo "[FULL AUTOMATED LOCAL SETUP & START]"
    echo
    echo "1. Installing Backend and Frontend dependencies..."
    cd backend && npm install && cd ..
    cd frontend && npm install && cd ..

    echo "2. Seeding Database..."
    cd backend && npm run seed && cd ..

    echo "3. Starting Local System..."
    start_local
}

while true; do
    show_menu
    case $choice in
        1) check_prereqs ;;
        2) install_deps ;;
        3) seed_db ;;
        4) start_local ;;
        5) start_docker ;;
        6) full_run ;;
        7) exit 0 ;;
        *) echo "Invalid option. Please try again." ; sleep 1 ;;
    esac
done
