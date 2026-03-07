.PHONY: up down dev seed clean wasm

# Start all services via Docker Compose
up:
	docker compose up --build -d

# Stop all services
down:
	docker compose down

# Start services for local development (without Docker)
# Requires: PostgreSQL running locally, Ruby, Elixir, Go, Node.js
dev:
	@echo "Starting all services for local development..."
	@echo "1. Start Rails API:     cd api && bin/rails server"
	@echo "2. Start Phoenix:       cd realtime && mix phx.server"
	@echo "3. Start Go engine:     cd engine && go run ./cmd/server"
	@echo "4. Start SvelteKit:     cd frontend && npm run dev"

# Seed the database with sample elements
seed:
	cd api && bin/rails db:seed

# Run database migrations
migrate:
	cd api && bin/rails db:migrate

# Full setup: install deps, create DB, migrate, seed
setup:
	cd api && bundle install && bin/rails db:create db:migrate db:seed
	cd frontend && npm install
	cd realtime && mix deps.get
	cd engine && go mod download

# Build all WASM crates via wasm-pack
wasm:
	@echo "Building WASM crates..."
	cd wasm && for crate in geom spatial diff render; do \
		echo "  Building wasm-$$crate..."; \
		wasm-pack build --target web --out-dir pkg --out-name wasm_$$crate crates/$$crate || exit 1; \
	done
	@echo "WASM build complete."

# Clean build artifacts
clean:
	docker compose down -v
	rm -rf frontend/node_modules frontend/.svelte-kit
	rm -rf engine/bin
	rm -rf realtime/_build realtime/deps
	rm -rf wasm/crates/*/pkg wasm/target
