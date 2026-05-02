# Via Fidei

> _The Way of Faith._ A multilingual Catholic platform — prayers, saints,
> sacramental guidance, liturgy, and parish discovery — presented with reverence
> and clarity.

Via Fidei is a Next.js 14 application that pairs a public, reader-facing site
with an authenticated admin console for curating Catholic content. It supports
twelve locales, persists data in PostgreSQL via Prisma, and ingests material
from a small allowlist of approved Vatican-affiliated sources through a cron
pipeline that always lands new records in a moderation queue.

---

## Stack

| Area              | Choice                                                            |
| ----------------- | ----------------------------------------------------------------- |
| Framework         | Next.js `14.2.35` (App Router, `output: "standalone"`)            |
| Runtime           | Node.js `>= 20`                                                   |
| Language          | TypeScript `5.6` (strict)                                         |
| UI                | React `18.3`, Tailwind CSS `3.4`, Framer Motion                   |
| Database          | PostgreSQL via Prisma `5.22`                                      |
| Sessions          | `iron-session` (encrypted cookie, `vf_session`)                   |
| Password hashing  | `argon2id`                                                        |
| Validation        | `zod`                                                             |
| Locale negotiation| `negotiator` + cookie override                                    |
| Container         | Multi-stage `Dockerfile` (deps → builder → runner)                |
| Deployment        | Railway-ready (`railway.json`, healthcheck on `/api/health`)      |

---

## Repository layout

```
.
├── prisma/
│   ├── schema.prisma          # Postgres schema (users, content, ingestion, audit, rate limits)
│   ├── migrations/            # Prisma migrations
│   ├── seed.ts                # `npm run db:seed` entrypoint
│   └── seeds/                 # Domain seed data (prayers, saints, apparitions, settings)
├── public/                    # Static assets (favicon)
├── src/
│   ├── app/                   # App Router routes
│   │   ├── (public pages)     # /, /prayers, /saints, /spiritual-life,
│   │   │                      # /spiritual-guidance, /liturgy-history, /search,
│   │   │                      # /login, /register
│   │   ├── profile/           # /profile, /profile/journal, /goals,
│   │   │                      # /milestones, /prayers, /saints, /settings
│   │   ├── admin/             # 12-card admin dashboard (see below)
│   │   └── api/               # Route handlers (auth, admin, cron, journal,
│   │                          # settings, health)
│   ├── components/            # Layout, icons, profile, ui primitives
│   ├── lib/
│   │   ├── auth/              # Session, password, schemas, user/admin helpers
│   │   ├── audit/             # AdminAuditLog writer
│   │   ├── concurrency/       # Lock helpers
│   │   ├── content/           # Review workflow (approve/reject/revise/move-to-review)
│   │   ├── data/              # Per-entity repositories
│   │   ├── db/                # Shared Prisma client
│   │   ├── http/              # Fetch client, retries, timeouts, JSON responses
│   │   ├── i18n/              # 12-locale dictionaries, negotiator, translator
│   │   ├── ingestion/         # Adapters, registry, runner, scheduler, persist
│   │   ├── observability/     # Structured logger + request-id propagation
│   │   └── security/          # Rate limit, hashing, crypto, request helpers,
│   │                          # cron-auth, key resolution
│   └── middleware.ts          # Request-id + CSP / security headers
├── Dockerfile                 # Multi-stage production image
├── railway.json               # Railway deploy + healthcheck config
├── next.config.js             # standalone output, image hosts, security headers
├── tailwind.config.ts         # Liturgical palette + Cormorant/Inter typography
├── tsconfig.json              # `@/*` → `src/*`
└── .env.example               # All recognized environment variables
```

---

## Getting started

### Prerequisites

- Node.js 20+
- npm (the repo ships a `package-lock.json`)
- A reachable PostgreSQL database

### Install and configure

```bash
npm install
cp .env.example .env
```

Edit `.env` and set at minimum `DATABASE_URL`. For local development the
session secret and admin credentials may be omitted (the app falls back to a
dev-only secret), but they are **required** in production — see
[Environment](#environment).

### Database

```bash
npm run db:push     # applies schema.prisma to a fresh database
# or, against a database tracked by Prisma migrations:
npm run db:migrate  # prisma migrate deploy
npm run db:seed     # loads sample prayers, saints, apparitions, site settings
```

`postinstall` automatically runs `prisma generate`.

### Run

```bash
npm run dev         # next dev on http://localhost:3000
npm run build       # prisma generate && next build
npm start           # next start on $PORT (default 3000)
```

### Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint (ESLint)
npm run lint:fix    # next lint --fix
npm run format      # prettier --write .
npm run format:check
npm run verify      # typecheck + lint + format:check (CI parity)
```

CI (`.github/workflows/ci.yml`) runs `verify` plus `next build` against Node 20.

---

## Environment

Recognized variables (see `.env.example` and `src/lib/env.ts` for the
production-strict schema):

### Required

| Variable          | Notes                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string                                                       |
| `SESSION_SECRET`  | 32+ chars. Required in production. `JWT_ACCESS_SECRET` (32+) is accepted as a fallback. |
| `ADMIN_USERNAME`  | Required in production                                                             |
| `ADMIN_PASSWORD`  | Required in production. Must be at least 12 characters.                            |

### Optional

| Variable                                       | Purpose                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                                     | `development` \| `test` \| `production`                            |
| `APP_URL`, `CANONICAL_URL`                     | Used for OG / metadata base                                        |
| `LOG_LEVEL`                                    | `debug` \| `info` \| `warn` \| `error` (default: info in prod)     |
| `JWT_REFRESH_SECRET`                           | Reserved for future refresh-token flow                             |
| `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM_ADDRESS`  | Transactional email (planned wiring)                               |
| `CLOUDINARY_*`                                 | Media uploads                                                      |
| `REDIS_URL`                                    | Optional cache / queue                                             |
| `SENTRY_DSN`, `PLAUSIBLE_DOMAIN`               | Monitoring / analytics                                             |
| `SEARCH_PROVIDER`, `MEILISEARCH_*`             | `postgres` (default) or `meilisearch`                              |
| `TRANSLATION_PROVIDER`, `TRANSLATION_API_KEY`  | Machine-translation pipeline                                       |
| `TRANSLATION_DEFAULT_SOURCE_LOCALE`            | Defaults to `en`                                                   |
| `TRANSLATION_FALLBACK_LOCALE`                  | Defaults to `en`                                                   |
| `CRON_SECRET`                                  | 16+ chars. Required to call `/api/cron/ingest`.                    |
| `INTERNAL_API_TOKEN`                           | Reserved for internal service-to-service calls                     |
| `INGESTION_USER_AGENT`                         | UA sent during scheduled fetches                                   |
| `INGESTION_HTTP_TIMEOUT_MS`                    | Per-request timeout (ms, default 15000)                            |
| `INGESTION_INITIAL_STATUS`                     | `DRAFT` or `REVIEW` (default `REVIEW`)                             |

`getEnv()` validates these with Zod at first access; in production an invalid
configuration throws, in development it logs a warning and continues.

---

## Internationalization

Twelve locales are supported (`src/lib/i18n/locales.ts`):

`en`, `es`, `fr`, `it`, `de`, `pt`, `pl`, `la`, `tl`, `vi`, `ko`, `zh`.

Selection order:

1. The `vf_locale` cookie, if set to a supported locale.
2. `Accept-Language` negotiation via `negotiator`.
3. `DEFAULT_LOCALE` (`en`).

`POST /api/settings/locale` updates the cookie. Each content entity (prayers,
saints, apparitions, devotions) has a `*Translation` table keyed by `(entityId,
locale)` with `MACHINE` / `HUMAN_REVIEWED` / `LOCKED` workflow status.

---

## Authentication

- Reader accounts: `POST /api/auth/register`, `POST /api/auth/login`,
  `POST /api/auth/logout`. Passwords are hashed with `argon2id`
  (memory cost 19456, time cost 2).
- Sessions: encrypted cookie via `iron-session` (`vf_session`,
  `httpOnly`, `sameSite=lax`, `secure` in production).
- Admin: a single operator account configured through `ADMIN_USERNAME` /
  `ADMIN_PASSWORD`. Login at `/admin/login` (`POST /api/admin/login`) sets
  `session.role = "ADMIN"` and `session.adminSignedInAt`. Use `requireAdmin()`
  to gate server logic.
- Rate limiting is applied to login, register, admin login, and other
  policies (`src/lib/security/rate-limit.ts`). Buckets are persisted in
  `RateLimitBucket`; if the database is unreachable the limiter falls back
  to an in-memory bucket.

---

## Security

- `src/middleware.ts` ensures every request has an `x-request-id`, sets a
  Content-Security-Policy and the usual hardening headers
  (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy`, and HSTS in production).
- `next.config.js` re-asserts security headers at the framework level and
  disables `x-powered-by`.
- `/api/cron/ingest` requires a constant-time match against `CRON_SECRET`
  via either `Authorization: Bearer <secret>` or `X-Cron-Secret`.
- Admin actions write to `AdminAuditLog` (`src/lib/audit`).

---

## Content model

The Prisma schema (`prisma/schema.prisma`) defines, among others:

- **Identity**: `User`, `Session`, `Profile`.
- **User content**: `JournalEntry`, `Goal`, `GoalChecklistItem`, `Milestone`.
- **Catalog**: `Prayer`, `Saint`, `MarianApparition`, `Parish`, `Devotion`,
  each with a `*Translation` sibling.
- **Saved items**: `UserSavedPrayer`, `UserSavedSaint`, `UserSavedApparition`,
  `UserSavedParish`, `UserSavedDevotion`.
- **Curation**: `ContentReview`, `Tag`, `EntityTag`, `Category`,
  `MediaAsset`, `EntityMediaLink`.
- **Pages / settings**: `HomePage`, `HomePageBlock`, `SiteSetting`.
- **Ops**: `IngestionSource`, `IngestionJob`, `IngestionJobRun`,
  `AdminAuditLog`, `RateLimitBucket`.

Catalog entities all carry a `ContentStatus` (`DRAFT` → `REVIEW` →
`PUBLISHED` / `ARCHIVED`) plus a `contentChecksum` so the ingestion pipeline
can short-circuit unchanged records.

---

## Ingestion pipeline

Scheduled scrapers register adapters, fetch from a hard-coded allowlist of
Vatican-affiliated hosts, and write items to the moderation queue.

- Adapters live under `src/lib/ingestion/sources` and are registered via
  `registerVaticanAdapters()` / `ensureVaticanSchedule()`.
- New or changed records are persisted with `INGESTION_INITIAL_STATUS`
  (defaulting to `REVIEW`) so nothing fetched goes live until an admin
  approves it through `/admin/ingestion` or `/admin/<entity>`.
- Trigger from cron: `POST /api/cron/ingest` with `Authorization: Bearer
  $CRON_SECRET`. The same handler accepts `GET` for platforms that prefer
  it. `maxDuration` is 60s.
- Trigger ad-hoc from the admin console: `POST /api/admin/ingestion/run`
  (optional `{ "jobName": "..." }` body). Both routes record an audit entry.
- Each run also prunes expired `RateLimitBucket` rows.

---

## Admin console

`/admin` is locked behind `requireAdmin` and shows twelve sections
(`src/app/admin/_dashboard/cards.ts`):

1. Homepage blocks
2. Prayers
3. Saints
4. Marian apparitions
5. Parishes
6. Liturgy history
7. Translations
8. Ingestion
9. Search settings
10. Media library
11. Favicon
12. Audit log

Content actions go through `POST /api/admin/content/review` with
`{ entityType, entityId, action, notes }` where `action` is
`approve` | `reject` | `request-revision` | `move-to-review`.

---

## API surface

| Method | Path                                      | Purpose                                        |
| ------ | ----------------------------------------- | ---------------------------------------------- |
| GET    | `/api/health`                             | Liveness + DB ping (used by Docker / Railway)  |
| POST   | `/api/auth/register`                      | Create reader account                          |
| POST   | `/api/auth/login`                         | Reader login                                   |
| POST   | `/api/auth/logout`                        | Reader logout                                  |
| POST   | `/api/admin/login`                        | Admin login                                    |
| POST   | `/api/admin/logout`                       | Admin logout                                   |
| POST   | `/api/admin/content/review`               | Approve / reject / revise / move-to-review     |
| POST   | `/api/admin/ingestion/run`                | Run a single job or all active jobs            |
| GET    | `/api/admin/favicon`, POST same path      | Read / replace favicon asset                   |
| GET    | `/api/admin/homepage`, POST same path     | Read / update homepage block config            |
| POST   | `/api/cron/ingest` (also `GET`)           | Run scheduler (cron-secret authenticated)      |
| POST   | `/api/journal`                            | Create journal entry                           |
| POST   | `/api/journal/[id]/delete`                | Delete journal entry                           |
| POST   | `/api/settings/locale`                    | Set locale cookie                              |

---

## Deployment

### Docker

The `Dockerfile` builds a slim three-stage image (`node:20-bookworm-slim`),
runs as non-root user `nextjs:nodejs`, exposes `3000`, and on start runs
`prisma migrate deploy` (falling back to `prisma db push --accept-data-loss`)
before launching `node server.js`. A `HEALTHCHECK` polls `/api/health`.

### Railway

`railway.json` builds with the Dockerfile, sets the same start command, and
points the platform healthcheck at `/api/health` with a 120s timeout and a
5-retry on-failure restart policy.

### Cron

Schedule a recurring `POST` to `https://<host>/api/cron/ingest` with
`Authorization: Bearer $CRON_SECRET`. Any cron platform works (Railway,
Vercel, GitHub Actions, etc.).

---

## License

See `LICENSE`.
