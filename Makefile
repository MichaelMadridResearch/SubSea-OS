.PHONY: bootstrap seed-demo dev test verify

bootstrap:
	python -m pip install -e "apps/api[dev]" -e apps/worker
	corepack pnpm install
	corepack pnpm generate
	corepack pnpm exec playwright install chromium

seed-demo:
	docker compose build api
	docker compose up -d --wait postgres redis minio
	docker compose run --rm --no-deps --entrypoint alembic api -c /repo/apps/api/alembic.ini upgrade head
	docker compose run --rm --no-deps --entrypoint python api -m app.seed --reset

dev:
	docker compose up --build

test:
	docker compose up -d --build --wait
	docker compose run --rm --no-deps --entrypoint python api -m app.seed --reset
	SUBSEA_REQUIRE_DB=1 python -m pytest
	corepack pnpm exec playwright test

verify:
	python -m ruff check apps tests
	python -m ruff format --check apps tests
	corepack pnpm typecheck
	corepack pnpm lint
	corepack pnpm test:tokens
	$(MAKE) test
