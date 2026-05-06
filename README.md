# Via Fidei

> _The Way of Faith._ A multilingual Catholic platform — prayers, saints,
> sacramental guidance, liturgy, and parish discovery — presented with reverence
> and clarity.

**Live site: [etviafidei.com](https://etviafidei.com)**

Via Fidei is a Next.js 14 application that pairs a public, reader-facing site
with an authenticated admin console for curating Catholic content. It supports
twelve locales, persists data in PostgreSQL via Prisma, and ingests material
from a small allowlist of approved Vatican-affiliated sources through a cron
pipeline that always lands new records in a moderation queue.

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
  is **`notifications@viafidei.com`**, hardcoded in `src/lib/config.ts`.
  It is the only address used for account-related email (welcome, password
  reset, email verification). Email is delivered via **Resend** when
  `RESEND_API_KEY` is set; without it, email features are safely skipped
  and the rest of the auth flow still succeeds.
- **Email DNS records are managed externally.** SPF, DKIM, DMARC, and
  return-path records live at the DNS provider and authoritatively belong
  there. **App code must not generate, write, or overwrite DNS records.**

---

## Stack

| Area               | Choice                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| Framework          | Next.js `14.2.35` (App Router, `output: "standalone"`)                                 |
| Runtime            | Node.js `>= 20`                                                                        |
| Language           | TypeScript `5.6` (strict)                                                              |
| UI                 | React `18.3`, Tailwind CSS `3.4`, Framer Motion                                        |
| Database           | PostgreSQL via Prisma `5.22`                                                           |
| Sessions           | `iron-session` (encrypted cookie, `vf_session`)                                        |
| Password hashing   | `argon2id`                                                                             |
| Validation         | `zod`                                                                                  |
| Locale negotiation | `negotiator` + cookie override                                                         |
| Container          | Multi-stage `Dockerfile` (deps → builder → runner)                                     |
| Deployment         | Railway-ready (`railway.json`, healthcheck on `/api/health/live`)                      |
| Email              | Resend transactional sends (welcome, password reset, email verification)               |
| Startup            | `instrumentation.ts` auto-seeds an empty DB and schedules in-process Vatican ingestion |
| Unit / API tests   | Vitest 2 + v8 coverage (mocked Prisma, Next route handler imports)                     |
| Component tests    | React Testing Library 15 + jsdom + jest-axe                                            |
| End-to-end tests   | Playwright (chromium + mobile-chromium) with visual + perf smoke                       |

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
│   │   ├── (public pages)     # /, /prayers, /saints, /devotions, /spiritual-life,
│   │   │                      # /spiritual-guidance, /liturgy-history, /search,
│   │   │                      # /login, /register, /forgot-password,
│   │   │                      # /reset-password, /verify-email, /privacy
│   │   ├── profile/           # /profile, /profile/journal, /profile/goals,
│   │   │                      # /profile/milestones, /profile/prayers,
│   │   │                      # /profile/saints, /profile/apparitions,
│   │   │                      # /profile/devotions, /profile/parishes,
│   │   │                      # /profile/settings
│   │   ├── admin/             # 15-card admin dashboard (see below)
│   │   └── api/               # Route handlers (auth, admin, cron, internal,
│   │                          # journal, settings, health, search)
│   ├── components/
│   │   ├── icons/             # Cross ornament, Marian monogram, search, hamburger,
│   │   │                      # user silhouette, spiritual-life icons, logo
│   │   ├── layout/            # Header, footer, brand, nav, mobile menu, search,
│   │   │                      # user menu, route error
│   │   ├── profile/           # Avatar, save button, unverified-email notice
│   │   └── ui/                # ConfirmDialog, PageHero, RemoveSavedButton,
│   │                          # AccountRequiredButton, LoginRequiredPopup,
│   │                          # ExpandablePrayer, ExpandableTimelineEvent
│   ├── lib/
│   │   ├── auth/              # Session, password, schemas, user/admin helpers, tokens
│   │   ├── audit/             # AdminAuditLog writer
│   │   ├── concurrency/       # Lock helpers
│   │   ├── content/           # Review workflow + Catholic-rite filtering
│   │   ├── data/              # Per-entity repositories + admin catalog + goal templates
│   │   ├── db/                # Prisma client, table diagnostics, init
│   │   ├── email/             # Resend client, link builders, templates,
│   │   │                      # send helpers, locale-aware translations
│   │   ├── http/              # Fetch client, retries, timeouts, JSON responses,
│   │   │                      # admin-catalog + saved-item route factories
│   │   ├── i18n/              # 12-locale dictionaries, negotiator, translator,
│   │   │                      # locale / theme / rite cookies
│   │   ├── ingestion/         # Adapters, registry, runner, scheduler, persist
│   │   ├── observability/     # Structured logger + request-id propagation
│   │   ├── security/          # Rate limit, hashing, crypto, request helpers,
│   │   │                      # cron-auth, key resolution
│   │   └── startup/           # Auto-seed bootstrap + content seeder
│   ├── instrumentation.ts     # Next.js startup hook (auto-seed + ingestion schedule)
│   └── middleware.ts          # Request-id + CSP / security headers
├── tests/                     # Vitest unit + component + API + ingestion + DB tests
│   ├── auth/                  # Auth module (password, schemas, user, tokens, admin)
│   ├── api/                   # Route handler tests (mocked Prisma)
│   ├── components/            # RTL tests with `@vitest-environment jsdom`
│   ├── data/                  # Repository tests (admin-users, etc.)
│   ├── db/                    # checkRequiredTables / checkSeedContent
│   ├── email/                 # Resend client, templates, link builders, send helpers
│   ├── fixtures/              # Factories + mock SourceAdapter / fetch
│   ├── helpers/               # Prisma + cookie mocks
│   ├── ingestion/             # validateItem + sanitize boundary tests
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

CI (`.github/workflows/ci.yml`) runs four jobs against Node 20:

1. **verify** — `prisma validate`, typecheck, lint, format check, Vitest, production build
2. **audit** — `npm audit --audit-level=high`
3. **integration** — applies migrations to a Postgres service container and runs `tests/integration/**` on PRs and `main`
4. **e2e** — installs Chromium, runs Playwright, uploads the HTML report (push to `main` only)

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

| Variable         | Purpose                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`       | `development` \| `test` \| `production`                                                                            |
| `RESEND_API_KEY` | Resend API key. When unset, transactional email is silently skipped — auth flows succeed without delivering email. |

`getEnv()` validates these with Zod at first access; in production an invalid
configuration throws, in development it logs a warning and continues.

### Hardcoded configuration (no environment variables)

The following values are baked into `src/lib/config.ts`. They used to be
environment variables; they are now safe internal defaults so production
deployments do not need to set them:

| Setting                             | Hardcoded value                                                         |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Canonical / app URL                 | `https://etviafidei.com`                                                |
| Email sender address                | `notifications@viafidei.com`                                            |
| Search provider (echoed by reindex) | `postgres`                                                              |
| Server port / hostname              | `3000` / `0.0.0.0`                                                      |
| Logger floor                        | `info` in production, `debug` otherwise                                 |
| Ingestion HTTP timeout              | 15000 ms                                                                |
| Ingestion User-Agent                | `ViaFideiBot/1.0 (+https://etviafidei.com/bot; ingestion@viafidei.com)` |
| Ingestion initial status            | `REVIEW`                                                                |
| Ingestion scheduler interval        | 30 min (initial delay 5 min)                                            |
| In-process ingestion scheduler      | **Disabled by default.** Edit `src/lib/config.ts` to enable.            |

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
- **User content**: `JournalEntry`, `Goal`, `GoalChecklistItem`, `Milestone`.
- **Catalog**: `Prayer`, `Saint`, `MarianApparition`, `Parish`, `Devotion`,
  `LiturgyEntry`, `SpiritualLifeGuide`, `DailyLiturgy`, each with a
  `*Translation` sibling where applicable.
- **Saved items**: `UserSavedPrayer`, `UserSavedSaint`, `UserSavedApparition`,
  `UserSavedParish`, `UserSavedDevotion`.
- **Curation**: `ContentReview`, `Tag`, `EntityTag`, `Category`,
  `MediaAsset`, `EntityMediaLink`.
- **Pages / settings**: `HomePage`, `HomePageBlock`, `SiteSetting`.
- **Ops**: `IngestionSource` (with `isActive`, `reliabilityScore`,
  `lastSuccessfulSync`, `lastFailedSync`), `IngestionJob`, `IngestionJobRun`,
  `AdminAuditLog`, `RateLimitBucket`.

Catalog entities all carry a `ContentStatus` (`DRAFT` → `REVIEW` →
`PUBLISHED` / `ARCHIVED`) plus a `contentChecksum` so the ingestion pipeline
can short-circuit unchanged records.

---

## Reader-facing pages

The public site renders entirely from the catalog tables, with a small
in-app fallback spine so pages stay alive if a table happens to be
empty:

- **Spiritual-life guides** (`/spiritual-life`, `/spiritual-life/[slug]`).
  Each guide loads from `SpiritualLifeGuide`, with steps stored as
  structured JSON. When a guide references a prayer (e.g. the Rosary
  guide referencing the Apostles' Creed, the Our Father, the Hail
  Mary), the page renders an `ExpandablePrayer` block per prayer:
  collapsed → arrow points right; tapped open → arrow points down and
  the full prayer body is shown; tapped again → it collapses. Slugs
  match `Prayer.slug` so the live database wins, with canonical English
  fallbacks in `src/lib/data/guide-prayers.ts` so a fresh deployment
  still shows a complete prayer body.
- **Saints** (`/saints`, `/saints/[slug]`). Each saint page renders the
  story, historical background, important dates, major contributions,
  feast day, and patronages by parsing the biography into labelled
  sections (`src/lib/data/saint-sections.ts`). Either explicit
  `Story:` / `Historical background:` / `Important dates:` /
  `Major contributions:` markers in the source biography or a prose
  heuristic split (year-mention paragraphs become "important dates")
  power the layout. Pages link to `/admin/sources` for the source
  ingestion provenance.
- **Church history timeline** (`/liturgy-history/timeline`). Renders a
  full chronological timeline from Christ's ministry through 2025: the
  apostolic age, persecution, legalisation, the Church Fathers, every
  early ecumenical council, the medieval Church, the Great Schism, the
  Reformation, the Council of Trent, Vatican I, Vatican II, and modern
  Church history. All twenty-one ecumenical councils are included with
  date, location, historical context, key issues addressed, and major
  outcomes. Each event is collapsed by default; tapping it shows the
  full body, with the same right-arrow / down-arrow behaviour as the
  prayer expander. The data comes from `LiturgyEntry` rows of kind
  `COUNCIL_TIMELINE` plus any slug starting with `church-history-` or
  `council-`, merged with the in-app fallback spine in
  `src/lib/data/church-history.ts`.
- **Liturgy & sacraments** (`/liturgy-history`,
  `/liturgy-history/[slug]`). Mass structure, the liturgical year,
  sacred symbols, vestments, marriage / funeral / ordination rites,
  glossary entries, and general catechetical material. All rendered
  from `LiturgyEntry`.
- **Search** (`/search` and the header typeahead). Powered by
  `searchAll()` and `suggest()` in `src/lib/data/search.ts`. Strict
  Postgres `contains` matches run alongside fuzzy candidate sets that
  use 3-letter sliding windows to tolerate single-character typos
  (`rosery` → "Rosary"); results are scored with a Levenshtein-based
  similarity so common misspellings of saint names, prayers, or guides
  still surface a sensible suggestion. The index covers prayers,
  saints, Marian apparitions, parishes, devotions, liturgy / Church
  history entries, spiritual-life guides, and parish names. The header
  typeahead caps suggestions at **2 on mobile** (< 640 px) and **3 on
  tablet and desktop** (≥ 640 px) — driven live from `matchMedia` and
  enforced again server-side via the `limit` query param on
  `/api/search/suggest` so the payload never exceeds what is shown.
- **Parish finder** (`/spiritual-guidance`,
  `/spiritual-guidance/[slug]`). Combines manual search and an opt-in
  device-location lookup via the W3C Geolocation API. Location is
  asked for once: the user can accept (the answer is persisted to
  `localStorage` so we don't re-prompt on every visit), decline, or
  ignore the prompt. When granted, `/api/parishes/near` returns the
  closest parishes within a 50 km radius using the haversine formula
  on the published parish set (Postgres handles the `latitude` /
  `longitude` filter, the application sorts by distance). Manual
  search by name, city, region, or country always works regardless of
  location permission. Parishes are populated through the
  `vatican.parishes` adapter from approved bishops' conference
  directories; each row carries `name`, `address`, `city`, `region`,
  `country`, `phone`, `email`, `websiteUrl`, `diocese`, `latitude`,
  `longitude`, plus the standard ingestion metadata
  (`externalSourceKey`, `sourceHost`, `contentChecksum`).

---

## Content injection (ingestion) pipeline

Scheduled scrapers register adapters, fetch from a hard-coded allowlist of
approved Catholic sources, and write items to the moderation queue. The
allowlist is the single point of truth for which hosts may populate doctrine,
liturgy, Church history, prayers, saints, devotions, guides, or
catechetical content — anything not on the allowlist is refused at fetch
time.

### Approved-source allowlist

The full list lives in `src/lib/ingestion/sources/vatican-allowlist.ts`
and is rendered for admins at **`/admin/sources`**. It is organised in
three tiers:

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

| Adapter               | Target table         | Content                                       |
| --------------------- | -------------------- | --------------------------------------------- |
| `vatican.prayers`     | `Prayer`             | Liturgical and devotional prayers             |
| `catholic.prayers`    | `Prayer`             | Bishops' conference prayer catalogues         |
| `vatican.saints`      | `Saint`              | Saint biographies from the Holy See           |
| `bishops.saints`      | `Saint`              | Saint biographies from bishops' conferences   |
| `vatican.apparitions` | `MarianApparition`   | Approved Marian apparitions                   |
| `vatican.devotions`   | `Devotion`           | Devotions and spiritual practices             |
| `catholic.devotions`  | `Devotion`           | Conference-republished devotional material    |
| `vatican.parishes`    | `Parish`             | Parish directories                            |
| `vatican.teaching`    | `LiturgyEntry`       | Catechism, encyclicals, sacraments, liturgy   |
| `vatican.history`     | `LiturgyEntry`       | Church history events and ecumenical councils |
| `vatican.guides`      | `SpiritualLifeGuide` | Spiritual-life guides (rosary, confession, …) |

Each ingested record carries source metadata: `externalSourceKey` (the
upstream URL — used for duplicate detection), `sourceHost` (parsed from
the URL), `contentChecksum` (SHA-256 of the canonical content — short-
circuits unchanged runs), `category` / `kind` for indexing, and a
`createdAt` / `updatedAt` retrieval timestamp. Curated rows
(`PUBLISHED` / `ARCHIVED`) are protected from automatic overwrites.

### Validation and review workflow

Every batch is sent through `sanitize()` and `validateItem()` before
persistence: incomplete records (missing slug, title, or body shorter
than the kind-specific minimum) are rejected, and any `externalSourceKey`
that points off-allowlist is rejected. Surviving records land in the
moderation queue at the configured initial status (defaulting to `REVIEW`)
so nothing reaches the public site until an admin approves it through
`/admin/ingestion` or `/admin/<entity>`.

### Scheduling and observability

- **In-process scheduler.** Disabled by default in `src/lib/config.ts`
  (`ingestion.schedulerDisabled = true`). When enabled in code, the running
  server schedules itself to call `POST /api/cron/ingest` after the
  configured initial delay (default 5 min) and then every configured
  interval (default 30 min). The first tick is delayed so it never blocks
  deploy healthchecks.
- **External cron.** `POST /api/cron/ingest` with `Authorization: Bearer
<token>`, where `<token>` is the cron token derived from `SESSION_SECRET`.
  The same handler accepts `GET` for platforms that prefer it. `maxDuration`
  is 60s.
- **Ad-hoc.** `POST /api/admin/ingestion/run` from the admin console.
  Records an audit entry.
- **Failure isolation.** A single failing source records an
  `IngestionJobRun` with status `FAILED` (or `PARTIAL`) and an error
  message — the rest of the batch keeps running. Adapter fetches are
  wrapped in try/catch so a 500 from upstream becomes an empty result
  set rather than a thrown exception.
- **Logs.** Every run writes to `IngestionJobRun` with `recordsSeen`,
  `recordsCreated`, `recordsUpdated`, `recordsSkipped`, `recordsFailed`,
  `recordsReviewRequired`, and `errorMessage`. Source-level rollups are
  tracked on `IngestionSource.lastSuccessfulSync` /
  `lastFailedSync` / `reliabilityScore`.
- **Admin visibility.** `/admin/ingestion` lists registered sources and
  job activity; `/admin/sources` renders the allowlist next to each
  source's registration / sync status; `/admin/audit` records every
  manual trigger. Source-management endpoints under `/api/admin/sources`
  allow disabling, marking official, recording reliability scores, and
  reading `lastSuccessfulSync` / `lastFailedSync` per host.
- **Housekeeping piggyback.** Each ingestion run also prunes expired
  `RateLimitBucket` rows, expires unused password-reset and email-
  verification tokens, prunes old `IngestionJobRun` and `AdminAuditLog`
  rows, and flips `ACTIVE` goals past their `dueDate` to `OVERDUE`. A
  separate `POST /api/internal/cleanup` (also cron-secret authenticated)
  prunes expired sessions and tokens between ticks.

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
visibility in `/admin/ingestion`. Page-side, every detail page calls
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
3. Counts published prayers — if zero, runs `seedAllContent()` from
   `src/lib/startup/seeder.ts` to populate prayers, saints, apparitions,
   devotions, parishes, liturgy entries, spiritual-life guides, and the
   default favicon site setting. If the table already has rows the seed is
   skipped.
4. Schedules the in-process ingestion ticker described above. The scheduler
   is disabled by default in `src/lib/config.ts`; flip
   `ingestion.schedulerDisabled` to `false` to enable it.

All of this work is fire-and-forget — the HTTP server begins accepting
requests immediately so Railway / Docker healthchecks never wait on it.

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

`/admin` shows fifteen sections (`src/app/admin/_dashboard/cards.ts`):

1. Homepage mirror editor
2. Prayers
3. Saints
4. Marian apparitions
5. Parishes
6. Devotions
7. Liturgy content
8. Translations
9. Ingestion jobs
10. Approved sources (allowlist + per-host sync status)
11. Search index
12. Media library
13. Favicon
14. Audit log
15. User accounts

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
| GET               | `/api/search`                                                 | Unified search across all content types                     |
| GET               | `/api/search/suggest`                                         | Typeahead suggestions grouped by content type               |
| POST              | `/api/settings/locale`                                        | Set locale cookie                                           |
| POST              | `/api/settings/rite`                                          | Set Catholic rite cookie                                    |

### Admin

| Method         | Path                             | Purpose                                                  |
| -------------- | -------------------------------- | -------------------------------------------------------- |
| POST           | `/api/admin/login`               | Admin login                                              |
| POST           | `/api/admin/logout`              | Admin logout                                             |
| POST           | `/api/admin/content/review`      | Approve / reject / revise / move-to-review               |
| GET / POST     | `/api/admin/prayers`             | List / create prayers (catalog)                          |
| PATCH / DELETE | `/api/admin/prayers/[id]`        | Update / delete a prayer                                 |
| GET / POST     | `/api/admin/saints`              | List / create saints                                     |
| PATCH / DELETE | `/api/admin/saints/[id]`         | Update / delete a saint                                  |
| GET / POST     | `/api/admin/apparitions`         | List / create Marian apparitions                         |
| PATCH / DELETE | `/api/admin/apparitions/[id]`    | Update / delete an apparition                            |
| GET / POST     | `/api/admin/parishes`            | List / create parishes                                   |
| PATCH / DELETE | `/api/admin/parishes/[id]`       | Update / delete a parish                                 |
| GET / POST     | `/api/admin/devotions`           | List / create devotions                                  |
| PATCH / DELETE | `/api/admin/devotions/[id]`      | Update / delete a devotion                               |
| GET / POST     | `/api/admin/liturgy`             | List / create liturgy entries                            |
| PATCH / DELETE | `/api/admin/liturgy/[id]`        | Update / delete a liturgy entry                          |
| GET / POST     | `/api/admin/spiritual-life`      | List / create spiritual-life guides                      |
| PATCH / DELETE | `/api/admin/spiritual-life/[id]` | Update / delete a spiritual-life guide                   |
| POST           | `/api/admin/ingestion/run`       | Run a single job or all active jobs                      |
| PATCH          | `/api/admin/ingestion/jobs/[id]` | Pause / resume or re-schedule a job                      |
| GET / POST     | `/api/admin/sources`             | List / create ingestion sources                          |
| GET / PATCH    | `/api/admin/sources/[id]`        | Read / update an ingestion source                        |
| GET / POST     | `/api/admin/media`               | List / register a media asset (Cloudinary URL)           |
| GET / DELETE   | `/api/admin/media/[id]`          | Read / delete a media asset                              |
| GET            | `/api/admin/users`               | Paginated, searchable user listing                       |
| GET            | `/api/admin/audit`               | Filterable audit log                                     |
| POST           | `/api/admin/search/reindex`      | Trigger reindex / housekeeping                           |
| GET            | `/api/admin/translations`        | Translation row counts                                   |
| GET / POST     | `/api/admin/favicon`             | Read / replace favicon asset                             |
| GET / POST     | `/api/admin/homepage`            | Read / update homepage block config                      |
| POST (`GET`)   | `/api/cron/ingest`               | Run scheduler + housekeeping (cron-secret authenticated) |
| POST / GET     | `/api/internal/cleanup`          | Prune sessions / tokens / rate-limits (cron-secret auth) |

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

`railway.json` builds with the Dockerfile, runs `./scripts/start.sh` as the
start command, and points the platform healthcheck at `/api/health/live`
with a 180s timeout and a 5-retry on-failure restart policy.

### Build behaviour

All public listing pages (`/`, `/prayers`, `/saints`, `/devotions`,
`/spiritual-life`, `/spiritual-guidance`, `/liturgy-history`) export
`dynamic = "force-dynamic"`. They are NOT pre-rendered at build time, so
`next build` never opens a database connection and CI / Docker builds do not
need access to PostgreSQL. Detail pages under `[slug]` are dynamic by default
(no `generateStaticParams`).

### Cron

The cron token is derived from `SESSION_SECRET` at runtime — there is no
separate `CRON_SECRET` environment variable. The in-process scheduler is
disabled by default; flip `ingestion.schedulerDisabled` to `false` in
`src/lib/config.ts` to enable it. To delegate scheduling to an external
platform, configure that platform to POST to
`https://<host>/api/cron/ingest` with `Authorization: Bearer <token>`,
where `<token>` is the HMAC-SHA-256 of the domain-separation tag
`viafidei:cron:v1` keyed by `SESSION_SECRET` (see
`src/lib/security/cron-auth.ts#deriveCronSecret`).

---

## License

See `LICENSE`.
