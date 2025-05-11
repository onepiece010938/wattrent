.PHONY: backend frontend-web frontend-app frontend-ios frontend-android dev help install run-all reset

# Set paths
BACKEND_DIR = ./backend
FRONTEND_DIR = ./frontend/wattrent

help:
	@echo "Available commands:"
	@echo "  make backend         - Start backend service using air"
	@echo "  make frontend        - Start Expo frontend (normal mode)"
	@echo "  make frontend-web    - Start Expo web frontend"
	@echo "  make frontend-ios    - Start Expo iOS frontend"
	@echo "  make frontend-android - Start Expo Android frontend"
	@echo "  make dev             - Start backend and web frontend simultaneously (requires multiple terminals)"
	@echo "  make run-all         - Start backend and web frontend simultaneously using tmux"
	@echo "  make install         - Install all dependencies"
	@echo "  make reset           - Reset project (clean temporary files)"

# Install all dependencies
install:
	@echo "Installing backend dependencies..."
	@cd $(BACKEND_DIR) && go mod download
	@echo "Installing frontend dependencies..."
	@cd $(FRONTEND_DIR) && npm install

# Start backend service (using air)
backend:
	@echo "Starting backend service..."
	@cd $(BACKEND_DIR) && air

# Start frontend Expo (normal mode)
frontend:
	@echo "Starting frontend..."
	@cd $(FRONTEND_DIR) && npm run start

# Start frontend Expo Web version
frontend-web:
	@echo "Starting web frontend..."
	@cd $(FRONTEND_DIR) && npm run web

# Start frontend Expo iOS version
frontend-ios:
	@echo "Starting iOS frontend..."
	@cd $(FRONTEND_DIR) && npm run ios

# Start frontend Expo Android version
frontend-android:
	@echo "Starting Android frontend..."
	@cd $(FRONTEND_DIR) && npm run android

# Start backend and frontend simultaneously (using multiple terminals)
dev:
	@echo "Starting backend and web frontend simultaneously requires multiple terminals"
	@echo "Please run the following commands in new terminals:"
	@echo "  - Backend: make backend"
	@echo "  - Web Frontend: make frontend-web"
	@echo "Or use tmux or other terminal multiplexers"

# Start backend and web frontend simultaneously using tmux
run-all:
	@echo "Starting backend and web frontend simultaneously using tmux..."
	@command -v tmux >/dev/null 2>&1 || { echo "Please install tmux first"; exit 1; }
	@tmux new-session -d -s wattrent
	@tmux rename-window -t wattrent:0 'WattRent'
	@tmux split-window -h -t wattrent:0
	@tmux send-keys -t wattrent:0.0 "cd $(BACKEND_DIR) && air" C-m
	@tmux send-keys -t wattrent:0.1 "cd $(FRONTEND_DIR) && npm run web" C-m
	@echo "Services started in tmux, please run 'tmux attach -t wattrent' to view"
	@tmux attach -t wattrent

# Reset project (clean temporary files)
reset:
	@echo "Resetting project..."
	@echo "Cleaning backend temporary files..."
	@cd $(BACKEND_DIR) && rm -rf tmp/*
	@echo "Resetting frontend project..."
	@cd $(FRONTEND_DIR) && npm run reset-project

# Default task
default: help 