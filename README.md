# Subsea Response OS

Advisory incident-response software for offshore-wind export-cable incidents. This checkout runs a fictional demonstration only. It does not control equipment.

## Setup

Requirements: Python 3.11+, Node.js 22+, and Docker. GNU make is optional. This repository already has a Makefile. On Windows, where `make` is not installed, run the direct commands below. They match the Makefile targets.

```text
make bootstrap
make seed-demo
make dev
```

### Direct commands

GNU Make is not required on Windows. Run these from the repository root in PowerShell. They are the Makefile steps without `make`.

Install dependencies:

```text
python -m pip install -e "apps/api[dev]" -e apps/worker
corepack pnpm install
corepack pnpm generate
corepack pnpm exec playwright install chromium
```

Start the stack:

```text
docker compose up --build
```

Seed and reset fictional data:

```text
docker compose build api
docker compose up -d --wait postgres redis minio
docker compose run --rm --no-deps --entrypoint alembic api -c /repo/apps/api/alembic.ini upgrade head
docker compose run --rm --no-deps --entrypoint python api -m app.seed --reset
```

Token check:

```text
corepack pnpm test:tokens
```

Web lint:

```text
corepack pnpm lint
```

Typecheck:

```text
corepack pnpm typecheck
```

Format check:

```text
python -m ruff check apps tests
python -m ruff format --check apps tests
```

API tests, no database:

```text
python -m pytest tests/test_mapping.py tests/security/test_tenant.py::test_openapi_paths_exist tests/security/test_tenant.py::test_live_health
```

Database-backed tests. PostgreSQL must already be up from the seed commands. PowerShell:

```text
$env:SUBSEA_REQUIRE_DB = "1"
python -m pytest tests/security/test_tenant.py::test_golden_path_tenant_and_audit
```

Playwright. The web app must be on http://localhost:3000. Run this again after the approved screens are integrated.

```text
corepack pnpm exec playwright test
```

Image build:

```text
docker compose build
```

Clean-checkout verification is a fresh clone, then the install commands, then the seed commands, then `docker compose up --build`, then the token check, web lint, typecheck, format check, API tests, database-backed tests, and Playwright.

- Web: http://localhost:3000
- API live check: http://localhost:8000/health/live
- API readiness: http://localhost:8000/health/ready
- Worker readiness: http://localhost:8001/health/ready

Sign in with `operator@demo.invalid` / `demo-only-not-a-secret`. Those defaults are local only. They are also in `.env.example`.

`make seed-demo` loads the fictional farm and can be run again to reset it. `make verify` runs formatting, lint, types, unit tests, and the browser golden path.

## Troubleshooting

- Docker is not running: start Docker Desktop, then repeat `make seed-demo`.
- Port 5432, 6379, 8000, 8001, 9000, or 3000 is taken: stop the other process or change the port mapping in `docker-compose.yml` and the matching URL.
- `make` is missing on Windows: use the direct commands in Setup. Do not add a second task runner.
- Readiness stays down: `docker compose ps` shows which of PostgreSQL, Redis, or MinIO failed. `docker compose logs api` shows migration errors.
- Playwright cannot find the browser: rerun `corepack pnpm exec playwright install chromium`.

## Agents

Repository instructions are in `AGENTS.md`. Product and architecture docs are under `docs/`.
