set shell := ["powershell", "-NoProfile", "-Command"]

# Path variables
BACKEND_DIR := ".\\backend"
FRONTEND_DIR := ".\\frontend\\wattrent"

# Show all available commands
help:
  just --list

# Install all dependencies
install:
  Write-Host "Installing backend dependencies..."
  Push-Location {{BACKEND_DIR}}; go mod download; Pop-Location
  Write-Host "Installing frontend dependencies..."
  Push-Location {{FRONTEND_DIR}}; npm install; Pop-Location

# Start backend service with air hot reload and ngrok tunnel
backend:
  Write-Host "Starting ngrok tunnel..."
  Start-Process powershell -ArgumentList "-NoProfile", "-Command", "ngrok http --url=calf-positive-urgently.ngrok-free.app 8090" -WindowStyle Hidden
  Write-Host "Starting backend with air..."
  Push-Location {{BACKEND_DIR}}; air; Pop-Location

# Start frontend with Expo tunnel mode
frontend:
  Push-Location {{FRONTEND_DIR}}; npx expo start --tunnel; Pop-Location

# Start frontend web version
frontend-web:
  Push-Location {{FRONTEND_DIR}}; npx expo start --web; Pop-Location

# Start frontend iOS simulator
frontend-ios:
  Push-Location {{FRONTEND_DIR}}; npx expo start --ios; Pop-Location

# Start frontend Android simulator
frontend-android:
  Push-Location {{FRONTEND_DIR}}; npx expo start --android; Pop-Location

# Show multi-terminal development guide
dev:
  Write-Host "👉 Open two PowerShell windows and run:"
  Write-Host "  just backend"
  Write-Host "  just frontend-web"

# Reset project files and cache
reset:
  Write-Host "Resetting backend..."
  Remove-Item -Recurse -Force "{{BACKEND_DIR}}\\tmp\\*" -ErrorAction SilentlyContinue
  Write-Host "Resetting frontend..."
  Push-Location {{FRONTEND_DIR}}; npm run reset-project; Pop-Location