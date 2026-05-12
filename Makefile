.PHONY: help up down logs restart migrate shell db-shell admin status build-image clean

help:
	@echo "GNPS Civic Readiness Portal — self-hosted ops"
	@echo ""
	@echo "Targets:"
	@echo "  up             Start the stack (db, migrations, app, caddy) in the background"
	@echo "  down           Stop the stack (preserves data)"
	@echo "  restart        Restart the stack"
	@echo "  logs           Tail logs from all services"
	@echo "  migrate        Run pending DB migrations"
	@echo "  shell          Open a shell inside the app container"
	@echo "  db-shell       Open psql against the running DB"
	@echo "  admin EMAIL=   Provision or upgrade a user to role=admin"
	@echo "  status         Show service status + health"
	@echo "  build-image    Rebuild the app Docker image without cache"
	@echo "  clean          DESTRUCTIVE: stop + remove containers, volumes, networks"

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=200

migrate:
	docker compose run --rm db-migrate

shell:
	docker compose exec app sh

db-shell:
	docker compose exec db psql -U $${POSTGRES_USER:-civicseal} $${POSTGRES_DB:-civicseal}

admin:
	@if [ -z "$(EMAIL)" ]; then echo "Usage: make admin EMAIL=alice@example.k12.ny.us"; exit 1; fi
	@docker compose run --rm -e ADMIN_EMAIL="$(EMAIL)" db-migrate sh -c "npm install --silent --no-package-lock postgres && node bootstrap-admin.mjs"
	@echo "✓ $(EMAIL) is now an admin. Have them sign in at /login."

status:
	docker compose ps

build-image:
	docker compose build --no-cache app

clean:
	@echo "This will delete ALL data (db + evidence files). Press Ctrl-C to abort."
	@sleep 5
	docker compose down -v
