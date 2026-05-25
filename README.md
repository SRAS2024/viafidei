# Via Fidei

> _The Way of Faith._ A multilingual Catholic platform — prayers, saints,
> sacramental guidance, liturgy, and trusted Catholic content — presented
> with reverence and clarity.

**Live site: [etviafidei.com](https://etviafidei.com)**

Via Fidei is a Next.js 15 application that pairs a public reader-facing
site with an authenticated admin console. Content is sourced only from
approved Catholic publishers and verified at multiple stages before it
reaches the public. The site is run by the **Admin Worker** — a fully
coded, deterministic, autonomous administrator that operates **without
any AI APIs**. With a fresh database the Admin Worker fills the site
by itself: it discovers approved Catholic sources, classifies and
extracts content, validates facts across sources, publishes when QA +
provenance + confidence all pass, verifies the public page after
publish, repairs failed pipeline stages, redesigns the homepage when
safe, defends the admin surface, and emails a monthly operations
report.

---

## Architecture

Two systems run together:

1. **Checklist-first content factory** — `src/lib/worker/`.
   The only path from a source page to a public page. Every public
   row begins as a `ChecklistItem`, gets one or more
   `ChecklistCitation`s pointing at approved Catholic sources, is
   built against a strict per-content-type schema, is scored on six
   QA dimensions, and is finally written to `PublishedContent` —
   the single table every public page reads from.

2. **Admin Worker engine** — `src/lib/admin-worker/`.
   The autonomous administrator that drives the checklist-first
   factory plus everything around it: brain, mission planner,
   discovery, source reader, classifier, extractors, cross-source
   verifier, publishing gate, post-publish verification, homepage
   redesign, security defense, diagnostics, reporting, durable
   repair plans, memory, source reputation. Deterministic and
   observable end-to-end.

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                       Admin Worker engine                         │
   │                    (src/lib/admin-worker/)                        │
   │                                                                   │
   │   brain → mission planner → discovery → source reader →           │
   │     classifier → extractors → cross-source verifier →             │
   │     publish gate → post-publish probe → repair plans              │
   │                                                                   │
   │   ┌──────────────────────────────────────────────────────────┐   │
   │   │       Checklist-first content factory                    │   │
   │   │  ChecklistItem → WorkerBuildJob → ChecklistQAReport      │   │
   │   │            → PublishedContent (public)                   │   │
   │   └──────────────────────────────────────────────────────────┘   │
   └──────────────────────────────────────────────────────────────────┘
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
| `AdminWorkerDecision`         | Every brain decision with inputs + chosen action      |
| `AdminWorkerMemory`           | Outcome counts + confidence — no invented facts       |
| `AdminWorkerSourceReputation` | Rolling per-(host, contentType) reputation tier       |
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

**User + site:**

`User`, `Session`, `Profile`, `JournalEntry`, `Goal`,
`GoalChecklistItem`, `Milestone`, `UserSavedContent` (consolidated
saved-content table keyed on `(userId, contentType, slug)`),
`MediaAsset`, `EntityMediaLink`, `SiteSetting`, `HomePage`,
`HomePageBlock`, `Category`, `Tag`, `EntityTag`.

**Security + admin:**

`SecurityEvent`, `BannedDevice`, `DiagnosticSnapshot`,
`AdminAuditLog`, `AdminActionLog`, `AdminNotificationState`,
`RateLimitBucket`, `ErrorLog`, `PasswordResetToken`,
`EmailVerificationToken`, `WorkerHeartbeat` (compat — Admin Worker
also writes it during the heartbeat-unification transition).

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

| Card               | Route                       | Purpose                                                       |
| ------------------ | --------------------------- | ------------------------------------------------------------- |
| Command Center     | `/admin/admin-worker`       | Status, current mission, last brain decision, controls, goals |
| System diagnostics | `/admin/diagnostics`        | 30 ratings, pause toggle, Developer Audit PDF                 |
| Admin Worker logs  | `/admin/admin-worker/logs`  | 16-category log viewer with period + severity filters         |
| Admin Worker rules | `/admin/admin-worker/rules` | Versioned rule catalogue                                      |

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

The **Admin Worker** is the autonomous website-administrator system,
fully coded and operating **without any AI APIs**. Code lives under
`src/lib/admin-worker/`. The operator surface is at `/admin/admin-worker`
(Command Center) and `/admin/diagnostics` (30 ratings + pause toggle).

### What it does

- **Has a real coded brain.** `brain.ts` samples world state on every
  pass (content goals, source reputation, pending + failed build jobs,
  homepage score, security events, heartbeat age, candidate URLs, open
  repair plans, blocked pipeline stages) and emits a structured
  `BrainDecision`: chosen mode + priority + task type, content type,
  source target, expected result, confidence, risk, reason, fallback,
  repair action, rules evaluated, memory used, reputation used. Every
  decision is written to `AdminWorkerDecision` so the operator can
  audit _"why did the worker choose this?"_ without re-running.

- **Walks the full content chain.** `mission-planner.ts` traverses
  Discovery → Candidate → Fetch → Read → Classify → Checklist →
  Citation → Build → Validate → QA → Publish → Post-publish → Search
  → Sitemap → Cache and stops at the first stage that needs work for
  the largest content gap. The worker never stalls when the build
  queue is empty; it creates discovery / classification / citation /
  build / verify work on demand.

- **Discovers approved Catholic sources** — eight discovery methods
  end-to-end: sitemap, RSS / Atom, configured fixed URL lists,
  internal links, Catholic content directories, source search pages,
  official source API adapters, and the candidate-URL store. Junk
  URLs (livestreams, donations, bulletins, store pages, event listings,
  staff pages, schools, login pages, calendars, …) are rejected
  before fetch.

- **Reads source pages.** `source-reader.ts` orchestrates fetch →
  stripJunk → classify → extract → persist into one call. Source body
  is sha256-hashed and stored in `AdminWorkerSourceRead`; subsequent
  reads short-circuit when the checksum hasn't changed.

- **Classifies content deterministically.** `classifier.ts` decides
  whether a source page is a prayer / saint / apparition / devotion /
  novena / rosary / consecration / sacrament / liturgy / history /
  parish — or rejects it as WRONG / UNUSABLE — using URL patterns,
  title regex, headings, body regex, required-term presence, and
  source reputation. Every decision records its per-type scores +
  reasons.

- **Extracts complete packages with field-level provenance.**
  Eleven specialised extractors (PrayerExtractor, SaintExtractor,
  MarianApparitionExtractor, DevotionExtractor, NovenaExtractor,
  RosaryExtractor, ConsecrationExtractor, SacramentExtractor,
  HistoryExtractor, LiturgyExtractor, ParishExtractor) parse a
  source-read into a candidate package. Every required field gets
  a `FieldProvenance` row with source URL, host, snippet, extraction
  method, confidence, timestamp, and source-page checksum. Required
  fields without provenance cannot be published — except deterministic
  internal rules (Rosary 5-mystery decade structure, seven sacraments
  list, novena 9-day requirement, content-type mapping).

- **Verifies facts across sources.** `cross-source-verifier.ts`
  compares required facts against approved validation sources and
  emits structured `ValidationEvidence` rows (`fieldVerified`,
  `sourceUsed`, `matchStatus`, `confidence`, `conflict`,
  `failureReason`). When two sources conflict — or when validation
  evidence is missing for required sensitive facts (apparition
  approval, saint feast day, scripture references, novena day count,
  rosary mystery count, sacrament identity) — publishing is blocked.

- **Validates per-content-type packages.** `packaging.ts` enforces
  the spec's structural extras the Zod schema treats as optional:
  Novena must have Day 1–9 with title + prayer, Rosary must have
  mystery sets with exactly 5 mysteries + decade structure,
  Consecration must have daily structure + final consecration prayer,
  Church History must be one of the 12 approved types, and so on.

- **Publishes valid content autonomously.** The publish gate
  (`publisher.ts`) requires: complete package, correct content type,
  required fields with provenance, validation evidence when sensitive
  facts are involved, duplicate check pass, strict QA pass, formatting
  check pass, and confidence above the per-type threshold (normal /
  doctrinal / Marian apparition / history / scripture / homepage).
  Items below threshold are repaired first; items that cannot be
  repaired go to rare human review.

- **Verifies the public page** after every publish: HTTP-fetches the
  public URL, checks title + body markers + tab placement + search
  visibility + sitemap inclusion + cache freshness. On failure,
  automatically unpublishes; clear-cut failures delete with logs,
  ambiguous failures route to human review.

- **Repairs failed pipeline stages.** Thirteen in-pass repair
  handlers cover heartbeat staleness, stuck queue, missing source
  jobs, discovery gaps, fetch backoff, chronic-failure source pause,
  missing QA fields, validation evidence gaps, persistence failures,
  public display failures, and cache / sitemap / search refresh.
  **Durable repair plans** (`AdminWorkerRepairPlan`) survive process
  restarts and retry with exponential backoff (1 min → 1 h cap).
  Plans abandon after maxAttempts.

- **Learns operationally.** `memory.ts` writes outcome counts +
  Laplace-smoothed confidence per (memoryType, memoryKey). Active
  hooks: `rankHostsByMemory` (orders candidate hosts before fetch),
  `recordExtractorOutcome` (tracks per-host extractor success),
  `rememberFailurePattern` (records failure modes for the brain).
  EWMA-smoothed `AdminWorkerSourceReputation` updates after every
  discovery / fetch / classify / extract / build / QA / publish /
  post-publish / duplicate / wrong-content outcome. Good sources
  promoted automatically; bad sources paused.

- **Maintains the homepage.** Deterministic 8-dimension scoring +
  Meeus-algorithm liturgical calendar (Advent / Christmas / Lent /
  Triduum / Easter / Ordinary Time, Marian feasts + months). Small
  high-confidence changes auto-publish; major redesigns route to
  human review; section deletion always routes to review. The
  Command Center has a **Request Homepage Makeover** button that
  triggers an on-demand task.

- **Defends the admin site.** Ten deterministic detectors classify
  every protected-route request: unauthenticated direct access,
  normal login redirect, failed admin login, valid admin login,
  valid session navigation, expired session, brute force, mutation
  bypass attempt, content route manipulation, banned-device reuse.
  Confirmed brute force results in an automatic device ban
  (`BannedDevice` row + Admin Worker Banned Device email). A valid
  authenticated admin login is never treated as suspicious — the
  admin gets a calm **Admin Log In** email with date, time, device,
  browser, OS, IP, city, region, country, and session status.

- **Creates Developer Audit PDFs** for the last 24 hours / 7 days /
  30 days. Table of contents + sections for Admin Worker diagnostics,
  worker decisions, passes, tasks, logs, source / classification /
  extraction / validation / QA / publishing / post-publish / security
  / homepage / repair / email / scheduler / DB / cache / search /
  sitemap logs, plus a summary section (overall health, top failures,
  top warnings, current blocker, most recent pass / publish / security
  action, top repair recommendation). All secrets redacted.

- **Sends a monthly PDF report** to `ADMIN_EMAIL` on the last calendar
  day of each month. Daily sections + monthly summary (total content
  growth, best / weakest content type growth, best / worst sources, QA
  pass rate, publish rate, worker uptime, security events, homepage
  improvements, remaining blockers).

- **Escalates stalled growth.** `content-growth.ts` watches each
  content type. After 24 hours with no growth while below target, the
  worker auto-expands sources. After 7 days, it escalates the gap to
  a full diagnostics pass.

- **Reports production readiness.** `readiness.ts` runs 12 live
  checks (heartbeat, brain has run, content goals exist, source
  discovery configured, candidate URLs available, source reads exist,
  builds exist, QA passes exist, published content exists,
  post-publish verification works, security defender wired, homepage
  scoring available). Every failed check returns a concrete repair
  instruction. The Command Center surfaces the readiness score and
  failing checks.

### Internal modules

`src/lib/admin-worker/` ships every spec-required module:

| File                         | Module                                  |
| ---------------------------- | --------------------------------------- |
| `brain.ts`                   | Explicit decision brain (deterministic) |
| `mission-planner.ts`         | Chain-aware mission planner             |
| `loop.ts`                    | Central decision loop + mode dispatch   |
| `passes.ts`                  | Pass lifecycle                          |
| `tasks.ts`                   | Task management                         |
| `state.ts`                   | Singleton state + pause/resume          |
| `modes.ts`                   | 9 mode descriptors                      |
| `priorities.ts`              | Priority ladder + selector              |
| `decisions.ts`               | Decision log + confidence thresholds    |
| `planner.ts`                 | Build-job enqueuer (within mission)     |
| `web-navigator.ts`           | Candidate URL store + junk classifier   |
| `sitemap-discovery.ts`       | Sitemap discovery + robots.txt          |
| `rss-discovery.ts`           | RSS / Atom feed discovery               |
| `configured-urls.ts`         | Configured fixed URL list discovery     |
| `internal-link-discovery.ts` | Internal-link discovery                 |
| `directory-discovery.ts`     | Catholic content directory discovery    |
| `search-page-discovery.ts`   | Approved-source search-page discovery   |
| `source-apis.ts`             | Official source API adapter registry    |
| `source-reads.ts`            | Source-read dedupe via sha256 checksum  |
| `source-reader.ts`           | Orchestrator: classify + extract + read |
| `classifier.ts`              | Deterministic content classifier        |
| `extractors.ts`              | Per-type extractors + field provenance  |
| `provenance.ts`              | Field-level provenance tracker          |
| `cross-source-verifier.ts`   | Field verification + ValidationEvidence |
| `packaging.ts`               | Per-content-type structural validators  |
| `publisher.ts`               | Publishing gate + confidence thresholds |
| `publish-safety.ts`          | Pattern blockers (incomplete prayers …) |
| `post-publish-probe.ts`      | Live HTTP probe + auto-rollback         |
| `post-publish.ts`            | Aggregation + rollback decision         |
| `homepage-designer.ts`       | Homepage scoring + draft decision       |
| `homepage-mutator.ts`        | Builds proposed homepage snapshots      |
| `liturgical-calendar.ts`     | Meeus-based liturgical calendar engine  |
| `security-defender.ts`       | Defender + automatic ban + email        |
| `security-detectors.ts`      | 10 deterministic detector functions     |
| `pipeline-stages.ts`         | Pipeline-stage chain + snapshot bucket  |
| `repair.ts`                  | 13 in-pass repair handlers              |
| `repair-plans.ts`            | Durable repair-plan queue + backoff     |
| `learning.ts`                | Feedback loop (success/failure counts)  |
| `memory.ts`                  | Active memory hooks (rank + record)     |
| `source-reputation.ts`       | EWMA-smoothed reputation engine         |
| `source-strategy.ts`         | 10-criteria source ranking              |
| `content-goals.ts`           | Per-content-type minimum/desired        |
| `content-growth.ts`          | 24h / 7d growth-escalation watcher      |
| `cleanup.ts`                 | Cleanup custodian                       |
| `human-review.ts`            | Rare-edge-case review queue             |
| `deletion.ts`                | Confidence-gated deletion + 9 reasons   |
| `quality.ts`                 | Content quality scoring                 |
| `health.ts`                  | Worker health monitor                   |
| `metrics.ts`                 | Command Center metric computation       |
| `diagnostics.ts`             | 30-rating diagnostics auditor           |
| `readiness.ts`               | Production-readiness 12-check sweep     |
| `rules.ts`                   | 12 versioned rules across 11 categories |
| `logs.ts`                    | Structured AdminWorkerLog writer        |
| `report-generator.ts`        | Developer Audit data collection         |
| `pdf.ts`                     | PDF rendering for both reports          |
| `monthly-report-job.ts`      | Last-day-of-month gate + run            |
| `public-routes.ts`           | Public URL builder + cache tag mapping  |

### Pause + override

The human admin is the site's super-admin. They can pause the Admin
Worker at any time via the toggle on `/admin/diagnostics`. Pausing
stops all non-security work — the security defender keeps running so
the site is never unprotected. When paused, the Admin Worker writes a
single "Admin Worker is paused (reason)" log entry per pass and skips
the rest of the loop. Resume the worker via the same toggle.

### Operator actions

The Command Center exposes one-click actions for every named pass:

- **Run diagnostic pass** — refreshes 30 ratings + writes diagnostic snapshots
- **Run content goal pass** — recomputes gaps + enqueues build jobs
- **Run source discovery pass** — runs the web navigator
- **Run homepage pass** — invokes the homepage mutator
- **Run source repair pass** — drains durable repair plans
- **Run report generation** — generates a monthly report on demand
- **Run cleanup pass** — runs the custodian
- **Run security defense pass** — invokes the defender (even when paused)
- **Request Homepage Makeover** — operator-triggered redesign
- **Download Developer Audit** — last 24 h / 7 d / 30 d PDF

### Modes

The loop runs in exactly one mode at a time:

- `SETUP` — initialise tables, source jobs, diagnostics, goals
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

The worker self-leases jobs and is safe to run with multiple replicas.
Each build job is leased for five minutes; stale leases are reclaimed
automatically. The monthly Admin Worker Report fires once per worker
startup when `isLastDayOfMonth(today)` is true, so a restart on the
last day of the month still sends the email.

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

The Admin Worker treats Catholic accuracy as a hard constraint:

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

- Admin Worker brain, mission planner, classifier, all 11 extractors,
  field provenance, cross-source verifier, source reader, pipeline
  stages, durable repair plans, source-read dedupe, memory hooks,
  content-growth escalation, production readiness, packaging,
  publish gate + safety, post-publish probe + rollback, homepage
  designer + mutator, security defender + auto-ban + emails, security
  detectors, source reputation + ranking, monthly report job, PDF
  generation, metrics, rule categories, liturgical calendar.
- End-to-end chain tests (Prayer + Saint + Novena) proving Discovery
  → Read → Classify → Extract → Verify → publishAllowed.
- Worker tests covering build engine, build queue, publishing gate,
  QA approval, source validation, diagnostics, janitor, cross-source,
  duplicate detection, schema compliance, autonomous cycle, knowledge
  base, relations, Catholic accuracy.
- API, auth, security, components, data, email, observability, i18n,
  and cache test suites.

Total: **1243+ passing tests**.

---

## Security

Three-tier security model:

1. **Middleware** — every request goes through `src/middleware.ts`,
   which sets the device-credential cookie, enforces CSP / HSTS /
   referrer-policy, and gates `/admin/*` on session presence.
2. **Admin gate** — `src/lib/security/banned-guard.ts` blocks every
   request from a `BannedDevice` row before any page renders.
3. **Admin Worker security defender** — `security-defender.ts`
   consumes `SecurityEvent` rows. On a confirmed Breach
   (classification=Breach + confidence ≥ 0.9 + known device
   fingerprint) it upserts a `BannedDevice` row and sends the Admin
   Worker Banned Device email. Suspicious activity never results in
   an automatic ban.

Admin login flow:

- Successful login → `recordAdminLoginSuccess` → SecurityEvent +
  AdminActionLog + Admin Log In email (timestamp, device, location).
- 3+ failed logins in window → Suspicious Activity email (no ban).
- 5+ failed logins OR confirmed brute force → Security Breach email +
  signed ban link the admin can click.
- The defender layers on top: classification=Breach + high confidence
  auto-bans without waiting for the admin to click the signed link.

A valid authenticated admin browsing the admin console never triggers
a suspicious-activity email — `recordAdminLoginSuccess` marks the
device known so subsequent navigation reads as expected activity.

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
translations) were dropped in `0025_drop_legacy_system`. Public reads
have been served by `PublishedContent` since `0023`; the schema
cleanup removes the now-orphaned tables and collapses the five
separate `UserSaved*` tables into one `UserSavedContent` keyed on
`(userId, contentType, contentSlug)`.

---

## License

ISC. See [LICENSE](./LICENSE).
