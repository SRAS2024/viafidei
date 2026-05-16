# Via Fidei

> _The Way of Faith._ A multilingual Catholic platform — prayers, saints,
> sacramental guidance, liturgy, and parish discovery — presented with reverence
> and clarity.

**Live site: [etviafidei.com](https://etviafidei.com)**

Via Fidei is a Next.js 15 application that pairs a public, reader-facing site
with an authenticated admin console for curating Catholic content. It supports
twelve locales, persists data in PostgreSQL via Prisma, and ingests material
from a curated allowlist of credible Catholic sources through a five-stage
intelligent packaging pipeline (format → clean → classify → enrich → sanitize)
that auto-publishes clean records, routes borderline content into a moderation
queue, hard-deletes landing-page noise outright, and runs a catalog janitor on
every cron tick to keep existing rows consistent.

The public site exposes nine tabs — **Home**, **Prayers**, **Sacraments**,
**Spiritual Life**, **Spiritual Guidance** (the parish finder), **Liturgy**,
**History**, **Saints & Our Lady**, and the authenticated **Profile** — plus an
admin console under `/admin` that operates with its own chrome (the public
navigation is suppressed automatically on every `/admin` route).

## Site, domain, and email facts

A few infrastructure facts that don't change very often and shouldn't be
edited blindly:

- **Official site name.** The official website name is **Via Fidei** and is
  used everywhere in copy, metadata, and templates.
- **Canonical domain.** The canonical production domain is
  **`https://etviafidei.com`**. It is hardcoded in `src/lib/config.ts` and
  used for metadata, sitemap, robots, and email links — no environment
  variable required.
- **Admin dashboard.** The admin console is served at **`/admin`** and only
  at `/admin`. The login screen is at `/admin/login`. Admin credentials are
  managed exclusively through the existing `ADMIN_USERNAME` / `ADMIN_PASSWORD`
  server environment variables — there is no admin UI for credential changes.
- **Sitemap.** The sitemap is served at **`/sitemap.xml`**. There is **one**
  authoritative source: `src/app/sitemap.ts`. Next's metadata route handler
  generates the XML dynamically (static public pages plus published-content
  detail entries pulled from the database with `updatedAt` as `lastmod`).
  Do not add a static `public/sitemap.xml` — that creates two conflicting
  sources. Google Search Console fetches `/sitemap.xml`.
- **Google Search Console verification.** The file
  `public/google0292583cfdf40074.html` is intentionally kept in the public
  folder. **Do not rename, move, or remove it** — Google revalidates the
  property by fetching that exact path.
- **Transactional sender address.** The official transactional sender address
  is **`notifications@etviafidei.com`**, hardcoded in `src/lib/config.ts`.
  It is the only address used for account-related email (welcome, password
  reset, email verification) and operational admin email. Email is delivered
  via **Resend** when `RESEND_API_KEY` is set; without it, email features
  are safely skipped and the rest of the auth flow still succeeds.
- **Operational admin mailbox.** Admin email (the biweekly Content Management
  Report, the monthly Archive Cleaning Up digest, the monthly Error Report
  PDF, threshold milestone alerts at 25 / 50 / 75 / 100 percent, Critical
  Failure pages, Security Breach alerts) is delivered to `ADMIN_EMAIL` —
  set in the hosting platform's environment dashboard (Railway, Vercel,
  …). There is **no admin UI for this value** because operational alerts
  must keep working even if the admin console itself is down. When unset,
  every admin notification is logged and silently skipped at the transport
  layer; the rest of the app keeps running.
- **Email DNS records are managed externally.** SPF, DKIM, DMARC, and
  return-path records live at the DNS provider and authoritatively belong
  there. **App code must not generate, write, or overwrite DNS records.**

---

## Stack

| Area               | Choice                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Next.js `15.5.18` (App Router, async cookies/headers, `output: "standalone"`)                                                                                                                                                       |
| Runtime            | Node.js `>= 20`                                                                                                                                                                                                                     |
| Language           | TypeScript `5.6` (strict)                                                                                                                                                                                                           |
| UI                 | React `18.3`, Tailwind CSS `3.4`, Framer Motion                                                                                                                                                                                     |
| Database           | PostgreSQL via Prisma `5.22`                                                                                                                                                                                                        |
| Sessions           | `iron-session` (encrypted cookie, `vf_session`)                                                                                                                                                                                     |
| Password hashing   | `argon2id`                                                                                                                                                                                                                          |
| Validation         | `zod`                                                                                                                                                                                                                               |
| Locale negotiation | `negotiator` + cookie override                                                                                                                                                                                                      |
| Container          | Multi-stage `Dockerfile` (deps → builder → runner)                                                                                                                                                                                  |
| Deployment         | Railway-ready (`railway.json`, healthcheck on `/api/health/live`)                                                                                                                                                                   |
| Email              | Resend transactional sends — account email (welcome, password reset, verification) and admin email (biweekly report, monthly archive cleanup, monthly Error Report PDF, milestone alerts, Critical Failure / Security Breach pages) |
| Startup            | `instrumentation.ts` auto-seeds an empty DB and schedules in-process Vatican ingestion                                                                                                                                              |
| Unit / API tests   | Vitest 3 + v8 coverage (mocked Prisma, Next route handler imports)                                                                                                                                                                  |
| Component tests    | React Testing Library 15 + jsdom + jest-axe                                                                                                                                                                                         |
| End-to-end tests   | Playwright (chromium + mobile-chromium) with visual + perf smoke                                                                                                                                                                    |

---

## Engineering highlights

The repository is intentionally scoped as a portfolio-grade reference for the
kind of trade-offs a small team makes when they want a production-leaning
Next.js application that is honest about its boundaries. The pieces I
would call attention to:

- **Ingestion as a first-class subsystem.** A curated allowlist of Vatican,
  USCCB, and dicastery hosts gates every fetch (`gateUrl` /
  `isApprovedUrl`). Adapters write through a single persistence layer that
  enforces content-hash dedupe, source attribution, and per-run summary
  logs (created / updated / skipped / failed / review-required). Every
  ingested item flows through a five-stage **intelligent packager**:
  - **format** (`src/lib/ingestion/format.ts`) — decode HTML entities,
    fold smart quotes to ASCII, normalise whitespace.
  - **clean** (`src/lib/ingestion/clean.ts`) — strip cookie / subscribe /
    share-this / newsletter / donation / footer boilerplate per field
    so the real content survives.
  - **classify** (`src/lib/ingestion/classify.ts`) — re-route the item's
    `kind` when the body reads more like another type (a "prayer" page
    whose body is actually a saint biography is sent to the Saint
    bucket, not bounced).
  - **enrich** (`src/lib/ingestion/enrich.ts`) — fill missing
    required + helpful fields from the text: prayer category, saint
    patronages + feast day, apparition location + country + status,
    parish diocese + city + region + country, devotion duration +
    tags, liturgy kind, guide kind.
  - **sanitize** (`src/lib/ingestion/validate.ts`) — final per-kind
    quality / correctness / category / shape check with three
    outcomes:
    - **valid → PUBLISHED**
    - **soft fail → REVIEW** (real content, slightly off shape)
    - **noise → HARD-DELETED** (landing pages like
      `"Catholic Prayers - Prayer to Jesus, Marian, & More | EWTN"`,
      navigation cruft like `"Skip to main content…"`, meta-
      descriptions like `"Devotions are manifestations of…"`).
      These never had any place in the catalog. No archive, no
      review — they're discarded.

  A **catalog janitor** (`src/lib/data/catalog-janitor.ts`) runs on
  every cron tick (regardless of the auto-cleanup toggle), walks
  every PUBLISHED row, re-runs the format → clean → validate
  pipeline against it, and:
  - **repackages** rows whose stored text differs from the cleaned
    version (e.g. strips a stale `" | EWTN"` brand suffix from an
    old prayer title);
  - **hard-deletes** rows now classified as noise;
  - **diverts** rows that fail softly to REVIEW.

  The in-process scheduler runs in burst mode while the catalog is
  below target and drops to a maintenance interval afterward — no
  external cron service required.

- **Operational admin email.** A single dispatcher
  (`src/lib/data/admin-notifications.ts`) is invoked on every cron tick
  and emits, on its own cadence, the **Biweekly Admin Report** (Content
  Management Report table — Content / Added / Edited / Deleted /
  Archived per content type, with `+N` / `-N` / `0` formatting), the
  **Monthly Archive Cleaning Up** digest (Content / Archived Deleted on
  the last day of each month), the **monthly Error Report PDF**
  (generated in-process by a small zero-dependency PDF builder under
  `src/lib/email/pdf.ts`), and per-bucket **threshold milestones** at 25
  / 50 / 75 / 100 percent. **Critical Failure** alerts fire when the
  global error boundary, an uncaught exception, or an unhandled
  rejection blows up; **Security Breach** alerts fire on devtools
  abuse, attempted DOM tampering, CSP violations, and admin-login rate-
  limit blowouts. All admin emails greet the recipient as `Admin` and
  share the same paper / serif design system used by the account emails.
- **Admin diagnostics designed around troubleshooting.** Diagnostics are
  split into five sections — Email; Ingestion & Data Management; Sitemap
  & Link Paths; Accounts; and Homepage Saints Feast Day — and each
  result carries severity (pass / warn / fail / skipped), a timestamp,
  a request id, and a short explanation so failures can be
  cross-referenced against the structured log stream. Secrets, database
  URLs, and token values are explicitly stripped before any value is
  rendered to the browser. Every diagnostic page is backed by a
  matching `/api/admin/diagnostics/...` route.
- **Real per-item Data Management logs.** Every ingestion run AND every
  janitor pass writes one `DataManagementLog` row per item action —
  added, updated, dedup-skipped, soft-routed to REVIEW, hard-deleted
  as noise, rejected as structurally invalid, archived by the legacy
  cleanup, or purged after the 30-day archive window — with the
  reason, source, job, and `triggeredBy` flag. The admin Logs page
  can answer "why is the count not changing?" precisely instead of
  showing an unexplained zero.
- **Ingestion run logs and per-item action logs are both
  first-class.** `/admin/logs/ingestion` reads from `IngestionJobRun`
  (per-run picture: source, job, status, counts, duration, error
  message). `/admin/logs/data-management` reads from
  `DataManagementLog` (per-item picture: ADD / UPDATE / DELETE /
  DEDUPE / REJECT / CLEANUP / CATEGORY_FIX / FAIL / PURGE). Each
  has its own admin page with filtering.
- **Manual "Run ingestion now" and "Run data cleanup now" buttons.**
  Both surface clear success or failure feedback inline — counts on
  success, error message on failure — and write to AdminAuditLog so
  the action is traceable.
- **Security headers and observability baked into middleware.** The
  edge middleware sets CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, and HSTS (production only), and
  generates / validates an `X-Request-Id` header for every request so
  it can ride through every log line.
- **A strict approved-source posture for ingestion.** Anything not on the
  Vatican-allowlist is rejected before it reaches the database. The same
  helper gates outbound fetches so adapters cannot accidentally call an
  off-list host. Tests exercise the allowlist directly so the boundary
  cannot regress quietly.
- **Tooling matches the merge bar.** `npm run verify` is the local
  short-form gate (typecheck + lint + format:check + unit tests).
  `npm run verify:full` adds integration + e2e + production build for
  pre-release runs. CI runs the same checks plus a high-severity audit
  gate and a moderate-severity advisory job.

## Screenshots

> 📷 _Screenshot placeholders — replace with rendered captures of each
> surface before publishing. Suggested filenames live under
> `docs/screenshots/` (gitignored by default; commit only the rendered
> versions you intend to ship)._

| Surface                          | Image                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| Home — public landing            | `docs/screenshots/home.png` _(placeholder)_                  |
| Saints calendar — today          | `docs/screenshots/saints-today.png` _(placeholder)_          |
| Prayers index with rite filter   | `docs/screenshots/prayers.png` _(placeholder)_               |
| Spiritual Guidance parish finder | `docs/screenshots/parish-finder.png` _(placeholder)_         |
| Admin console — data management  | `docs/screenshots/admin-data-management.png` _(placeholder)_ |
| Admin diagnostics                | `docs/screenshots/admin-diagnostics.png` _(placeholder)_     |

## Architecture at a glance

```mermaid
flowchart LR
    User((Reader)) -->|HTTPS| Edge[Next.js middleware<br/>CSP · request id · auth]
    Admin((Admin)) -->|HTTPS| Edge
    Edge --> AppRoutes[App Router pages<br/>+ API route handlers]
    AppRoutes --> Prisma[Prisma client<br/>singleton]
    Prisma --> Postgres[(PostgreSQL)]
    AppRoutes --> Resend[Resend API<br/>account email + admin email]
    Resend -.->|ADMIN_EMAIL| AdminMailbox((ADMIN_EMAIL))
    Instrumentation[instrumentation.ts<br/>boot once per process] --> Seeder[Seed +<br/>ensure email tables]
    Seeder --> Postgres
    Instrumentation --> Scheduler[In-process scheduler<br/>burst → maintenance]
    Scheduler -->|POST /api/cron/ingest| AppRoutes
    AppRoutes -->|gateUrl| Sources{{Approved sources<br/>Vatican · USCCB · CBCEW · …}}
    Sources --> Packager[Packaging pipeline<br/>format → clean → classify → enrich → sanitize]
    Packager -->|valid| Postgres
    Packager -->|review| Postgres
    Packager -.->|noise| Discard((discarded))
    AppRoutes --> Janitor[Catalog janitor<br/>every tick · repackage / hard-delete / divert]
    Janitor --> Postgres
    AppRoutes --> AdminNotif[dispatchAdminNotifications<br/>biweekly · monthly archive · monthly PDF · milestones]
    AdminNotif --> Resend
    AppRoutes --> ErrorLog[(ErrorLog)]
    ErrorLog --> AdminNotif
```

The full content lifecycle — ingestion → moderation → publish — is laid
out in [`## Content injection (ingestion) pipeline`](#content-injection-ingestion-pipeline)
below.

---

## Repository layout

```
.
├── prisma/
│   ├── schema.prisma          # Postgres schema (users, content, ingestion, audit, rate limits)
│   ├── migrations/            # Prisma migrations
│   ├── seed.ts                # `npm run db:seed` entrypoint
│   └── seeds/                 # Domain seed data (prayers, saints, apparitions, devotions,
│                              #                   parishes, liturgy entries, spiritual-life
│                              #                   guides, site settings)
├── public/                    # Static assets (favicon, Search Console verification file)
├── src/
│   ├── app/                   # App Router routes
│   │   ├── (public pages)     # /, /prayers, /prayers/[slug], /saints,
│   │   │                      # /saints/[slug], /saints/today, /devotions,
│   │   │                      # /devotions/[slug], /sacraments, /sacraments/[slug],
│   │   │                      # /spiritual-life, /spiritual-life/[slug],
│   │   │                      # /spiritual-guidance, /spiritual-guidance/[slug],
│   │   │                      # /liturgy, /liturgy-history, /liturgy-history/[slug],
│   │   │                      # /history, /search, /login, /register,
│   │   │                      # /forgot-password, /reset-password, /verify-email,
│   │   │                      # /privacy
│   │   ├── profile/           # /profile, /profile/journal, /profile/goals,
│   │   │                      # /profile/goals/completed (preserved
│   │   │                      # history of finished goals + their
│   │   │                      # checklists and journal entries),
│   │   │                      # /profile/milestones, /profile/prayers,
│   │   │                      # /profile/saints, /profile/apparitions,
│   │   │                      # /profile/devotions, /profile/parishes,
│   │   │                      # /profile/settings
│   │   ├── admin/             # 17-card admin dashboard (see Admin console section)
│   │   └── api/               # Route handlers (auth, admin, cron, internal,
│   │                          # journal, settings, health, search, saints/today,
│   │                          # data-management, ingestion-status)
│   ├── components/
│   │   ├── icons/             # Cross ornament, Marian monogram, search, hamburger,
│   │   │                      # user silhouette, spiritual-life icons, logo
│   │   ├── layout/            # Header, footer, brand, nav, mobile menu, search,
│   │   │                      # user menu, route error
│   │   ├── profile/           # Avatar, save button, unverified-email notice
│   │   ├── SecurityTamperDetector.tsx  # Client-side admin tamper detector
│   │   └── ui/                # ConfirmDialog, PageHero, RemoveSavedButton,
│   │                          # AccountRequiredButton, LoginRequiredPopup,
│   │                          # ExpandablePrayer, ExpandableTimelineEvent
│   ├── lib/
│   │   ├── auth/              # Session, password, schemas, user/admin helpers, tokens
│   │   ├── audit/             # AdminAuditLog writer
│   │   ├── concurrency/       # Lock helpers
│   │   ├── content/           # Review workflow + Catholic-rite filtering
│   │   ├── data/              # Per-entity repositories + admin catalog + goal templates
│   │   │                      # + admin-notifications dispatcher (biweekly /
│   │   │                      # monthly / milestone / critical / security)
│   │   │                      # + admin-notification-state tracker (dedup)
│   │   │                      # + catalog-janitor (always-on repackage / hard-
│   │   │                      # delete / divert pass on every PUBLISHED row)
│   │   │                      # + error-log (runtime error capture)
│   │   ├── db/                # Prisma client, table diagnostics, init
│   │   ├── email/             # Resend client, link builders, account templates,
│   │   │                      # admin templates + admin-send + zero-dep PDF
│   │   │                      # generator, send helpers, locale-aware translations
│   │   ├── http/              # Fetch client, retries, timeouts, JSON responses,
│   │   │                      # admin-catalog + saved-item route factories
│   │   ├── i18n/              # 12-locale dictionaries, negotiator, translator,
│   │   │                      # locale / theme / rite cookies
│   │   ├── ingestion/         # Adapters, registry, runner, scheduler, persist,
│   │   │                      # format (per-kind text normaliser), backlog-prefixes
│   │   ├── observability/     # Structured logger + request-id propagation
│   │   │                      # + page-error / api-error → ErrorLog bridge
│   │   ├── security/          # Rate limit, hashing, crypto, request helpers,
│   │   │                      # cron-auth, key resolution, security-events
│   │   │                      # (admin Security Breach + ErrorLog dispatcher)
│   │   └── startup/           # Auto-seed bootstrap + content seeder
│   ├── instrumentation.ts     # Next.js startup hook (auto-seed + ingestion schedule)
│   └── middleware.ts          # Request-id + CSP / security headers
├── tests/                     # Vitest unit + component + API + ingestion + DB tests
│   ├── auth/                  # Auth module (password, schemas, user, tokens, admin)
│   ├── api/                   # Route handler tests (mocked Prisma)
│   ├── components/            # RTL tests with `@vitest-environment jsdom`
│   ├── data/                  # Repository tests (admin-users, admin-notifications, etc.)
│   ├── db/                    # checkRequiredTables / checkSeedContent
│   ├── email/                 # Resend client, templates, link builders, send helpers,
│   │                          # admin templates, admin send, PDF generator
│   ├── fixtures/              # Factories + mock SourceAdapter / fetch
│   ├── helpers/               # Prisma + cookie mocks
│   ├── ingestion/             # validateItem + sanitize boundary tests, formatter
│   ├── integration/           # Real-DB tests, gated behind VITEST_INTEGRATION=1
│   ├── routes/                # Static route coverage check
│   ├── security/              # Rate limit DB + memory fallback
│   └── middleware.test.ts     # Request-id + security headers
├── e2e/                       # Playwright smoke + visual regression + perf
├── scripts/
│   ├── start.sh               # Container entrypoint (wait for DB → migrate deploy → exec server)
│   └── test-db.sh             # Reset isolated test DB (refuses prod URLs)
├── playwright.config.ts       # E2E + visual regression config
├── vitest.config.ts           # Unit + component test config (coverage thresholds)
├── TESTING.md                 # Test stack reference (commands, layout, isolation)
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
npm run db:seed     # loads prayers, saints, apparitions, devotions, parishes,
                    #        liturgy entries, spiritual-life guides, site settings
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
npm run typecheck         # tsc --noEmit
npm run lint              # next lint (ESLint)
npm run lint:fix          # next lint --fix
npm run format            # prettier --write .
npm run format:check
npm run test              # Vitest: unit + component + API + DB + email + data + route tests
npm run test:watch        # Vitest watch mode
npm run test:coverage     # Vitest with coverage + threshold gate
npm run test:integration  # Real-Postgres tests (requires TEST_DATABASE_URL)
npm run test:e2e          # Playwright (requires `npx playwright install`)
npm run test:db:setup     # Reset the isolated test DB from migrations
npm run verify            # typecheck + lint + format:check + test (CI parity)
npm run verify:full       # verify + integration + e2e + production build
```

CI (`.github/workflows/ci.yml`) runs five jobs on Node 22 LTS:

1. **verify** — `prisma validate`, typecheck, lint, format check, Vitest, production build
2. **audit** — `npm audit --audit-level=high` (high-severity is the merge gate)
3. **advisories** — `npm audit --audit-level=moderate` (advisory only, non-blocking)
4. **integration** — applies migrations to a Postgres service container and runs `tests/integration/**` on PRs and `main`
5. **e2e** — installs Chromium, runs Playwright, uploads the HTML report (push to `main` only)

See [TESTING.md](TESTING.md) for the full layout, fixtures, and test-DB isolation details.

---

## Environment

The app deliberately ships with a **minimal** production environment surface.
Anything that is not a private secret or deployment-specific value lives in
`src/lib/config.ts` as a hardcoded default.

### Required (production)

Only these four variables must be set for a production deployment to start:

| Variable         | Notes                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`   | PostgreSQL connection string. Private and deployment-specific.                             |
| `SESSION_SECRET` | 32+ chars of high-entropy randomness. Encrypts session cookies and derives the cron token. |
| `ADMIN_USERNAME` | Admin login username.                                                                      |
| `ADMIN_PASSWORD` | Admin login password. At least 12 characters.                                              |

### Optional

| Variable         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`       | `development` \| `test` \| `production`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `RESEND_API_KEY` | Resend API key. When unset, transactional email is silently skipped — auth flows succeed without delivering email.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ADMIN_EMAIL`    | Destination address for operational admin email — biweekly Content Management Report, monthly Archive Cleaning Up digest, monthly Error Report PDF, threshold milestone alerts (25 / 50 / 75 / 100 percent of each content target), Critical Failure alerts, and Security Breach alerts. Set in the hosting platform's environment dashboard (Railway, Vercel, …); there is no admin UI for this value because operational alerts must keep working even if the admin console itself is down. When unset, every admin email is logged and skipped. |

`getEnv()` validates these with Zod at first access; in production an invalid
configuration throws, in development it logs a warning and continues.

### Hardcoded configuration (no environment variables)

The following values are baked into `src/lib/config.ts`. They used to be
environment variables; they are now safe internal defaults so production
deployments do not need to set them:

| Setting                             | Hardcoded value                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Canonical / app URL                 | `https://etviafidei.com`                                                                           |
| Email sender address                | `notifications@etviafidei.com`                                                                     |
| Search provider (echoed by reindex) | `postgres`                                                                                         |
| Server port / hostname              | `3000` / `0.0.0.0`                                                                                 |
| Logger floor                        | `info` in production, `debug` otherwise                                                            |
| Ingestion HTTP timeout              | 15000 ms                                                                                           |
| Ingestion User-Agent                | `ViaFideiBot/1.0 (+https://etviafidei.com/bot; ingestion@viafidei.com)`                            |
| Ingestion initial status            | `PUBLISHED` (auto-publish; soft-validator failures are diverted to `REVIEW`)                       |
| Ingestion scheduler — burst tick    | 2.5 min (1/4 of base 10 min) while any target unmet; initial delay 30 s after deploy               |
| Ingestion scheduler — maintenance   | ≈ 84 hours (twice per week) once every target is met                                               |
| Backlog targets                     | 500 prayers · 7 000 saints · 150 000 parishes · 1 500 church docs · 7 sacraments · 4 consecrations |
| Auto-cleanup of archived rows       | Enabled — archived rows are hard-deleted after 30 days (configurable in site settings)             |
| In-process ingestion scheduler      | **Enabled by default.** Set `appConfig.ingestion.schedulerDisabled = true` to opt out.             |

The list above is the **complete** runtime surface — there are no additional
credentials to configure.

---

## Internationalization

Twelve locales are supported (`src/lib/i18n/locales.ts`):

`en`, `es`, `fr`, `it`, `de`, `pt`, `pl`, `la`, `tl`, `vi`, `ko`, `zh`.

Selection order:

1. The `vf_locale` cookie, if set to a supported locale.
2. `Accept-Language` negotiation via `negotiator`.
3. `DEFAULT_LOCALE` (`en`).

`POST /api/settings/locale` updates the cookie. Each content entity (prayers,
saints, apparitions, devotions, liturgy entries, spiritual-life guides) has a
`*Translation` table keyed by `(entityId, locale)` with `MACHINE` /
`HUMAN_REVIEWED` / `LOCKED` workflow status.

### Catholic rites

Beyond locale, readers can choose a Catholic rite (`src/lib/content/rites.ts`)
so liturgical content can be filtered to their tradition. Twelve rites are
recognised — `roman` (Latin) is the default, with `byzantine`, `maronite`,
`chaldean`, `coptic`, `syroMalabar`, `syroMalankara`, `armenian`, `ethiopic`,
`melkite`, `ukrainian`, and `ruthenian`. The `vf_rite` cookie is set via
`POST /api/settings/rite`. Rite-neutral content is shown to everyone; only
rite-tagged slugs are filtered out when the reader's selection differs.

---

## Authentication

- Reader accounts: `POST /api/auth/register`, `POST /api/auth/login`,
  `POST /api/auth/logout`. Passwords are hashed with `argon2id`
  (memory cost 19456, time cost 2).
- Password reset: `POST /api/auth/forgot-password` issues a token (always
  returns OK so addresses can't be enumerated); `POST /api/auth/reset-password`
  consumes the token, resets the password, and revokes existing sessions.
  Tokens are SHA-256 hashed before storage and expire after 60 minutes.
- Email verification: `POST /api/auth/verify-email` consumes a token;
  `PUT /api/auth/verify-email` issues a fresh one for the signed-in user.
  Verification tokens expire after 24 hours.
- Sessions: encrypted cookie via `iron-session` (`vf_session`,
  `httpOnly`, `sameSite=lax`, `secure` in production).
- Admin: a single operator account configured through `ADMIN_USERNAME` /
  `ADMIN_PASSWORD`. Login at `/admin/login` (`POST /api/admin/login`) sets
  `session.role = "ADMIN"` and `session.adminSignedInAt`. Use `requireAdmin()`
  to gate server logic.
- Rate limiting (`src/lib/security/rate-limit.ts`) is persisted in
  `RateLimitBucket`; if the database is unreachable the limiter falls back
  to an in-memory bucket. Named policies cover `login`, `register`,
  `passwordReset`, `emailVerification`, `adminLogin`, `adminWrite`,
  `userWrite`, `savedItem`, `goalWrite`, `profileWrite`, `mediaUpload`,
  `search`, `publicRead`, and `ingestionTrigger`.

---

## Testing

The test suite lives under `tests/` (Vitest) and `e2e/` (Playwright). For the
full reference — fixtures, factories, mock SourceAdapter helpers, test-DB
isolation guards — see [TESTING.md](TESTING.md). The short version:

- **Unit + component + API + ingestion + DB + route tests** run via
  `npm run test`. Component tests opt into jsdom via the
  `@vitest-environment jsdom` doc-comment at the top of the file.
  Prisma is mocked through `tests/helpers/prisma-mock.ts` so the default
  test run never touches a real database.
- **Integration tests** live under `tests/integration/**` and are excluded
  from the default run. They execute under
  `VITEST_INTEGRATION=1 npm run test:integration` against
  `TEST_DATABASE_URL`. Two layers of safety guards (`scripts/test-db.sh`
  and `tests/setup.integration.ts`) refuse to run if the URL contains
  `prod`, lacks `test` in the database name, or points off-localhost
  (override with `TEST_DB_ALLOW_REMOTE=1`).
- **End-to-end + visual regression + perf smoke** runs via
  `npm run test:e2e` (Playwright). The `e2e/smoke.spec.ts` suite covers
  every primary nav route, asserts the header survives tab navigation
  (regression guard), pins visual snapshots for home / search / login,
  and verifies `/api/prayers` respects its 200-item server cap.
- **Coverage thresholds** (`vitest.config.ts`) require 80% lines / 80%
  functions / 75% branches on the security-critical surface (auth,
  rate-limit, middleware, DB diagnostics, destructive-confirm UI). The
  threshold gate fails the build if coverage regresses.
- **Accessibility smoke** uses `jest-axe` against rendered components
  (`tests/components/ConfirmDialog.test.tsx`).

---

## Security

- `src/middleware.ts` ensures every request has an `x-request-id`, sets a
  Content-Security-Policy and the usual hardening headers
  (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy`, and HSTS in production).
- `next.config.js` re-asserts security headers at the framework level and
  disables `x-powered-by`.
- `/api/cron/ingest` requires a constant-time match against the per-deployment
  cron token derived from `SESSION_SECRET` (HMAC-SHA-256 with a domain-separation
  tag), supplied via `Authorization: Bearer <token>` or `X-Cron-Secret`.
- Admin actions write to `AdminAuditLog` (`src/lib/audit`).

---

## Content model

The Prisma schema (`prisma/schema.prisma`) defines, among others:

- **Identity**: `User`, `Session`, `Profile`, `PasswordResetToken`,
  `EmailVerificationToken`.
- **User content**: `JournalEntry` (with an optional `goalId` so entries
  can be attached to a goal and preserved as part of that goal's
  spiritual history), `Goal` (with a `journalEntries` back-relation
  and a `status` of `ACTIVE` → `COMPLETED` / `OVERDUE` / `ARCHIVED`),
  `GoalChecklistItem`, `Milestone`. **Completed goals are never
  deleted automatically** — they leave the active `/profile/goals`
  list the moment they are completed and migrate to a dedicated
  `/profile/goals/completed` page that preserves the original
  checklist, the completion date, and every journal entry the user
  wrote inside the goal. Archived goals remain on the active page
  in a collapsed `<details>` block so they can be un-archived
  without leaving.
- **Catalog**: `Prayer`, `Saint`, `MarianApparition`, `Parish`, `Devotion`,
  `LiturgyEntry`, `SpiritualLifeGuide`, `DailyLiturgy`, each with a
  `*Translation` sibling where applicable.
- **Saved items**: `UserSavedPrayer`, `UserSavedSaint`, `UserSavedApparition`,
  `UserSavedParish`, `UserSavedDevotion`.
- **Curation**: `ContentReview`, `Tag`, `EntityTag`, `Category`,
  `MediaAsset`, `EntityMediaLink`.
- **Pages / settings**: `HomePage`, `HomePageBlock`, `SiteSetting`.
- **Ops**: `IngestionSource` (with `isActive`, `reliabilityScore`,
  `lastSuccessfulSync`, `lastFailedSync`), `IngestionJob`,
  `IngestionJobRun`, `AdminAuditLog` (per-user admin actions, with
  indexes on `(actorUserId, createdAt)` and `(action, createdAt)`),
  `DataManagementLog` (structured record of every automatic /
  manually-triggered cleanup action — `action` is one of `ADD`,
  `UPDATE`, `DELETE`, `REJECT`, `CLEANUP`, `DEDUPE`,
  `CATEGORY_FIX`, `FAIL`, `PURGE`, with `contentType`, `contentRef`,
  `reason`, and `triggeredBy`), `ErrorLog` (runtime error capture for
  the monthly Error Report PDF — `source`, `kind`, `message`, `stack`,
  `route`, `requestId`, `severity` ∈ `warn` / `error` / `critical`),
  `AdminNotificationState` (per-flow dedup state for the operational
  email scheduler — biweekly send timestamps, monthly year-month tags,
  per-bucket milestone thresholds already emailed), `RateLimitBucket`.

Catalog entities all carry a `ContentStatus` (`DRAFT` → `REVIEW` →
`PUBLISHED` / `ARCHIVED`) plus a `contentChecksum` so the ingestion pipeline
can short-circuit unchanged records.

---

## Reader-facing pages

The public site renders entirely from the catalog tables, with a small
in-app fallback spine so pages stay alive if a table happens to be
empty:

- **Prayers** (`/prayers`, `/prayers/[slug]`). Categorised prayer
  catalogue with pagination, filtered by the user's selected Catholic
  rite (rite-neutral prayers always render; rite-tagged prayers from
  another rite are hidden). A single **Filter** dropdown at the top of
  the grid lists the canonical Catholic prayer types — **Marian**,
  **Christ-centered**, **Angelic**, **Eucharistic**, **Sacramental**,
  **Rosary**, **Chaplets**, **Novenas**, **Litanies**, **Liturgical**,
  **Seasonal**, **Daily**, **Lord's Prayer**, and **Traditional
  Prayers**. The dropdown is used on every breakpoint — mobile and
  desktop — so the page stays calm even as the catalog grows.
  Selecting an option is a real server navigation
  (`?filter=<category>`); the matching category is resolved per-prayer
  via `resolvePrayerCategory` (`src/lib/data/prayers.ts`), which runs
  the same `categorizePrayer` heuristic used by the ingestion pipeline
  so the public filter and the seed-time category never disagree.
  Each prayer detail page shows the actual prayer text — pages that
  carry only a source byline (e.g. "Catholic Australia, a work of
  the Australian Catholic Bishops Conference") are now rejected at
  ingestion and never reach this list. At the bottom of every prayer
  / saint / apparition / devotion / liturgy / sacrament detail page
  the `<OfficialSourceLink>` component renders a direct link back to
  the original Holy See / bishops'-conference URL when the row was
  ingested with an `externalSourceKey`.
- **Sacraments** (`/sacraments`, `/sacraments/[slug]`). Surfaces the
  seven sacraments and the four major personal consecrations (Marian
  de Montfort, St. Joseph, Holy Family, Sacred Heart) as
  `SpiritualLifeGuide` rows whose slug starts with `sacrament-` or
  `consecration-`. Each card carries a hand-drawn SVG badge
  (water-and-shell for Baptism, dove for Confirmation, chalice for
  the Eucharist, confessional grille for Reconciliation, vial of oil
  for Anointing of the Sick, chasuble for Holy Orders, interlocking
  rings for Matrimony, crowned M for Marian consecration, lily +
  carpenter's square for St Joseph, three radiating hearts for the
  Holy Family, thorn-wreathed heart for the Sacred Heart). The
  **Reconciliation** card ships with a full Confession guide —
  preparation, examination of conscience against the Ten
  Commandments, contrition and firm purpose of amendment, the rite
  itself (`"Bless me, Father, for I have sinned…"`), the Act of
  Contrition, absolution, the penance, and the spiritual follow-up.
  When a user creates a Confession goal (`monthly-confession`), the
  same nine-step flow is pre-populated as the goal's checklist.
  Consecrations carry their daily readings and prayers (e.g. the
  four-week structure of de Montfort's True Devotion) in the
  guide steps; public copy explains the spiritual purpose of the
  consecration without claiming a profile-badge reward.
- **Spiritual-life guides** (`/spiritual-life`,
  `/spiritual-life/[slug]`). Each guide loads from
  `SpiritualLifeGuide`, with steps stored as structured JSON. When a
  guide references a prayer, the page renders an `ExpandablePrayer`
  block per prayer.
- **Today's Feast Day Saints** — rendered as a section near the
  bottom of `/` and as a dedicated `/saints/today` page. The
  homepage section reads the user's local date from
  `new Date()` in the browser (so the date is in the user's
  device timezone), fetches the matching saints via
  `/api/saints/today`, and surfaces up to five names in
  veneration order with a "See more" link to the full
  `/saints/today` page. Each name links to the saint's detail
  page. Feast-day matching is index-backed: the Saint table
  carries structured `feastMonth` and `feastDayOfMonth` columns
  (added in migration `0009_saint_feast_month_day`, backfilled
  from the legacy freeform `feastDay` text), and
  `listSaintsForFeastDate()` joins those columns first, then
  falls back to a JS pass over the legacy text using
  `feastDayMatchesDate()` so any row whose backfill could not
  populate the structured fields still matches. The matcher
  understands canonical ("August 28"), abbreviated ("Aug 28"),
  ordinal ("October 1st"), trailing-prose
  ("January 28 — Doctor of the Church") and multi-feast
  ("August 4 / 5 (1969 reform)") variants. `parseFeastDayText()`
  is the central parser used by both ingestion and admin edits,
  so the structured columns stay in sync whenever an admin saves
  a Saint row through the admin catalog.
  `/api/saints/today` returns a `diagnostic` field (kind:
  `empty_catalog` / `no_structured_fields` / `no_match_for_date`)
  when the result list is empty so the admin diagnostic page can
  pinpoint the cause without guessing.
- **Saints & Our Lady** (`/saints`, `/saints/[slug]`). The default
  ordering surfaces the most venerable figures first — Mary, Joseph,
  the Twelve Apostles in their traditional order, then Mary Magdalene
  / Stephen / Paul — and falls through to alphabetical for the rest.
  Three pill filters at the top of the page narrow to **Saints**,
  **Our Lady**, or **Angels** (e.g. archangels and the named angels).
  The filtering is two-phase: Postgres performs a coarse
  case-insensitive match on `canonicalName`, and the JS
  `categorizeSaintByName` helper then re-classifies each row so the
  default **Saints** tab never duplicates entries that belong under
  **Our Lady** or **Angels**. Marian apparitions render in a separate
  section underneath with their own pagination. Each saint detail
  page parses the biography into labelled sections
  (`src/lib/data/saint-sections.ts`). List cards display the saint's
  feast day, biography excerpt, and `patronages` so visitors can see
  at a glance who each is the patron of. The ingestion pipeline now
  rejects "EWTN live programming" / "Catholic Australia, a work of"
  / TV-listing pages so unrelated content never lands in the Saints,
  Our Lady, or Angels buckets.
- **Liturgy** (`/liturgy`). New dedicated tab. Surfaces only true
  liturgical content from `LiturgyEntry` — the Mass, the liturgical
  year, the rites of marriage / funerals / ordination, liturgical
  symbolism, and the glossary. Council documents, encyclicals, the
  Catechism, and Church history live under **History**.
- **History** (`/history`). New dedicated tab. Renders an interactive
  slidable timeline from Christ's ministry (27 AD) through the
  current year. The user can drag the slider or type a year directly
  into a numeric input to scrub through the chronology; filter pills
  along the top let them narrow by **Beginnings**, **Councils**,
  **Schisms & Reform**, **Doctrine & Magisterium**, or **Modern
  Era**. Under the slider sits the "Council documents" section —
  collapsible `<details>` cards for every ecumenical council (Nicaea
  through Vatican II), each expanding to the conciliar texts the
  pipeline has ingested. Data merges live `LiturgyEntry` rows of
  kind `COUNCIL_TIMELINE`, slugs starting with `church-history-`,
  `council-`, `vatican-council-`, or `synod-`, and the in-app
  fallback spine in `src/lib/data/church-history.ts`. The legacy
  `/liturgy-history` index now permanently redirects to `/history`;
  the per-document detail route `/liturgy-history/[slug]` stays in
  place for deep-links.
- **Search** (`/search` and the header typeahead). Powered by
  `searchAll()` and `suggest()` in `src/lib/data/search.ts`. Strict
  Postgres `contains` matches run alongside fuzzy candidate sets that
  use 3-letter sliding windows to tolerate single-character typos
  (`rosery` → "Rosary"); results are scored with a Levenshtein-based
  similarity so common misspellings of saint names, prayers, or guides
  still surface a sensible suggestion. The index covers prayers,
  saints, Marian apparitions, parishes, devotions, liturgy / Church
  history entries, and spiritual-life guides. `detectSearchIntent()`
  classifies the query — a "City, State", a parish/church/cathedral/
  diocese keyword, a US state abbreviation, an "Our Lady of" pattern,
  an angel reference, a sacrament keyword, a prayer keyword, or a
  leading saint title — and the `/search` page re-orders the result
  groups so the intent-matched bucket lands first. Each result row
  carries a content-type pill (Parish / Saint / Prayer / Apparition /
  Devotion / Church teaching / Spiritual life) so a mixed list reads
  cleanly. The header typeahead caps suggestions at **2 on mobile**
  (< 640 px) and **3 on tablet and desktop** (≥ 640 px) — driven live
  from `matchMedia` and enforced again server-side via the `limit`
  query param on `/api/search/suggest` so the payload never exceeds
  what is shown.
- **Parish finder** (`/spiritual-guidance`,
  `/spiritual-guidance/[slug]`). Combines manual search and an opt-in
  device-location lookup via the W3C Geolocation API. Location is
  asked for once: the user can accept (the answer is persisted to
  `localStorage` so we don't re-prompt on every visit), decline, or
  ignore the prompt. When granted, `/api/parishes/near` returns the
  closest parishes within a 50 km radius using the haversine formula
  on the published parish set (Postgres handles the `latitude` /
  `longitude` filter, the application sorts by distance). Manual
  parish search via `searchParishes()` (`src/lib/data/parishes.ts`)
  spans **name, city, region / state / province, country, diocese,
  and address** with a token-AND-of-field-ORs predicate so
  "Boston, MA" and "Archdiocese of Boston" both match. Parishes are
  populated through the `vatican.parishes` adapter from approved
  bishops' conference directories; each row carries `name`,
  `address`, `city`, `region`, `country`, `phone`, `email`,
  `websiteUrl`, `diocese`, `latitude`,
  `longitude`, plus the standard ingestion metadata
  (`externalSourceKey`, `sourceHost`, `contentChecksum`).
- **Profile** (`/profile` and the sub-pages under it). Avatar +
  display name + email, followed by a `<ProfileBadgeStrip>` that
  renders every sacrament / consecration badge the user has earned
  (sourced from `Milestone` rows via `listBadgesForUser()`; badges
  persist across logout, login, and refresh; the strip links to
  `/profile/milestones` for the full history). Below the header
  the page groups every user-content area into sections —
  **My Goals** + **Completed Goals** + **Milestones**, **Journal**
  - **Favorites**, **Saved prayers** + **Saved devotions**, **Saved
    liturgical content** (parishes, apparitions), **Saved learning**
    (saints). Each goal card on `/profile/goals` exposes an inline
    journal panel; completed goals migrate to
    `/profile/goals/completed` the moment they're finished, where
    they are preserved indefinitely with their original checklist,
    completion date, and every journal entry the user wrote inside
    the goal.

---

## Content injection (ingestion) pipeline

Scheduled scrapers register adapters, fetch from a hard-coded allowlist of
approved Catholic sources, and write items to the moderation queue. The
allowlist is the single point of truth for which hosts may populate doctrine,
liturgy, Church history, prayers, saints, devotions, guides, or
catechetical content — anything not on the allowlist is refused at fetch
time.

### Approved-source allowlist

The full list (≈350 hosts) lives in
`src/lib/ingestion/sources/vatican-allowlist.ts` and is rendered for
admins at **`/admin/sources`**. It is organised in three tiers:

- **Tier 1 — Holy See and Vatican press.** `vatican.va`, `press.vatican.va`,
  `vaticannews.va`, `osservatoreromano.va`, `synod.va`, every Vatican
  dicastery (`dicasteryforevangelization.va`, `doctrineoffaith.va`,
  `dicasterydivineworship.va`, etc.), the Vatican Apostolic Library,
  the Vatican Observatory, the Vatican Museums, and Vatican City State.
- **Tier 2 — Conferences of bishops.** USCCB (United States), CCCB
  (Canada), CBCEW (England & Wales), Irish Bishops, Australian Bishops,
  New Zealand Bishops, CBCP (Philippines), SACBC (Southern Africa), CBCI
  (India), DBK (Germany), Conferencia Episcopal Española, CEI
  (Italy), Église catholique de France, Conferência Episcopal
  Portuguesa, Konferencja Episkopatu Polski, CELAM, CEM (Mexico), CNBB
  (Brazil), Argentine Episcopal Conference, Den katolske kirke i Norge,
  plus major archdioceses (New York, Chicago, Boston, Milwaukee,
  Westminster, Los Angeles).
- **Tier 3 — Pontifical institutes and approved Catholic reference.**
  Pontifical Lateran, Gregorian, and Holy Cross universities;
  EWTN; Bible Gateway, Biblia.com, Douay-Rheims Bible Online; the
  Liturgical Calendar service; iBreviary; Universalis (Liturgy of the
  Hours); Corpus Christi Watershed; ICEL; Magnificat; New Advent
  (Catholic Encyclopedia); the Christian Classics Ethereal Library
  (patristic primary sources only).

`isApprovedHost(...)` and `gateUrl(...)` are called at every fetch site so
a misconfigured adapter cannot accidentally reach an off-list source.

### Adapters and content types

Adapters live under `src/lib/ingestion/sources/vatican-adapters.ts` and are
registered via `registerVaticanAdapters()` / `ensureVaticanSchedule()`.
The system has full ingestion support across the app:

| Adapter               | Target table         | Content                                                                                                                                  |
| --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `vatican.prayers`     | `Prayer`             | Liturgical and devotional prayers from the Holy See                                                                                      |
| `catholic.prayers`    | `Prayer`             | Bishops' conference prayer catalogues                                                                                                    |
| `credible.prayers`    | `Prayer`             | EWTN / Catholic Culture / KofC / religious order prayer pages                                                                            |
| `vatican.saints`      | `Saint`              | Saint biographies from the Holy See                                                                                                      |
| `bishops.saints`      | `Saint`              | Saint biographies from bishops' conferences                                                                                              |
| `credible.saints`     | `Saint`              | Saint biographies from EWTN, Catholic Culture, New Advent, religious orders                                                              |
| `vatican.apparitions` | `MarianApparition`   | Approved Marian apparitions                                                                                                              |
| `vatican.devotions`   | `Devotion`           | Devotions and spiritual practices                                                                                                        |
| `catholic.devotions`  | `Devotion`           | Conference-republished devotional material                                                                                               |
| `vatican.parishes`    | `Parish`             | Parish directories                                                                                                                       |
| `vatican.teaching`    | `LiturgyEntry`       | Catechetical / sacramental / liturgical content                                                                                          |
| `vatican.history`     | `LiturgyEntry`       | Church-history events and ecumenical councils                                                                                            |
| `vatican.guides`      | `SpiritualLifeGuide` | Spiritual-life guides (rosary, confession, vocation discernment)                                                                         |
| `vatican.councils`    | `LiturgyEntry`       | Conciliar documents from `/archive/hist_councils/` (slug `council-`)                                                                     |
| `vatican.catechism`   | `LiturgyEntry`       | Full Catechism of the Catholic Church (slug `catechism-`)                                                                                |
| `vatican.canonlaw`    | `LiturgyEntry`       | Full Code of Canon Law (CIC 1983) and Code of Canons of the Eastern Churches (CCEO 1990) in seven Holy-See languages (slug `canon-law-`) |
| `vatican.encyclicals` | `LiturgyEntry`       | Every papal encyclical archive on vatican.va, every pope from Pius IX through Leo XIV (slug `encyclical-`)                               |

Each ingested record carries source metadata: `externalSourceKey` (the
upstream URL — used for duplicate detection), `sourceHost` (parsed from
the URL), `contentChecksum` (SHA-256 of the canonical content — short-
circuits unchanged runs), `category` / `kind` for indexing, and a
`createdAt` / `updatedAt` retrieval timestamp. Curated rows
(`PUBLISHED` / `ARCHIVED`) are protected from automatic overwrites.

### Validation and auto-publish workflow

Every batch is sent through `sanitize()` and `validateItem()` before
persistence. The validator is intentionally strict — quality over
quantity is an explicit project priority — and rejects, in addition
to the obvious schema problems:

- **Source bylines and navigation copy.** Pages that read "Catholic
  Australia, a work of the Australian Catholic Bishops Conference",
  "EWTN is the global Catholic Network", "Subscribe to our
  newsletter", "Donate now", or "404 Not Found" are rejected via a
  curated set of `NON_CONTENT_PHRASES` regular expressions
  (`src/lib/ingestion/validate.ts`).
- **Prayers without prayer language.** A page tagged as a prayer
  must contain at least one prayer-marker word — `Amen`, `Hail`,
  `pray`, `Let us pray`, `Lord have mercy`, `Soul of Christ`,
  `Mother of God`, the `I believe / I confess` family, etc. Pure
  source-summary text is refused.
- **Saints without biographical vocabulary.** A page tagged as a
  saint must contain biographical markers (`Saint`, `Blessed`,
  `martyr`, `bishop`, `Doctor`, `born`, `died`, `canonized`,
  `feast`) and must not look like a catalog index
  ("Catholic Saints", "Patron Saints Directory").
- **Marian apparitions without Marian vocabulary.** The summary
  must reference Mary, Our Lady, the Blessed Virgin, an
  appearance, vision, or apparition — and `approvedStatus`
  must be one of the canonical Church statuses (`Approved`,
  `Constat de supernaturalitate`, `Worthy of belief`, etc.).
- **Devotions without a devotional practice.** A devotion must
  mention rosary, novena, chaplet, consecration, adoration, the
  stations of the cross, first Friday / Saturday, the scapular,
  the Miraculous Medal, or otherwise contain `prayer` /
  `meditation`.
- **Length floors per kind.** Prayer body ≥ 40 characters, saint
  biography ≥ 80, apparition summary ≥ 60, devotion summary ≥ 40,
  liturgy body ≥ 80, guide summary ≥ 40 — so the public catalog
  feels consistent and complete rather than a mix of one-line
  stubs and full entries.
- **Parish non-Catholic rejection.** Baptist / Methodist /
  Lutheran / Presbyterian / Orthodox / Anglican / Episcopal /
  mosque / synagogue / temple / Hindu / Buddhist names are
  refused; "Find a parish", "Parish locator", and "Parish
  directory" navigation pages are refused.
- **Off-allowlist external keys.** Any `externalSourceKey` URL
  whose host is not in the Vatican allowlist is rejected.

Validation failures are classified by **severity**
(`src/lib/ingestion/validate.ts`):

- **Noise** — the page is clearly navigation cruft, a brand landing
  page, or a meta-description about a content category (titles
  matching `LANDING_PAGE_TITLE_PATTERNS`, bodies matching
  `META_DESCRIPTION_OPENERS`, or anything else `looksLikeNonContent`
  flags). The runner hard-deletes these with a single `DELETE` row in
  `DataManagementLog`. No archive, no review — they never had any
  place in the catalog.
- **Hard failures** — structurally invalid: missing required fields,
  protected user kinds, off-allowlist sources, malformed URLs/emails,
  unrecognised enum values. Refused outright and logged as `REJECT`.
- **Soft failures** — items that pass the structural and noise
  checks but trip one of the category heuristics (a "prayer" without
  prayer language, a "saint" body missing biographical vocabulary,
  an "apparition" without Marian vocabulary, a body too short for
  the bucket). Persisted with `status = REVIEW` so a moderator can
  publish or archive via `/admin/publish-list`. Soft severity is
  what preserves borderline real content without polluting the
  public catalog.

`sanitize()` returns four buckets — `valid`, `review`, `noise`, and
`rejected` — and the runner handles each:

| Bucket     | Outcome                                                               |
| ---------- | --------------------------------------------------------------------- |
| `valid`    | persisted with the configured initial status (`PUBLISHED` by default) |
| `review`   | persisted with `status = REVIEW` + a `CATEGORY_FIX` log row           |
| `noise`    | **hard-deleted** with a single `DELETE` log row, no DB write          |
| `rejected` | refused before persistence with a `REJECT` log row                    |

### Background cleanup pass (Ingestion & Data Management)

The admin module `/admin/ingestion` is named **Ingestion & Data
Management**. Two coordinated passes run on every cron tick:

#### 1. Catalog janitor (always on)

`runCatalogJanitor()` (`src/lib/data/catalog-janitor.ts`) walks every
`PUBLISHED` row across the seven content tables (Prayer, Saint,
MarianApparition, Devotion, LiturgyEntry, SpiritualLifeGuide, Parish)
and runs the same `format → clean → validate` pipeline against it
that ingestion runs on new items. Three actions per row:

- **Repackage** (UPDATE): if the cleaned text differs from what's
  stored (e.g. the title has a stale `" | EWTN"` brand suffix, or
  the body still carries a "Subscribe to our newsletter" line), the
  row is updated to the cleaned version. Stays `PUBLISHED`.
- **Hard-delete** (DELETE): if validation now classifies the row as
  noise, it is hard-deleted with no archive. The legacy
  "Catholic Faith, Beliefs, & Prayers | Catholic Answers" rows that
  predate the noise detector get cleaned out on the next tick.
- **Divert to review** (CATEGORY_FIX → status REVIEW): soft-fail rows
  flip to REVIEW so an admin can decide.

The janitor runs regardless of the auto-cleanup site setting —
catalog quality is not a configurable behavior. Every action emits a
`DataManagementLog` row prefixed `Janitor:` so the operator can
filter for it at `/admin/logs/data-management`.

#### 2. Catalog-wide cleanup pass (toggleable)

The settings panel at the top of `/admin/ingestion` controls a
secondary cleanup pass that does coarser-grained work:

- **Automatic cleanup enabled** — master switch. When on (default),
  the cron job runs `cleanupMiscategorisedContent()`,
  `archiveDuplicatePrayers()`, and `purgeArchivedByArchivedAt()`
  on every tick. When off, the cron skips these — the catalog
  janitor still runs.
- **Hard-delete after N days** — how long a row may sit in
  `ARCHIVED` status before `purgeArchivedByArchivedAt()`
  permanently removes it. Default **30 days**, measured from the
  dedicated `archivedAt` column (not `updatedAt`), so editing an
  archived row does not push its deletion date forward. Set to 0
  to disable.

`cleanupMiscategorisedContent()` walks every `PUBLISHED` row and
flips anything that matches the broader miscategorised heuristics
to `ARCHIVED` so it stops appearing on the public site, with a
30-day grace period before hard-delete. `archiveDuplicatePrayers()`
catches historical artefacts: rows sharing the same content
checksum under different slugs (a pre-checksum dedup hangover). The
earliest row stays `PUBLISHED`; the duplicates are archived.

Every hard delete writes one `ArchiveDeletionLog` row (contentType,
contentId, contentSlug, archivedAt, deletedAt, reason, triggeredBy,
actorUsername) so cleanup is fully auditable. The cron route also
writes a `DataManagementLog` `PURGE` row for each delete so the
existing admin reports keep working.

Settings are stored in the `SiteSetting` table under the key
`data_management` and editable via
`/api/admin/data-management` (admin-only) and the toggle UI in
the ingestion admin page.

Manual edits are the only path that re-introduces a moderation step.
The seven `update*` functions in `src/lib/data/admin-catalog.ts` use a
shared `resolveStatusForUpdate()` helper: when an admin edits any
content field without explicitly choosing a status, the row drops back
to `DRAFT`. The admin must then click **Publish** on `/admin/publish-list`
(or on the entity's own admin page) for the change to go live. Status-
only flips and explicit "Save and Publish" actions are honoured as-is.

### Queue-first architecture — cron plans, worker executes

The ingestion pipeline is split across two processes that share one
Postgres database:

1. **Web service** (the Next.js server) ticks
   `POST /api/cron/ingest`. The cron route is plan-only: it
   recovers stale leases, checks backlog thresholds, calls the
   planner to enqueue due jobs into `IngestionJobQueue`, runs
   cleanup + queue retention + admin notifications, then exits in
   seconds.
2. **Worker service** (`npm run worker`) is the only adapter
   executor. It leases the next queue row, validates the payload
   against its Zod schema, dispatches by `jobKind`, runs the
   adapter, and marks the row `completed` / `failed` / `retrying`.

`runAllActiveJobs()` and the direct-execution path no longer exist
— the cron route never invokes an adapter and the worker is the
sole execution surface.

#### Cron route responsibilities

`/api/cron/ingest` performs short, bounded work on every tick:

- `recoverStaleJobs()` — returns crashed-worker leases to `pending`.
- `getBacklogProgress()` — decides constant vs maintenance mode
  (DB error → constant; fires `threshold_check_failed` warning).
- `enqueueDueIngestionJobs()` — the planner (see below).
- `pruneQueueHistory()` — 30d completed, 90d failed retention.
- Token/audit/error-log pruning, archive cleanup
  (`purgeArchivedByArchivedAt`), goal overdue marking.
- `dispatchAdminNotifications()` — biweekly + monthly + milestones.
- `runAllIngestionAlerts()` + `checkStallSignals()` — alerts.
- `autoEvaluateSourcePauses()` — auto-pauses failing sources.

`maxDuration` stays at 60s — comfortable for cleanup + planning,
but the route never depends on it for ingestion execution.

#### Planner module (`src/lib/ingestion/queue/planner.ts`)

`enqueueDueIngestionJobs()` walks active `IngestionJob` rows and
writes new `IngestionJobQueue` rows at the right priority. Safety
invariants:

- DB error on threshold counting → stay in constant mode, NEVER
  downgrade to maintenance priority, fire
  `threshold_check_failed` admin warning.
- Paused source / paused job / paused content type → counted in
  the summary, not enqueued.
- Source `healthState` of `blocked` / `exhausted` → skipped
  entirely.
- `failing` / `low_quality` / `stale` sources → priority demoted
  (+100 / +50 / +25) regardless of tier so unhealthy sources do
  not camp at the front of the queue.

**Priority bands** (lower = higher priority):

- `10` — Tier 1 source, content threshold unmet (constant burst).
- `30` — Tier 2 source, content threshold unmet.
- `60` — Tier 3 source, content threshold unmet.
- `100` — normal scheduled ingestion.
- `200` — maintenance refresh (all thresholds met).

Caps prevent any one tick / source / content-type from monopolising
the queue:

- `fillCap` — max rows per tick (default 200).
- `perContentTypeCap` — max per content type per tick (default 60).
- `perSourceCap` — max per source per tick (default 10).
- `dailyPerSource` / `dailyPerContentType` — daily ingestion
  ceilings tracked in `DailyIngestionCounter`.

**Planner summary** is returned from `/api/cron/ingest`, logged in
`cron.completed`, and surfaced on the admin queue dashboard:

```json
{
  "jobsScanned": 42,
  "jobsEnqueued": 12,
  "jobsSkippedAlreadyQueued": 30,
  "jobsSkippedSourcePaused": 0,
  "jobsSkippedJobPaused": 0,
  "jobsSkippedContentTypePaused": 0,
  "jobsSkippedSourceUnhealthy": 0,
  "jobsSkippedSourceExhausted": 0,
  "jobsSkippedDailyCap": 0,
  "jobsSkippedFillCap": 0,
  "promotedToConstant": 8,
  "assignedToMaintenance": 4,
  "mode": "constant",
  "dbError": false
}
```

#### `IngestionJobQueue` lifecycle

```
pending → running → completed
                  → failed   (terminal — sent to admin review)
                  → skipped  (paused source / job / content type)
                  → retrying → pending (backoff delay applied)
```

- **Exponential backoff** — 30 s base × 2ⁿ, ±25 % jitter, capped
  at 6 h (`src/lib/ingestion/queue/backoff.ts`).
- **Max retries** — 5 attempts; on the 6th attempt the row stays
  in `failed`, `sentToReviewAt` is set, a `DataManagementLog`
  `FAIL` row is written, and the job appears on
  `/admin/ingestion/queue` with a Retry button.
- **Dedupe key** — every planner row carries a stable
  `dedupeKey` of the form
  `ingest|<jobId>|<sourceId>|<adapterKey>|<contentType>|<mode>`. A
  partial unique index in
  `prisma/migrations/0012_queue_transition/migration.sql`
  enforces uniqueness for active rows (`pending` / `running` /
  `retrying`); completed / failed / skipped rows still keep their
  historical records.
- **Cancellation** — `POST /api/admin/ingestion/queue/cancel`.
  Pending / retrying rows cancel immediately; running rows get a
  `cancelRequestedAt` flag that the worker checks between batches.
  Completed rows cannot be cancelled.
- **Audit** — every state transition writes a `QueueAuditLog` row
  (enqueued / leased / completed / retrying / failed / skipped /
  canceled / cancel_requested / stale_recovered).

#### Typed job kinds

`src/lib/ingestion/queue/job-kinds.ts` defines eight kinds, each
with a Zod payload schema validated at enqueue and at execution:

| Job kind             | Priority default | Purpose                                                     |
| -------------------- | ---------------- | ----------------------------------------------------------- |
| `source_freshness`   | 50               | ETag / Last-Modified / checksum probe; lightweight.         |
| `source_ingest`      | 100              | Full adapter run with format / clean / validate / persist.  |
| `source_discovery`   | 110              | Find URLs / feed entries; writes to `DiscoveredSourceItem`. |
| `content_revalidate` | 150              | Re-run the catalog janitor against PUBLISHED rows.          |
| `dedupe_cleanup`     | 300              | Collapse duplicate-checksum rows.                           |
| `archive_cleanup`    | 400              | `purgeArchivedByArchivedAt` — hard delete after 30 days.    |
| `sitemap_refresh`    | 450              | Reserved for sitemap regeneration.                          |
| `report_generate`    | 500              | Admin-triggered report regeneration.                        |

The worker's `runJobByKind()` (`src/lib/ingestion/queue/dispatch.ts`)
routes to the matching execution function.

#### Worker process (`scripts/run-worker.ts`)

```sh
npm run worker        # long-running loop
npm run worker:once   # drain queue once and exit (cron-friendly)
npm run worker:status # one-shot CLI status snapshot
```

The worker:

- Leases the next queue row via
  `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *`
  so multiple workers never claim the same row.
- Writes a `WorkerHeartbeat` row every iteration (workerId,
  startedAt, lastHeartbeatAt, processedCount, failedCount,
  retryCount, currentJobId, status).
- Routes by `jobKind` and validates the payload with Zod before
  executing.
- Honours `IngestionSource.pausedAt`,
  `IngestionJob.pausedAt`, and `ContentTypePause` rows (paused
  rows return `skipped` with no retry consumed).
- Checks `cancelRequestedAt` between batches so a long-running
  job can be cancelled cooperatively.
- On graceful SIGTERM / SIGINT, releases active leases and removes
  its heartbeat row.

#### Per-source cursors, batches, and discovery

- **`IngestionCursor`** — last successful checkpoint per
  `(adapterKey, cursorKey)` pair. A worker restart resumes from
  the last cursor instead of starting over.
- **`IngestionBatch`** — per-batch counts (discovered, created,
  updated, skipped, rejected, archived, deduped, failed).
- **`DiscoveredSourceItem`** — durable record of every URL / feed
  entry / API record a discovery job finds. Status lifecycle:
  `pending` → `processing` → `ingested` / `skipped` / `rejected` /
  `duplicate` / `failed` / `archived`. Item-level retry +
  failure reason + review routing.
- **Adapter-driven exhaustion** — adapters that finish their
  catalog return `{ exhausted: true }`; the runner marks the
  source `exhaustedAt` + `healthState = "exhausted"` and the
  planner stops re-enqueueing it (except for freshness checks).

#### Source health, freshness, and tiering

Every `IngestionSource` carries source freshness metadata
(`lastSuccessfulSync`, `lastFailedSync`, `lastContentUpdateAt`,
`lastHttpStatus`, `lastEtag`, `lastModifiedHeader`,
`consecutiveFailures`, `lowQualityRatio`), per-source coverage
metrics (`estimatedTotalItems`, `discoveredItems`,
`completedItems`), and a `healthState` label (`active` / `stale` /
`failing` / `blocked` / `exhausted` / `low_quality` / `paused`).

**Source tiers** (`src/lib/ingestion/source-tier.ts`):

- **Tier 1** — official Church (`vatican.va`, `usccb.org`, etc.).
  Auto-publish at confidence ≥ 0.5; otherwise REVIEW.
- **Tier 2** — established publishers (`catholic.com`,
  `newadvent.org`, `ewtn.com`, etc.). Auto-publish at confidence
  ≥ 0.8; otherwise REVIEW.
- **Tier 3** — general / blog / news. Always REVIEW unless
  confidence ≥ 0.95.
- Theological content (`theologicalReviewFlag`) is forced to
  REVIEW regardless of tier.

Tier changes go through `POST /api/admin/ingestion/sources/tier`
(admin-only, requires a non-empty reason, audited in
`SourceTierChange`).

**Auto-pause** — `autoEvaluateSourcePauses()` runs every cron
tick. Sources with `consecutiveFailures ≥ 8` or
`lowQualityRatio ≥ 0.7` are paused automatically and an admin
email is dispatched. Resume via the admin source-health
dashboard.

#### Per-item quality + content version history

Every persisted content row carries:

- `sourceConfidence`, `formattingConfidence`, `qualityScore` (0–1).
- `theologicalReviewFlag` (boolean).
- `sourceTier` (1 / 2 / 3).
- `outcomeReason` — short string explaining accept / review /
  reject / archive routing.
- `archivedAt` — set the moment status flips to ARCHIVED. The
  retention math uses this column, not `updatedAt`.

When an upstream item with the same `externalSourceKey` arrives
with a different `contentChecksum`, the persister snapshots the
previous row into `ContentVersion` (previous title / body /
source / checksum / status / updatedAt) and updates in place.
Theological / saint / Church-document changes default to
`reviewRequired = true`. The admin diff viewer at
`/admin/ingestion/changes` shows before/after and offers
Approve / Reject / Request revision / Restore previous version
buttons.

#### Rate limits + robots.txt

- **Per-domain rate buckets** (`IngestionRateBucket`) — shared
  across workers. Conservative defaults: 30/min for
  `vatican.va`, 20/min for `newadvent.org`, 40/min for
  `catholic.com` / `ewtn.com`. Tune per source via
  `IngestionSource.rateLimitPerMin` /
  `requestSpacingMs`.
- **robots.txt cache** (`RobotsCache`) — per-domain body + status
  with a 6-hour TTL. Refetched only after expiry; falls back to
  the last cached body on fetch failure so a transient outage
  doesn't block ingestion.

#### Stall detector and admin alerts

Three distinct stall classes fire their own admin emails
(24h cooldown per class):

- `stall_content_below_target_no_jobs` — content type below
  target but planner enqueued nothing.
- `stall_jobs_enqueued_no_worker` — queue has pending jobs but
  no healthy worker heartbeat.
- `stall_workers_complete_no_growth` — workers are completing
  jobs but content counts aren't increasing.

Other alerts: stalled growth, repeated source failures,
low-quality source, review queue too large.

#### Scheduler modes — constant vs maintenance

- **Constant mode** — at least one of the six backlog targets is
  unmet. The planner ticks every ~2.5 min (the in-process
  scheduler `burstIntervalMs`) and promotes priority for sources
  whose content type is below target.
- **Maintenance mode** — every target is met. The planner drops
  to `maintenanceIntervalMs` (≈ 84 h, twice per week) and
  enqueues `source_freshness` jobs instead of full ingests.
  Adapters short-circuit on ETag / Last-Modified 304 responses;
  only genuine upstream changes write to the DB.
- **DB-error guard** — `getBacklogProgress()` catches any count
  error and returns `{ mode: "constant", dbError: true }`. The
  planner stays in constant mode, never downgrades priority, and
  fires the `threshold_check_failed` admin warning.

`/admin/ingestion/progress` shows the current mode with a clear
visual label (amber CONSTANT, emerald MAINTENANCE) and surfaces
the `dbError` flag.

#### Admin dashboards

- `/admin/ingestion` — registered sources + per-source latest run.
- `/admin/ingestion/health` — source health table with coverage
  and auto-paused badges.
- `/admin/ingestion/progress` — content-type progress + mode.
- `/admin/ingestion/queue` — queue counts, failed-needing-review,
  retrying, planner-last-15-minutes snapshot, filter pills (All,
  Failed, Skipped, Review-required, Source errors, Formatting
  errors).
- `/admin/ingestion/queue/[id]` — single-row detail with
  sanitized payload (tokens / secrets / cookies / auth headers
  redacted) and full QueueAuditLog timeline.
- `/admin/ingestion/workers` — heartbeats + 24h metrics
  (processed / failed / retry / avg duration / idle time).
- `/admin/ingestion/changes` — `ContentVersion` feed with diff
  viewer and Approve / Reject / Restore actions.
- `/admin/ingestion/outcomes` — recent persisted items with
  outcomeReason / qualityScore / sourceTier.

#### Admin actions

All manual ingestion actions enqueue jobs (recording actor
username, writing `AdminAuditLog` + `DataManagementLog` rows):

| Action                  | Endpoint                                        |
| ----------------------- | ----------------------------------------------- |
| Run now                 | `POST /api/admin/ingestion/run`                 |
| Reprocess source        | `POST /api/admin/ingestion/sources/reprocess`   |
| Revalidate content type | `POST /api/admin/ingestion/revalidate`          |
| Retry failed job        | `POST /api/admin/ingestion/queue/retry`         |
| Cancel queue row        | `POST /api/admin/ingestion/queue/cancel`        |
| Pause source            | `POST /api/admin/ingestion/sources/pause`       |
| Pause job               | `POST /api/admin/ingestion/jobs/pause`          |
| Pause content type      | `POST /api/admin/ingestion/content-types/pause` |
| Change source tier      | `POST /api/admin/ingestion/sources/tier`        |
| Review content version  | `POST /api/admin/ingestion/changes/review`      |
| Restore version         | `POST /api/admin/ingestion/changes/restore`     |
| List queue (filters)    | `GET  /api/admin/ingestion/queue/list?status=…` |

#### Admin notification dispatch

Each cron tick dispatches `dispatchAdminNotifications()`. Sub-flows
guard their own "is it time?" checks:

- **Biweekly Admin Report** — ≥ 14 days since last send. Body =
  Content Management Report (Added / Edited / Deleted / Archived /
  Deduped / Purged per content type) + Ingestion Health Summary
  (total jobs run / completed / failed / retried / items to review /
  sources failing / items archived / permanently deleted / deduped).
- **Monthly Archive Cleaning Up** — last day of each month. Body =
  Content / Archived Deleted table.
- **Monthly Source Quality Report** — last day of each month. Body
  = per-source counts of accepted / rejected / duplicate / failed
  items ranked by accepted descending.
- **Monthly Error Report PDF** — last day of each month. PDF
  attachment with the month's errors.
- **Threshold milestone alerts** — 25 / 50 / 75 / 100 percent of
  each target. State per bucket advances **even when ADMIN_EMAIL
  is unset**, preventing the "flood when ADMIN_EMAIL configured
  later" surprise.

Subjects are pinned exactly as required: **Biweekly Admin Report**,
**Monthly Archive Cleaning Up**, **Monthly Source Quality Report**,
**Critical Failure**, **Security Breach**, **Error Report**, plus
the per-content-type threshold subjects.

### Connecting prayers to guides

`src/lib/data/guide-prayers.ts` maps each spiritual-life guide slug to an
ordered list of prayer slugs. The detail page renders each one as an
expandable section using `ExpandablePrayer` — the title shows with a
right-pointing arrow when collapsed and a down-pointing arrow when
expanded, with the full prayer text below. Bodies are looked up live in
the `Prayer` table and fall back to in-app canonical English forms when
a slug has not yet been ingested. The same component pattern is reused
for the Church-history timeline at `/liturgy-history/timeline`, where
`ExpandableTimelineEvent` renders every council and history event with
the same arrow / collapse behaviour.

### Scrape → database → page contract

Scraped content lives in PostgreSQL the entire time it is on the site —
nothing renders out of in-memory scraper state. The pipeline is:

1. **Scrape** — `runAdapter()` calls `adapter.fetch()`, gets back a list
   of `IngestedItem`s, and sends them through `sanitize()` /
   `validateItem()`. Items missing required fields, with body shorter
   than the kind-specific minimum, or carrying an off-allowlist
   `externalSourceKey` are rejected up front.
2. **Persist** — surviving items go through `persistItems()`, which
   dispatches to a kind-specific persister (`persist-prayer`,
   `persist-saint`, `persist-apparition`, `persist-parish`,
   `persist-devotion`, `persist-liturgy`, `persist-guide`). Each persister
   writes to its own dedicated table — guides land in
   `SpiritualLifeGuide`, prayers in `Prayer`, saints in `Saint`,
   apparitions in `MarianApparition`, parishes in `Parish`, devotions in
   `Devotion`, liturgy / Church-history / catechetical entries in
   `LiturgyEntry`. The runner asserts at the type level (and through
   `validateItem`'s protected-kind list) that ingestion never touches
   user-generated tables (journal entries, goals, milestones, profile
   data, saved-item links).
3. **Dedupe** — duplicates are eliminated at three layers:
   - `dedupeBatch()` drops in-batch duplicates by normalized
     `externalSourceKey` (URL canonicalised — fragments, trailing
     slashes, and `utm_*` parameters stripped) and by normalized slug.
   - Each persister looks up the existing row by stable identifiers
     before writing: `externalSourceKey` first (the source URL is the
     most reliable identity), then `slug`, then a kind-specific
     fallback (`name + city + country` for parishes). When a match is
     found, `contentChecksum` (SHA-256 of canonicalised content) is
     compared — identical checksums short-circuit as `skipped` with no
     DB write.
   - `PUBLISHED` and `ARCHIVED` rows are protected: the persister
     refuses to overwrite curated content. Re-ingesting on top of a
     published row is a no-op until the admin moves it back to
     `DRAFT` / `REVIEW`.
4. **Update** — when an existing draft / review row's checksum changes,
   the persister calls `prisma.<table>.update()` with the full payload
   and resets `status` to the configured initial status (default `REVIEW`)
   so the change re-enters the moderation queue. New rows are created
   with the same status. The runner counts every freshly-created or
   updated row as `recordsReviewRequired` when `initialStatus === REVIEW`.
5. **Read** — public pages call `listPublished*` and `getPublished*BySlug`
   functions in `src/lib/data/`, which always filter by
   `{ status: "PUBLISHED" }`. Detail pages wrap the lookup in a `safe*`
   helper that catches DB errors, classifies them with
   `classifyPageError()` (missing-table vs. db-connection vs.
   route-error), logs through `logPageError()` / `logPageMissingContent()`,
   and falls back to `notFound()` so a missing or unpublished slug returns
   a 404, never a 500. The `requireUser()` and `isSaved()` calls used by
   the Save button are wrapped the same way: when no signed-in user is
   present they short-circuit to `null` / `false` so anonymous traffic
   sees the page exactly like a signed-in reader (minus the Save button
   pre-checked state).

Field mapping is one-to-one from `IngestedItem` → DB row → page render.
The `Prayer` row carries `slug`, `defaultTitle`, `body`, `category`,
`externalSourceKey`, `sourceHost`, `contentChecksum`, and `status`; the
detail page reads exactly those fields (plus the locale translation).
The same pattern applies to every kind — see
`src/lib/ingestion/persist/persist-*.ts` for the source side and
`src/lib/data/*.ts` for the read side.

### Persistence after redeploys

Because every record lives in PostgreSQL (not in process memory),
scraped content survives container restarts and redeploys. The
auto-seed at boot only seeds when the public-content tables are empty
and never overwrites existing rows. When the schema changes, run
`prisma migrate deploy` (the Dockerfile entrypoint does this
automatically); the health check at `/api/health` reports
`migration_required` if any required table is missing and a separate
`public_content_unavailable` status if any of `Prayer` / `Saint` /
`MarianApparition` / `Parish` / `Devotion` / `LiturgyEntry` /
`SpiritualLifeGuide` / `DailyLiturgy` are gone — those are the tables
the public site reads from.

### Logging surface for ingestion runs and page failures

Every adapter run emits structured JSON via `logger`
(`src/lib/observability/logger.ts`):

- `ingestion.run.started` — adapter, sourceHost, jobId, initialStatus
- `ingestion.run.not_modified` — emitted on a 304 short-circuit
- `ingestion.run.completed` — with `recordsSeen`, `recordsCreated`,
  `recordsUpdated`, `recordsSkipped`, `recordsFailed`,
  `recordsReviewRequired`, `published`, `rejected`, `partial`,
  `durationMs`
- `ingestion.run.failed` — with `errorMessage` and `durationMs`
- `ingestion.scheduler.start` / `ingestion.scheduler.completed` — totals
  across all jobs in a tick

The same numbers are persisted to `IngestionJobRun` for historic
visibility — surfaced on `/admin/ingestion` (per-source rollup) and
`/admin/logs/ingestion` (every recorded run, filterable by status and
job name). For per-item detail, the same run writes one
`DataManagementLog` row per accepted (ADD), updated (UPDATE),
dedup-skipped (DEDUPE), hard-rejected (REJECT) or soft-routed
(CATEGORY_FIX) item — with the reason, source name, job name, and
`triggeredBy` (automatic vs manual). The Data Management cleanup pass
adds CLEANUP, additional DEDUPE, and DELETE rows for items it
archives or hard-deletes. The full timeline is browsable at
`/admin/logs/data-management`. Page-side, every detail page calls
`logPageMissingContent()` on a missed lookup (with a
`reason: missing_record | bad_slug | missing_table | db_connection`
classification) and `logPageError()` on caught exceptions, so an alert
on `kind=missing_table` points to a missed migration, `kind=db_connection`
points to the database, and `kind=missing_record` points to either an
unpublished record or a stale link.

## Startup behaviour

When the Node process boots, `src/instrumentation.ts` defers to
`src/lib/startup/auto-seed.ts`, which:

1. Confirms the database is reachable.
2. Verifies that `prisma migrate deploy` produced the required tables.
3. Counts published rows in each public-content table — if any are
   empty, runs `seedAllContent()` from `src/lib/startup/seeder.ts` to
   populate them. The seeder writes 7 sacraments + 4 consecrations,
   50+ papal encyclicals (Mirari Vos → Dilexit Nos), Catechism overview
   - four parts + key topics, all seven books of the 1983 Code of
     Canon Law + the Code of Canons of the Eastern Churches, one
     rite-inception entry per Catholic rite (Roman through Ruthenian),
     plus the standard prayers / saints / apparitions / devotions /
     parishes / liturgy entries / guides.
4. Runs `promoteIngestedOrphans()` — a one-time migration that
   promotes any legacy `REVIEW`-status rows with an `externalSourceKey`
   (i.e. created by ingestion before the auto-publish rule) to
   `PUBLISHED`. Idempotent: a second run touches zero rows.
5. Schedules the in-process ingestion ticker described above. The
   scheduler runs constantly while any backlog target is unmet, and
   drops to a twice-weekly maintenance cadence once every target is
   met. Initial delay is short (~30 s) so the catalog visibly starts
   filling within a minute of a fresh deploy.

All of this work is fire-and-forget — the HTTP server begins accepting
requests immediately so Railway / Docker healthchecks never wait on it.

### Backlog targets

The scheduler stays in constant-fill mode until every one of these
five buckets is at or above its minimum (configured in
`src/lib/config.ts`):

| Bucket           | Minimum | Counts                                                                                                                                                                       |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prayers          | 500     | `Prayer` rows                                                                                                                                                                |
| Saints           | 7,000   | `Saint` rows                                                                                                                                                                 |
| Parishes         | 150,000 | `Parish` rows                                                                                                                                                                |
| Church Documents | 1,500   | `LiturgyEntry` rows whose slug starts with `encyclical-`, `catechism-`, `code-of-canon-law-`, `council-`, `vatican-council-`, or `synod-`                                    |
| Sacraments       | 7       | `SpiritualLifeGuide` rows whose slug starts with `sacrament-`. Exactly seven — the doctrinal count of the Sacraments of the Church.                                          |
| Consecrations    | 4       | `SpiritualLifeGuide` rows whose slug starts with `consecration-` (Marian, Saint Joseph, Holy Family, Sacred Heart). Tracked separately so the Sacraments bucket stays exact. |

Once all six are met the scheduler switches to maintenance mode and
runs the upstream check on a ~84-hour cadence (~twice weekly).

---

## Operational admin email and incident reporting

Operational alerts go to a single mailbox specified by the `ADMIN_EMAIL`
environment variable (set in the hosting platform's environment
dashboard — there is no admin UI for this value). All admin email
shares the same rendering shell as the account email (paper / serif
aesthetic, cross logo, text + HTML parts), greets the recipient as
`Admin`, and is dispatched through the same Resend transport.
`src/lib/email/admin-templates.ts` owns the rendering;
`src/lib/email/admin-send.ts` owns the per-flow senders;
`src/lib/data/admin-notifications.ts` owns the cadence + dedup state.

When `ADMIN_EMAIL` is unset, every admin email is logged
(`admin.email.skipped_no_address`) and skipped at the transport layer;
the rest of the app keeps running. When `RESEND_API_KEY` is unset,
admin email is skipped with `admin.email.skipped_no_provider`.

### Email subjects (pinned)

| Flow                          | Subject                                  | Cadence                                                                                             |
| ----------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Biweekly Admin Report         | `Biweekly Admin Report`                  | Every 14 days                                                                                       |
| Monthly Archive Cleaning Up   | `Monthly Archive Cleaning Up`            | Last day of each month (30/31/Feb-final)                                                            |
| Monthly Error Report          | `Error Report`                           | Last day of each month, ships a generated PDF attachment (`error-report-YYYY-MM.pdf`)               |
| Threshold milestone — partial | `<Content> 25% Threshold Reached` (etc.) | Once per `(content type, threshold)` when the live count crosses 25 / 50 / 75 percent of the target |
| Threshold milestone — final   | `<Content> Final Threshold Reached`      | Once per content type when the live count first reaches 100% of the target                          |
| Critical Failure              | `Critical Failure`                       | Immediately on uncaught exception, unhandled rejection, or React global error boundary firing       |
| Security Breach               | `Security Breach`                        | Immediately (subject to a 5-minute per-(kind, IP, route) dedup) on suspicious activity — see below  |

### Content Management Report (biweekly body)

The Biweekly Admin Report's body is a single section titled
**Content Management Report** containing one table:

| Content                    | Added | Edited | Deleted | Archived |
| -------------------------- | ----- | ------ | ------- | -------- |
| Prayer                     | …     | …      | …       | …        |
| Saint                      | …     | …      | …       | …        |
| Marian Apparition          | …     | …      | …       | …        |
| Devotion                   | …     | …      | …       | …        |
| Liturgy / Church Document  | …     | …      | …       | …        |
| Spiritual Life / Sacrament | …     | …      | …       | …        |
| Parish                     | …     | …      | …       | …        |

Number formatting:

- **Added** — `+N` when N > 0; bare `0` when N = 0.
- **Edited** — bare integer; bare `0` when N = 0.
- **Deleted** — `-N` when N > 0; bare `0` when N = 0.
- **Archived** — bare integer; bare `0` when N = 0.

The numbers are aggregated from `DataManagementLog` over the two-week
window: `ADD` → Added, `UPDATE` → Edited, `DELETE` + `PURGE` → Deleted,
`CLEANUP` → Archived.

### Monthly Archive Cleaning Up body

Last-day-of-month digest summarising the hard-delete pass that runs as
part of `purgeStaleArchivedContent()`. The body is one table:

| Content | Archived Deleted |
| ------- | ---------------- |
| Prayer  | …                |
| …       | …                |

`Archived Deleted` shows `-N` when N > 0 and bare `0` when N = 0.
Archived rows are hard-deleted after **30 days** (configurable in
`/admin/ingestion` settings, persisted in `SiteSetting`).

### Monthly Error Report PDF

Errors are captured into the `ErrorLog` table by:

- `logPageError()` and `logApiError()` — every page render failure /
  API exception is persisted (`source: page|api`, `severity: error`).
- Process-level handlers in `src/instrumentation.ts` — uncaught
  exceptions and unhandled rejections (`source: uncaught`,
  `severity: critical`).
- React global error boundary — `/api/internal/critical-failure`
  receives the boundary's POST and writes a `source: global,
severity: critical` row.
- `reportSecurityEvent()` — every detected security event is also
  persisted (`source: security`, `severity: error`) so it appears in
  the next Error Report.

On the last day of each month, `dispatchAdminNotifications()` reads
every row from the calendar month, builds a paginated PDF
(`src/lib/email/pdf.ts` — small zero-dependency PDF 1.4 generator),
and emails it as `error-report-YYYY-MM.pdf`. `ErrorLog` rows older
than 90 days are pruned by the regular cleanup pass — by then the
month they fell in has already shipped its PDF.

### Threshold milestone alerts

Per-bucket counters compared against the configured targets:

| Bucket           | Target  |
| ---------------- | ------- |
| Prayers          | 500     |
| Saints           | 7 000   |
| Parishes         | 150 000 |
| Church Documents | 1 500   |
| Sacraments       | 7       |
| Consecrations    | 4       |

Each tick computes `count / target × 100` per bucket and emails one
alert per crossing of 25 / 50 / 75 / 100 percent. Per-bucket dedup
state is stored under `AdminNotificationState` flow keys
`milestone:<bucket>` so the same threshold is never re-emailed even if
the count later drops.

### Critical Failure alerts

Reserved for severe issues only — site-crash-class events that mean
the application could not complete a request. The triggers are:

- An uncaught exception (`process.on("uncaughtException")` in
  `src/instrumentation.ts`).
- An unhandled promise rejection
  (`process.on("unhandledRejection")`).
- The React global error boundary firing
  (`src/app/global-error.tsx` POSTs to
  `/api/internal/critical-failure`).

Per-request 4xx responses, ordinary validation errors, and upstream
adapter 5xx do **not** trigger Critical Failure. Those are routine
errors and are carried in the monthly Error Report PDF instead.

### Security Breach alerts

Triggered on suspicious activity with a 5-minute per-`(kind, IP,
route)` server-side dedup so a single misbehaving client cannot flood
the mailbox. The detectors are:

- **Server-side** — admin login attempts that exceed the
  `adminLogin` rate-limit policy.
- **Client-side** —
  `SecurityTamperDetector` (`src/components/SecurityTamperDetector.tsx`,
  mounted in the admin layout):
  - Browser developer tools detected as open
    (`client_devtools_open`).
  - Unexpected mutation of the admin chrome
    (`client_dom_tamper`) — the kind of edit a tampering session
    would attempt before submitting a forged request.
  - Content-Security-Policy violations
    (`client_csp_violation`).
- **Client → server bridge** — `/api/internal/security-event`
  validates the client's POST, rate-limits per IP, and calls
  `reportSecurityEvent()`.

`reportSecurityEvent()` writes a row to `ErrorLog` (so it lands in the
next monthly PDF) and fires a Security Breach email immediately. The
email subject is exactly `Security Breach` and the body lists the
event kind, summary, route, IP, user-agent, and any structured detail
the detector supplied.

### End-to-end diagnostics

`/admin/diagnostics/email` exposes an **Admin email diagnostics**
panel that lets the operator trigger a labelled example of each
admin notification flow (biweekly, monthly archive, monthly Error
Report PDF, threshold milestones at 25 / 50 / 75 / 100%, Critical
Failure, Security Breach). Each click POSTs to
`/api/admin/email/admin-test` with the flow name; the route resolves
`ADMIN_EMAIL`, dispatches through the same senders that production
uses, records an `AdminAuditLog` entry, and surfaces the outcome
inline. The page also shows the resolved `ADMIN_EMAIL` value next to
the Resend API-key status so the operator can confirm both pieces of
the pipeline are wired up.

The same diagnostic section runs as a backend check at
`/api/admin/diagnostics/email`: it reports `email.api_key` (Resend
API key configured), `email.admin_email` (ADMIN_EMAIL configured),
`email.from_address` (canonical sender), and `email.db_tables`
(account-email tables present).

---

## Admin console

`/admin` is the only admin surface. Protection is layered:

- **Middleware** (`src/middleware.ts`) redirects any unauthenticated request to
  a path under `/admin` (other than `/admin/login`) back to `/admin/login`
  with a 303. This is a coarse cookie-presence check so unauthenticated
  visitors never even render the page.
- **`requireAdmin()`** (`src/lib/auth/admin.ts`) is called inside every admin
  page server component and every `/api/admin/...` route handler. It verifies
  `session.role === "ADMIN"` and is the authoritative authorization check.
- **`/admin/login`** posts to `POST /api/admin/login`, which redirects to
  `/admin?welcome=1` on success and `/admin/login?error=invalid` on failure.
- **`POST /api/admin/logout`** destroys the session and redirects back to
  `/admin/login`.
- The `/admin` layout sets `robots: { index: false, follow: false }` so no
  admin page (including `/admin/login`) is indexable.

`/admin` shows seventeen sections (`src/app/admin/_dashboard/cards.ts`):

1. Homepage mirror editor
2. Prayers
3. Saints
4. Marian apparitions
5. Parishes
6. Devotions
7. Liturgy content
8. Translations
9. **Ingestion & Data Management** — live-polling content counts,
   24-hour edit overlay per content type (with a precise explanation
   of "0 edits" — disabled, blocked, stale, or skipped-because-no-new-
   content), status indicator (Active / Maintenance / Disabled /
   Blocked / Stale / Running / Failing / Idle), Data Management
   settings panel (auto-cleanup toggle + hard-delete window), a "Run
   ingestion now" button, and a "Run data cleanup now" button. Both
   manual buttons share the same advisory lock as the cron job and
   report inline success or failure detail.
10. Approved sources (allowlist + per-host sync status)
11. Search index
12. Media library
13. Favicon
14. **Logs** — hub for four sub-views: Account audit (per-user
    actions); Admin actions (homepage edits, content edits, settings,
    diagnostics, data-management toggles); Data Management (every
    addition, update, dedupe-skip, rejection, archive, dedupe, and
    category correction performed by the Ingestion & Data Management
    system, with reason and triggeredBy = automatic | manual);
    Ingestion runs (every IngestionJobRun row: source, job, status,
    per-run counts, duration, error message, filterable by status
    and job name).
15. User accounts
16. **Diagnostics** — hub for five sub-views, each backed by an
    `/api/admin/diagnostics/...` route returning a `DiagnosticSection`
    with severity / timestamp / requestId / explanation per check:
    Email (welcome / verify / resend / forgot-password / reset-password
    flows + self-test), Ingestion & Data Management (live status, last
    successful and failed runs, 24h counts, per-job error messages,
    review queue, published-content totals), Sitemap & Link Paths
    (every static and dynamic route, plus profile and admin paths),
    Accounts (account tables, saved items, badges, journals, language,
    today's feast date / timezone, parish location search), Homepage —
    Today's Feast Day Saints (PUBLISHED total, structured-field
    coverage, today's match, `/api/saints/today` round-trip).
17. Publish list (REVIEW queue)

Content review actions go through `POST /api/admin/content/review` with
`{ entityType, entityId, action, notes }` where `action` is
`approve` | `reject` | `request-revision` | `move-to-review`. Direct CRUD on
each catalog entity is exposed under `/api/admin/<entity>` via the
`makeAdminCatalogIndex` / `makeAdminCatalogItem` factories
(`src/lib/http/admin-catalog-routes.ts`).

---

## API surface

### Public / authenticated reader

| Method            | Path                                                          | Purpose                                                     |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| GET               | `/api/health`                                                 | Readiness + DB ping + table / seed diagnostics              |
| GET               | `/api/health/live`                                            | Liveness probe (no DB touch). Used by Docker / Railway      |
| POST              | `/api/auth/register`                                          | Create reader account                                       |
| POST              | `/api/auth/login`                                             | Reader login                                                |
| POST              | `/api/auth/logout`                                            | Reader logout                                               |
| POST              | `/api/auth/forgot-password`                                   | Issue a password-reset token (always returns OK)            |
| POST              | `/api/auth/reset-password`                                    | Consume token + set new password (revokes sessions)         |
| POST              | `/api/auth/verify-email`                                      | Consume an email-verification token                         |
| PUT               | `/api/auth/verify-email`                                      | Issue a fresh verification token for the current user       |
| GET / PATCH       | `/api/profile`                                                | Read / update profile (locale, theme)                       |
| POST / DELETE     | `/api/profile/avatar`                                         | Set / clear avatar (`MediaAsset` id)                        |
| GET / POST        | `/api/journal`                                                | List entries (sortable) / create entry                      |
| GET / PATCH       | `/api/journal/[id]`                                           | Read / update entry (ownership-checked)                     |
| POST              | `/api/journal/[id]/favorite`                                  | Toggle favorite flag                                        |
| POST              | `/api/journal/[id]/delete`                                    | Delete entry                                                |
| GET / POST / DEL  | `/api/saved/prayers`                                          | List / save / unsave a prayer                               |
| GET / POST / DEL  | `/api/saved/saints`                                           | List / save / unsave a saint                                |
| GET / POST / DEL  | `/api/saved/apparitions`                                      | List / save / unsave a Marian apparition                    |
| GET / POST / DEL  | `/api/saved/parishes`                                         | List / save / unsave a parish                               |
| GET / POST / DEL  | `/api/saved/devotions`                                        | List / save / unsave a devotion                             |
| GET / POST        | `/api/goals`                                                  | List / create goals (with optional checklist)               |
| GET / PATCH / DEL | `/api/goals/[id]`                                             | Read / update / delete a goal                               |
| POST              | `/api/goals/[id]/complete`                                    | Mark complete + auto-promote to a personal milestone        |
| POST              | `/api/goals/[id]/archive`                                     | Archive a goal                                              |
| POST              | `/api/goals/[id]/checklist`                                   | Append a checklist item                                     |
| POST              | `/api/goals/[id]/checklist/reorder`                           | Reorder checklist items                                     |
| PATCH / DEL       | `/api/goals/[id]/checklist/[itemId]`                          | Edit / delete a checklist item                              |
| GET               | `/api/goals/templates`                                        | List built-in goal templates (novenas, consecrations, OCIA) |
| POST              | `/api/goals/from-template`                                    | Instantiate a goal (with checklist) from a template         |
| GET / POST        | `/api/milestones`                                             | List / create user milestones                               |
| DELETE            | `/api/milestones/[id]`                                        | Delete a milestone                                          |
| GET               | `/api/prayers`, `/api/prayers/[slug]`                         | Published prayers list / detail (locale-aware)              |
| GET               | `/api/saints`, `/api/saints/[slug]`                           | Published saints list / detail                              |
| GET               | `/api/apparitions`, `/api/apparitions/[slug]`                 | Published apparitions                                       |
| GET               | `/api/parishes`, `/api/parishes/[slug]`, `/api/parishes/near` | Parish list, detail, geo-radius                             |
| GET               | `/api/devotions`, `/api/devotions/[slug]`                     | Devotions list / detail                                     |
| GET               | `/api/liturgy`, `/api/liturgy/[slug]`                         | Liturgy/history content                                     |
| GET               | `/api/spiritual-life`, `/api/spiritual-life/[slug]`           | Spiritual-life guides                                       |
| GET               | `/api/daily-liturgy`                                          | Today (or `?date=` / `?from=&to=`) daily liturgical content |
| GET               | `/api/saints/today`                                           | Saints whose feast falls on `?month=&day=` (or today UTC)   |
| GET               | `/api/search`                                                 | Unified search with intent detection                        |
| GET               | `/api/search/suggest`                                         | Typeahead suggestions grouped by content type               |
| POST              | `/api/settings/locale`                                        | Set locale cookie                                           |
| POST              | `/api/settings/rite`                                          | Set Catholic rite cookie                                    |

### Admin

| Method         | Path                                     | Purpose                                                                                                                                                                       |
| -------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST           | `/api/admin/login`                       | Admin login                                                                                                                                                                   |
| POST           | `/api/admin/logout`                      | Admin logout                                                                                                                                                                  |
| POST           | `/api/admin/content/review`              | Approve / reject / revise / move-to-review                                                                                                                                    |
| GET / POST     | `/api/admin/prayers`                     | List / create prayers (catalog)                                                                                                                                               |
| PATCH / DELETE | `/api/admin/prayers/[id]`                | Update / delete a prayer                                                                                                                                                      |
| GET / POST     | `/api/admin/saints`                      | List / create saints                                                                                                                                                          |
| PATCH / DELETE | `/api/admin/saints/[id]`                 | Update / delete a saint                                                                                                                                                       |
| GET / POST     | `/api/admin/apparitions`                 | List / create Marian apparitions                                                                                                                                              |
| PATCH / DELETE | `/api/admin/apparitions/[id]`            | Update / delete an apparition                                                                                                                                                 |
| GET / POST     | `/api/admin/parishes`                    | List / create parishes                                                                                                                                                        |
| PATCH / DELETE | `/api/admin/parishes/[id]`               | Update / delete a parish                                                                                                                                                      |
| GET / POST     | `/api/admin/devotions`                   | List / create devotions                                                                                                                                                       |
| PATCH / DELETE | `/api/admin/devotions/[id]`              | Update / delete a devotion                                                                                                                                                    |
| GET / POST     | `/api/admin/liturgy`                     | List / create liturgy entries                                                                                                                                                 |
| PATCH / DELETE | `/api/admin/liturgy/[id]`                | Update / delete a liturgy entry                                                                                                                                               |
| GET / POST     | `/api/admin/spiritual-life`              | List / create spiritual-life guides                                                                                                                                           |
| PATCH / DELETE | `/api/admin/spiritual-life/[id]`         | Update / delete a spiritual-life guide                                                                                                                                        |
| POST           | `/api/admin/ingestion/run`               | Run a single job or all active jobs                                                                                                                                           |
| PATCH          | `/api/admin/ingestion/jobs/[id]`         | Pause / resume or re-schedule a job                                                                                                                                           |
| GET / POST     | `/api/admin/sources`                     | List / create ingestion sources                                                                                                                                               |
| GET / PATCH    | `/api/admin/sources/[id]`                | Read / update an ingestion source                                                                                                                                             |
| GET / POST     | `/api/admin/media`                       | List / register a media asset (Cloudinary URL)                                                                                                                                |
| GET / DELETE   | `/api/admin/media/[id]`                  | Read / delete a media asset                                                                                                                                                   |
| GET            | `/api/admin/users`                       | Paginated, searchable user listing                                                                                                                                            |
| GET            | `/api/admin/audit`                       | Filterable audit log                                                                                                                                                          |
| GET            | `/api/admin/ingestion-status`            | Live snapshot used by the Ingestion admin page (polled)                                                                                                                       |
| GET / POST     | `/api/admin/data-management`             | Read / write Ingestion & Data Management settings                                                                                                                             |
| POST           | `/api/admin/data-management/cleanup`     | Run the cleanup passes on demand (admin "Run cleanup now")                                                                                                                    |
| GET            | `/api/admin/diagnostics/email`           | Email diagnostics section                                                                                                                                                     |
| GET            | `/api/admin/diagnostics/data-management` | Data management diagnostics section + 24h edit counts                                                                                                                         |
| GET            | `/api/admin/diagnostics/ingestion`       | Ingestion diagnostics section + live snapshot                                                                                                                                 |
| GET            | `/api/admin/diagnostics/saints-feast`    | Homepage saints feast-day diagnostics section                                                                                                                                 |
| GET            | `/api/admin/diagnostics/sitemap`         | Sitemap & link-path diagnostics                                                                                                                                               |
| GET            | `/api/admin/diagnostics/accounts`        | Account diagnostics section                                                                                                                                                   |
| GET / POST     | `/api/admin/email`                       | Email configuration check + send a test message                                                                                                                               |
| POST           | `/api/admin/email/ensure-tables`         | Idempotent in-process create of account-email tables                                                                                                                          |
| POST           | `/api/admin/email/self-test`             | End-to-end self-test of welcome / reset / verify flows                                                                                                                        |
| GET / POST     | `/api/admin/email/admin-test`            | Trigger one labelled example of each admin email flow (biweekly / monthly cleanup / monthly Error Report PDF / milestone / Critical Failure / Security Breach) to ADMIN_EMAIL |
| GET            | `/api/admin/publish-list`                | Items currently in REVIEW status across the catalog                                                                                                                           |
| POST           | `/api/admin/publish-list/publish-all`    | Bulk-publish every queued REVIEW row                                                                                                                                          |
| POST           | `/api/admin/search/reindex`              | Trigger reindex / housekeeping                                                                                                                                                |
| GET            | `/api/admin/translations`                | Translation row counts                                                                                                                                                        |
| GET / POST     | `/api/admin/favicon`                     | Read / replace favicon asset                                                                                                                                                  |
| GET / POST     | `/api/admin/homepage`                    | Read / update homepage block config                                                                                                                                           |
| POST (`GET`)   | `/api/cron/ingest`                       | Run scheduler + cleanup pass + housekeeping + admin notification dispatch (cron-secret)                                                                                       |
| POST / GET     | `/api/internal/cleanup`                  | Prune sessions / tokens / rate-limits (cron-secret auth)                                                                                                                      |
| POST           | `/api/internal/critical-failure`         | Receive a Critical Failure escalation from the React global error boundary; writes to `ErrorLog` and emails ADMIN_EMAIL                                                       |
| POST           | `/api/internal/security-event`           | Receive a Security Breach signal from the client tamper detector or other client-side detector; writes to `ErrorLog` and emails ADMIN_EMAIL (5-min dedup)                     |

---

## Deployment

### Docker

The `Dockerfile` builds a slim three-stage image (`node:20-bookworm-slim`),
runs as non-root user `nextjs:nodejs`, and exposes `3000`. The container
entrypoint is `scripts/start.sh`, which:

1. Probes the database for up to 60s so a slow-starting Postgres service
   doesn't crash the container.
2. Runs `prisma migrate deploy`. If the migration fails, the script logs the
   failure but **still** starts the server so `/api/health` can surface
   `migration_required` instead of looping the deploy.
3. `exec`s into `node server.js` so Node owns PID 1 and SIGTERM propagates
   cleanly on restart.

The Prisma CLI is invoked through its file path
(`node node_modules/prisma/build/index.js`) because the Next.js standalone
output does not preserve the symlinks under `node_modules/.bin/`.

A `HEALTHCHECK` polls `/api/health/live` after a 60s start period. That
endpoint deliberately does **not** touch the database — a transient DB blip
must not flip the container unhealthy. `/api/health` is the readiness /
diagnostic endpoint and reports `migration_required` when expected tables
are missing.

### Railway

The production deployment runs two services from the same image:

1. **`viafidei-web`** — start command `./scripts/start.sh` (Next.js
   standalone server). Health check `/api/health/live` with a 180s
   timeout and a 5-retry on-failure restart policy. Hosts every
   page, every API route, and the cron entry point at
   `POST /api/cron/ingest`.
2. **`viafidei-worker`** — start command `npm run worker`. The
   only ingestion-adapter executor. Shares the same production
   Postgres reference as the web service. No external health
   check needed — `WorkerHeartbeat` is the source of truth.

Both services need the same env vars: `DATABASE_URL`,
`SESSION_SECRET`, `ADMIN_EMAIL`, `RESEND_API_KEY`,
`ADMIN_USERNAME`, `ADMIN_PASSWORD`. `railway.json` builds with the
Dockerfile.

See `docs/operations/queue-rollout.md` for the full 7-phase rollout
plan, rollback procedure, and data-safety checklist.

### Build behaviour

All public listing pages (`/`, `/prayers`, `/saints`, `/saints/today`,
`/devotions`, `/sacraments`, `/spiritual-life`, `/spiritual-guidance`,
`/liturgy`, `/liturgy-history`, `/history`, `/search`) export
`dynamic = "force-dynamic"`. They are NOT pre-rendered at build time, so
`next build` never opens a database connection and CI / Docker builds do not
need access to PostgreSQL. Detail pages under `[slug]` are dynamic by default
(no `generateStaticParams`). Admin pages under `/admin/*` and every
`/api/admin/*` route are also dynamic.

### Cron

The cron token is derived from `SESSION_SECRET` at runtime — there is no
separate `CRON_SECRET` environment variable. The **in-process tick driver
is enabled by default** (`ingestion.schedulerDisabled: false` in
`src/lib/config.ts`) — it just POSTs to `/api/cron/ingest` on a cadence
(every ~2.5 min in constant mode, every ~84 h in maintenance mode). It
does NOT execute adapters; the cron route plans and the worker process
executes. To delegate the tick to an external platform, set
`ingestion.schedulerDisabled` to `true` and configure that platform to
POST to `https://<host>/api/cron/ingest` with
`Authorization: Bearer <token>`, where `<token>` is the HMAC-SHA-256 of
the domain-separation tag `viafidei:cron:v1` keyed by `SESSION_SECRET`
(see `src/lib/security/cron-auth.ts#deriveCronSecret`).

`/api/cron/ingest` does six short, bounded things on every tick:

1. Ensures the `IngestionSource` + `IngestionJob` rows for every
   allowlisted host exist.
2. Recovers stale leases (`recoverStaleJobs`).
3. Calls the planner (`enqueueDueIngestionJobs`) to write new
   `IngestionJobQueue` rows for jobs that are due, at the priority
   determined by backlog progress + source tier + source health.
4. Prunes expired rate-limit buckets, expired auth tokens, old
   `IngestionJobRun` / `AdminAuditLog` / `ErrorLog` rows, queue
   history (30d completed / 90d failed), and marks overdue goals.
5. When `data_management.autoCleanupEnabled` is true (default), runs
   `cleanupMiscategorisedContent()` (archive miscategorised rows),
   `archiveDuplicatePrayers()` (dedupe by checksum), and
   `purgeArchivedByArchivedAt(hardDeleteAfterDays)` — the
   `archivedAt`-based retention pass that hard-deletes rows
   30 days after they were archived.
6. Calls `dispatchAdminNotifications()`, `runAllIngestionAlerts()`,
   `checkStallSignals()`, and `autoEvaluateSourcePauses()` — emits
   the Biweekly + Monthly Archive Cleaning Up + Monthly Source
   Quality + Monthly Error Report PDF + Threshold milestone +
   Source-failure + Source-low-quality + Review-queue-large +
   Stall-class alerts. Each sub-flow guards its own "is it time?"
   check so off-cadence ticks are cheap.

A structured `cron.completed` log line captures every counter
(planner summary, prune counts, archive cleanup, janitor totals,
alert outcomes, admin notification deliveries). `maxDuration` is
60s — comfortable for cleanup + planning, never relied on for
adapter execution.

---

## Known limitations and ongoing refinements

This is an honest list of items that are scoped for future polish branches.
None of them affect day-to-day reader behaviour, and each lands behind the
same CI gates that protect the rest of the codebase.

- **High-severity advisories cleared.** All four original high-severity
  items are now resolved. Three were knocked out by an npm `overrides`
  entry that pulls `glob` forward to the patched 10.5.0+ line, and the
  fourth (Next.js core HTTP request deserialization) was cleared by
  bumping Next.js to `15.5.18` and migrating `cookies()` / `headers()`
  to the async App Router API. `npm audit --audit-level=high` now exits
  zero and the CI audit gate passes.
- **Most moderate advisories cleared.** Vitest is now on the 3.x line,
  which removed five of the seven moderate findings from the test
  chain. The remaining two moderate advisories are upstream of Next.js
  itself (postcss < 8.5.10 transitively, only triggered at dev-server
  time) and require Next 16 to fully clear — that bump waits until 16
  is on a stable release.
- **ESLint 8 deprecation.** The repository still uses ESLint 8 with the
  legacy `.eslintrc` config. Moving to ESLint 9 requires migrating to
  the flat config format and revalidating every rule, including the
  `next/core-web-vitals` integration. Tracked as a stand-alone migration.
- **Diagnostics expansion.** The diagnostics admin surface covers email
  configuration, table availability, ingestion runs, cleanup activity,
  and recent failures. Additional probes (location-based parish
  discovery readiness, browser timezone reporting, translation override
  audit) are scoped for the next diagnostics iteration so the test
  surface for them lands together with the routes.
- **Screenshot assets.** The `docs/screenshots/` files are placeholders
  in the README table. They will be populated when the next visible UI
  iteration ships so the captures stay current.

---

## License

See `LICENSE`.
