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
by itself: it ranks the next safest action, discovers approved Catholic
sources across seven discovery methods, fetches and reads pages into
structured source blocks, classifies content with confusion detection,
builds complete package artifacts, fetches validation pages from
higher-authority hosts to verify sensitive facts, runs strict QA as a
durable artifact-level stage, scores quality across ten dimensions,
publishes through a single Publish Orchestrator path, independently
verifies search + sitemap + cache, repairs failed stages with real
handlers (not just logging), rolls back via an explicit decision tree
(repair → unpublish → log-deletion → human review), defends the admin
surface (without harassing the valid admin), and emails a monthly
operations report.

---

## Architecture

The **Admin Worker artifact pipeline** is the only active path from a
source page to a public page. The pre-Admin-Worker checklist-first
build/publish engine in `src/lib/worker/` is **hard-disabled** (see
[Single content path](#single-content-path-no-legacy)): the legacy
`publish()` writer and `runOneBuildCycle` build engine throw unless an
explicit `ALLOW_LEGACY_PUBLISH=1` migration escape hatch is set, the
old build/publish admin routes return `410 Gone`, and production
readiness fails if any content could still become public through an
old path. The checklist-first data models (`ChecklistItem`,
`ChecklistCitation`, `AuthoritySource`, `PublishedContent`) remain —
the Admin Worker pipeline populates `ChecklistItem` + `ChecklistCitation`
from package artifacts and publishes to `PublishedContent` through the
Publish Orchestrator.

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                  Admin Worker engine — the ONLY                    │
   │              active content path (src/lib/admin-worker/)           │
   │                                                                    │
   │   ranked-action brain → mission dispatcher (22 stages)             │
   │                                                                    │
   │     DISCOVERY → CANDIDATE_PRIORITIZATION → SOURCE_FETCH →          │
   │     SOURCE_READ → CLASSIFICATION → EXTRACTION →                    │
   │     CHECKLIST_CREATION → CITATION_CREATION → PACKAGE_BUILD →       │
   │     CROSS_SOURCE_VERIFICATION → STRICT_QA → PERSISTENCE →          │
   │     PUBLIC_PUBLISH → POST_PUBLISH_VERIFY → SEARCH_VERIFY →         │
   │     SITEMAP_VERIFY → CACHE_REFRESH → REPAIR → HOMEPAGE_WORK →      │
   │     REPORTING → SECURITY_DEFENSE → MAINTENANCE                     │
   │                                                                    │
   │   AdminWorkerPackageArtifact → ChecklistItem + ChecklistCitation   │
   │            → runPublishOrchestrator() → PublishedContent (public)  │
   └──────────────────────────────────────────────────────────────────┘
```

The public site reads only from `PublishedContent`. There is no other
code path from the database to a public page, and only
`runPublishOrchestrator()` writes it.

---

## Data model

**Checklist + published content** (`src/lib/worker/`):

| Model               | Role                                                           |
| ------------------- | -------------------------------------------------------------- |
| `ChecklistItem`     | One row per concrete item (populated from package artifacts)   |
| `AuthoritySource`   | Approved-source registry (Vatican, USCCB, …)                   |
| `ChecklistCitation` | One citation per (item, URL) with authority level              |
| `WorkerBuildJob`    | Legacy build-queue row (legacy build engine hard-disabled)     |
| `WorkerBuildLog`    | Legacy structured build log                                    |
| `ChecklistQAReport` | Legacy per-build QA score (artifact strict QA is the live one) |
| `ChecklistVersion`  | Per-publish snapshot for audit & rollback                      |
| `ChecklistRelation` | Typed relations (saint→feast day, devotion→prayer, …)          |
| `PublishedContent`  | The only table the public site reads from                      |

**Admin Worker engine** (`src/lib/admin-worker/`):

| Model                                | Role                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| `AdminWorkerState`                   | Singleton: current mode, priority, pause toggle               |
| `AdminWorkerPass`                    | One row per decide-then-act cycle of the loop                 |
| `AdminWorkerTask`                    | Planned action; produces one or more log rows                 |
| `AdminWorkerLog`                     | Structured engine log (16 categories)                         |
| `AdminWorkerDecision`                | Brain decision: chosen action + ranked alternatives + reason  |
| `AdminWorkerActionScore`             | One row per ranked action (every action, not only the chosen) |
| `AdminWorkerReasoningGraph`          | Directed "why" graph edges connecting every pipeline entity   |
| `AdminWorkerMemory`                  | Outcome counts + confidence — no invented facts, 30-day decay |
| `AdminWorkerSourceReputation`        | EWMA + time-decayed per-(host, contentType) reputation tier   |
| `AdminWorkerSecurityAction`          | Defender actions taken in response to security events         |
| `AdminWorkerSourceRead`              | Durable extracted text per (sourceUrl, checksum)              |
| `AdminWorkerSourceBlock`             | Structured HTML blocks (heading, paragraph, list, …)          |
| `AdminWorkerFetchResult`             | Every fetch: status, checksum, host, rejection reason         |
| `AdminWorkerPackageArtifact`         | Built content package (provenance + missing fields)           |
| `AdminWorkerStrictQAResult`          | Per-artifact strict QA: 7 sub-scores + blocking reasons       |
| `AdminWorkerCrossSourceVerification` | Per-field validation evidence with conflict status            |
| `AdminWorkerSourceCoverage`          | Per-type primary/validation/enrichment + active/recent counts |
| `AdminWorkerGrowthSnapshot`          | Per-content-type 24h/7d growth status                         |
| `AdminWorkerPipelineStage`           | One row per item moving through the 22-stage chain            |
| `AdminWorkerRepairPlan`              | Durable repair plans with exponential-backoff retry           |
| `CandidateSourceUrl`                 | URLs the discovery orchestrator has found (with scoring)      |
| `ContentGoal`                        | Per-content-type minimum + desired targets                    |
| `HumanReviewQueue`                   | Rare items needing human review                               |
| `HomepageWorkerDraft`                | Proposed homepage edits with before/after snapshots           |
| `AdminDeveloperReportLog`            | Audit trail of every Developer Audit PDF generated            |
| `PostPublishVerification`            | Public-page load + cache + sitemap + search check             |
| `ContentQualityScore`                | Deterministic per-package quality score (10 dimensions)       |
| `HomepageQualityScore`               | Deterministic homepage score (8 dimensions)                   |

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

| Variable                    | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `RESEND_API_KEY`            | Enables transactional + admin emails                         |
| `ADMIN_EMAIL`               | Destination for Admin Worker monthly + security emails       |
| `PUBLIC_BASE_URL`           | Base URL the post-publish probe + verifiers fetch from       |
| `WORKER_ID`                 | Stable id for this worker process (auto-generated)           |
| `ADMIN_WORKER_SKIP_NETWORK` | Test-only: dispatcher skips real fetch + read calls when `1` |

---

## Admin UI

`/admin` renders a card grid grouped into four sections:

**Admin Worker (autonomous system):**

| Card               | Route                           | Purpose                                                                                          |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Command Center     | `/admin/admin-worker`           | Mission + chosen action + ranked alternatives + content-growth funnel + Why-No-Growth + controls |
| System diagnostics | `/admin/diagnostics`            | Subsystem ratings (incl. automatic-repair status), pause toggle, Developer Audit PDF             |
| Worker Reasoning   | `/admin/admin-worker/reasoning` | Full "why" chain for any content item (candidate → … → publish), drawn from the reasoning graph  |
| Pipeline map       | `/admin/admin-worker/pipeline`  | Per-stage queue snapshot across the 22-stage chain                                               |
| Package artifacts  | `/admin/admin-worker/artifacts` | Every built artifact + its strict-QA result; per-artifact detail view                            |
| Admin Worker logs  | `/admin/admin-worker/logs`      | 16-category log viewer with period + severity filters                                            |
| Admin Worker rules | `/admin/admin-worker/rules`     | Versioned rule catalogue                                                                         |

**Checklist (read-only management surfaces):**

The legacy build/publish admin actions (`worker-run`, per-item
`publish`, `bulk/build-all`, `bulk/run-autonomous`) return `410 Gone`
— content is created only by the Admin Worker pipeline. The remaining
checklist pages are read-only views of the data the worker populates.

| Card                | Route                              | Purpose                           |
| ------------------- | ---------------------------------- | --------------------------------- |
| Checklist dashboard | `/admin/checklist`                 | Counts by status + type           |
| Build queue         | `/admin/checklist/queue`           | `WorkerBuildJob` state (legacy)   |
| QA reports          | `/admin/checklist/qa`              | Unreviewed reports                |
| Published content   | `/admin/checklist/published`       | Items live on the public site     |
| Approved sources    | `/admin/checklist/sources`         | Authority registry                |
| Janitor: edits      | `/admin/checklist/janitor/edits`   | Items the worker wants to rebuild |
| Janitor: deletes    | `/admin/checklist/janitor/deletes` | Items the worker wants to remove  |
| Failed builds       | `/admin/checklist/failed`          | Exhausted retry budgets           |

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
(Command Center) and `/admin/diagnostics` (per-subsystem ratings +
pause toggle). It is the **only** system that creates public content
(see [Single content path](#single-content-path-no-legacy)).

### What it does

- **Ranks the next safest action.** `brain.ts` samples world state on
  every pass (content goals, source reputation, pending + failed build
  jobs, homepage score, security events, heartbeat age, candidate
  URLs, open repair plans, blocked pipeline stages, growth snapshots,
  source coverage) and _scores every candidate action_. The output is
  a `BrainDecision` with the chosen action **plus a ranked list of
  rejected alternatives**, confidence, risk, urgency, source score,
  quality expectation, repair likelihood, fallback action, stop
  condition, the rules evaluated, and the memory + reputation rows
  that influenced the decision. It also learns from real outcomes:
  `sampleExecutionFeedback` reads last-7-day **pass rates** from the
  durable tables (strict-QA, ContentQualityScore, post-publish, repair
  plans) and `applyExecutionFeedback` demotes stages with poor pass
  rates and boosts winners. Action fatigue penalises paths that have
  just failed; a recently-advanced bonus rewards paths that just moved
  a stage forward; fallback + content-type rotation kick in when a
  type/source is repeatedly blocked. Every decision is written to
  `AdminWorkerDecision` (including memory + reputation used) so the
  operator can audit _"why this and not that?"_ without re-running.

- **Executes 22 mission stages.** `dispatcher.ts` runs the chosen
  action against the real pipeline — _no "logged intent" stubs_ (a
  test statically scans every handler and fails if one only logs). The
  22 stages span DISCOVERY → CANDIDATE_PRIORITIZATION → SOURCE_FETCH
  → SOURCE_READ → CLASSIFICATION → EXTRACTION → CHECKLIST_CREATION →
  CITATION_CREATION → PACKAGE_BUILD → CROSS_SOURCE_VERIFICATION →
  STRICT_QA → PERSISTENCE → PUBLIC_PUBLISH → POST_PUBLISH_VERIFY →
  SEARCH_VERIFY → SITEMAP_VERIFY → CACHE_REFRESH → REPAIR →
  HOMEPAGE_WORK → REPORTING → SECURITY_DEFENSE → MAINTENANCE. SOURCE_FETCH
  actually calls `adminWorkerFetch`; SOURCE_READ actually calls
  `readSource`; POST_PUBLISH_VERIFY actually hits the public route
  (no `skipNetwork: true` in the production path). Every stage returns
  a uniform result — stage name, action taken, input/output entity,
  advanced/rejected/repaired counts, blocker, next stage, logs created.

- **Discovers approved Catholic sources.** `discovery-orchestrator.ts`
  runs seven discovery methods end-to-end with per-content-type
  strategies and cadence: **configured fixed URL lists**, **sitemap**,
  **RSS / Atom**, **approved Catholic content directories**, **internal
  links**, **approved-source search pages**, and **official source
  APIs**. Discovery prioritises content types below goal and slows
  down for types at goal. Junk URLs (livestreams, donations, bulletins,
  store pages, event listings, staff pages, schools, login pages,
  generic news, unrelated blog posts) are rejected before fetch.
  Every method writes which sources were scanned, which were skipped
  (with reason), which candidates were found, rejected, and prioritised.

- **Scores every candidate.** `candidate-scorer.ts` rates each
  discovered URL across seven dimensions (host authority, content-type
  signal, freshness, depth, duplicate risk, past success at this host,
  goal-pull). Scores live on `CandidateSourceUrl`; outcomes adjust
  scores so the chain doesn't keep re-fetching losers.

- **Fetches with policy.** `fetcher.ts` enforces approved-host
  allow-list before request, sets timeout + backoff, computes the
  body checksum, and rejects login pages / binary content / size
  blowups _without writing to source reads_. Every fetch writes an
  `AdminWorkerFetchResult` with status, host, checksum, and rejection
  reason.

- **Reads pages into structured source blocks.**
  `structured-source-reader.ts` parses real HTML into
  `AdminWorkerSourceBlock` rows: page title, canonical URL, headings,
  paragraphs, lists, tables, prayer blocks, novena day sections,
  scripture references, location blocks, metadata. Navigation,
  footers, ads, cookie banners, donation prompts, newsletter prompts,
  related-article rails, social-share widgets, event widgets, and
  livestream embeds are stripped with explicit `rejected` markers.
  Extractors consume structured blocks first, raw text only as
  fallback.

- **Classifies content with confusion detection.** `classifier.ts`
  (extended `classifyDetailed`) decides whether a source page is a
  prayer / saint / apparition / devotion / novena / rosary /
  consecration / sacrament / liturgy / history / parish — or rejects
  it as WRONG / UNUSABLE — using URL patterns, title regex, headings,
  body regex, required-term presence, negative-signal patterns, and
  source reputation. `confusion-detector.ts` then runs eleven explicit
  confusion rules (saint-named schools/hospitals/parishes, prayer
  livestreams, novena articles without days, devotion without
  instructions, sacrament schedule pages, Mass schedule pages, Church
  news, parish bulletins, …) and _flips a misleading classification
  to UNUSABLE_ before extraction runs.

- **Builds complete package artifacts with provenance.**
  `content-builder.ts` and eleven specialised extractors emit a
  `AdminWorkerPackageArtifact` per page with normalised title +
  slug, display fields, body sections, dropdown sections, required
  fields, optional fields, missing fields, field provenance,
  validation needs, formatting metadata, duplicate keys, rejection
  reasons, repair suggestions, and confidence by field and by package.
  Required fields without provenance cannot be published — except
  deterministic internal rules (Rosary 5-mystery decade structure,
  seven sacraments list, novena 9-day requirement, content-type
  mapping).

- **Fetches validation sources, doesn't just name them.**
  `validation-source-resolver.ts` maps `(contentType, field)` to a
  ranked list of higher-authority hosts. `validation-fetcher.ts`
  then _actually fetches the validation pages_ through
  `adminWorkerFetch` + `readSource` + structured extraction and
  compares the extracted field values to the package artifact —
  returning `MATCH` / `MISMATCH` / `MISSING_EVIDENCE` per host with
  per-field probe paths. `verifier.ts` enforces the sensitive-field
  whitelist (saint feast day + identity, Marian apparition approval,
  novena day count, rosary mystery structure, sacrament identity,
  Church history date/era, scripture reference + translation policy):
  empty validation source fields are _not_ silently accepted —
  publishing is blocked until evidence exists or the conflict is
  resolved by a higher-authority source. Conflicts that survive
  resolver fallback route to rare human review. Verification runs
  **before** publish.

- **Runs strict QA as an artifact-level stage.** `strict-qa.ts`
  scores each package across seven dimensions (completeness,
  correctness, formatting, provenance, validation, duplicate safety,
  public readiness) and writes a durable `AdminWorkerStrictQAResult`
  row with the final status, blocking reasons, and repair
  suggestions. The Publish Orchestrator requires `PASSED` —
  any-zero gate + per-content-type threshold.

- **Scores quality across ten dimensions before publish.** `quality.ts`
  `computeFinalScoreV2` rates completeness, correctness, formatting,
  field provenance, validation evidence, duplicate safety, route
  readiness, search readiness, sitemap readiness, and doctrinal
  sensitivity. Stricter thresholds apply to sacraments, Church
  history, Marian apparition approval, scripture references, and
  doctrine-related content. Packages below threshold are repaired
  before rejection; packages still below threshold do not publish.

- **Publishes through one orchestrator path.** `publish-orchestrator.ts`
  is the only normal publish path. It requires a complete artifact,
  verifier sign-off for doctrinal types, strict-QA `PASSED`, a unique
  slug, and the per-type confidence threshold. It is idempotent (no
  duplicate public rows) and updates `PublishedContent`, content
  goals, the pipeline stage, Admin Worker memory, source reputation,
  search index, sitemap, cache, and diagnostics in one go.

- **Verifies the public page** after every publish: HTTP-fetches the
  public URL, checks title + body markers + tab placement + search
  visibility + sitemap inclusion + cache freshness + content-goal
  count. `search-sitemap-cache-verifiers.ts` runs **independent**
  search, sitemap, and cache checks — not just the post-publish
  probe — so a green probe can't hide a missing-from-search bug.

- **Rolls back via an explicit decision tree.**
  `post-publish-rollback.ts` walks: (1) attempt repair (cache /
  sitemap / search refresh), (2) if repair fails, unpublish,
  (3) if the failure is severe + clear (public_route or body_marker
  without a recoverable hint), mark for **logged deletion**,
  (4) otherwise file rare human review. Every rollback writes one
  structured `AdminWorkerLog` row with content type, slug, failed
  check, reason, repair attempted, rollback action, and
  human-review status.

- **Repairs failed pipeline stages with real handlers.**
  `repair-orchestrator.ts` executes per-kind handlers (cache failure
  → `flagCacheRefresh`, sitemap failure → regenerate, search failure
  → rebuild, discovery failure → re-run orchestrator, fetch backoff,
  source pause, stuck queue, missing source jobs, persistence
  failures, public render failures, etc.) — _not just logging
  intent_. **Durable repair plans** (`AdminWorkerRepairPlan`)
  survive process restarts and retry with exponential backoff
  (1 min → 1 h cap); plans abandon after maxAttempts. Failed repair
  updates memory + reputation so the brain rotates away from
  fail-prone paths.

- **Learns operationally with decay.** `memory.ts` writes outcome
  counts + Laplace-smoothed confidence per (memoryType, memoryKey)
  with **30-day half-life decay** so recent outcomes outweigh stale
  ones. Active hooks: `rankHostsByMemory`, `recordExtractorOutcome`,
  `rememberFailurePattern`. EWMA-smoothed
  `AdminWorkerSourceReputation` updates after **every one of the ten
  pipeline stages** — discovery, fetch, source-read, classification,
  extraction, validation, strict QA, quality score, publish, and
  post-publish (`source-reputation-hooks.ts`; a static test asserts a
  reputation push exists for each stage). Good sources promoted
  automatically; bad sources paused. Action fatigue rotates the brain
  to fallback paths when one content type or source is repeatedly
  blocked.

- **Maintains the homepage.**
  `homepage-publish-orchestrator.ts` runs a 10-axis homepage
  inspection (featured links work, no unpublished content featured,
  no section accidentally empty, mobile layout valid, accessibility
  checks pass, seasonal content appropriate, …) with snapshot,
  mutate, verify, and rollback. Small high-confidence changes
  auto-publish; major redesigns route to human review; section
  deletion always routes to review. The Command Center has a
  **Request Homepage Makeover** button that triggers an on-demand
  task.

- **Defends the admin site without harassing the admin.** The
  defender runs at three layers: (1) the security defender pipeline
  (`security-defender.ts` + ten deterministic detectors —
  unauthenticated direct access, normal login redirect, failed
  admin login, valid admin login, valid session navigation, expired
  session, brute force, mutation bypass, content route manipulation,
  banned-device reuse), (2) the admin gate
  (`src/lib/security/admin-gate.ts`) which fires
  `defendUnauthorizedMutation` on every unauthorised
  POST/PUT/PATCH/DELETE to a protected admin route — GET is not
  rate-limited as a mutation, so admins redirected once to login are
  not banned, and (3) the `requireAdminWithDefender` helper for routes
  that don't use the gate. Confirmed brute force results in an
  automatic device ban (`BannedDevice` row + Admin Worker Banned
  Device email). A valid authenticated admin login is never treated
  as suspicious — the admin gets a calm **Admin Log In** email with
  date, time, device, browser, OS, IP, city, region, country, and
  session status.

- **Explains why content is or isn't growing.**
  `why-no-growth.ts` walks the chain top-to-bottom on every Command
  Center render — returning the _first blocked stage_, the exact
  table + count, the most recent failure, the next automatic repair,
  the last brain decision, and the next planned decision. The
  Why-No-Growth panel appears on the Command Center and is included
  in every Developer Audit PDF.

- **Creates Developer Audit PDFs** for the last 24 hours / 7 days /
  30 days. All declared sections are actually rendered: table of
  contents, executive summary, brain decisions + ranked alternatives,
  mission plans, pipeline stage history, content goal progress,
  content growth funnel, source coverage, discovery / fetch /
  source-read / structured-block / classification / extraction /
  package-artifact / checklist+citation / validation / strict-QA /
  quality-score / publishing / post-publish / search / sitemap /
  cache / repair / security / homepage logs, memory +
  source-reputation changes, why-no-growth, current blockers,
  recommended repairs. All secrets redacted; useful debugging
  fields visible.

- **Sends a monthly PDF report** to `ADMIN_EMAIL` on the last calendar
  day of each month. Daily sections + monthly summary (total content
  growth, best / weakest content type growth, best / worst sources, QA
  pass rate, publish rate, worker uptime, security events, homepage
  improvements, remaining blockers).

- **Tracks source coverage per content type.**
  `source-coverage.ts` scores primary + validation + enrichment
  sources, recent successful sources, recent failed sources, and a
  rolling coverage score per content type. Content types with weak
  coverage are flagged `blockedByCoverage`; the brain expands within
  the approved source registry only — quality thresholds never drop
  to compensate for missing coverage.

- **Escalates stalled growth.** `growth-orchestrator.ts` classifies
  every content type into one of seven status buckets (AT_GOAL /
  GROWING_OK / SLOW_24H / STUCK_7D / REJECT_HEAVY / PARTIAL_HEAVY /
  NEW). After 7 days stuck below target, the worker auto-files a
  repair plan.

- **Tracks the full growth funnel.** `content-growth-monitor.ts`
  (`computeContentFunnel`) computes a per-content-type funnel from the
  durable tables — candidates discovered → prioritized → fetched →
  source reads → structured blocks → package artifacts → checklist
  items → citations → validation → strict QA → quality score →
  published → post-publish, plus public/search/sitemap visibility and
  the first **bottleneck** stage (first funnel stage that dropped to
  zero). Surfaced on the Command Center and in the Developer Audit.

- **Reports production readiness.** `readiness.ts` runs live checks
  (heartbeat, brain has run, content goals exist, source discovery
  configured, candidate URLs available, source reads exist, pipeline
  stages tracked, growth orchestrator active, source coverage scored,
  cross-source verifier wired, post-publish verification works,
  **legacy publish path disabled**, and **every recent public row
  traces to a package artifact** — the last two fail if any content
  could become public through an old path). Every failed check returns
  a concrete repair instruction. The Command Center surfaces the
  readiness score and failing checks.

### Single content path (no legacy)

The Admin Worker artifact pipeline is the **only** way content becomes
public. The pre-Admin-Worker build/publish engine is hard-disabled:

- `src/lib/worker/publishing/index.ts` `publish()` — the only writer
  that ever wrote public rows outside the pipeline — throws unless
  `ALLOW_LEGACY_PUBLISH=1` (a supervised one-off migration escape
  hatch, off in production).
- `runOneBuildCycle` (the legacy build entry point that
  `runWorkerLoop` / `runFullAutonomousCycle` / `bulkBuildAll` funnel
  through) throws under the same guard.
- The legacy build/publish admin routes (`checklist/worker-run`,
  `checklist/[id]/publish`, `bulk/build-all`, `bulk/run-autonomous`)
  return `410 Gone` (`src/lib/worker/legacy-disabled.ts`).
- The dispatcher no longer imports `@/lib/worker`; with no
  `BUILD_READY` / `QA_PASSED` artifact, PACKAGE_BUILD and
  PUBLIC_PUBLISH return idle rather than falling back to a legacy
  build.
- Production readiness **fails** if `ALLOW_LEGACY_PUBLISH` is set, or
  if any row published in the last 7 days has no linked
  `AdminWorkerPackageArtifact`.

`tests/admin-worker/legacy-system-disabled.test.ts` proves `publish()`
and `runOneBuildCycle` throw when disabled, PACKAGE_BUILD never runs a
legacy build, readiness fails when the flag is set, and the legacy
routes return `410`.

### Internal modules

`src/lib/admin-worker/` ships every module of the autonomous pipeline.

| File                                     | Module                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| **`brain.ts`**                           | Ranked-action brain + action fatigue + execution feedback |
| **`dispatcher.ts`**                      | 22-stage mission dispatcher (real execution, no stubs)    |
| `mission-planner.ts`                     | Chain-aware mission planner                               |
| `loop.ts`                                | Central decision loop + mode dispatch                     |
| `passes.ts`                              | Pass lifecycle                                            |
| `tasks.ts`                               | Task management                                           |
| `state.ts`                               | Singleton state + pause/resume                            |
| `modes.ts`                               | Mode descriptors                                          |
| `priorities.ts`                          | Priority ladder + selector                                |
| `decisions.ts`                           | Decision log + confidence thresholds                      |
| `planner.ts`                             | Build-job enqueuer (within mission)                       |
| **`discovery-orchestrator.ts`**          | 7 discovery methods + per-type strategies + cadence       |
| `web-navigator.ts`                       | Candidate URL store + junk classifier                     |
| `sitemap-discovery.ts`                   | Sitemap discovery + robots.txt                            |
| `rss-discovery.ts`                       | RSS / Atom feed discovery                                 |
| `configured-urls.ts`                     | Configured fixed URL list discovery                       |
| `internal-link-discovery.ts`             | Internal-link discovery                                   |
| `directory-discovery.ts`                 | Catholic content directory discovery                      |
| `search-page-discovery.ts`               | Approved-source search-page discovery                     |
| `source-apis.ts`                         | Official source API adapter registry                      |
| **`candidate-scorer.ts`**                | 7-dimension candidate scoring + outcome adjustment        |
| **`fetcher.ts`**                         | Approved-host fetch + checksum + login/binary rejection   |
| `source-reads.ts`                        | Source-read dedupe via sha256 checksum                    |
| `source-reader.ts`                       | Orchestrator: classify + extract + read                   |
| **`structured-source-reader.ts`**        | HTML parser → AdminWorkerSourceBlock rows                 |
| **`confusion-detector.ts`**              | 11 confusion rules (flip to UNUSABLE before extract)      |
| `classifier.ts`                          | Deterministic content classifier + `classifyDetailed`     |
| `extractors.ts`                          | Per-type extractors + field provenance                    |
| **`content-builder.ts`**                 | Builds complete package artifacts (all required fields)   |
| `provenance.ts`                          | Field-level provenance tracker                            |
| **`checklist-citation-orchestrator.ts`** | Artifact → ChecklistItem + ChecklistCitation bridge       |
| `cross-source-verifier.ts`               | Field verification + ValidationEvidence                   |
| **`validation-source-resolver.ts`**      | Field → ranked validation hosts + conflict fallback       |
| **`validation-fetcher.ts`**              | Actually fetches + reads + compares validation pages      |
| **`verifier.ts`**                        | Sensitive-field whitelist + pre-publish verifier gate     |
| `packaging.ts`                           | Per-content-type structural validators                    |
| **`strict-qa.ts`**                       | Artifact-level strict QA (7 sub-scores + gate)            |
| `quality.ts`                             | 10-dim quality scoring (`computeFinalScoreV2`)            |
| **`publish-orchestrator.ts`**            | The only publish path; idempotent; updates all stores     |
| `publisher.ts`                           | Publish-gate evaluator used by the orchestrator           |
| `publish-safety.ts`                      | Pattern blockers (incomplete prayers, …)                  |
| `post-publish-probe.ts`                  | Live HTTP probe                                           |
| **`search-sitemap-cache-verifiers.ts`**  | Independent search + sitemap + cache verification         |
| `post-publish.ts`                        | Aggregation + decision                                    |
| **`post-publish-rollback.ts`**           | REPAIR → UNPUBLISH → DELETED → HUMAN_REVIEW decision tree |
| `homepage-designer.ts`                   | Homepage scoring + draft decision                         |
| `homepage-mutator.ts`                    | Builds proposed homepage snapshots                        |
| **`homepage-publish-orchestrator.ts`**   | 10-axis inspect + snapshot + verify + rollback            |
| `liturgical-calendar.ts`                 | Meeus-based liturgical calendar engine                    |
| `security-defender.ts`                   | Defender + automatic ban + email                          |
| `security-detectors.ts`                  | 10 deterministic detector functions                       |
| **`request-defender.ts`**                | 7 helpers (failed login, brute force, mutation, …)        |
| **`admin-route-guard.ts`**               | `requireAdminWithDefender` for non-gate routes            |
| `pipeline-stages.ts`                     | Pipeline-stage chain + `resumeOrAdvance` checksum skip    |
| `repair.ts`                              | In-pass repair handlers                                   |
| **`repair-orchestrator.ts`**             | Real per-kind repair execution (not just logging)         |
| `repair-plans.ts`                        | Durable repair-plan queue + exponential backoff           |
| `learning.ts`                            | Feedback loop (success/failure counts)                    |
| `memory.ts`                              | Memory hooks + **30-day half-life decay**                 |
| `source-reputation.ts`                   | EWMA-smoothed reputation engine                           |
| **`source-reputation-hooks.ts`**         | Per-stage `pushReputation` (discovery → post-publish)     |
| `source-strategy.ts`                     | 10-criteria source ranking                                |
| **`source-coverage.ts`**                 | Primary/validation/enrichment coverage per content type   |
| `content-goals.ts`                       | Per-content-type minimum/desired                          |
| `content-growth.ts`                      | 24 h / 7 d growth-escalation watcher                      |
| **`growth-orchestrator.ts`**             | 7 growth-status classes + auto-file repair plans          |
| **`content-growth-monitor.ts`**          | Per-content-type funnel (candidates → cache) + bottleneck |
| `cleanup.ts`                             | Cleanup custodian                                         |
| `human-review.ts`                        | Rare-edge-case review queue                               |
| `deletion.ts`                            | Confidence-gated deletion + 9 reasons                     |
| `health.ts`                              | Worker health monitor                                     |
| `metrics.ts`                             | Command Center metric computation                         |
| `diagnostics.ts`                         | Subsystem ratings + diagnostics auditor                   |
| **`why-no-growth.ts`**                   | Live chain walk → first blocker + next automatic repair   |
| `readiness.ts`                           | Production-readiness 12-check sweep                       |
| `rules.ts`                               | Versioned rules across categories                         |
| `logs.ts`                                | Structured AdminWorkerLog writer                          |
| `report-generator.ts`                    | Developer Audit data collection (24 sections)             |
| `pdf.ts`                                 | PDF rendering for both reports                            |
| `monthly-report-job.ts`                  | Last-day-of-month gate + run                              |
| `public-routes.ts`                       | Public URL builder + cache tag mapping                    |

### Pause + override

The human admin is the site's super-admin. They can pause the Admin
Worker at any time via the toggle on `/admin/diagnostics`. Pausing
stops all non-security work — the security defender keeps running so
the site is never unprotected. When paused, the Admin Worker writes a
single "Admin Worker is paused (reason)" log entry per pass and skips
the rest of the loop. Resume the worker via the same toggle.

### Operator actions

The Command Center exposes one-click actions for every named pass:

- **Run diagnostic pass** — refreshes subsystem ratings + writes diagnostic snapshots
- **Run content goal pass** — recomputes gaps + refreshes content goals
- **Run source discovery pass** — runs the discovery orchestrator
- **Run homepage pass** — invokes the homepage publish orchestrator
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
- `REPAIR` — fix pipeline failures (runs `repair-orchestrator.ts`)
- `HOMEPAGE` — improve the homepage
- `DIAGNOSTICS` — audit the system
- `SECURITY_DEFENSE` — protect the site
- `REPORTING` — generate scheduled reports
- `PAUSED` — non-security tasks paused

Mode selection is driven by the ranked-action brain, not a fixed
ladder — the brain re-scores every cycle.

---

## Worker entry point

```bash
tsx scripts/run-worker.ts                # loop forever
tsx scripts/run-worker.ts --one-shot     # one pass then exit
tsx scripts/run-worker.ts --max-jobs N   # exit after N passes
tsx scripts/run-worker.ts --worker-id X  # stable worker id
```

`run-worker.ts` drives `runAdminWorkerLoop` — each pass runs the
ranked-action brain then the mission dispatcher (the legacy
build-queue engine is removed). It is safe to run with multiple
replicas; per-stage work is idempotent and durable. The monthly Admin
Worker Report fires once per worker startup when `isLastDayOfMonth(today)`
is true, so a restart on the last day of the month still sends the
email.

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

### Admin Worker proof gate

```bash
npm run admin-worker:proof                    # full gate: prisma validate + typecheck + lint
                                              #   + unit/integration/full-pipeline tests
                                              #   + no-legacy + no-placeholder tests
                                              #   + offline brain dry run + content-growth proof
npm run admin-worker:proof:content            # one content item through all 16 pipeline stages
npm run admin-worker:proof:all-content-types  # one full pipeline proof per content type (real extractor)
npm run admin-worker:proof:security           # 5 defender flows (login email, threshold, ban, mutation, reuse)
npm run admin-worker:proof:reports            # Developer Audit generates + required sections + secret redaction
npm run admin-worker:proof:live               # back-half proof against a REAL DB: extract → publish a prayer
npm run admin-worker:proof:autonomy           # FULL autonomous loop vs REAL DB + REAL HTTP (local mirror)
npm run worker:dry-run                        # offline brain action-ranking across synthetic worlds
```

`admin-worker:proof:autonomy` is the strongest end-to-end proof: it serves
content-complete fixtures from a local HTTP server (a mirror of approved
content, since the CI sandbox blocks outbound fetches), seeds candidate
URLs, and runs the **real worker loop** — the brain ranks actions each
pass and the dispatcher really fetches over HTTP, reads the page into
structured blocks, classifies, extracts the package artifact, creates
checklist + citations, runs strict QA, scores quality, and publishes
through the orchestrator. It confirms the worker autonomously publishes PRAYER + DEVOTION and — via
a real fetch-and-compare against an INDEPENDENT validation mirror — the
doctrinally-sensitive SAINT (name + patronage + birthplace + lived dates

- feast day + background), with the feast day cross-source verified before
  publishing. It uses the `ADMIN_WORKER_DEV_SOURCE_HOSTS` +
  `ADMIN_WORKER_DEV_VALIDATION_HOSTS` hooks (non-production only) to allow
  the local mirrors; every QA / quality / content-contract / cross-source
  gate still applies. Sensitive content with no reachable validation source
  correctly holds in NEEDS_REPAIR (a `VALIDATION_EVIDENCE_MISSING` plan is
  filed) rather than publishing unverified.

The proof tests live in `tests/admin-worker/proof/` and drive the real
extractors / strict-QA / quality scorer / publish orchestrator (so they
prove content correctness: a prayer yields title + actual prayer text, a
saint yields name + feast day + patronage + biography, a novena yields
exactly nine days, junk content fails). `admin-worker:proof:live`
publishes a real `PublishedContent` row to the configured database and
prints the resulting reasoning chain.

The unit + component suite covers:

- **Admin Worker engine** — ranked-action brain + execution feedback,
  22-stage dispatcher (real pipeline + skip-network variant), mission
  planner, classifier + `classifyDetailed`, 11 extractors, content
  builder + per-content-type chain proof (99 tests across 11 content
  types × 9 stages), confusion detector, structured source reader,
  fetcher (host allow-list, login/binary rejection, checksum),
  candidate scorer, discovery orchestrator (all 7 methods), validation
  source resolver + validation fetcher, verifier (sensitive-field
  whitelist), strict-QA artifact + gate, 10-dim quality scoring,
  publish orchestrator, independent search/sitemap/cache verifiers,
  post-publish rollback decision tree, repair orchestrator (real
  per-kind handlers), memory decay (30-day half-life), per-stage
  source-reputation hooks, growth orchestrator, source coverage,
  homepage publish orchestrator (snapshot + verify + rollback),
  pipeline resume by checksum, why-no-growth chain walk, developer
  audit data + sections, packaging, publish safety, post-publish
  probe, homepage designer + mutator, liturgical calendar.
- **Security** — defender + 10 detectors + auto-ban + emails, request-
  path defender, admin-route guard (defender fires on POST/PUT/PATCH/
  DELETE only — never on GET), brute-force ban tests, "valid admin is
  not harassed" tests.
- **End-to-end chain proof** — full per-content-type tests proving
  Discovery → Score → Fetch → Read → Structured Blocks → Classify →
  Extract → Artifact → Checklist + Citation → Verification → Strict
  QA → Quality → Publish Orchestrator → Post-publish → Search →
  Sitemap → Cache.
- **Acceptance criteria** — tests proving validation sources are
  actually fetched and compared, `runPublishOrchestrator()` is the
  normal publish path, post-publish verification performs live
  checks, Developer Audit includes all required sections.
- **Single-content-path guards** — no legacy system can create,
  publish, or mutate public content (`legacy-system-disabled.test.ts`);
  no dispatcher handler only logs without doing work
  (`dispatcher-no-placeholder-stages.test.ts`); every stage returns
  the full §3.4 result shape (`dispatcher-outcome-shape.test.ts`);
  source reputation updates after all ten stages
  (`source-reputation-stage-coverage.test.ts`); content funnel +
  bottleneck (`content-growth-monitor.test.ts`).
- **Worker (checklist + publish gate)** — build engine, publish-gate
  evaluator, QA approval, source validation, diagnostics, janitor,
  cross-source, duplicate detection, schema compliance, knowledge
  base, relations, Catholic accuracy (legacy build/publish exercised
  behind the `ALLOW_LEGACY_PUBLISH` escape hatch).
- **App-wide** — API, auth, security, components, data, email,
  observability, i18n, cache test suites.

Total: **1803 passing tests across 220 test files**.

---

## Security

Four-tier security model:

1. **Middleware** — every request goes through `src/middleware.ts`,
   which sets the device-credential cookie, enforces CSP / HSTS /
   referrer-policy, and gates `/admin/*` on session presence.
2. **Banned-device guard** — `src/lib/security/banned-guard.ts`
   blocks every request from a `BannedDevice` row before any page
   renders.
3. **Admin gate (request-path defender)** —
   `src/lib/security/admin-gate.ts` is the unified entry point for
   admin API routes. On unauthorized POST/PUT/PATCH/DELETE, the gate
   fires `defendUnauthorizedMutation` so an `AdminWorkerSecurityAction`
   row is recorded alongside the `SecurityEvent`. GET is never
   defender-flagged, so admins redirected once to login are not
   banned. Routes that don't use the gate can call
   `requireAdminWithDefender` for the same protection.
4. **Admin Worker security defender** — `security-defender.ts`
   consumes `SecurityEvent` rows. On a confirmed Breach
   (classification=Breach + confidence ≥ 0.9 + known device
   fingerprint) it upserts a `BannedDevice` row and sends the Admin
   Worker Banned Device email. Suspicious activity never results in
   an automatic ban.

Admin login flow:

- Successful login → `recordAdminLoginSuccess` →
  `defendValidAdminNavigation` → SecurityEvent + AdminActionLog +
  Admin Log In email (timestamp, device, location).
- Failed login → `defendFailedAdminLogin`. 3+ failed logins in window
  → Suspicious Activity email (no ban). 5+ failed logins OR confirmed
  brute force → `defendConfirmedBruteForce` → Security Breach email
  - signed ban link the admin can click.
- The defender layers on top: classification=Breach + high confidence
  auto-bans without waiting for the admin to click the signed link.

A valid authenticated admin browsing the admin console never triggers
a suspicious-activity email — `recordAdminLoginSuccess` marks the
device known so subsequent navigation reads as expected activity.

---

## Migration history

| Migration                                          | What it added                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `0001` – `0022`                                    | Original schema (auth, content, ingestion, …)                                              |
| `0023_checklist_first_architecture`                | Checklist-first models (ChecklistItem, …)                                                  |
| `0024_admin_worker`                                | Admin Worker engine tables (15 + enums)                                                    |
| `0025_drop_legacy_system`                          | Dropped 30+ legacy tables, consolidated UserSaved\* into UserSavedContent                  |
| `0026_admin_worker_brain`                          | Brain tables: SourceRead, PipelineStage, RepairPlan                                        |
| `0027_admin_worker_brain_ranking`                  | Brain ranked alternatives + AdminWorkerFetchResult / SourceBlock / CrossSourceVerification |
| `0028_admin_worker_pipeline_and_orchestrators`     | Pipeline durability + candidate scoring fields + SourceCoverage + GrowthSnapshot           |
| `0029_admin_worker_package_artifact`               | AdminWorkerPackageArtifact (built package as a first-class artifact)                       |
| `0030_admin_worker_strict_qa`                      | AdminWorkerStrictQAResult (durable strict-QA per artifact)                                 |
| `0031_admin_worker_repair_kinds_strict_qa_quality` | Added STRICT_QA_FAILED + QUALITY_SCORE_FAILED repair kinds                                 |
| `0032_admin_worker_source_coverage_active_counts`  | SourceCoverage: active / recently-successful / recently-failed source counts               |

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
