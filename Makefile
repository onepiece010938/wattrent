.PHONY: help install \
        backend backend-build backend-test backend-vet backend-lint \
        frontend frontend-web frontend-ios frontend-android frontend-lint frontend-typecheck \
        dev run-all agent cmdctrl \
        tf-fmt tf-validate tf-plan-staging tf-plan-prod tf-apply-staging tf-apply-prod \
        firestore-deploy \
        reset

# ──────────────── Paths ────────────────
BACKEND_DIR   = ./backend
FRONTEND_DIR  = ./frontend/wattrent
TERRAFORM_DIR = ./terraform

# ──────────────── Help (default) ────────────────
help:
	@echo "WattRent — local dev commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install              Install backend + frontend dependencies"
	@echo ""
	@echo "Run:"
	@echo "  make backend             Run Go API on :8080 (air hot reload, AUTH_BYPASS=true)"
	@echo "  make frontend            Run Expo with tunnel (for physical device)"
	@echo "  make frontend-web        Run Expo on web (http://localhost:8081)"
	@echo "  make frontend-ios        Run Expo iOS simulator"
	@echo "  make frontend-android    Run Expo Android emulator"
	@echo "  make dev                 Multi-terminal dev guide"
	@echo "  make run-all             Backend + web in one tmux session (Linux/macOS)"
	@echo ""
	@echo "Agent:"
	@echo "  make agent               Start cmdctrl-vscode-copilot (remote agent runner)"
	@echo "  make cmdctrl             Alias for 'make agent'"
	@echo ""
	@echo "Backend checks:"
	@echo "  make backend-build       go build ./..."
	@echo "  make backend-test        go test ./..."
	@echo "  make backend-vet         go vet ./..."
	@echo "  make backend-lint        gofmt diff check"
	@echo ""
	@echo "Frontend checks:"
	@echo "  make frontend-lint       expo lint"
	@echo "  make frontend-typecheck  tsc --noEmit"
	@echo ""
	@echo "Infra (Terraform):"
	@echo "  make tf-fmt              terraform fmt -recursive"
	@echo "  make tf-validate         terraform validate"
	@echo "  make tf-plan-staging     terraform plan against staging"
	@echo "  make tf-plan-prod        terraform plan against production"
	@echo "  make tf-apply-staging    terraform apply against staging"
	@echo "  make tf-apply-prod       terraform apply against production"
	@echo ""
	@echo "Firestore:"
	@echo "  make firestore-deploy    Deploy rules + indexes via firebase CLI"
	@echo ""
	@echo "Maintenance:"
	@echo "  make reset               Clean backend tmp + reset Expo project"

default: help

# ──────────────── Setup ────────────────
install:
	@echo "==> Installing backend dependencies"
	@cd $(BACKEND_DIR) && go mod download
	@echo "==> Installing frontend dependencies"
	@cd $(FRONTEND_DIR) && npm install

# ──────────────── Run ────────────────
backend:
	@echo "==> Starting backend (air, http://localhost:8080)"
	@cd $(BACKEND_DIR) && air

frontend:
	@cd $(FRONTEND_DIR) && npx expo start --tunnel

frontend-web:
	@cd $(FRONTEND_DIR) && npx expo start --web

frontend-ios:
	@cd $(FRONTEND_DIR) && npx expo start --ios

frontend-android:
	@cd $(FRONTEND_DIR) && npx expo start --android

dev:
	@echo "Open two terminals and run:"
	@echo "  1) make backend"
	@echo "  2) make frontend-web   (or make frontend for tunnel)"

run-all:
	@command -v tmux >/dev/null 2>&1 || { echo "tmux is required"; exit 1; }
	@tmux new-session -d -s wattrent
	@tmux rename-window -t wattrent:0 'WattRent'
	@tmux split-window -h -t wattrent:0
	@tmux send-keys -t wattrent:0.0 "cd $(BACKEND_DIR) && air" C-m
	@tmux send-keys -t wattrent:0.1 "cd $(FRONTEND_DIR) && npx expo start --web" C-m
	@tmux attach -t wattrent

# ──────────────── Agent (remote VS Code Copilot runner) ────────────────
agent:
	@echo "==> Starting cmdctrl-vscode-copilot"
	@cmdctrl-vscode-copilot start

cmdctrl: agent

# ──────────────── Backend checks ────────────────
backend-build:
	@cd $(BACKEND_DIR) && go build ./...

backend-test:
	@cd $(BACKEND_DIR) && go test ./...

backend-vet:
	@cd $(BACKEND_DIR) && go vet ./...

backend-lint:
	@cd $(BACKEND_DIR) && gofmt -l . | tee /tmp/gofmt.out && test ! -s /tmp/gofmt.out

# ──────────────── Frontend checks ────────────────
frontend-lint:
	@cd $(FRONTEND_DIR) && npx expo lint

frontend-typecheck:
	@cd $(FRONTEND_DIR) && npx tsc --noEmit

# ──────────────── Terraform ────────────────
tf-fmt:
	@cd $(TERRAFORM_DIR) && terraform fmt -recursive

tf-validate:
	@cd $(TERRAFORM_DIR) && terraform validate

tf-plan-staging:
	@cd $(TERRAFORM_DIR) && TF_WORKSPACE=wattrent-staging terraform plan -var-file=envs/staging.tfvars

tf-plan-prod:
	@cd $(TERRAFORM_DIR) && TF_WORKSPACE=wattrent-production terraform plan -var-file=envs/production.tfvars

tf-apply-staging:
	@cd $(TERRAFORM_DIR) && TF_WORKSPACE=wattrent-staging terraform apply -var-file=envs/staging.tfvars

tf-apply-prod:
	@cd $(TERRAFORM_DIR) && TF_WORKSPACE=wattrent-production terraform apply -var-file=envs/production.tfvars

# ──────────────── Firestore ────────────────
firestore-deploy:
	@firebase deploy --only firestore:rules,firestore:indexes

# ──────────────── Maintenance ────────────────
reset:
	@echo "==> Cleaning backend tmp"
	@cd $(BACKEND_DIR) && rm -rf tmp/*
	@echo "==> Resetting frontend project"
	@cd $(FRONTEND_DIR) && npm run reset-project
