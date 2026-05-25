# Via Fidei

> _The Way of Faith._ A multilingual Catholic platform — prayers, saints,
> sacramental guidance, liturgy, and trusted Catholic content — presented
> with reverence and clarity.

**Live site: [etviafidei.com](https://etviafidei.com)**

Via Fidei is a Next.js 15 application that pairs a public reader-facing
site with an authenticated admin console. Content is sourced only from
approved Catholic publishers and verified at multiple stages before it
reaches the public. The site is run by an autonomous **Admin Worker**:
with a fresh database it fills the site by itself from a curated
knowledge base of foundational Catholic content, monitors its own
health, defends the admin surface, redesigns the homepage, and emails
a monthly operations report.

---

## Architecture

Two systems run together:

1. **Checklist-first content factory** — `src/lib/worker/`.
   The only way new content reaches the public site. Every
   public-content row begins as a `ChecklistItem` (a row in the
   master list of items the app intends to publish), gets one or
   more `ChecklistCitation`s pointing at approved Catholic sources,
   is built by the worker against a strict per-content-type schema,
   is scored on six QA dimensions, and is finally written to
   `PublishedContent` — the single table every public page reads
   from.

2. **Admin Worker engine** — `src/lib/admin-worker/`.
   The autonomous administrator that drives the checklist-first
   factory plus everything around it: source discovery, content
   goals, publishing safety, post-publish verification, homepage
   redesign, security defense, diagnostics, reporting, and self-
   repair. Fully coded, deterministic, observable, and operates
   without any AI APIs.

```
   ┌─────────────────────────────────────────────────────────────┐
   │                       Admin Worker engine                    │
   │                  (src/lib/admin-worker/)                     │
   │   planner → web navigator → web checkers → ...               │
   │   ┌──────────────────────────────────────────────────────┐   │
   │   │       Checklist-first content factory                │   │
   │   │  ChecklistItem → WorkerBuildJob → ChecklistQAReport  │   │
   │   │            → PublishedContent (public)               │   │
   │   └──────────────────────────────────────────────────────┘   │
   └─────────────────────────────────────────────────────────────┘
```

The public site reads only from `PublishedContent`. There is no other
code path from the database to a public page.

---

## Data model

**Checklist-first factory** (`src/lib/worker/`):

| Model               | Role                                                  |
| ------------------- | ----------------------------------------------------- |
| `ChecklistItem`     | One row per concrete item the app intends to publish  |
| `AuthoritySource`   | Approved-source registry (Vatican, USCCB, …)          |
| `ChecklistCitation` | One citation per (item, URL) with authority level     |
| `WorkerBuildJob`    | Queue row for a single worker build attempt           |
| `WorkerBuildLog`    | Structured log of every meaningful worker step        |
| `ChecklistQAReport` | Per-build six-dimension QA score                      |
| `ChecklistVersion`  | Per-publish snapshot for audit & rollback             |
| `ChecklistRelation` | Typed relations (saint→feast day, devotion→prayer, …) |
| `PublishedContent`  | The only table the public site reads from             |

**Admin Worker engine** (`src/lib/admin-worker/`):

| Model                         | Role                                                  |
| ----------------------------- | ----------------------------------------------------- |
| `AdminWorkerState`            | Singleton: current mode, priority, pause toggle       |
| `AdminWorkerPass`             | One row per decide-then-act cycle of the loop         |
| `AdminWorkerTask`             | Planned action; produces one or more log rows         |
| `AdminWorkerLog`              | Structured engine log (16 categories)                 |
| `AdminWorkerMemory`           | Outcome counts + confidence — no invented facts       |
| `AdminWorkerSourceReputation` | Rolling per-(host, contentType) reputation tier       |
| `AdminWorkerDecision`         | Every major decision with inputs + chosen action      |
| `AdminWorkerSecurityAction`   | Defender actions taken in response to security events |
| `AdminWorkerSourceRead`       | Durable extracted text per (sourceUrl, checksum)      |
| `AdminWorkerPipelineStage`    | One row per item moving through the content chain     |
| `AdminWorkerRepairPlan`       | Durable repair plans with exponential-backoff retry   |
| `CandidateSourceUrl`          | URLs the web navigator has discovered                 |
| `ContentGoal`                 | Per-content-type minimum + desired targets            |
| `HumanReviewQueue`            | Rare items needing human review                       |
| `HomepageWorkerDraft`         | Proposed homepage edits with before/after snapshots   |
| `AdminDeveloperReportLog`     | Audit trail of every Developer Audit PDF generated    |
| `PostPublishVerification`     | Public-page load + cache + sitemap + search check     |
| `ContentQualityScore`         | Deterministic per-package quality score               |
| `HomepageQualityScore`        | Deterministic homepage score (8 dimensions)           |

**User + site** (unchanged):

`User`, `Session`, `Profile`, `JournalEntry`, `Goal`,
`GoalChecklistItem`, `Milestone`, `UserSavedContent` (consolidated
saved-content table keyed on `(userId, contentType, slug)`),
`MediaAsset`, `EntityMediaLink`, `SiteSetting`, `HomePage`,
`HomePageBlock`, `Category`, `Tag`, `EntityTag`.

**Security + admin** (unchanged):

`SecurityEvent`, `BannedDevice`, `DiagnosticSnapshot`,
`AdminAuditLog`, `AdminActionLog`, `AdminNotificationState`,
`RateLimitBucket`, `ErrorLog`, `PasswordResetToken`,
`EmailVerificationToken`.

See `prisma/schema.prisma` for the full definitions.

---

## Running locally

```bash
# Install deps and generate the Prisma client
npm install

# Apply migrations to a local Postgres
npx prisma migrate deploy

# Seed the master checklists + authority sources
npm run seed:checklist

# Run the public site (port 3000)
npm run dev

# Run the Admin Worker in another terminal
npm run worker
```

Required environment variables (production):

| Variable         | Purpose                            |
| ---------------- | ---------------------------------- |
| `DATABASE_URL`   | Postgres connection string         |
| `SESSION_SECRET` | 32+ char iron-session secret       |
| `ADMIN_USERNAME` | Admin console username             |
| `ADMIN_PASSWORD` | Admin console password (12+ chars) |

Optional environment variables:

| Variable          | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `RESEND_API_KEY`  | Enables transactional + admin emails                   |
| `ADMIN_EMAIL`     | Destination for Admin Worker monthly + security emails |
| `PUBLIC_BASE_URL` | Base URL the post-publish probe fetches from           |
| `WORKER_ID`       | Stable id for this worker process (auto-generated)     |

---

## Admin UI

`/admin` renders a card grid grouped into four sections:

**Admin Worker (autonomous system):**

| Card               | Route                       | Purpose                                               |
| ------------------ | --------------------------- | ----------------------------------------------------- |
| Command Center     | `/admin/admin-worker`       | Status, controls, content goals, metrics              |
| System diagnostics | `/admin/diagnostics`        | 27 ratings, pass breakdown, pause toggle, Dev Report  |
| Admin Worker logs  | `/admin/admin-worker/logs`  | 16-category log viewer with period + severity filters |
| Admin Worker rules | `/admin/admin-worker/rules` | Versioned rule catalogue                              |

**Checklist (content the worker builds):**

| Card                | Route                              | Purpose                               |
| ------------------- | ---------------------------------- | ------------------------------------- |
| Checklist dashboard | `/admin/checklist`                 | Counts by status + type, bulk actions |
| Build queue         | `/admin/checklist/queue`           | Live `WorkerBuildJob` state           |
| QA reports          | `/admin/checklist/qa`              | Unreviewed reports                    |
| Published content   | `/admin/checklist/published`       | Items live on the public site         |
| Approved sources    | `/admin/checklist/sources`         | Authority registry                    |
| Janitor: edits      | `/admin/checklist/janitor/edits`   | Items the worker wants to rebuild     |
| Janitor: deletes    | `/admin/checklist/janitor/deletes` | Items the worker wants to remove      |
| Failed builds       | `/admin/checklist/failed`          | Exhausted retry budgets               |

**Site surfaces:**

| Card            | Route             | Purpose                |
| --------------- | ----------------- | ---------------------- |
| Homepage editor | `/admin/homepage` | Public homepage mirror |
| Search index    | `/admin/search`   | Search                 |
| Media library   | `/admin/media`    | Image assets           |

**Admin operations:**

| Card          | Route          | Purpose          |
| ------------- | -------------- | ---------------- |
| Logs          | `/admin/logs`  | Application logs |
| User accounts | `/admin/users` | Registered users |
| Audit log     | `/admin/audit` | Admin actions    |

---

## Admin Worker

The **Admin Worker** is the autonomous website-administrator system.
It is fully coded, deterministic, durable, observable, and autonomous,
and it operates **without any AI APIs**. Code lives under
`src/lib/admin-worker/`; the operator-facing surface is at
`/admin/admin-worker` (Command Center) and `/admin/diagnostics` (27
health ratings + pause toggle).

### What it does

- **Discovers approved Catholic source URLs** — all 7 spec-listed
  discovery methods work end-to-end: sitemap, RSS / Atom, configured
  fixed URL lists, source internal links, Catholic content
  directories, source search pages, and registered API adapters.
  Junk URLs (livestreams, donations, bulletins, store pages, event
  listings, …) are rejected before fetch.
- **Reads source pages** and extracts Catholic content using the
  existing fetcher + per-content-type Zod schemas.
- **Validates correctness** against schema + per-type packaging
  validators (Prayer, Saint, Marian Apparition, Devotion, Novena
  Day 1–9, Rosary mystery sets, Consecration daily structure,
  Sacrament, Church History — only 12 approved types — Liturgy,
  Parish).
- **Formats and publishes** valid content automatically when QA +
  quality score + source evidence + confidence all pass; humans only
  see ambiguous edge cases.
- **Verifies the public page** after every publish: HTTP-fetches the
  public URL, checks the title and body marker, triggers cache /
  sitemap / search revalidation. On failure, automatically
  unpublishes and either deletes (clear failure) or files a human
  review row (ambiguous failure).
- **Maintains the homepage** — deterministic 8-dimension scoring +
  proper liturgical-calendar engine (Meeus algorithm for Easter,
  Advent / Christmas / Lent / Triduum / Easter / Ordinary Time, with
  flags for Marian feasts + months). Small high-confidence changes
  auto-publish, major redesigns route to review, section deletion
  always routes to review.
- **Monitors diagnostics** (27 health ratings) and surfaces them on
  `/admin/diagnostics` with pass / warn / fail badges and links to
  underlying data.
- **Creates Developer Audit PDFs** for the last 24 hours, 7 days,
  or 30 days. Table of contents + 7 sections (Diagnostics Results,
  Worker Logs, System Logs, Security Logs, Content Growth and
  Publishing, Homepage Actions, Recommended Repairs) with secret
  redaction.
- **Defends the admin site**. Detects brute force, suspicious
  request bursts, banned-device reuse, attempts to bypass admin
  authentication, attempts to set public-content flags outside the
  worker, attempts to manipulate internal content routes. Only
  confirmed brute force results in an automatic device ban
  (BannedDevice row + Admin Worker Banned Device email). A valid
  authenticated admin login is never treated as suspicious — the
  admin gets a calm Admin Log In email confirming the sign-in with
  device + location.
- **Sends monthly worker reports** to `ADMIN_EMAIL` on the last day
  of each month with a PDF attachment containing per-day sections
  and a monthly summary. Handles February + shorter months.
- **Learns operationally** — outcome counts + confidence scoring +
  EWMA-smoothed source reputation. The learning system never
  invents facts, never bypasses QA, and never creates content
  without source evidence. Bad sources are paused automatically;
  good sources promoted automatically.
- **Repairs itself** — 13 repair handlers covering heartbeat
  staleness, stuck queue, missing source jobs, discovery gaps,
  fetch backoff, chronic-failure source pause, missing QA fields,
  validation evidence gaps, persistence failures, public display
  failures, and cache / sitemap / search refresh. **Durable repair
  plans** (`AdminWorkerRepairPlan`) survive process restarts and
  retry with exponential backoff (1 min → 1 h cap).
- **Brain audit view** — every pass writes a `BrainDecision` to
  `AdminWorkerDecision` with the full rules-evaluated payload so
  the operator can answer _"why did the worker choose this?"_
  without re-running the loop. The Command Center shows the most
  recent decision and the Production Readiness card runs 12 live
  checks with concrete repair instructions for each fail.

### Internal modules

`src/lib/admin-worker/` ships every spec-required module:

| File                         | Module                                  |
| ---------------------------- | --------------------------------------- |
| `planner.ts`                 | Source / content planner                |
| `web-navigator.ts`           | Web navigator + junk-URL classifier     |
| `sitemap-discovery.ts`       | Sitemap discovery + robots.txt          |
| `rss-discovery.ts`           | RSS / Atom feed discovery               |
| `configured-urls.ts`         | Configured fixed URL list discovery     |
| `internal-link-discovery.ts` | Internal-link discovery                 |
| `directory-discovery.ts`     | Catholic content directory discovery    |
| `search-page-discovery.ts`   | Approved-source search-page discovery   |
| `source-apis.ts`             | Official source API adapter registry    |
| `publisher.ts`               | Publishing gate + confidence thresholds |
| `publish-safety.ts`          | Pattern blockers (incomplete prayers, … |
| `packaging.ts`               | Per-content-type structural validators  |
| `post-publish-probe.ts`      | Live HTTP probe + auto-rollback         |
| `post-publish.ts`            | Aggregation + rollback decision         |
| `homepage-designer.ts`       | Homepage scoring + draft decision       |
| `homepage-mutator.ts`        | Builds proposed homepage snapshots      |
| `liturgical-calendar.ts`     | Meeus-based liturgical calendar engine  |
| `security-defender.ts`       | Defender + automatic ban + email        |
| `security-detectors.ts`      | 10 deterministic detector functions     |
| `cleanup.ts`                 | Cleanup custodian                       |
| `diagnostics.ts`             | 27-rating diagnostics auditor           |
| `report-generator.ts`        | Developer Audit data collection         |
| `pdf.ts`                     | Real PDF rendering for both reports     |
| `monthly-report-job.ts`      | Last-day-of-month gate + run            |
| `learning.ts`                | Feedback loop (success/failure counts)  |
| `memory.ts`                  | Learning memory store                   |
| `source-reputation.ts`       | EWMA-smoothed reputation engine         |
| `source-strategy.ts`         | 10-criteria source ranking              |
| `repair.ts`                  | 13 self-repair handlers                 |
| `rules.ts`                   | 12 versioned rules across 11 categories |
| `decisions.ts`               | Decision log + confidence thresholds    |
| `health.ts`                  | Worker health monitor                   |
| `metrics.ts`                 | Command Center metric computation       |
| `brain.ts`                   | Explicit decision brain (deterministic) |
| `pipeline-stages.ts`         | Pipeline-stage chain + snapshot bucket  |
| `repair-plans.ts`            | Durable repair-plan queue + backoff     |
| `source-reads.ts`            | Source-read dedupe via sha256 checksum  |
| `readiness.ts`               | Production-readiness 12-check sweep     |
| `loop.ts`                    | Central decision loop + mode dispatch   |
| `state.ts`                   | Singleton state + pause/resume          |
| `modes.ts`                   | 9 mode descriptors                      |
| `priorities.ts`              | Priority ladder + selector              |
| `passes.ts`                  | Pass lifecycle                          |
| `tasks.ts`                   | Task management                         |
| `logs.ts`                    | Structured AdminWorkerLog writer        |
| `human-review.ts`            | Rare-edge-case review queue             |
| `deletion.ts`                | Confidence-gated deletion + 9 reasons   |
| `quality.ts`                 | Content quality scoring                 |
| `public-routes.ts`           | Public URL builder + cache tag mapping  |

### Pause + override

The human admin is the site's super-admin. They can pause the Admin
Worker at any time via the toggle on `/admin/diagnostics` (directly
above the Developer Report button). Pausing stops all non-security
work — the security defender keeps running so the site is never
unprotected.

When paused, the Admin Worker writes a single "Admin Worker is paused
(reason)" log entry per pass and skips the rest of the loop. Resume
the worker via the same toggle.

### Modes

The loop runs in exactly one mode at a time:

- `SETUP` — initialize tables, source jobs, diagnostics, goals
- `CONSTANT_FILL` — build content until goals are met
- `MAINTENANCE` — keep content fresh
- `REPAIR` — fix pipeline failures
- `HOMEPAGE` — improve the homepage
- `DIAGNOSTICS` — audit the system
- `SECURITY_DEFENSE` — protect the site
- `REPORTING` — generate scheduled reports
- `PAUSED` — non-security tasks paused

---

## Worker entry point

```bash
tsx scripts/run-worker.ts                # loop forever
tsx scripts/run-worker.ts --one-shot     # one pass then exit
tsx scripts/run-worker.ts --max-jobs N   # exit after N passes
tsx scripts/run-worker.ts --worker-id X  # stable worker id
```

The worker self-leases jobs and is safe to run with multiple
replicas. Each build job is leased for five minutes; stale leases
are reclaimed automatically.

The monthly Admin Worker Report is gated on `isLastDayOfMonth(today)`
and is triggered once on every worker startup, so a restart on the
last day of the month still fires the email.

---

## Public site

Every public page renders directly from `PublishedContent`:

```
/prayers              → PublishedContent where contentType=PRAYER
/saints               → PublishedContent where contentType=SAINT
/sacraments           → PublishedContent where contentType=SACRAMENT
/devotions            → PublishedContent where contentType=DEVOTION
/spiritual-life       → PublishedContent where contentType=GUIDE or SPIRITUAL_PRACTICE
/spiritual-guidance   → PublishedContent where contentType=MARIAN_TITLE or APPARITION
/liturgy              → PublishedContent where contentType=LITURGICAL
/liturgy-history      → LITURGICAL + CHURCH_DOCUMENT slugs (same /[slug] route)
/history              → PublishedContent where contentType=CHURCH_DOCUMENT
/search?q=...         → full-text search across PublishedContent
/api/prayers?take=N   → public list endpoint (clamped at 200)
```

There is no other code path from the database to the public site.

---

## Catholic accuracy rules

The worker treats Catholic accuracy as a hard constraint:

- Scripture must come from an approved translation source. Unapproved
  translations are blocked at the publish gate.
- Sacraments are limited to the seven the Catholic Church recognises.
- Indulgences must cite the Vatican or the Apostolic Penitentiary.
- Novenas must have exactly nine days.
- Rosary mystery sets must have exactly five mysteries each.
- Church history packages must be one of the 12 approved types
  (councils, encyclicals, papal acts, doctrinal definitions, …).
- Cross-source reconciliation prefers higher authority levels
  (Vatican > Catechism > USCCB > Diocesan > Religious Order > Trusted
  Publisher > Academic > Community).
- Marian apparitions must include an approval status.

The accuracy guards are deterministic and enforced in code — they
have no off-switch.

---

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format:check
npm test            # vitest run (unit + component + worker + admin-worker)
npm run test:e2e    # playwright
npm run verify      # typecheck + lint + format:check + test
npm run verify:full # verify + integration + e2e + build
```

The unit + component suite covers:

- 246 admin-worker tests (state, modes, priorities, planner, deletion,
  publish gate, publish safety, packaging validators, post-publish
  probe + rollback, homepage designer + mutator, security defender +
  auto-ban + emails, security detectors, source reputation + ranking,
  PDF generation, monthly report job, metrics, rule categories,
  sitemap + RSS + internal-link + directory discovery, liturgical
  calendar)
- 17 worker tests (build engine, build queue, publishing gate, QA
  approval, source validation, diagnostics, janitor, cross-source,
  duplicate detection, schema compliance, autonomous cycle,
  knowledge base, relations, Catholic accuracy)
- API, auth, security, components, data, email, observability,
  i18n, cache test suites

Total: **1165+ passing tests**.

---

## Security

Three-tier security model:

1. **Middleware** — every request goes through `src/middleware.ts`,
   which sets the device-credential cookie, enforces CSP / HSTS /
   referrer-policy, and gates `/admin/*` on session presence.
2. **Admin gate** — `src/lib/security/banned-guard.ts` blocks every
   request from a `BannedDevice` row before any page renders.
3. **Admin Worker security defender** — `src/lib/admin-worker/
security-defender.ts` consumes `SecurityEvent` rows. On a
   confirmed Breach (classification=Breach + confidence ≥ 0.9 +
   known device fingerprint) it upserts a `BannedDevice` row and
   sends the Admin Worker Banned Device email. Suspicious activity
   never results in an automatic ban.

Admin login flow:

- Successful login → `recordAdminLoginSuccess` → SecurityEvent +
  AdminActionLog + Admin Log In email (timestamp, device, location).
- 3+ failed logins in window → Suspicious Activity email (no ban).
- 5+ failed logins in window OR confirmed brute force → Security
  Breach email + signed ban link the admin can click.
- The Admin Worker defender layers on top: when classification=Breach
  - high confidence, it auto-bans (BannedDevice + Admin Worker
    Banned Device email) without waiting for the admin to click the
    signed link.

A valid authenticated admin browsing the admin console never
triggers a suspicious-activity email — `recordAdminLoginSuccess`
marks the device known so subsequent navigation reads as expected
activity.

---

## Migration history

| Migration                           | What it added                                                             |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `0001` – `0022`                     | Original schema (auth, content, ingestion, …)                             |
| `0023_checklist_first_architecture` | Checklist-first models (ChecklistItem, …)                                 |
| `0024_admin_worker`                 | Admin Worker engine tables (15 + enums)                                   |
| `0025_drop_legacy_system`           | Dropped 30+ legacy tables, consolidated UserSaved\* into UserSavedContent |
| `0026_admin_worker_brain`           | Brain tables: SourceRead, PipelineStage, RepairPlan                       |

The legacy scraper-first ingestion + legacy public-content models
(`Prayer`, `Saint`, `MarianApparition`, `Parish`, `Devotion`,
`LiturgyEntry`, `SpiritualLifeGuide`, `DailyLiturgy`, and their
translations) were dropped in migration `0025_drop_legacy_system`.
Public reads have been served by `PublishedContent` since
`0023`; the schema cleanup removes the now-orphaned tables and
collapses the 5 separate `UserSaved*` tables into one
`UserSavedContent` keyed on `(userId, contentType, contentSlug)`.

If you are deploying to a database that still has the legacy tables,
running `prisma migrate deploy` applies `0025` which drops them
cleanly. No data migration is required because the public surface
has been reading from `PublishedContent` for the full life of those
tables under the new system.

---

## License

ISC. See [LICENSE](./LICENSE).
