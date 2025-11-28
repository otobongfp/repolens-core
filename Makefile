.PHONY: help install install-api install-frontend install-tensor install-all \
		run run-full run-api run-ui run-tensor \
		build build-api build-frontend build-all \
		migrate migrate-dev migrate-prod migrate-reset migrate-status migrate-generate migrate-create generate-migration \
		setup-services stop-services \
		test test-api test-frontend \
		lint lint-api lint-frontend \
		clean clean-api clean-frontend clean-all \
		dev dev-api dev-ui dev-full \
		fix-xcode

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

# Variables
API_DIR := api
FRONTEND_DIR := frontend
TENSOR_DIR := tensor
DOCKER_COMPOSE := ../docker/docker-compose.yml
DOCKER_COMPOSE_MONITORING := api/docker/docker-compose.monitoring.yml

##@ Help

help: ## Show this help message
	@echo "$(BLUE)RepoLens Core - Makefile Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make $(BLUE)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(BLUE)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(GREEN)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Installation

install-api: ## Install API dependencies
	@echo "$(BLUE)Detecting OS and setting up build environment...$(NC)"
	@UNAME_S=$$(uname -s 2>/dev/null || echo "Unknown"); \
	if [ "$$UNAME_S" = "Darwin" ]; then \
		echo "$(BLUE)macOS detected - Setting up build environment...$(NC)"; \
		if ! xcode-select -p > /dev/null 2>&1; then \
			echo "$(RED)Xcode Command Line Tools not found!$(NC)"; \
			echo "$(YELLOW)Run: make fix-xcode$(NC)"; \
			exit 1; \
		fi; \
		SDK_PATH=$$(xcrun --show-sdk-path 2>/dev/null || echo ""); \
		if [ -z "$$SDKROOT" ]; then \
			if [ -n "$$SDK_PATH" ]; then \
				export SDKROOT="$$SDK_PATH"; \
				echo "$(GREEN)Using SDK from xcrun: $$SDKROOT$(NC)"; \
			elif [ -d "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk" ]; then \
				export SDKROOT="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk"; \
				echo "$(GREEN)Using default SDK: $$SDKROOT$(NC)"; \
			fi; \
		else \
			echo "$(GREEN)Using SDKROOT from environment: $$SDKROOT$(NC)"; \
		fi; \
		if [ -z "$$CC" ]; then \
			export CC="/usr/bin/clang"; \
		fi; \
		if [ -z "$$CXX" ]; then \
			export CXX="/usr/bin/clang++"; \
		fi; \
		if [ -z "$$MACOSX_DEPLOYMENT_TARGET" ]; then \
			export MACOSX_DEPLOYMENT_TARGET="13.0"; \
		fi; \
		if [ -z "$$CFLAGS" ] && [ -n "$$SDKROOT" ]; then \
			ARCH=$$(uname -m); \
			if [ "$$ARCH" = "arm64" ]; then \
				export CFLAGS="-target aarch64-apple-darwin -isysroot $$SDKROOT"; \
				export CXXFLAGS="-target aarch64-apple-darwin -isysroot $$SDKROOT"; \
				echo "$(BLUE)Set CFLAGS for M1 Mac (arm64)$(NC)"; \
			else \
				export CFLAGS="-isysroot $$SDKROOT"; \
				export CXXFLAGS="-isysroot $$SDKROOT"; \
				echo "$(BLUE)Set CFLAGS for Intel Mac$(NC)"; \
			fi; \
		fi; \
		echo "$(BLUE)Build env: SDKROOT=$$SDKROOT, CC=$$CC, ARCH=$$(uname -m)$(NC)"; \
	elif [ "$$UNAME_S" = "Linux" ]; then \
		echo "$(BLUE)Linux detected - No special setup needed$(NC)"; \
	elif echo "$$UNAME_S" | grep -q "MINGW\|MSYS\|CYGWIN"; then \
		echo "$(BLUE)Windows detected - No special setup needed$(NC)"; \
	else \
		echo "$(YELLOW)Unknown OS: $$UNAME_S - Proceeding anyway$(NC)"; \
	fi
	@echo "$(BLUE)Installing API dependencies...$(NC)"
	@UNAME_S=$$(uname -s 2>/dev/null || echo "Unknown"); \
	if [ "$$UNAME_S" = "Darwin" ]; then \
		echo "$(BLUE)macOS detected - Configuring build environment...$(NC)"; \
		SDK_PATH=$$(xcrun --show-sdk-path 2>/dev/null || echo ""); \
		if [ -z "$$SDKROOT" ]; then \
			if [ -n "$$SDK_PATH" ]; then \
				SDKROOT_VAL="$$SDK_PATH"; \
				echo "$(GREEN)Using SDK from xcrun: $$SDKROOT_VAL$(NC)"; \
			elif [ -d "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk" ]; then \
				SDKROOT_VAL="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk"; \
				echo "$(GREEN)Using default SDK: $$SDKROOT_VAL$(NC)"; \
			else \
				SDKROOT_VAL=""; \
				echo "$(RED)ERROR: SDKROOT not found! Run: make fix-xcode$(NC)"; \
				exit 1; \
			fi; \
		else \
			SDKROOT_VAL="$$SDKROOT"; \
			echo "$(GREEN)Using SDKROOT from environment: $$SDKROOT_VAL$(NC)"; \
		fi; \
		CC_VAL=$${CC:-/usr/bin/clang}; \
		if [ "$$CC_VAL" != "/usr/bin/clang" ] && [ "$$CC_VAL" != "/usr/bin/gcc" ]; then \
			echo "$(YELLOW)Warning: CC is set to $$CC_VAL (non-standard). Using /usr/bin/clang for native builds.$(NC)"; \
			CC_VAL="/usr/bin/clang"; \
		fi; \
		CXX_VAL=$${CXX:-/usr/bin/clang++}; \
		if [ "$$CXX_VAL" != "/usr/bin/clang++" ] && [ "$$CXX_VAL" != "/usr/bin/g++" ]; then \
			CXX_VAL="/usr/bin/clang++"; \
		fi; \
		MACOSX_TARGET=$${MACOSX_DEPLOYMENT_TARGET:-13.0}; \
		ARCH=$$(uname -m); \
		if echo "$$CFLAGS" | grep -q "wasm32\|wasm64"; then \
			echo "$(YELLOW)Warning: CFLAGS contains wasm target. Overriding for native build.$(NC)"; \
			CFLAGS_VAL=""; \
			CXXFLAGS_VAL=""; \
		fi; \
		if [ -z "$$CFLAGS_VAL" ] && [ -n "$$SDKROOT_VAL" ]; then \
			if [ "$$ARCH" = "arm64" ]; then \
				CFLAGS_VAL="-target aarch64-apple-darwin -isysroot $$SDKROOT_VAL"; \
				CXXFLAGS_VAL="-target aarch64-apple-darwin -isysroot $$SDKROOT_VAL"; \
			else \
				CFLAGS_VAL="-isysroot $$SDKROOT_VAL"; \
				CXXFLAGS_VAL="-isysroot $$SDKROOT_VAL"; \
			fi; \
		fi; \
		echo "$(BLUE)Build environment:$(NC)"; \
		echo "  SDKROOT=$$SDKROOT_VAL"; \
		echo "  CC=$$CC_VAL"; \
		echo "  CXX=$$CXX_VAL"; \
		echo "  CFLAGS=$$CFLAGS_VAL"; \
		echo "  MACOSX_DEPLOYMENT_TARGET=$$MACOSX_TARGET"; \
		cd $(API_DIR) && \
			env SDKROOT="$$SDKROOT_VAL" \
				CC="$$CC_VAL" \
				CXX="$$CXX_VAL" \
				MACOSX_DEPLOYMENT_TARGET="$$MACOSX_TARGET" \
				CFLAGS="$$CFLAGS_VAL" \
				CXXFLAGS="$$CXXFLAGS_VAL" \
				npm install --legacy-peer-deps && echo "$(GREEN)✓ Installation successful!$(NC)" || \
			(EXIT_CODE=$$?; \
			 if [ $$EXIT_CODE -ne 0 ]; then \
				echo "$(YELLOW)⚠ Installation completed with errors.$(NC)"; \
				echo "$(YELLOW)Tree-sitter native modules failed to build - parser will use regex fallback.$(NC)"; \
				echo "$(YELLOW)This is OK for development. The parser will work with regex extraction.$(NC)"; \
				echo "$(YELLOW)To fix tree-sitter on macOS: Run 'make fix-xcode' then 'make install-api'$(NC)"; \
				echo "$(GREEN)Continuing with available packages...$(NC)"; \
			 fi); \
	else \
		cd $(API_DIR) && \
			(npm install --legacy-peer-deps && echo "$(GREEN)✓ Installation successful!$(NC)") || \
			(EXIT_CODE=$$?; \
			 if [ $$EXIT_CODE -ne 0 ]; then \
				echo "$(YELLOW)⚠ Installation completed with errors.$(NC)"; \
				echo "$(GREEN)Continuing with available packages...$(NC)"; \
			 fi); \
	fi

install-frontend: ## Install Frontend dependencies
	@echo "$(BLUE)Cleaning Frontend node_modules...$(NC)"
	@rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/package-lock.json
	@echo "$(BLUE)Installing Frontend dependencies...$(NC)"
	cd $(FRONTEND_DIR) && npm install --legacy-peer-deps

install-tensor: ## Install Tensor service dependencies
	@echo "$(BLUE)Cleaning Tensor service...$(NC)"
	@rm -rf $(TENSOR_DIR)/venv $(TENSOR_DIR)/__pycache__
	@echo "$(BLUE)Installing Tensor service dependencies...$(NC)"
	cd $(TENSOR_DIR) && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

clean-install-api: ## Clean and install API dependencies
	@echo "$(YELLOW)Cleaning API completely...$(NC)"
	@rm -rf $(API_DIR)/node_modules $(API_DIR)/package-lock.json $(API_DIR)/dist
	@make install-api

clean-install-frontend: ## Clean and install Frontend dependencies
	@echo "$(YELLOW)Cleaning Frontend completely...$(NC)"
	@rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/package-lock.json $(FRONTEND_DIR)/.next
	@make install-frontend

clean-install-all: clean-install-api clean-install-frontend install-tensor ## Clean and install all dependencies

install-all: install-api install-frontend install-tensor ## Install all dependencies

fix-xcode: ## Fix Xcode Command Line Tools configuration (macOS only)
	@echo "$(BLUE)Fixing Xcode Command Line Tools...$(NC)"
	@UNAME_S=$$(uname -s 2>/dev/null || echo "Unknown"); \
	if [ "$$UNAME_S" != "Darwin" ]; then \
		echo "$(YELLOW)This command is for macOS only. Your OS: $$UNAME_S$(NC)"; \
		exit 0; \
	fi
	@if ! xcode-select -p > /dev/null 2>&1; then \
		echo "$(YELLOW)Installing Xcode Command Line Tools...$(NC)"; \
		xcode-select --install; \
		echo "$(YELLOW)Please complete the installation dialog, then run: make install-api$(NC)"; \
	else \
		echo "$(BLUE)Resetting Xcode path...$(NC)"; \
		sudo xcode-select --reset; \
		SDK_PATH=$$(xcrun --show-sdk-path 2>/dev/null || echo ""); \
		if [ -n "$$SDK_PATH" ]; then \
			echo "$(GREEN)SDK found at: $$SDK_PATH$(NC)"; \
			echo "$(BLUE)Setting environment variables for M1 Mac...$(NC)"; \
			echo "$(YELLOW)Add these to your ~/.zshrc or ~/.bashrc:$(NC)"; \
			echo "export SDKROOT=$$SDK_PATH"; \
			echo "export CC=/usr/bin/clang"; \
			echo "export CXX=/usr/bin/clang++"; \
			echo "export MACOSX_DEPLOYMENT_TARGET=13.0"; \
			ARCH=$$(uname -m); \
			if [ "$$ARCH" = "arm64" ]; then \
				echo "export CFLAGS=\"-target aarch64-apple-darwin -isysroot \$$SDKROOT\""; \
				echo "export CXXFLAGS=\"-target aarch64-apple-darwin -isysroot \$$SDKROOT\""; \
			fi; \
		fi; \
		echo "$(GREEN)Xcode path reset. Try: make install-api$(NC)"; \
	fi

##@ Development

dev-api: ## Run API in development mode
	@echo "$(GREEN)Starting API in development mode...$(NC)"
	@echo "$(BLUE)Note: Migrations will auto-run on startup (set AUTO_MIGRATE=false to disable)$(NC)"
	cd $(API_DIR) && AUTO_MIGRATE=true npm run start:dev

dev-api-no-migrate: ## Run API without auto-migration
	@echo "$(GREEN)Starting API in development mode (no auto-migration)...$(NC)"
	cd $(API_DIR) && AUTO_MIGRATE=false npm run start:dev

dev-ui: ## Run Frontend in development mode
	@echo "$(GREEN)Starting Frontend in development mode...$(NC)"
	cd $(FRONTEND_DIR) && npm run dev

dev-tensor: ## Run Tensor service in development mode
	@echo "$(GREEN)Starting Tensor service in development mode...$(NC)"
	cd $(TENSOR_DIR) && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

dev-full: setup-services ## Run full stack (API + Frontend + Tensor) in development
	@echo "$(GREEN)Starting full development stack...$(NC)"
	@echo "$(YELLOW)Starting services (PostgreSQL, Redis)...$(NC)"
	@docker-compose -f $(DOCKER_COMPOSE) up -d postgres redis
	@echo "$(YELLOW)Waiting for services to be ready...$(NC)"
	@sleep 5
	@echo "$(GREEN)Starting Tensor service...$(NC)"
	@make dev-tensor &
	@sleep 3
	@echo "$(GREEN)Starting API...$(NC)"
	@make dev-api &
	@sleep 3
	@echo "$(GREEN)Starting Frontend...$(NC)"
	@make dev-ui
	@echo "$(GREEN)All services started!$(NC)"
	@echo "$(BLUE)API: http://localhost:3000$(NC)"
	@echo "$(BLUE)Frontend: http://localhost:3001$(NC)"
	@echo "$(BLUE)Tensor: http://localhost:8080$(NC)"

##@ Production

run-api: build-api ## Run API in production mode
	@echo "$(GREEN)Starting API in production mode...$(NC)"
	cd $(API_DIR) && npm run start:prod

run-ui: build-frontend ## Run Frontend in production mode
	@echo "$(GREEN)Starting Frontend in production mode...$(NC)"
	cd $(FRONTEND_DIR) && npm run start

run-full: build-all setup-services ## Run full stack in production mode
	@echo "$(GREEN)Starting full production stack...$(NC)"
	@docker-compose -f $(DOCKER_COMPOSE) up -d
	@make run-api &
	@make run-ui

##@ Database

migrate: ## Run database migrations (development)
	@echo "$(BLUE)Running database migrations...$(NC)"
	cd $(API_DIR) && npm run db:migrate

migrate-dev: ## Run database migrations in development mode
	@echo "$(BLUE)Running database migrations (dev)...$(NC)"
	cd $(API_DIR) && npm run db:migrate

migrate-prod: ## Run database migrations in production mode
	@echo "$(BLUE)Running database migrations (prod)...$(NC)"
	cd $(API_DIR) && npx prisma migrate deploy

migrate-reset: ## Reset database (WARNING: Drops all data)
	@echo "$(RED)WARNING: This will drop all database data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		cd $(API_DIR) && npx prisma migrate reset --force; \
	fi

migrate-reset-force: ## Force reset database without confirmation (DANGER: Drops all data)
	@echo "$(RED)DANGER: Dropping all database data...$(NC)"
	cd $(API_DIR) && npx prisma migrate reset --force --skip-seed

db-drop: ## Drop the database completely (requires manual recreation)
	@echo "$(RED)DANGER: Dropping database...$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		cd $(API_DIR) && npx prisma db execute --stdin <<< "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"; \
	fi

db-clear: migrate-reset-force ## Clear database and reset (alias for migrate-reset-force)

migrate-generate: ## Generate Prisma client
	@echo "$(BLUE)Generating Prisma client...$(NC)"
	cd $(API_DIR) && npm run db:generate

migrate-status: ## Check migration status
	@echo "$(BLUE)Checking migration status...$(NC)"
	cd $(API_DIR) && npx prisma migrate status

generate-migration: ## Generate a new migration (usage: make generate-migration name=migration_name)
	@if [ -z "$(name)" ]; then \
		echo "$(RED)Error: Migration name is required$(NC)"; \
		echo "$(YELLOW)Usage: make generate-migration name=init$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Generating migration: $(name)...$(NC)"
	cd $(API_DIR) && npx prisma migrate dev --name $(name) --create-only

migrate-create: generate-migration ## Alias for generate-migration

db-studio: ## Open Prisma Studio
	@echo "$(BLUE)Opening Prisma Studio...$(NC)"
	cd $(API_DIR) && npm run db:studio

##@ Services

setup-services: ## Start required services (PostgreSQL, Redis)
	@echo "$(BLUE)Starting required services...$(NC)"
	@docker-compose -f $(DOCKER_COMPOSE) up -d postgres redis
	@echo "$(GREEN)Services started!$(NC)"
	@echo "$(BLUE)PostgreSQL: localhost:5432$(NC)"
	@echo "$(BLUE)Redis: localhost:6379$(NC)"

setup-services-full: ## Start all services (PostgreSQL, Redis, Neo4j, Tensor)
	@echo "$(BLUE)Starting all services...$(NC)"
	@docker-compose -f $(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)All services started!$(NC)"

setup-monitoring: ## Start monitoring services (Prometheus, Grafana)
	@echo "$(BLUE)Starting monitoring services...$(NC)"
	@docker-compose -f $(DOCKER_COMPOSE_MONITORING) up -d
	@echo "$(GREEN)Monitoring services started!$(NC)"
	@echo "$(BLUE)Prometheus: http://localhost:9090$(NC)"
	@echo "$(BLUE)Grafana: http://localhost:3001 (admin/admin)$(NC)"

stop-services: ## Stop all Docker services
	@echo "$(YELLOW)Stopping all services...$(NC)"
	@docker-compose -f $(DOCKER_COMPOSE) down
	@docker-compose -f $(DOCKER_COMPOSE_MONITORING) down 2>/dev/null || true
	@echo "$(GREEN)Services stopped!$(NC)"

logs-services: ## View service logs
	@docker-compose -f $(DOCKER_COMPOSE) logs -f

##@ Build

build-api: ## Build API
	@echo "$(BLUE)Building API...$(NC)"
	cd $(API_DIR) && npm run build

build-frontend: ## Build Frontend
	@echo "$(BLUE)Building Frontend...$(NC)"
	cd $(FRONTEND_DIR) && npm run build

build-all: build-api build-frontend ## Build all applications

##@ Testing

test-api: ## Run API tests
	@echo "$(BLUE)Running API tests...$(NC)"
	cd $(API_DIR) && npm test

test-frontend: ## Run Frontend tests
	@echo "$(BLUE)Running Frontend tests...$(NC)"
	cd $(FRONTEND_DIR) && npm test

test: test-api test-frontend ## Run all tests

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	cd $(API_DIR) && npm run test:watch

##@ Linting

lint-api: ## Lint API code
	@echo "$(BLUE)Linting API code...$(NC)"
	cd $(API_DIR) && npm run lint

lint-frontend: ## Lint Frontend code
	@echo "$(BLUE)Linting Frontend code...$(NC)"
	cd $(FRONTEND_DIR) && npm run eslint:check

lint: lint-api lint-frontend ## Lint all code

format-api: ## Format API code
	@echo "$(BLUE)Formatting API code...$(NC)"
	cd $(API_DIR) && npm run format

format-frontend: ## Format Frontend code
	@echo "$(BLUE)Formatting Frontend code...$(NC)"
	cd $(FRONTEND_DIR) && npm run prettier:fix

format: format-api format-frontend ## Format all code

##@ Cleanup

clean-api: ## Clean API build artifacts
	@echo "$(YELLOW)Cleaning API build artifacts...$(NC)"
	cd $(API_DIR) && rm -rf dist node_modules/.cache

clean-frontend: ## Clean Frontend build artifacts
	@echo "$(YELLOW)Cleaning Frontend build artifacts...$(NC)"
	cd $(FRONTEND_DIR) && rm -rf .next node_modules/.cache

clean-tensor: ## Clean Tensor service artifacts
	@echo "$(YELLOW)Cleaning Tensor service artifacts...$(NC)"
	cd $(TENSOR_DIR) && rm -rf __pycache__ *.pyc venv

clean-all: clean-api clean-frontend clean-tensor ## Clean all build artifacts

clean-docker: ## Clean Docker volumes and containers
	@echo "$(RED)WARNING: This will remove all Docker volumes and containers!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f $(DOCKER_COMPOSE) down -v; \
		docker-compose -f $(DOCKER_COMPOSE_MONITORING) down -v 2>/dev/null || true; \
		echo "$(GREEN)Docker volumes and containers removed!$(NC)"; \
	fi

##@ Quick Start

quick-start: install-all setup-services migrate dev-full ## Quick start: Install, setup, migrate, and run everything

quick-start-api: install-api setup-services migrate dev-api ## Quick start: Install API, setup services, migrate, and run API

quick-start-ui: install-frontend dev-ui ## Quick start: Install Frontend and run UI

##@ Utilities

check-env: ## Check environment variables
	@echo "$(BLUE)Checking environment variables...$(NC)"
	@test -f $(API_DIR)/.env || (echo "$(RED)Missing $(API_DIR)/.env$(NC)" && exit 1)
	@test -f $(FRONTEND_DIR)/.env.local || echo "$(YELLOW)Warning: Missing $(FRONTEND_DIR)/.env.local$(NC)"
	@echo "$(GREEN)Environment files check complete!$(NC)"

health: ## Check service health
	@echo "$(BLUE)Checking service health...$(NC)"
	@curl -s http://localhost:3000/api/health || echo "$(RED)API not responding$(NC)"
	@curl -s http://localhost:3001 > /dev/null && echo "$(GREEN)Frontend is up$(NC)" || echo "$(RED)Frontend not responding$(NC)"
	@curl -s http://localhost:8080/health > /dev/null && echo "$(GREEN)Tensor service is up$(NC)" || echo "$(YELLOW)Tensor service not responding$(NC)"

ps: ## Show running Docker containers
	@docker-compose -f $(DOCKER_COMPOSE) ps
