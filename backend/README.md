# ReproFlow API (backend)

NestJS (Fastify) API implementing Phase 1 of `docs/ARCHITECTURE.md`: authentication,
organisations, and projects. Later phases add `reports`, `attachments`, `share-links`,
`integrations`, `ai`, and their background workers in the same module layout.

## Prerequisites

- Node.js 20+ (tested on 24) and npm.
- PostgreSQL 16 and Redis 7, reachable at the URLs in `.env`. The repo's
  `infra/docker-compose.yml` provides both (plus MinIO for later phases) — this
  requires **Docker Desktop**, which is not installed on this machine yet. Either
  install it, or point `DATABASE_URL`/`REDIS_URL` at any Postgres/Redis you already
  have (a free-tier hosted instance works fine for local development).

## Setup

```bash
cp .env.example .env
# edit .env: at minimum set JWT_ACCESS_SECRET and ENCRYPTION_KEY to random values,
# e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

npm install

# Start Postgres/Redis/MinIO locally (requires Docker Desktop):
docker compose -f ../infra/docker-compose.yml up -d

# Create the database schema (generates prisma/migrations/<timestamp>_init from
# the schema in prisma/schema.prisma — this is the first real migration, so it
# must be run once Postgres is reachable):
npx prisma migrate dev --name init

npm run start:dev
```

The API listens on `http://localhost:4000`, all routes under `/api/v1` except
`/health` and `/health/ready` (see `docs/ARCHITECTURE.md` §7).

## Verifying the setup

```bash
curl http://localhost:4000/health/ready
# {"status":"ok","database":"ok","redis":"ok"}

curl -X POST http://localhost:4000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Passw0rd123","fullName":"Your Name","organisationName":"My Agency"}'
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` | Watch-mode dev server |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit/integration tests |
| `npm run prisma:migrate:dev` | Create + apply a new migration in development |
| `npm run prisma:migrate:deploy` | Apply pending migrations (used in CI/deploy, never generates new ones) |
| `npm run prisma:studio` | Browse the database |

## What's implemented (Phase 1)

- `auth`: signup, login, refresh (rotating, reuse-detected), logout, `/me`.
- `organisations`: create/update/soft-delete, member invite/role-change/remove,
  with server-side role checks on every write (`docs/ARCHITECTURE.md` §10, §20).
- `projects`: create/list/update, scoped to an organisation.
- `health`: liveness + readiness (DB + Redis).

Known Phase 1 scope limits (by design, not oversight — see `docs/ARCHITECTURE.md` §28
for when each lands):

- Inviting a member requires they already have a ReproFlow account; emailed
  invite-to-signup links are a Phase-5-adjacent addition once the notification
  worker exists.
- No `reports`/`attachments`/`share-links`/`integrations` yet — Phases 2–5.
- No rate-limit tiers beyond auth endpoints yet; report/AI endpoints get theirs
  in the phases that add those routes.
