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
by itself: it ranks the next safest action, discovers Catholic sources
across eight discovery methods (including open keyword web-search), fetches
and reads pages into structured source blocks, classifies content with
confusion detection,
builds complete package artifacts, fetches validation pages from
higher-authority hosts to verify sensitive facts, runs strict QA as a
durable artifact-level stage, scores quality across ten dimensions,
publishes through a single Publish Orchestrator path, independently
verifies search + sitemap + cache, repairs failed stages with real
handlers (not just logging), rolls back via an explicit decision tree
(repair → unpublish → log-deletion → human review), defends the admin
surface (without harassing the valid admin), and emails a monthly
operations report.

The Admin Worker is driven by a **permanent Python intelligence brain**
([`intelligence/`](intelligence/)) — a deterministic, pure-stdlib core (no
AI APIs, no network) that TypeScript holds open as an always-on service and
consults on every meaningful decision: **final action selection**, planning +
**mission control**, semantic memory + hybrid retrieval, duplicate detection,
source intelligence with a **Catholic authority graph** + **communion-risk**
screening, **claim-level verification**, quality + **specialist-panel** review,
action **simulation**, **confidence calibration**, knowledge-graph and
schema/UI awareness, a whole-app **self-model**, repair + **stuckness**
analysis, learning, and self-inspection (233 operations).
The split is **TypeScript = the body** (execution, Prisma/DB, queues,
policy, publishing, safety, app + admin integration), **Python = the brain**
(it analyses and recommends through strict typed contracts; it never touches
the database or the network), and **Postgres = the long-term store**
(content, vectors, knowledge graph, audit trail, semantic memory). The
worker learns from every run, and the **end of every developer report lists
the upgrades the worker believes it needs** to get smarter and more capable.
See [Intelligence brain (Python)](#intelligence-brain-python).

---

## Architecture

The **Admin Worker artifact pipeline** is the only path from a source
page to a public page (see [Single content path](#single-content-path)).
There is no other build/publish engine: the pre-Admin-Worker
build/QA/publish engine has been **deleted outright** — no fallback, no
escape hatch, no backwards compatibility. What remains under
`src/lib/checklist/` is purely the **checklist-first content foundation**
(the master checklists, curated knowledge, content schemas, the authority
source registry, the janitor, seeding, the build-intent queue, and the
checklist lifecycle CRUD). The Admin Worker pipeline builds from that
foundation: it populates `ChecklistItem` + `ChecklistCitation` from
package artifacts and publishes to `PublishedContent` through the Publish
Orchestrator.

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

### Body, brain, store

The Admin Worker is split into three layers:

```
   TypeScript = the BODY            Python = the BRAIN          Postgres = the STORE
   (src/lib/admin-worker/)          (intelligence/)             (Prisma models)
   execution, Prisma writes,   ───► semantic memory, dup    ───► long-term memory,
   queues, policy, publishing,      detection, source intel,     vector store,
   safety, app + admin glue         quality, relationships,      knowledge graph,
                              ◄───   repair, self-inspection ◄─── audit trail
                                     (deterministic, stdlib)
```

- **Python decides; TypeScript enforces.** Each pass, TypeScript generates
  and sub-scores the candidate actions, then the Python brain **selects the
  final action** from them (`select_action`). TypeScript validates that
  choice with Zod against the strict decision contract + a safety gate, and
  **may reject an unsafe choice**; it then executes, persists, verifies,
  publishes, rolls back, defends, reports, and enforces every
  policy/publish/security gate. Python reasons, scores, ranks, and learns —
  it **never touches the database or the network** and never executes.
- **Safe degraded mode, never a TypeScript final brain.** The brain runs
  as a permanent `python3 -m intelligence` process (`INTELLIGENCE_BRAIN_ENABLED`,
  default on). If Python is unavailable, returns an invalid shape, or picks
  an action that fails safety validation, the worker enters **safe degraded
  mode** (`PYTHON_BRAIN_UNAVAILABLE`): security defense, diagnostics,
  reporting, maintenance, and repair only — **never autonomous content
  publishing**, and **never** a fallback to an older TypeScript
  final-decision path.

See [Intelligence brain (Python)](#intelligence-brain-python) for the full
design.

---

## Data model

**Checklist + published content** (`src/lib/checklist/`):

| Model               | Role                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChecklistItem`     | One row per concrete item (populated from package artifacts)                                                                                    |
| `AuthoritySource`   | Global approved-source registry (Holy See & dicasteries, bishops' conferences, Eastern Churches, orders, universities, dioceses, reference DBs) |
| `ChecklistCitation` | One citation per (item, URL) with authority level                                                                                               |
| `WorkerBuildJob`    | Build-intent signal the Admin Worker reads (enqueued on approve)                                                                                |
| `PublishedContent`  | The only table the public site reads from                                                                                                       |

The prior engine's tables (`WorkerBuildLog`, `ChecklistQAReport`,
`ChecklistVersion`, `ChecklistRelation`) were **dropped** (migration
`0041`); the Admin Worker records strict QA in `AdminWorkerStrictQAResult`
and activity in `AdminWorkerLog`, and the dashboard, diagnostics, audit,
readiness, and growth surfaces all read those live tables.

**Admin Worker engine** (`src/lib/admin-worker/`):

| Model                                | Role                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `AdminWorkerState`                   | Singleton: current mode, priority, pause toggle                                                      |
| `AdminWorkerPass`                    | One row per decide-then-act cycle of the loop                                                        |
| `AdminWorkerTask`                    | Planned action; produces one or more log rows                                                        |
| `AdminWorkerLog`                     | Structured engine log (16 categories)                                                                |
| `AdminWorkerDecision`                | Brain decision: chosen action + ranked alternatives + reason                                         |
| `AdminWorkerActionScore`             | One row per ranked action (every action, not only the chosen) — incl. `fallbackAction`               |
| `AdminWorkerReasoningGraph`          | Directed "why" graph edges connecting every pipeline entity                                          |
| `AdminWorkerStageOutcome`            | Exact per-stage outcome ledger (result, duration, confidence, repair) — the brain's precise feedback |
| `AdminWorkerRollbackLedger`          | Durable, restorable-aware record of every post-publish rollback                                      |
| `AdminWorkerMemory`                  | Outcome counts + confidence — no invented facts, 30-day decay                                        |
| `AdminWorkerSourceReputation`        | EWMA + time-decayed per-(host, contentType) reputation tier                                          |
| `AdminWorkerSecurityAction`          | Defender actions taken in response to security events                                                |
| `AdminWorkerSourceRead`              | Durable extracted text per (sourceUrl, checksum)                                                     |
| `AdminWorkerSourceBlock`             | Structured HTML blocks (heading, paragraph, list, …)                                                 |
| `AdminWorkerFetchResult`             | Every fetch: status, checksum, host, rejection reason                                                |
| `AdminWorkerPackageArtifact`         | Built content package (provenance + missing fields)                                                  |
| `AdminWorkerStrictQAResult`          | Per-artifact strict QA: 7 sub-scores + blocking reasons                                              |
| `AdminWorkerCrossSourceVerification` | Per-field validation evidence with conflict status                                                   |
| `AdminWorkerSourceCoverage`          | Per-type primary/validation/enrichment + active/recent counts                                        |
| `AdminWorkerGrowthSnapshot`          | Per-content-type 24h/7d growth status                                                                |
| `AdminWorkerPipelineStage`           | One row per item moving through the 22-stage chain                                                   |
| `AdminWorkerRepairPlan`              | Durable repair plans with exponential-backoff retry                                                  |
| `CandidateSourceUrl`                 | URLs the discovery orchestrator has found (with scoring)                                             |
| `ContentGoal`                        | Per-content-type minimum + desired targets                                                           |
| `HumanReviewQueue`                   | Rare items needing human review                                                                      |
| `HomepageWorkerDraft`                | Proposed homepage edits with before/after snapshots                                                  |
| `AdminDeveloperReportLog`            | Audit trail of every Developer Audit PDF generated                                                   |
| `PostPublishVerification`            | Public-page load + cache + sitemap + search check                                                    |
| `ContentQualityScore`                | Full per-package quality model — 10 dimensions + threshold + pass/fail + failed-dimension list       |
| `HomepageQualityScore`               | Deterministic homepage score (8 dimensions)                                                          |

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
`EmailVerificationToken`. (The heartbeat-unification transition is complete:
worker liveness is read solely from `AdminWorkerState.lastHeartbeatAt`; the
legacy `WorkerHeartbeat` dual-write and its diagnostics rating were removed.)

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

# Publish the in-repo curated knowledge base through the real publish pipeline
# (grows content across every type even with no outbound network). Idempotent.
npm run seed:content

# Run the public site (port 3000)
npm run dev

# Run the Admin Worker in another terminal
npm run worker

# Refresh today's daily readings (the worker also does this on a schedule)
npm run readings:refresh

# Exercise the Python intelligence brain (needs python3 on PATH)
npm run brain:selftest
npm run brain:test
```

The intelligence brain needs `python3` (3.11+, stdlib only — no pip
installs). When it isn't present the worker still runs and uses its
deterministic fallbacks.

Required environment variables (production):

| Variable         | Purpose                            |
| ---------------- | ---------------------------------- |
| `DATABASE_URL`   | Postgres connection string         |
| `SESSION_SECRET` | 32+ char iron-session secret       |
| `ADMIN_USERNAME` | Admin console username             |
| `ADMIN_PASSWORD` | Admin console password (12+ chars) |

Optional environment variables:

| Variable                                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`                                    | Enables transactional + admin emails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ADMIN_EMAIL`                                       | Destination for Admin Worker monthly + security emails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PUBLIC_BASE_URL`                                   | Base URL the post-publish probe + verifiers fetch from                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `WORKER_ID`                                         | Stable id for this worker process (auto-generated)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ADMIN_WORKER_SKIP_NETWORK`                         | Test-only: dispatcher skips real fetch + read calls when `1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ADMIN_WORKER_DISABLE_LIVE_PROBE`                   | Local/dry-run only: skip the mandatory production live sitemap + cache probe when `1` (verification is otherwise live + fail-closed in production)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ADMIN_WORKER_OPEN_INTERNET`                        | Lets the worker fetch sources beyond the registry (any diocese, conference, EWTN, database, accurate site) and follow links across the open web. Accuracy is still enforced by cross-source verification + strict QA; local/social/commerce hosts stay blocked. On by default; set `0`/`false`/`off` to restrict to the registry                                                                                                                                                                                                                                                                                                                                   |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID` | OPTIONAL higher-volume/quality upgrade for open keyword web-search discovery (Google Programmable Search). Web search is keyless by default (DuckDuckGo); set these to use Google instead. The worker queries per content type to find sources nothing it knows links to                                                                                                                                                                                                                                                                                                                                                                                           |
| `BING_SEARCH_API_KEY`                               | OPTIONAL alternative keyed search provider (Bing Web Search). Web search is keyless by default; this is only a quality/volume upgrade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ADMIN_WORKER_KEYLESS_WEB_SEARCH`                   | Keyless open web search via DuckDuckGo — on by default, no API key. Lets the worker discover sources nothing it already links to (feeds parishes + every content gap). Results still pass the full pipeline (host filter → classify → cross-source verify → strict QA). Set `0`/`false`/`off` to disable; forced off by `ADMIN_WORKER_SKIP_NETWORK=1`                                                                                                                                                                                                                                                                                                              |
| `INTELLIGENCE_BRAIN_ENABLED`                        | Python intelligence brain on/off (default on; `0` disables)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `INTELLIGENCE_PYTHON`                               | Python executable for the brain (default `python3`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `INTELLIGENCE_TIMEOUT_MS`                           | Per brain-call timeout (default `8000`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `GOOGLE_PLACES_API_KEY`                             | Enables Google Maps parish discovery (Places API). Unset → the `discover_parishes_via_maps` skill is a no-op                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PARISH_DISCOVERY_LOCATIONS`                        | Optional `;`-separated localities to search for parishes (e.g. `Boston, MA; Rome, Italy`). Unset → seeds derive from the cities already in the catalog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ADMIN_WORKER_OSM_PARISHES`                         | Keyless OpenStreetMap (Overpass) parish discovery — on by default; the fallback used when `GOOGLE_PLACES_API_KEY` is unset. Set `0`/`false`/`off` to disable. Same communion + schema + publish gates as the Maps flow                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ADMIN_WORKER_ALWAYS_ON_DISCOVERY`                  | Always-on web scanning — on by default. Runs the full discovery orchestrator (all 8 methods, incl. open-web keyword search + cross-host crawl) on **every** pass (throttled), not only when the brain picks the DISCOVERY stage, so the worker is constantly finding new sources and the fetch/extract pipeline never starves for candidates. Set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                     |
| `ADMIN_WORKER_DISCOVERY_SWEEP_MS`                   | Throttle interval (ms) for the always-on discovery sweep (default `300000` = 5 min)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ADMIN_WORKER_LITURGICAL_API`                       | Keyless Liturgical Calendar ingest (the open Liturgical Calendar API → General Roman Calendar feasts of the Lord + solemnities) — on by default; set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ADMIN_WORKER_ARCHIVE_FALLBACK`                     | Keyless Internet Archive (Wayback Machine) fetch fallback — when a live fetch 404s, errors, or hits a login wall, the worker serves the most recent archived snapshot of that exact URL instead of parking the artifact in repair (`finalUrl` honestly shows web.archive.org). On by default; set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                                                                     |
| `ADMIN_WORKER_DYNAMIC_FETCHER`                      | Keyless dynamic (JS-rendering) fetcher — when a fetched page is a JavaScript-only shell with no usable text, the worker re-renders it in a headless Chromium so client-rendered sources flow through the normal pipeline. No API key (the worker image ships Chromium). On by default; fully fail-open (no-op where no browser is available); set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                     |
| `ADMIN_WORKER_CHROMIUM_PATH`                        | Optional explicit path to the Chromium binary for the dynamic fetcher. Unset → the worker resolves `PLAYWRIGHT_BROWSERS_PATH` or Playwright's bundled browser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ADMIN_WORKER_DYNAMIC_FETCHER_TIMEOUT_MS`           | Navigation timeout (ms) for the dynamic fetcher (default `15000`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ADMIN_WORKER_DISCOVERY_SEEDER`                     | Keyless structured discovery seeder — queries Wikidata for apparitions / novenas / prayers & litanies (the types whose verbatim or approval-status content needs an approved source, not an abstract) and enqueues their authoritative source URLs (official websites, reference URLs) for the live extraction pipeline, so the content types with no structured ingestor still get fed authoritative sources. Devotions, Marian titles, and spiritual practices now have their own keyless ingestors and are no longer seeded here. Discovery only (every candidate still passes extraction + verification + QA). On by default; set `0`/`false`/`off` to disable |
| `LITURGICAL_CALENDAR_API_URL`                       | Override the Liturgical Calendar API endpoint (default: the public litcal General Roman Calendar, US adaptation). Any endpoint returning the litcal `{ litcal: [...] }` shape works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `GOOGLE_TRANSLATE_API_KEY`                          | OPTIONAL higher-quality (keyed) Google Translate for the prayer/litany Latin/Greek the curated corpus can't resolve. Translation is keyless by default; this is only a quality upgrade                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ADMIN_WORKER_KEYLESS_TRANSLATE`                    | Keyless Latin/Greek machine translation via the free Google translate endpoint — on by default, no API key. Translates the EXACT stored prayer text word-for-word for prayers/litanies with no authentic received form; output is flagged `source:"machine"` (auditable, never mistaken for received text). Set `0`/`false`/`off` to disable; forced off by `ADMIN_WORKER_SKIP_NETWORK=1`                                                                                                                                                                                                                                                                          |
| `TRANSLATION_AI_API_URL` / `_API_KEY` / `_MODEL`    | Optional OpenAI-compatible AI translation provider (preferred over Google for the liturgical register). Reuses the `EXTRACTION_AI_*` provider when unset (and vice-versa), so one AI key powers both translation and extraction                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `TRANSLATION_AUTOPUBLISH_MACHINE`                   | Machine-translation drafts **auto-publish by default** so every prayer and litany ends up with both Latin and Greek (the authentic corpus is always tried first; machine fills carry `machineTranslated` provenance for later curation). Set `0`/`false`/`off` to instead route machine drafts to human review before they go live                                                                                                                                                                                                                                                                                                                                 |
| `EXTRACTION_AI_API_URL` / `_API_KEY` / `_MODEL`     | Optional OpenAI-compatible AI provider for content extraction + single-source verification. Removes the publish ceiling: when the deterministic extractors leave required fields missing, the AI fills ONLY what the page text supports (never invents); and when a top-authority source's independent cross-checks are merely unreachable (not disagreeing), the AI confirms the sensitive values against that source's own text so the artifact can verify. Falls back to the `TRANSLATION_AI_*` config when unset. No-op when neither is set; accuracy is still enforced by the content schema, cross-source verification, and strict QA                        |
| `ADMIN_WORKER_REQUIRE_HUMAN_REVIEW`                 | **Off by default — the worker is fully independent and never parks work for a human.** Every situation that would otherwise need review gets the worker's own terminal decision: publish when the evidence clears the bar, otherwise SKIP (never publish unverified, never delete on uncertainty) and revisit autonomously. The human-review UI still exists (a human _may_ act), but the worker never depends on it, so the queue never blocks growth. Set `1`/`true`/`on` to restore human-gated review (uncertain items are queued for a person)                                                                                                                |

---

## Admin UI

`/admin` renders a card grid grouped into four sections:

**Admin Worker (autonomous system):**

| Card                | Route                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command Center      | `/admin/admin-worker`           | Organised into labelled sections — worker-health banner (accurate brain/heartbeat/publishing state), at-a-glance metrics, mission & control, content & coverage (catalogue + **daily-readings calendar coverage** + growth funnel + Why-No-Growth + **Worker capabilities** — which outward capabilities are enabled vs. need an env/network to grow), pipeline & diagnostics, quality & safety, and brain & learning |
| System diagnostics  | `/admin/diagnostics`            | Subsystem ratings (incl. automatic-repair status), pause toggle, Developer Audit PDF                                                                                                                                                                                                                                                                                                                                  |
| Worker Reasoning    | `/admin/admin-worker/reasoning` | Full "why" chain for any content item (candidate → … → publish), drawn from the reasoning graph                                                                                                                                                                                                                                                                                                                       |
| Pipeline map        | `/admin/admin-worker/pipeline`  | Per-stage queue snapshot across the 22-stage chain                                                                                                                                                                                                                                                                                                                                                                    |
| Package artifacts   | `/admin/admin-worker/artifacts` | Every built artifact + its strict-QA result; per-artifact detail view                                                                                                                                                                                                                                                                                                                                                 |
| Admin Worker logs   | `/admin/admin-worker/logs`      | 16-category log viewer with period + severity filters                                                                                                                                                                                                                                                                                                                                                                 |
| Admin Worker rules  | `/admin/admin-worker/rules`     | Versioned rule catalogue                                                                                                                                                                                                                                                                                                                                                                                              |
| Worker Intelligence | `/admin/intelligence`           | Live capability dashboard: brain status, self-model, capability strengths/weaknesses, memory, source reliability, decisions, self-explanations, stuckness, upgrades                                                                                                                                                                                                                                                   |
| Intelligence Lab    | `/admin/intelligence/lab`       | Intelligence Laboratory surfaces: highest-leverage change, causal/root-cause, hypotheses, experiments, proof packets, strategy tournaments, benchmarks + brain versions, capability proposals, adversarial weaknesses, architecture integrity                                                                                                                                                                         |

The public **daily readings** page lives at `/liturgy/readings?date=…` (the
homepage + liturgical calendar link to it), and the worker owns it end to end.
A deterministic **liturgical-calendar engine**
(`content-shared/liturgical-calendar.ts`, mirrored in the Python brain)
computes the exact day of the **General Roman Calendar** for any date in any
year — season, Sunday cycle (A/B/C), weekday cycle (I/II), colour, moveable
feasts, and the principal fixed-date solemnities (a Proper-of-Saints overlay) —
and a **lectionary** (`content-shared/lectionary.ts`) maps each day to its Mass
readings, with the Scripture text from the public-domain **Douay-Rheims**. The
worker **stores readings ahead of time**: `backfillDailyReadings` fills a
rolling ~year-ahead window into `DailyReading`, re-verifies it on every scan,
**self-corrects any drift, and never downgrades a verified day** — so once the
window is filled the worker only keeps it current and cycles it forward. The
page also resolves any day **on-demand**, so the whole calendar is viewable
immediately. Coverage grows through a pluggable **readings-source framework**
(`readings-source.ts`): the offline table first, then any authoritative dataset
configured via `LECTIONARY_DATA_URL`, which the worker fetches, validates,
ingests, and manages itself — no code change. Days without verified readings
show the liturgical framing + a link to the official source; a reading is never
fabricated. Today the table covers the principal solemnities and feasts; the
rest fills automatically as a dataset is configured or the table is expanded.

The Command Center's **Daily readings** card tracks this coverage live
(`dailyReadingsCoverage`): how many days are framed, how many carry verified
text vs are on the official link, today's status, the covered date range, and
the verified-text coverage of the next 30 / 90 days. There is **no target
count** — the goal is simply to cover the whole liturgical calendar — so the
card reports the span the worker has reached rather than a quota.

**Checklist (management surfaces):**

Content is created only by the Admin Worker pipeline. The checklist pages
are read-only views of the data the worker populates, plus bulk
**source-curation** actions (verify sources, reject) — building, QA, and
publishing are handled autonomously by the Admin Worker.

| Card                | Route                              | Purpose                                                                      |
| ------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| Checklist dashboard | `/admin/checklist`                 | Counts by status + type (each type links to its filtered published view)     |
| Build queue         | `/admin/checklist/queue`           | `WorkerBuildJob` (build-intent)                                              |
| QA reports          | `/admin/checklist/qa`              | Unreviewed reports                                                           |
| Published content   | `/admin/checklist/published`       | Items live on the public site, filterable by content type (`?contentType=…`) |
| Approved sources    | `/admin/checklist/sources`         | Authority registry                                                           |
| Janitor: edits      | `/admin/checklist/janitor/edits`   | Items the worker wants to rebuild                                            |
| Janitor: deletes    | `/admin/checklist/janitor/deletes` | Items the worker wants to remove                                             |
| Failed builds       | `/admin/checklist/failed`          | Exhausted retry budgets                                                      |

**Site surfaces:**

| Card             | Route                               | Purpose                                          |
| ---------------- | ----------------------------------- | ------------------------------------------------ |
| Homepage editor  | `/admin/homepage`                   | Public homepage mirror                           |
| Makeover preview | `/admin/homepage/preview/[draftId]` | Editable full-screen preview of a makeover draft |
| Search index     | `/admin/search`                     | Search                                           |
| Media library    | `/admin/media`                      | Image assets                                     |

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
(see [Single content path](#single-content-path)).

### Brain as the FINAL decision brain

The Python intelligence brain is the **final action selector**; the
TypeScript worker is the **safety-enforcing executor**. The brain thinks,
scores, ranks, compares, detects, learns, diagnoses, and recommends — it
never publishes, deletes, bans, mutates users, or bypasses any gate.
TypeScript enforces truth, provenance, strict QA, the full quality score,
publishing rules, rollback, security, and database integrity.

Each pass runs: (1) TS samples world state + generates and sub-scores the
candidate actions; (2) TS sends the candidates + world + memory + source
reputation + exact stage outcomes + action history to the Python brain;
(3) the brain ranks every candidate and **selects the final action**
(`select_action`, returning a strict decision contract); (4) TS validates
the choice against the schema + the safety gate (the action must be an
allowed, safe candidate); (5) TS executes it; (6) TS writes the exact
stage outcome; (7) TS feeds the result back to the brain for learning.

There is **no legacy TypeScript final brain** and **no backwards
compatibility**. The deterministic ranker now only _generates_ candidates;
`final-brain.ts` (`pythonFinalSelector`) routes the final choice through
the Python brain. If the brain is unavailable, returns an invalid shape,
or picks a disallowed/unsafe action, TS rejects it (logged for the
Developer Audit) and enters **safe degraded mode**
(`PYTHON_BRAIN_UNAVAILABLE`) — security defense, diagnostics, reporting,
and repair only, **never autonomous content publishing** — rather than
falling back to a TypeScript final brain. Concretely:

- **The Python brain makes the final selection.** `select_action` ranks
  the candidate set with exact stage outcomes, recency-weighted action
  fatigue, source fatigue + reputation, content-type rotation (so one
  blocked type can't stall the site), and the content-type intelligence
  profiles (doctrinal caution). The strict `BrainFinalDecisionSchema` is
  validated before execution; the chosen action's provenance
  (`finalBrain: "python"` / `"degraded"`) is recorded on every pass. The
  Command Center's worker-health banner derives its **current** state from this
  latest-pass provenance plus the worker heartbeat — so a single transient
  rejection in the last 24h shows only as an informational footnote, never as a
  false "offline / not publishing" alarm, and the loud safe-degraded warning
  appears only when the latest pass actually degraded (or the worker process is
  not running).
  `intelligence/tests/test_select_action.py` proves the brain ranks every
  candidate and that **learning changes the ranking** (a low exact
  stage-success rate + action fatigue flips the selection; a BLOCKED source
  deprioritises its candidate).
- **The brain is the only quality + decision authority that's surfaced.**
  The command center shows a "Final decision brain: Python" banner (and a
  loud `PYTHON_BRAIN_UNAVAILABLE` safe-degraded-mode warning when the brain
  is down / actions are rejected); the Developer Audit has a **Python Brain
  Diagnostics** section (availability, ok/failed calls, `select_action`
  count, latency, confidence, safe-to-auto-execute rate, learning events,
  strategy memory, degraded events, op mix). There is no reduced quality
  scorer — `recordQualityScore` (the full ten-dimension model, all
  dimensions required) is the only quality path.
- **Every considered action is stored, not just the chosen one.**
  `AdminWorkerActionScore` records each ranked action with action type,
  mission stage, target content type / source / candidate, expected
  result, final / confidence / risk / quality / source / repair scores,
  the **fallback action**, the rejected reason, and the selected flag — so
  the worker can explain what it chose, why it rejected alternatives, and
  what nearly won.
- **Exact stage feedback.** Every dispatcher result writes one precise
  `AdminWorkerStageOutcome` (stage, action, entity, result, result type,
  failure reason, downstream stage, duration, confidence-before, actual
  outcome, repair-created, next action). `summarizeStageReliability`
  aggregates real per-stage success/failure so the brain scores from
  exact outcomes instead of guessed attribution.
- **Every listed brain op is wired + recorded.** The worker calls the
  Python brain for action ranking, candidate prioritization, semantic
  duplicate detection, source comparison, quality review, missing-field
  detection, relationship inference, source assessment, failure
  classification, repair strategy, self-inspection, developer-request
  generation, graph analysis, schema / UI / code awareness, and
  learning-from-outcomes — each recorded to `AdminWorkerBrainCall`
  (visible in IQ diagnostics). The brain reasons, scores, ranks, and selects
  the final action; it never publishes, deletes, bans, mutates users, or
  bypasses a gate — TypeScript executes and enforces every gate.
- **Immediate, per-stage repair.** The repair orchestrator runs the
  concrete recovery now whenever the data is present — re-extract from the
  stored source read, re-classify and advance, retry persistence when the
  DB is healthy, re-verify cache / sitemap / search / validation — and
  defers only when recovery needs an external fetch or an unhealthy DB. A
  successful repair advances the item; a failed one updates memory +
  source reputation and is classified by the brain.
- **Extractor-strategy learning.** Each extraction records a per-(host,
  contentType) `BUILDER_PRIORITY` outcome (confidence + missing fields +
  fatal) and recalls prior extractor confidence, so later passes prefer
  hosts that reliably yield complete packages.
- **Full quality model, stored and enforced.** `ContentQualityScore`
  stores all ten dimensions (completeness, correctness, formatting,
  source authority, field provenance, validation evidence, duplicate
  safety, public rendering, doctrinal sensitivity, package consistency)
  plus the threshold, the pass/fail verdict, and the **failed-dimension
  list**. Publishing uses the full stored score; the dashboard and
  Developer Audit show exactly which dimension failed.
- **Generated sitemap is actually inspected — fail closed in production.**
  `sitemap-inspect.ts` builds the expected URL, assembles the generated
  sitemap's URL set (real generator ∪ authoritative published-row mapping),
  and confirms the public URL is present. In production it FAILS CLOSED: if
  the generated output can't be inspected, or the live `/sitemap.xml` can't
  be probed, or the URL is missing from the live sitemap, verification fails
  → files a sitemap repair → re-verifies. The "row qualifies for inclusion"
  fallback is allowed only in local test / documented dry-run mode.
- **Cache freshness is proven against the public route — fail closed in
  production.** A content checksum is stamped on
  `PublishedContent.contentChecksum` at publish time; cache verification
  confirms the marker matches the live row and, in production, fetches the
  public route to confirm the latest title/checksum is served. In production
  an unreachable route or stale content FAILS (→ repair → re-verify); the
  checksum + recent-revalidation-log fallback is local test / dry-run only.
- **Rollback guarantees.** Every post-publish rollback writes an
  `AdminWorkerRollbackLedger` row (previous public state, failed reason,
  action, related artifact/repair, human-review, result, restorable).
  DELETED is the only non-restorable terminal state. Surfaced in
  diagnostics + the Developer Audit.
- **Content-type intelligence profiles.** `content-type-profiles.ts` is
  the single source of truth per content type for required / validation
  fields, forbidden patterns, doctrinal sensitivity, source-authority +
  cross-source-validation requirements, QA + quality thresholds,
  extraction strategy, public route, and publishing / repair / rollback /
  human-review rules.
- **Brain IQ diagnostics.** `/admin/intelligence` shows brain
  availability + protocol, ok/failed call counts, average latency,
  average + safe-to-auto-execute confidence, learning events, and
  strategy-memory size, drawn from the `AdminWorkerBrainCall` ledger.
- **No placeholders.** `npm run admin-worker:no-placeholders` fails the
  build if production worker code contains unresolved implementation
  language (TODO, "not implemented", "placeholder stage", "intent only",
  "log only", "phase 2", "future pass", "stub", …); the readiness check
  also fails if a publish path bypasses strict QA or the quality score.
- **Live dry run.** `npm run admin-worker:proof:dry-run` runs the full
  chain (extract → package → strict QA → full quality score → publish
  decision) and **explains whether it would publish (and why not)
  without writing any public row**.

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
  runs eight discovery methods end-to-end with per-content-type
  strategies and cadence: **configured fixed URL lists**, **sitemap**,
  **RSS / Atom**, **approved Catholic content directories**, **internal
  links**, **approved-source search pages**, **official source APIs**,
  and **open keyword web-search** (`search-discovery.ts`) so the worker can
  find sources that nothing it already knows links to ("search the whole
  internet for X"). Web search is **keyless by default** — it queries
  **DuckDuckGo** with no API key (parsing the HTML SERP and following each
  result through the full pipeline); `GOOGLE_SEARCH_API_KEY` +
  `GOOGLE_SEARCH_ENGINE_ID` (or `BING_SEARCH_API_KEY`) are an optional
  higher-volume/quality upgrade, not a requirement. Per-content-type query
  templates target each gap, and for parishes the worker searches **city by
  city** (seeded from `PARISH_DISCOVERY_LOCATIONS`) the way a person would.
  With `ADMIN_WORKER_OPEN_INTERNET` on, internal-link
  discovery follows links **across hosts** so the worker spiders out from a
  known Catholic page into the wider web; the search seed and the cross-host
  crawl together let it reach genuinely new sites, databases, and online
  libraries across any TLD. Discovery prioritises content types below goal
  and slows down for types at goal. Junk URLs (livestreams, donations,
  bulletins, store pages, event listings, staff pages, schools, login pages,
  generic news, unrelated blog posts) are rejected before fetch. Every
  search result and link is still an **unverified candidate** that must pass
  classification → cross-source verification → strict QA before it can
  publish — search widens reach, never the accuracy bar. Every method writes
  which sources were scanned, which were skipped (with reason), which
  candidates were found, rejected, and prioritised.

- **Scans the web constantly (always-on discovery).** The orchestrator above
  used to run only when the brain picked the DISCOVERY stage. An always-on sweep
  ([`always-on-discovery.ts`](src/lib/admin-worker/always-on-discovery.ts), wired
  into the loop, on by default, ~5-min throttle) now runs the **full** discovery
  orchestrator on **every** pass against the largest-gap content type, so the
  worker is continuously finding new sources across all 8 methods and the
  fetch/extract pipeline never starves for candidates. Throttled + fail-open;
  surfaced URLs remain unverified leads that still face the whole pipeline
  before anything publishes. Tunables: `ADMIN_WORKER_ALWAYS_ON_DISCOVERY`,
  `ADMIN_WORKER_DISCOVERY_SWEEP_MS`.

  The trusted registry (`checklist/sources/authority-registry.ts`,
  `AUTHORITY_SOURCES`) spans the **global** Catholic source ecosystem — the
  Holy See and Roman Curia dicasteries, national & continental **bishops'
  conferences** (USCCB, CCCB, CBCEW, CELAM, CCEE, FABC, SECAM, …), **Eastern
  Catholic Churches**, major **(arch)dioceses**, **religious orders**, **Catholic
  universities**, and reputable **reference databases** (Catholic Culture, CNA,
  Aleteia, Papal Encyclicals Online, …). The whole Holy See **`.va`** TLD is
  approved by pattern, so the worker can follow links to any dicastery domain.
  By default the worker fetches only registry hosts; with
  **`ADMIN_WORKER_OPEN_INTERNET`** enabled it may reach **across the whole web**
  to any conference of bishops, diocese, EWTN, Catholic database, or lesser-known
  but accurate source (`isFetchableHost`) — local / social / commerce hosts stay
  blocked, and **accuracy is enforced downstream by cross-source verification +
  strict QA, not by the allow-list**, so opening the fetch list never lowers the
  bar. `classifyHostAuthority` lets it **judge the quality of any lesser-known
  source it encounters** — diocesan / order / university domains are recognised by
  pattern and weighed accordingly in cross-source verification, while the
  reputation system (below) vets each source's reliability over time.

- **Ingests structured knowledge directly — keyless, deterministic, no ceiling.**
  The biggest deterministic lever is not "read messy HTML" but "ingest structured
  knowledge." The structured-knowledge engine
  ([`structured/`](src/lib/admin-worker/structured)) queries **Wikidata** (free,
  CC0, citable) and pulls **Wikipedia** lead-abstracts for narrative fields, maps
  each entity to a schema-valid record, and publishes the not-yet-live ones
  through the **same real gate** as everything else — no API key, no model, no
  hallucination surface. It is **self-advancing** (a per-ingestor cursor in
  `AdminWorkerMemory` walks the whole corpus across passes and wraps to re-sweep),
  **self-improving** (the same row accumulates a success/failure learning signal),
  and **self-expanding** (each ingested entity's official website is added to the
  worker's own discovery queue, so it learns new places to pull from), and it
  selects the ingestor whose content type is **furthest from its goal** so it
  works where the headroom is. Adding a content type is "add an ingestor to the
  registry" — currently **POPE** (the line of Roman Pontiffs), **SAINT**
  (canonization status + feast day, the largest goal), **CHURCH_DOCUMENT**
  (encyclicals, exhortations, … — whose canonical Vatican text URL also feeds
  self-expansion, and whose records carry a **verbatim, cited opening excerpt**
  pulled from the canonical document text itself —
  [`document-excerpt.ts`](src/lib/admin-worker/structured/document-excerpt.ts),
  zero fabrication surface) — and the **ecumenical councils** (Nicaea → Vatican II)
  as `council_document` records that fill the Church-history timeline with the
  great councils, keeping each council's historically certain inception year (a
  Jan-1 placeholder only when the source records mere year precision, never a
  fabricated exact day), **DOCTOR** (Doctors of the Church), **RITE** (the
  recognized rites + the Eastern Catholic Churches sui iuris), and the
  **descriptive types** — **DEVOTION**, **MARIAN_TITLE**, and **SPIRITUAL_PRACTICE**
  — which resolve their narrative from **multiple sources, cross-referenced**: the
  entity's **own official source first** (read verbatim with the document
  extractor) and the **Wikipedia abstract only as a last resort**, citing every
  source so each record is cross-checkable (a non-Catholic "practice" with no
  recognized kind is never published). Accuracy stays
  paramount: a mapper returns nothing on any incomplete row, doctrinally-sensitive
  facts (a saint's feast day) must be **corroborated in an independent source's
  own statement** — the article's prose **or its parsed infobox**
  ([`wikipedia-infobox.ts`](src/lib/admin-worker/structured/wikipedia-infobox.ts),
  a deterministic wikitext parser that also enriches records with cited
  patronage, birth/death, and canonization fields) — before they publish,
  sensitive types must clear the stricter 0.95
  doctrinal publish bar, a name-normalized dedup keeps a structured record from
  ever duplicating a curated page under a different slug, and every record still
  passes the strict schema + publish gate. The types whose **required content is
  verbatim or doctrinally-sensitive text** — an **apparition's** official approval
  status, a **novena's** nine-day prayer text, a **prayer's** verbatim body — are
  **not** abstract-ingested: the structured **discovery seeder**
  ([`discovery-seeder.ts`](src/lib/admin-worker/structured/discovery-seeder.ts))
  instead enumerates them from Wikidata and feeds their **authoritative source
  URLs** to the live extraction + cross-source-verification pipeline, so they grow
  from approved sources rather than an encyclopedia.

- **AI-assisted extraction + single-source verification removes the publish
  ceiling.** The deterministic extractors only fill fields a regex can pin down,
  so most messy open-web pages stall with "missing fields" and never publish —
  the published count tracks only what the curated corpus already carries. With
  **`EXTRACTION_AI_API_URL`/`_API_KEY`** set (it reuses the `TRANSLATION_AI_*`
  config when a dedicated key isn't given), an OpenAI-compatible provider reads
  the fetched page text and fills **only** the missing fields, strictly from what
  the text states — it is instructed never to invent, guess, or use outside
  knowledge, and AI-filled fields carry `AI_EXTRACTION` provenance in the audit
  trail ([`extraction-provider.ts`](src/lib/admin-worker/extraction-provider.ts)).
  A second assist closes the verification ceiling: when an artifact's **own
  source is a top Catholic authority** (the Holy See, an episcopal conference)
  and its independent cross-check sources are merely **unreachable** (a Vatican
  page 404s, a login wall) rather than **disagreeing**, the AI confirms the
  sensitive values are explicitly stated in that source's text and records `PASS`
  evidence — the same single-authoritative-source basis the hand-curated content
  already verifies on. Both are **gated, no-ops by default, and conservative**:
  they never override a real `MISMATCH`, and AI widens only what the worker can
  _extract_ — the content schema, cross-source verification, and strict QA still
  decide what publishes, so accuracy is never lowered.

- **Finds parishes on Google Maps — and verifies communion with Rome.**
  When `GOOGLE_PLACES_API_KEY` is set, `discover_parishes_via_maps`
  ([`parish-places.ts`](src/lib/admin-worker/parish-places.ts) +
  [`parish-discovery-runner.ts`](src/lib/admin-worker/parish-discovery-runner.ts))
  text-searches the Places API for Catholic churches in a locality (from
  `PARISH_DISCOVERY_LOCATIONS` or, absent that, the cities/states already in the
  catalog). Maps lists "Catholic" churches that are **not** in communion with
  Rome, so every candidate is run through a **communion-with-Rome verifier**
  ([`communion-verifier.ts`](src/lib/admin-worker/communion-verifier.ts)) that
  reads the parish's own website: disqualifying signals (Old Catholic / Union of
  Utrecht, Polish National Catholic, sedevacantist, independent/national
  "Catholic" bodies, women's ordination, Orthodox/Anglican identity) → **rejected,
  never published**; a clear Roman signal ("Roman Catholic", an explicit communion
  statement, USCCB / Holy See, a named Catholic diocese) → published through the
  real orchestrator; anything ambiguous, or canonically irregular (SSPX), → human
  review. ("Catholic" alone is never enough — Old Catholics call themselves
  Catholic too.) A no-op when no key is configured. On the public site every
  parish / shrine / cathedral / basilica card and detail page shows the address
  as a tappable link (`MapsAddressLink`) that opens turn-by-turn directions in
  **Apple Maps on iPhone/iPad** and **Google Maps** everywhere else, using the
  record's exact coordinates when present so the pin lands on the right building.

- **Finds parishes keyless via OpenStreetMap — versatility without an API key.**
  When no `GOOGLE_PLACES_API_KEY` is configured, parish discovery falls back to
  the free, public **OpenStreetMap Overpass API**
  ([`parish-osm.ts`](src/lib/admin-worker/parish-osm.ts)): it queries churches
  tagged `amenity=place_of_worship` + `religion=christian` +
  `denomination=roman_catholic` in a locality and feeds the candidates through the
  **same** gates as the Maps flow — communion verification against the parish
  website (a site that proves not-in-communion is rejected; an entry with no
  website is trusted on the explicit `roman_catholic` tag, which already excludes
  Old Catholic / sedevacantist / Orthodox), the strict parish schema, and the real
  publish orchestrator. It is self-throttled for Overpass fair-use and on by
  default (`ADMIN_WORKER_OSM_PARISHES=0` opts out). Two independent parish
  sources — keyed Maps and keyless OSM — so the worker always has a way to grow
  the directory.

- **Rescues dead and walled pages from the Internet Archive — keyless.** The
  live pipeline's most common stalls are pages that 404 after a site
  reorganisation or moved behind a login wall. When a fetch fails that way, the
  fetcher ([`archive-fallback.ts`](src/lib/admin-worker/archive-fallback.ts))
  asks the free Wayback Machine availability API for the most recent snapshot of
  that exact URL and serves the archived body instead — same document, same
  authoritative host, served verbatim by the archive, with `finalUrl` honestly
  set to web.archive.org for the provenance trail. The content still faces
  extraction, cross-source verification, and strict QA like any live page. On by
  default (`ADMIN_WORKER_ARCHIVE_FALLBACK=0` opts out), fail-open, a no-op
  offline.

- **Renders JavaScript-only pages in a headless browser — keyless.** Many
  authoritative Catholic sources render their text client-side, so the static
  HTML is an empty shell (`<div id="root"></div>` + a script bundle) with no
  usable prose. The fetcher now detects that case and re-renders the page in a
  headless Chromium ([`dynamic-fetcher.ts`](src/lib/admin-worker/dynamic-fetcher.ts)),
  returning the post-JavaScript HTML so JS-rendered sources flow through the
  normal pipeline (read → classify → extract → verify → publish) instead of
  being abandoned. **No API key** — only a Chromium binary, which the worker
  image ships (see `Dockerfile.worker`). Fully fail-open: where no browser is
  available it degrades to a no-op and the worker uses the static body exactly
  as before, so it can never block a deploy. On by default
  (`ADMIN_WORKER_DYNAMIC_FETCHER=0` opts out; `ADMIN_WORKER_CHROMIUM_PATH`
  points at a browser in a non-standard location). This is the worker's
  former #1 self-requested capability — it no longer files a "dynamic fetcher
  needed" developer request because the capability now ships in-process.

- **Reads PDFs from the web.** The runtime has a dependency-free PDF text
  extractor ([`pdf-extract.ts`](src/lib/admin-worker/pdf-extract.ts)) built on
  Node's `zlib`: the PDF skills fetch a document (a bounded, host-allowlisted GET,
  since the normal fetcher rejects binary) and pull its text out of the content
  streams — covering the digitally-generated text PDFs the Holy See and USCCB
  publish, for more data across every content type. Scanned or encrypted PDFs that
  yield no usable text fall back to a specific OCR developer request rather than
  feeding the pipeline noise.

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
  `computeFinalScore` rates completeness, correctness, formatting,
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
  deletion always routes to review.
  - **Request Homepage Makeover (preview → edit → publish/discard).**
    The Command Center has a **Request Homepage Makeover** button.
    Running it always files an `AWAITING_REVIEW`
    `HomepageWorkerDraft` (a proposed set of `featured-*` rails built
    from currently published content). While a reviewable draft
    exists, three actions appear just below the completion message —
    **Preview** (grey), **Discard** (red), **Publish** (green) — and
    disappear once the draft is resolved. **Preview** opens a
    full-screen, faithful render of the proposed homepage at
    `/admin/homepage/preview/[draftId]` where the admin can make small
    edits inline (rail headings, item titles, remove items), then use
    the sticky **Back** control (which saves edits) or the fixed
    bottom-right **Discard** / **Publish** buttons to act from inside
    the preview itself. Publishing applies only the `featured-*` rails
    to the live `HomePage` record (non-destructive: the static
    hero/mission sections are preserved) in a transaction, flips the
    page to `PUBLISHED`, and marks the draft `APPROVED`; discarding
    marks it `REJECTED`. The live homepage renders the published rails
    when present and falls back to its static featured section
    otherwise, so there is **zero visual change until a makeover is
    explicitly published**. Every edit/publish/discard is
    admin-guarded and written to the audit log; terminal drafts are
    refused (409) so a stale tab cannot double-apply. Review actions
    live in `homepage-designer.ts`
    (`getHomepageDraft` / `saveHomepageDraftEdits` /
    `applyHomepageDraft` / `discardHomepageDraft`) behind
    `POST|PATCH /api/admin/admin-worker/homepage-draft/[id]`.

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
  the last brain decision, and the next planned decision. It checks
  the **worker-level gates first** — `WORKER_NOT_RUNNING` (stale
  heartbeat), `WORKER_PAUSED`, and `BRAIN_DEGRADED` (the Python final
  brain in safe-degraded mode) — because all three turn off _every_
  publishing path (curated, structured, AND the fetcher chain), so they
  are the real reason a worker that was growing suddenly plateaus and the
  pipeline walk underneath can't see them. When the blocker is a stage a missing
  **outward capability** explains (no candidates to fetch, fetches failing on
  unapproved hosts, extraction unable to complete required fields, validation
  sources unreachable, publish gated on evidence), it appends the **exact env /
  network remediation** ([`capability-gaps.ts`](src/lib/admin-worker/capability-gaps.ts)):
  e.g. _"set `EXTRACTION_AI_API_URL` + `EXTRACTION_AI_API_KEY`"_ or _"set
  `ADMIN_WORKER_OPEN_INTERNET=1`"_. The Why-No-Growth panel appears on the
  Command Center and is included in every Developer Audit PDF.

- **Recognises stuckness and acts on it — not just logs it.** Every pass the
  Python brain runs `detect_stuckness` (action/repair loops + no-growth). When it
  fires, the worker now takes **real corrective action** before asking for help
  ([`mission-control.ts`](src/lib/admin-worker/mission-control.ts) →
  `runStucknessPass`): it runs an aggressive **review-queue auto-resolve** sweep
  (so a pile-up of safely-resolvable items is never what holds growth), diagnoses
  the missing **growth capability**, and files a high-priority developer request
  whose detail names the precise remediation (the env var / network to enable) —
  the honest version of "figure out a resolution on its own", since the worker
  cannot grant itself an API key or open a firewall. The **review auto-resolve**
  ([`human-review.ts`](src/lib/admin-worker/human-review.ts) →
  `runReviewAutoResolve`) drains every kind of item it can decide safely: it
  applies the authentic Latin/Greek the canonical engine can build, and rejects
  as moot/redundant any translation, `publish`, `PUBLISH_PARISH`,
  `delete:*`, `investigate_post_publish_failure`, or `publish-daily-readings`
  proposal whose content is already live (or already gone, or now verified).

- **Fully independent of human review (default).** The worker **never parks work
  for a person** ([`policy.ts`](src/lib/admin-worker/policy.ts) →
  `requireHumanReview`, off by default). For every situation that would otherwise
  need a human it makes its own terminal decision: publish when the evidence
  clears the bar, otherwise **skip** — never publish unverified, never delete on
  uncertainty — and revisit autonomously when better evidence or a capability
  arrives. `fileHumanReview` records that decision as an audit log instead of
  queueing; the four direct review-filers (translation backfill, OSM parish,
  daily readings, `ensure_prayer_translations`) are likewise gated; and the
  per-pass auto-resolve gives every still-pending item its own safe terminal
  decision, so the queue **drains to zero and never blocks growth**. The
  human-review UI still exists (a human _may_ act), and setting
  `ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1` restores the human-gated behaviour. The
  worker cannot grant itself an API key or open a firewall, so when growth is
  capped by a missing capability it says exactly what to enable (see the
  capability self-diagnosis above) — but it is never _stuck_ waiting on a person.

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
  cross-source verifier wired, post-publish verification works, and
  **every recent public row traces to a package artifact + a strict-QA
  PASS + a ContentQualityScore** — fails if any content could become
  public outside the pipeline). It also runs **structural single-pipeline
  guards** that fail closed if a removed path reappears: only the full
  ten-dimension quality model exists (no reduced/V2 scorer), the Python
  brain is the only final action selector (no TypeScript fallback), the
  checklist foundation has no `publish()` writer, and live search/sitemap/
  cache verification is actually running. Every failed check returns a
  concrete repair instruction. The Command Center surfaces the readiness
  score and failing checks.

### Content goal model (targets, not caps)

Every content type has a **growth target**, not a hard maximum. The single
exception is **Sacraments**, the one _closed_ type fixed by the faith: it
carries a true `canonicalMax` of **7**. Every other type is _open_ —
`canonicalMax` is `null`, the target is a milestone, and the worker keeps
building verified content past the target at a slower **maintenance** pace.
The worker never treats a target as an absolute cap, and a gap is **never** a
reason to publish — content still has to pass every accuracy / approval /
source / verification / strict-QA / full-quality gate first.

- **Targets** (`src/lib/admin-worker/content-goals.ts`): Sacrament 7
  (canonicalMax 7); Parish 300,000; Prayer 1,000; Pope 267; Saint 10,000;
  Doctor 37; Rite 24; Church Document 200; Devotion / Novena / Guide /
  Liturgical 100; Marian Title / Apparition / Spiritual Practice 50 — all
  with **no hard maximum**.
- **Statuses**: `TARGET_REACHED` for an open type at its target (it keeps
  growing — never "complete"), `CANONICAL_COMPLETE` only for a closed type at
  its hard maximum, plus `NEEDS_VERIFICATION` / `SOURCE_BLOCKED` / `STALLED`.
  The command-center "Content goals" table is driven by the **content catalog**
  (`src/lib/content-shared/content-catalog.ts`) so it lists **every page the
  site offers in navigation order** — including the view-based categories that
  are not their own content type (Litanies = prayers of type `litany`, Our Lady
  = Marian titles + apparitions, Liturgical Calendar = feasts/seasons, History
  = the Church-documents timeline, tagged `view`). Each non-view row's
  `Target` / `Hard max` is **locked to `DEFAULT_GOAL_SEEDS`** — the same goal the
  growth orchestrator drives toward — by a drift-guard test, so the console can
  never show a stale denominator (Saints reads `/10,000`, the real goal, not a
  hard-coded `/1,000`). Each row shows a single legible `Have / Target` column,
  Hard max (— for open types), Gap, and status, and reserves "complete" for
  Sacraments.
- The content-type profiles + the Python brain's `select_action` input carry
  `canonicalMax` + `allowsContinuedGrowth`, so the brain knows only
  Sacraments are capped and keeps growing the open types after their targets.

### Single content path

The Admin Worker artifact pipeline is the **only** way content becomes
public. The pre-Admin-Worker build/QA/publish engine has been **deleted
outright** — there is no second engine, no fallback, and no escape hatch:

- The legacy build engine, QA scorer, build logger, relation extractor,
  duplicate detector, source fetcher, and `publish()` writer are all
  gone from the tree. The only writer of public rows is
  `runPublishOrchestrator()`.
- The legacy build/publish admin routes (`checklist/worker-run`,
  `checklist/[id]/publish`, `bulk/build-all`, `bulk/run-autonomous`) and
  the dashboard "Build all" / "Run autonomous cycle" buttons have been
  removed — building and publishing are autonomous.
- With no `BUILD_READY` / `QA_PASSED` artifact, the PACKAGE_BUILD and
  PUBLIC_PUBLISH stages return idle — there is nothing to fall back to.
- Production readiness **fails** if any row published in the last 7 days
  has no linked `AdminWorkerPackageArtifact` (i.e. something bypassed
  the pipeline).
- `src/lib/checklist/` is the **content foundation** the pipeline + admin
  UI build on (checklists, curated knowledge, content schemas, the
  authority source registry, the janitor, seeding, the build-intent
  queue, and the checklist lifecycle CRUD). `unpublish()` (a safe admin
  op that only flips `isPublished=false`) is the one publishing-adjacent
  function it keeps.

Live sitemap + cache verification is **mandatory in production**
(`liveProbeEnabled()` probes the real generated sitemap output + the
public route unless `ADMIN_WORKER_DISABLE_LIVE_PROBE=1` is set for a
documented test/local run).

Because the legacy engine no longer exists as code, the single-content-path
guarantee is **structural**: `tests/admin-worker/production-mandates.test.ts`
and the readiness checks prove `runPublishOrchestrator()` is the only
publish writer and that every recent public row traces to an artifact.

### Curated knowledge as the offline first-pass source

The repo ships a large, hand-verified curated knowledge base
(`src/lib/checklist/knowledge/`, `ALL_CURATED_ENTRIES`) of ground-truth,
schema-valid Catholic content with authority citations — **~507 entries
spanning every content type**: the Church's fixed texts and canonical lists.
Representative depth: 167 saints, 57 popes, the complete sets of the 37 Doctors
of the Church and the 7 sacraments, 42 prayers (with Latin/Greek where an
authentic form exists), 34 Marian titles, 30 liturgical feasts & seasons, 27
basilicas & shrines, 25 church documents (encyclicals, conciliar texts, the
Catechism), 23 devotions, plus litanies, novenas, approved apparitions, how-to
guides, spiritual practices, and the recognized rites. Every entry validates
against its per-type content schema (`tests/checklist/knowledge.test.ts`) and
publishes through the real orchestrator. The curated set is the worker's
**first-pass content source** (canonical content can be published without a live
fetch), while live discovery + cross-source verification — **plus the runtime
growth engines below (open-internet + keyword web-search discovery, Google Maps
parish discovery, and web-PDF reading)** — grows everything far beyond it (the
saint target alone is 10,000).

- The worker publishes it through the **real** pipeline, not a back door:
  `runCuratedIngest()` (`src/lib/admin-worker/curated-ingest.ts`) runs each
  loop pass as a bounded, idempotent, fail-open step that publishes the next
  batch of not-yet-live curated entries through `runPublishOrchestrator()`
  (full safety + ten-dimension quality gate + verifier evidence + persist),
  then refreshes the content goals. So `npm run worker` grows content across
  every type even where outbound HTTP is unavailable.
- The curated entries carry citations and a verifier sign-off, so the
  orchestrator's brain-backed _advisory_ screens (communion-risk, semantic
  dedupe) are skipped for them (`skipBrainScreens`) while every deterministic
  gate still runs — the brain remains the final action selector for the
  worker's autonomous discovery/fetch missions.
- `npm run seed:content` runs the same publish path once from the CLI
  (`scripts/seed-curated-content.ts`) for a fresh local DB or any offline
  environment.

### Internal modules

`src/lib/admin-worker/` ships every module of the autonomous pipeline.

| File                                     | Module                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`brain.ts`**                           | Candidate generator + sub-scoring + safe-degraded selector (no longer the final brain)                    |
| **`final-brain.ts`**                     | Python is the FINAL action selector: validates `select_action`, enforces the safety gate, degrades safely |
| **`dispatcher.ts`**                      | 22-stage mission dispatcher (real execution, no stubs)                                                    |
| `mission-planner.ts`                     | Chain-aware mission planner                                                                               |
| `loop.ts`                                | Central decision loop + mode dispatch                                                                     |
| `passes.ts`                              | Pass lifecycle                                                                                            |
| `tasks.ts`                               | Task management                                                                                           |
| `state.ts`                               | Singleton state + pause/resume                                                                            |
| `modes.ts`                               | Mode descriptors                                                                                          |
| `priorities.ts`                          | Priority ladder + selector                                                                                |
| `decisions.ts`                           | Decision log + confidence thresholds                                                                      |
| `planner.ts`                             | Build-job enqueuer (within mission)                                                                       |
| **`discovery-orchestrator.ts`**          | 7 discovery methods + per-type strategies + cadence                                                       |
| `web-navigator.ts`                       | Candidate URL store + junk classifier                                                                     |
| `sitemap-discovery.ts`                   | Sitemap discovery + robots.txt                                                                            |
| `rss-discovery.ts`                       | RSS / Atom feed discovery                                                                                 |
| `configured-urls.ts`                     | Configured fixed URL list discovery                                                                       |
| `internal-link-discovery.ts`             | Internal-link discovery                                                                                   |
| `directory-discovery.ts`                 | Catholic content directory discovery                                                                      |
| `search-page-discovery.ts`               | Approved-source search-page discovery                                                                     |
| `source-apis.ts`                         | Official source API adapter registry                                                                      |
| **`candidate-scorer.ts`**                | 7-dimension candidate scoring + outcome adjustment                                                        |
| **`fetcher.ts`**                         | Approved-host fetch + checksum + login/binary rejection                                                   |
| `source-reads.ts`                        | Source-read dedupe via sha256 checksum                                                                    |
| `source-reader.ts`                       | Orchestrator: classify + extract + read                                                                   |
| **`structured-source-reader.ts`**        | HTML parser → AdminWorkerSourceBlock rows                                                                 |
| **`confusion-detector.ts`**              | 11 confusion rules (flip to UNUSABLE before extract)                                                      |
| `classifier.ts`                          | Deterministic content classifier + `classifyDetailed`                                                     |
| `extractors.ts`                          | Per-type extractors + field provenance                                                                    |
| **`content-builder.ts`**                 | Builds complete package artifacts (all required fields)                                                   |
| `provenance.ts`                          | Field-level provenance tracker                                                                            |
| **`checklist-citation-orchestrator.ts`** | Artifact → ChecklistItem + ChecklistCitation bridge                                                       |
| `cross-source-verifier.ts`               | Field verification + ValidationEvidence                                                                   |
| **`validation-source-resolver.ts`**      | Field → ranked validation hosts + conflict fallback                                                       |
| **`validation-fetcher.ts`**              | Actually fetches + reads + compares validation pages                                                      |
| **`verifier.ts`**                        | Sensitive-field whitelist + pre-publish verifier gate                                                     |
| `packaging.ts`                           | Per-content-type structural validators                                                                    |
| **`strict-qa.ts`**                       | Artifact-level strict QA (7 sub-scores + gate)                                                            |
| `quality.ts`                             | 10-dim quality scoring (`computeFinalScore`)                                                              |
| **`publish-orchestrator.ts`**            | The only publish path; idempotent; updates all stores                                                     |
| `publisher.ts`                           | Publish-gate evaluator used by the orchestrator                                                           |
| `publish-safety.ts`                      | Pattern blockers (incomplete prayers, …)                                                                  |
| `post-publish-probe.ts`                  | Live HTTP probe                                                                                           |
| **`search-sitemap-cache-verifiers.ts`**  | Independent search + sitemap + cache verification                                                         |
| `post-publish.ts`                        | Aggregation + decision                                                                                    |
| **`post-publish-rollback.ts`**           | REPAIR → UNPUBLISH → DELETED → HUMAN_REVIEW decision tree                                                 |
| `homepage-designer.ts`                   | Homepage scoring + draft decision + preview/edit/publish/discard actions                                  |
| `homepage-mutator.ts`                    | Builds proposed homepage snapshots (`force` for admin makeovers)                                          |
| **`homepage-publish-orchestrator.ts`**   | 10-axis inspect + snapshot + verify + rollback                                                            |
| `liturgical-calendar.ts`                 | Meeus-based liturgical calendar engine (homepage seasonal scorer)                                         |
| `daily-readings.ts`                      | Daily Mass readings: resolve + store + autonomous backfill/self-correct                                   |
| **`readings-source.ts`**                 | Pluggable readings sources (offline table + `LECTIONARY_DATA_URL` dataset)                                |
| `security-defender.ts`                   | Defender + automatic ban + email                                                                          |
| `security-detectors.ts`                  | 10 deterministic detector functions                                                                       |
| **`request-defender.ts`**                | 7 helpers (failed login, brute force, mutation, …)                                                        |
| **`admin-route-guard.ts`**               | `requireAdminWithDefender` for non-gate routes                                                            |
| `pipeline-stages.ts`                     | Pipeline-stage chain + `resumeOrAdvance` checksum skip                                                    |
| `repair.ts`                              | In-pass repair handlers                                                                                   |
| **`repair-orchestrator.ts`**             | Real per-kind repair execution (not just logging)                                                         |
| `repair-plans.ts`                        | Durable repair-plan queue + exponential backoff                                                           |
| `learning.ts`                            | Feedback loop (success/failure counts)                                                                    |
| `memory.ts`                              | Memory hooks + **30-day half-life decay**                                                                 |
| `source-reputation.ts`                   | EWMA-smoothed reputation engine                                                                           |
| **`source-reputation-hooks.ts`**         | Per-stage `pushReputation` (discovery → post-publish)                                                     |
| `source-strategy.ts`                     | 10-criteria source ranking                                                                                |
| **`source-coverage.ts`**                 | Primary/validation/enrichment coverage per content type                                                   |
| `content-goals.ts`                       | Per-content-type minimum/desired                                                                          |
| `content-growth.ts`                      | 24 h / 7 d growth-escalation watcher                                                                      |
| **`growth-orchestrator.ts`**             | 7 growth-status classes + auto-file repair plans                                                          |
| **`content-growth-monitor.ts`**          | Per-content-type funnel (candidates → cache) + bottleneck                                                 |
| `cleanup.ts`                             | Cleanup custodian                                                                                         |
| `human-review.ts`                        | Rare-edge-case review queue                                                                               |
| `deletion.ts`                            | Confidence-gated deletion + 9 reasons                                                                     |
| `health.ts`                              | Worker health monitor                                                                                     |
| `metrics.ts`                             | Command Center metric computation                                                                         |
| `diagnostics.ts`                         | Subsystem ratings + diagnostics auditor                                                                   |
| **`why-no-growth.ts`**                   | Live chain walk → first blocker + next automatic repair                                                   |
| `readiness.ts`                           | Production-readiness sweep (single-pipeline + publish-gate guards)                                        |
| `rules.ts`                               | Versioned rules across categories                                                                         |
| `logs.ts`                                | Structured AdminWorkerLog writer                                                                          |
| `report-generator.ts`                    | Developer Audit data collection (incl. the Worker Requests section)                                       |
| `pdf.ts`                                 | PDF rendering for both reports                                                                            |
| `monthly-report-job.ts`                  | Last-day-of-month gate + run                                                                              |
| `public-routes.ts`                       | Public URL builder + cache tag mapping                                                                    |

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
- **Request Homepage Makeover** — operator-triggered redesign that
  files a reviewable draft, then offers Preview / Discard / Publish
  (with an editable full-screen preview)
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
ranked-action brain then the mission dispatcher, which walks the artifact
pipeline (there is no separate build-queue engine). It is safe to run with multiple
replicas; per-stage work is idempotent and durable. The monthly Admin
Worker Report fires once per worker startup when `isLastDayOfMonth(today)`
is true, so a restart on the last day of the month still sends the
email.

---

## Intelligence brain (Python)

A permanent intelligence core under [`intelligence/`](intelligence/) is the
Admin Worker's **single unified brain**: Python owns reasoning (planning, final
action selection, self-modeling, learning, diagnosis, and upgrade requests),
**TypeScript** stays the safe execution + enforcement body (filesystem, network,
Prisma writes, publishing, verification, rollback, policy, human-review gates),
and **Postgres** is the durable memory + audit store. It is **pure-stdlib and
deterministic** (no external AI APIs, no network), so the same input always
yields the same output and every recommendation is auditable.

This is a forward-only unification (no legacy compatibility paths kept beside
the new ones). The first delivered phase is the **unified self-model + deep code
awareness** below, which replaced the old summary-only `analyze_code`
(line-counts) with a real model of the whole application.

### A permanent, always-on service (not a sidecar)

The brain is **not** spawned per call. TypeScript holds a single long-lived
`python3 -m intelligence` process open for the lifetime of the worker (and
web) process and multiplexes every request over it by id (newline-delimited
JSON over stdio). The worker warms it on boot (`ensureBrainStarted()`),
keeps it resident, auto-restarts it if it dies, and shuts it down cleanly on
exit. It is consulted for every meaningful decision and ships **inside the
worker image** (`Dockerfile.worker` copies the Python runtime, same Debian
release as the node base). TypeScript talks to it through a typed bridge:

- `src/lib/admin-worker/intelligence/contracts.ts` — Zod-validated response
  envelope + a protocol-version check + typed result interfaces.
- `src/lib/admin-worker/intelligence/client.ts` — the persistent-process
  manager: `callBrain()` writes a request and resolves the matching response
  by id, with per-call timeouts, an in-memory cache, auto-restart, and
  `ensureBrainStarted()` / `shutdownBrain()`. It **degrades gracefully**
  (returns `null`) whenever the brain is disabled/offline — resilience, not
  optionality: the brain is always consulted; it simply never blocks a pass.
- `src/lib/admin-worker/intelligence/index.ts` — one typed wrapper per op.
- `src/lib/admin-worker/intelligence/service.ts` — worker-facing functions
  that call the brain, write the audit trail, persist durable output, and
  return a fallback-safe shape.
- `src/lib/admin-worker/intelligence/store.ts` — all Postgres writes
  (TypeScript owns the database; Python never does).

### Operations (`intelligence/operations/`)

| Op                                                                                                               | Purpose                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `embed`, `semantic_search`                                                                                       | semantic memory / vector search                                                                         |
| `detect_duplicates`                                                                                              | exact + slug + fuzzy + semantic + alias + source/citation duplicate scoring                             |
| `score_quality`                                                                                                  | per-record quality profile + hard publish gates                                                         |
| `assess_source`, `detect_communion_risk`, `compare_sources`                                                      | source authority, **Catholic communion-risk screening**, contradiction detection                        |
| `infer_relationships`                                                                                            | recommend knowledge-graph edges                                                                         |
| `classify_failure`, `diagnose_fetch`                                                                             | repair intelligence + webpage-fetch diagnosis                                                           |
| `self_inspect`, `developer_requests`, `iq_metrics`                                                               | self-inspection, the worker's developer requests, worker-IQ metrics                                     |
| `plan`, `prioritize`                                                                                             | planning + priority intelligence                                                                        |
| `analyze_graph`                                                                                                  | orphans, weak links, hubs, components, duplicate clusters, missing edges                                |
| `scan_content`                                                                                                   | prompt-injection / manipulation detection on sanitised text                                             |
| `classify_freshness`                                                                                             | refresh-cadence classification                                                                          |
| `extract_knowledge`                                                                                              | extract dates, names, citations, sources, claims, sections from sanitised text                          |
| `suggest_structure`                                                                                              | content-structure intelligence (sections, split recommendations)                                        |
| `detect_variants`                                                                                                | structural title variants (flags that real translations need source verification)                       |
| `detect_missing`                                                                                                 | missing-information detection per record (gaps + severity + completeness)                               |
| `learn_from_outcome`                                                                                             | turn an outcome / admin feedback into score adjustments + a learned memory                              |
| `analyze_schema`                                                                                                 | schema-awareness: isolated/under-indexed models → schema developer requests                             |
| `analyze_ui`                                                                                                     | UI-awareness: content types with no public route → UI developer requests                                |
| `ingest_codebase`                                                                                                | normalise + integrity-check the corpus (by dir/lang, export index, duplicate basenames)                 |
| `build_self_model`                                                                                               | whole-app self-model from the ingested corpus (files, routes, models, ops, …)                           |
| `build_symbol_graph`, `build_call_graph`, `build_route_graph`, `build_schema_graph`, `build_test_coverage_graph` | module/call/route/model/test graphs (depended-on, fan-in/out, import cycles, orphans, unused, coverage) |
| `explain_own_architecture`                                                                                       | narrate the Python-brain / TS-body / Postgres-memory layering with evidence                             |
| `find_weak_modules`, `find_untested_modules`, `find_orphaned_code`, `find_duplicate_logic`                       | deep code awareness: why a module is weak + split plan + risk + tests                                   |
| `rank_self_upgrades`                                                                                             | rank the worker's own upgrade requests (evidence, gain, difficulty, rollback)                           |
| `detect_stuckness`                                                                                               | stage/source/repair loops + no-growth detection → change-strategy recommendation                        |

> **Communion-risk note.** `detect_communion_risk` emits a _verification
> flag_, never a canonical/doctrinal ruling. Sources or content that may not
> be in full communion with Rome (e.g. "Old Catholic", "independent
> Catholic", "not in communion with Rome") raise risk and route to human
> review before publishing; official domains (`vatican.va`, diocesan, USCCB)
> are recognised as trustworthy. When uncertain it raises risk — the safe
> direction.

### Unified self-model & deep code awareness

The brain understands the whole application, not just the record in front of it.
TypeScript (it owns the filesystem) ingests the codebase into a structured
corpus — every file with its real **exports + imports**, the public/admin
**routes**, the **Prisma models** with consumer counts, the **package scripts**,
the Admin Worker **mission stages**, the **brain ops**, and **test→module**
coverage links (`src/lib/admin-worker/self-model.ts`). The Python brain reasons
over that corpus and can answer, with evidence: what the app is, how it is
layered, which modules are oversized / highly-coupled / untested / orphaned /
duplicated, what to upgrade next (ranked, each with a split plan, risk,
suggested tests, and rollback), and whether the worker is stuck.

Each pass the worker runs `runSelfModelPass`: it builds the model, persists a
durable self-model **snapshot** (Postgres audit log), and turns the ranked
self-upgrades into **developer requests** — so the worker continuously says what
it is, what is weak, and what it needs next. Production code is never rewritten
automatically; the brain only recommends (human-review gated). The legacy
summary-only code-awareness path (`analyze_code` / `runCodeAwareness` /
`inspectCode`) was removed outright.

### Unified brain capabilities (233 operations)

Beyond the self-model, the unified brain reasons across these areas — every
operation returns the same strict envelope (`ok`, `result`, `confidence`,
`reasoning`, `evidence`, `sources_used`, `risk_level`,
`recommended_next_action`, `safe_to_auto_execute`, `error`,
`protocol_version`, `elapsed_ms`), validated by TypeScript before use:

- **Catholic authority graph** (`authority.py`): one shared authority ladder
  (Vatican → Catechism → Liturgical → USCCB → Diocesan → Religious order →
  Trusted publisher → Academic → Community) used to rank sources, classify
  document/source authority, and gate auto-publish.
- **Claim-level verification** (`claims.py`): extract structured claims
  (subject/predicate/value/source/authority/citation), compare them, and resolve
  conflicts by authority — the higher authority wins, the lower is blocked
  pending review; ties route to human review. Used before publishing factual
  Catholic content.
- **Action simulation** (`simulation.py`): expected value, failure/publish/
  safety/source risk, repair + time cost, likely next stage/blocker, and a
  counterfactual comparison that explains why the best action wins.
- **Confidence calibration** (`calibration.py`): measures whether predictions
  came true and raises/lowers per-op confidence; grades decisions; tracks
  false-positive/negative risk.
- **Stuckness detection** (`stuckness.py` + `detect_stuckness`): action/source/
  repair loops + no-growth detection → a change-strategy recommendation.
- **Mission control** (`mission.py`): a mission tree above action selection
  (subgoals, existing vs missing content, blockers, completion %, next best
  action) driving each content section to completion.
- **Self-explanation** (`explanation.py`): every decision explained — what,
  why, rejected alternatives, evidence/memories used, safety basis, and what
  would change its mind.
- **Upgrade-request engine** (`upgrades.py` + `rank_self_upgrades`): the
  worker's internal product manager — rank, explain, dedupe, ROI-score, and flag
  neglected requests. Every request is a complete 20-field record (title,
  category, problem, evidence, affected files / models / worker-stages /
  brain-ops / public+admin routes, expected intelligence gain + user value, risk
  if not fixed, difficulty, implementation plan, suggested tests + migration,
  rollback plan, priority + confidence) persisted to
  `AdminWorkerDeveloperRequest.metadata` and surfaced on the dashboard + audit.
- **Test-gap detection** (`testgaps.py`): repeated failures become review-gated
  regression-test recommendations (PDF, dynamic fetch, duplicate, schema,
  publish, QA …).
- **Specialist reviewers** (`specialists.py`): a 12-member deterministic panel
  combined into one decision envelope.
- **Multi-layer memory** (`memory_layers.py`): episodic / semantic / procedural
  / source / self / admin-feedback / mission / safety layers with consolidation,
  dedup, conflict detection, retirement, ranking, and context-pack retrieval.
- **Hybrid retrieval** (`retrieval.py`): keyword + sparse vector + graph +
  authority/citation/freshness/feedback/historical-success weighting.
- **Catholic content extraction** (`catholic_extraction.py`): document-type
  identification + structured metadata for papal/council documents, canon law,
  catechism, saints, parishes, prayers, novenas, litanies, and history-timeline
  entries.
- **Liturgical calendar + lectionary** (`lectionary.py` → `liturgical_day`,
  `lectionary_readings`): the brain's deterministic knowledge of the Church's
  year. For any date it computes the exact liturgical day of the General Roman
  Calendar (season, Sunday cycle A/B/C, weekday cycle I/II, colour, moveable
  feasts, and a Proper-of-Saints overlay) and the day's Mass-reading citations,
  keyed on a shared `lectionaryKey` that mirrors the TypeScript engine
  (`content-shared/liturgical-calendar.ts` + `lectionary.ts`). Pure stdlib — the
  body resolves the public-domain Scripture text and stores it.
- **Review-gated self-improvement** (`patches.py`): the brain proposes code /
  schema / test patches with risk review + rollback plan, but never applies or
  deploys them (`safe_to_auto_execute` is always false; human review required).
- **Replayability & resilience** (`replay.py` + `replay-runner.ts`): the brain
  reasons over the event-sourced record in Postgres (`AdminWorkerDecision` stores
  each chosen stage + the full ranked candidate list) — `replay_decision`
  (reproduce a stored decision), `compare_decisions` + `explain_decision_change`
  (why a decision changed), `detect_decision_drift` (oscillation / fixation),
  `recommend_circuit_break` (per host / stage / content-type), and
  `check_replay_integrity` (stored brain-output corruption check). Each post-pass
  the worker **replays the last pass** and **replays the last 50 passes in
  simulation** (read-only) and records the reproduction rate; **idempotency keys**
  (`actionIdempotencyKey`) dedupe replayed actions so a pass is never
  double-counted. Surfaced on the dashboard; see also the chaos tests below.

Each phase is forward-only and verified before the next: `npm run brain:selftest`
(every op returns a valid envelope) + `npm run brain:test` (per-op unit tests),
with the TypeScript `BRAIN_OPS` list kept in sync with the Python registry.

**Resilience / chaos tests** prove the brain degrades safely rather than
crashing: `intelligence/tests/test_chaos.py` feeds every op empty /
type-confused / nested-garbage payloads (all 125 survive), isolates a crashing
op to an error envelope, and recovers the stdio loop from malformed lines;
`tests/admin-worker/intelligence/resilience.test.ts` drives a configurable fake
brain through protocol mismatch, malformed output, timeout, and the restart
circuit breaker, and proves real-brain op-error round-trips, process death +
auto-recovery, and concurrent id-multiplexing.

### Where the brain is wired in

- **Final action selection, every pass** (`loop.ts` → `brain.ts` →
  `final-brain.ts`): TypeScript generates + sub-scores the candidate actions
  and the Python brain **selects the final action** (`select_action`);
  TypeScript validates that choice against the safety gate and executes it
  (see [Brain as the FINAL decision brain](#brain-as-the-final-decision-brain)).
  Around the choice the brain **forward-simulates** the chosen vs the top
  alternatives (`compare_counterfactual_actions`) and records the prediction.
- **Supplementary pre-pass consultation** (`intelligence-advisory.ts`): the
  Python brain also `prioritize`s the unmet content goals and returns a
  `plan` / next-best-action, recorded to the audit trail for the reasoning
  view. This does not select the action — it is a supplementary signal.
- **Publish gate** (`publish-orchestrator.ts`): a **communion-risk** screen
  routes risky content to review, a **semantic-duplicate** gate blocks
  near-duplicates the slug/canonical checks miss, the **12-member
  specialist panel** (`specialist_reviews`) routes a candidate to review when a
  blocking specialist objects (e.g. an uncited sensitive type, a security or
  duplicate flag), and a **proof-based publishing** gate (`proof-publishing.ts`)
  holds the sensitive Catholic categories (apparitions, doctrine, papal /
  council documents, canon law, liturgical norms, …) to a **passing proof
  packet** (`build_proof_packet` + `check_invariants`) before they may go
  public — **fail-closed**: if the proof can't be built, the item routes to
  human review rather than publishing. All of these run before the existing
  quality/QA gates.
- **Source reading** (`source-reader.ts`): on every new read the brain runs
  **Catholic content extraction** (`identify_document_type` +
  `extract_structured_catholic_document`) over the source text — document type
  - canon-law / catechism / papal / council references — recorded to the audit.
- **Cross-source verification** (`dispatcher.ts`): when validation sources
  disagree, the brain's **claim-level authority resolution**
  (`resolve_claim_with_authority`) adjudicates by Catholic authority (advisory;
  it never overrides the deterministic verifier that gates publishing).
- **Post-pass, every pass** (`loop.ts` → `intelligence-pass.ts`):
  self-inspects recent failures/blocked actions, persists deduped
  **developer requests**, computes **worker-IQ** metrics, turns the dominant
  repeated failure into a **learning signal** (`learn_from_outcome`), then runs
  **mission control** (`build_mission_tree` → `rank_subgoals` →
  `detect_mission_blockers` → `recommend_next_mission_action`, persisted as a
  snapshot) and **stuckness detection** (`detect_stuckness` →
  `recommend_unblock_strategy`, filing a developer request when stuck). It then
  **reflects** — explaining the real decision it made (`explain_decision` +
  `explain_what_would_change_my_mind`) and turning recurring failures into
  test-gap → regression-test requests (`detect_test_gap` → `rank_missing_tests`)
  — and runs **replay & resilience** (`compare_decisions` /
  `explain_decision_change` / `detect_decision_drift` / `check_replay_integrity`
  / `recommend_circuit_break`) over the event-sourced record.
- **Admin feedback as training signal** (`service.recordAdminFeedback`):
  an admin approve/reject/edit/unpublish/repair becomes a learned outcome
  that changes future behaviour.
- **Developer audit — Intelligence section** (`diagnostics/developer-audit.ts`):
  the Developer Audit PDF has an **"Intelligence (the unified brain)"** section —
  brain decision count + ok-rate + avg confidence + Worker IQ, the self-model
  summary (files, coverage, weak/untested), next mission action, any stuckness
  signal, the brain operation mix, the top self-requested upgrades, and the open
  developer-request queue (parser, schema, source, UI, safety, capability,
  code/refactor, and process needs). Also surfaced live on the
  `/admin/intelligence` dashboard.
- **Maintenance intelligence, throttled** (`awareness.ts` + `self-model.ts` +
  `custody.ts`): **schema-awareness** (parses the Prisma schema →
  isolated/under-indexed models), **UI-awareness** (scans routes/admin pages →
  content types with no public page), the **unified self-model** (ingests the
  whole codebase → weak/untested/orphaned/duplicate modules + ranked
  review-gated upgrade requests; replaced the old summary-only code-awareness),
  and **content custody** (`detect_missing` over published records → improvement
  requests). Each files deduped developer requests.
- **Autonomy + policy engine** (`policy.ts`): `evaluateAutonomy()` turns the
  brain's confidence/risk/communion/duplicate signals into an
  auto/draft/escalate/block decision bounded by the worker's autonomy level
  (`ADMIN_WORKER_AUTONOMY`). Policy stays in TypeScript.
- **Daily readings** (`daily-readings.ts`, `readings-source.ts`,
  `content-shared/lectionary.ts`): the worker computes the exact liturgical day,
  resolves its readings (Douay-Rheims), and autonomously fills a rolling
  ~year-ahead window into `DailyReading` — re-verifying + self-correcting each
  scan, never downgrading a verified day. Coverage is extensible at runtime via
  `LECTIONARY_DATA_URL`. The brain owns the calendar/lectionary knowledge
  (`liturgical_day`, `lectionary_readings`); the worker consults it each refresh
  and records it, plus freshness classification + review-on-uncertainty.

All of the supplementary wirings above are best-effort and non-blocking —
they never block a pass. The **final action selection** is separate: the
Python brain selects it whenever it is online (the default); otherwise the
worker enters safe degraded mode and never falls back to a TypeScript final
brain.

### Intelligence Laboratory (causal + experimental self-evaluation)

The Intelligence Laboratory is a **complete expansion of the one unified
brain** — not a sidecar, second brain, or optional add-on. Every capability is
a registered brain operation behind the same strict envelope contract and the
same TS↔Python parity test; TypeScript stays the safe execution / validation /
persistence / enforcement layer, and **human review remains required for code
changes, schema changes, production deployment, and review-gated
self-improvement.** The lab is wired into the worker loop as a throttled,
fail-open, **advisory** pass (`intelligence-lab.ts`) that records its findings
to the audit trail and routes any code/schema/architecture recommendation
through a developer request — it never deploys, mutates schema, or publishes.

- **Causal Intelligence Core** (`causal.py`): reasons about _why_, not just
  what. A curated causal model of the pipeline (cause → effect edges with
  mechanism, strength, and the breaking intervention) powers
  `build_causal_graph`, `infer_causal_factors`, `explain_root_cause`,
  `detect_causal_chain`, `rank_causal_factors`, `update_causal_model`,
  `explain_causal_model` — e.g. it traces _mission stagnation_ back through
  publish delay → strict-QA failure → missing fields → extraction difficulty →
  **source type**, and names the exact fix.
- **Counterfactual reasoning** (`counterfactual.py`): estimates what another
  choice would have done (different source/type, repair-first, human review,
  pause + switch) and the regret, to improve future action choice.
- **Safe experiments** (`experiments.py`): bounded (≤10/group), measure-only,
  reversible A/B trials — design / run-bounds-check / compare / evaluate /
  extract-lesson / follow-up. They never bypass the publish gates.
- **Hypothesis engine** (`hypotheses.py`): forms, ranks, tests, and evaluates
  explanations for success/failure, each with evidence, confidence, an
  experiment plan, and success criteria.
- **Proof packets** (`proof.py`): evidence-based proof for sensitive decisions
  (source / authority / citation / agreement / conflict → conditions
  satisfied vs failed → risk → action → review → what-would-change). Sensitive
  Catholic categories require a passing proof packet to publish.
- **Formal logic rules** (`logic_rules.py`): the app's critical invariants as
  checkable predicates (doctrinal trusted-support, communion-risk block,
  feast/calendar match, document/saint/papal completeness, duplicate block,
  route-required, mission-growth, developer-request evidence) +
  conflict detection where a hard block always wins.
- **Catholic ontology** (`catholic_ontology.py`): a 38-type entity taxonomy +
  relationship grammar (pope authored encyclical, saint is_a doctor, apparition
  has_status, feast varies_by rite, sacrament = one of seven, …) for
  classifying, linking, validating, and inferring Catholic relationships.
- **Epistemic status** (`epistemic.py`): every claim is graded Certain →
  Well-supported → Likely → Uncertain → Conflicting → Needs-more-evidence →
  Requires-human-review → Blocked, with overconfidence detection so the worker
  never treats a weak claim like a verified one.
- **Strategy tournament** (`strategy.py`): scores candidate long-term
  strategies on 15 dimensions (growth, source quality, Catholic safety risk,
  parser difficulty, maintainability, …) and explains why the winner beats the
  alternatives.
- **Benchmark arena + brain-version comparison** (`benchmark.py`): a 25-task
  arena + 15 version metrics, so an upgrade can be _proven_ better or worse;
  benchmark/version regressions block auto-adoption.
- **Digital twin** (`digital_twin.py`): a simulated worker environment for safe
  practice — every op asserts production is untouched and nothing publishes.
- **Capability invention** (`capability.py`): full review-gated capability
  proposals (problem, evidence, gains, affected files/models/ops/stages,
  contracts, tests, migrations, difficulty, risk, rollback) — invented, not
  just listed.
- **Self-generated curriculum** (`curriculum.py`): progressively harder
  self-training + plateau detection + training-focus recommendations.
- **Adversarial self-testing** (`adversarial.py`): a 20-case library that
  attacks the worker's own gates; every exposed weakness becomes a
  review-gated regression-test request.
- **Architecture governor** (`architecture.py`): 18 architecture invariants
  (no competing paths, no legacy fallback, no untested stage, no route-less
  public type, no unproven sensitive publish, no untested/uncontracted op, no
  unreviewed patch, …) that keep the one unified brain unified and surface
  drift to the dashboard.
- **Highest-leverage change ranking** (`leverage.py`): ranks interventions by
  value ÷ cost and explains the single most valuable change — not a wish list.

**Review-gated adoption.** Lab recommendations flow through: developer request →
evidence pack → capability proposal → test plan → (optional patch proposal) →
risk review → **human approval** → tests → merge → post-merge benchmark
comparison. Code/schema/architecture changes always require human review; only
safe ranking/learning/memory/source-reputation adjustments may be adopted
automatically under TypeScript policy.

### Postgres tables (Postgres owns the durable memory + audit store)

Core intelligence stores (migration `0038`): `AdminWorkerEmbedding`
(vector/semantic-memory store, JSON embeddings — no pgvector required),
`AdminWorkerGraphNode` / `AdminWorkerGraphEdge` (knowledge graph; inferred edges
land `PROPOSED` until approved), `AdminWorkerMemory` (multi-layer learning),
`AdminWorkerDeveloperRequest` (the worker's requests to the developer, deduped by
fingerprint, with the full 20-field structure in `metadata`),
`AdminWorkerBrainCall` (audit trail of every brain call),
`AdminWorkerDecision` (decision **event-sourcing** / replay records, with the
full ranked candidate list), `AdminWorkerStageOutcome` (action-outcome records),
and `AdminWorkerSourceReputation` (source memory).

Dedicated unified-intelligence stores (migration `0044`) — so Postgres, not a
generic log, owns each dataset the spec assigns to it:
`AdminWorkerSelfModelSnapshot` (SelfModel snapshots), `AdminWorkerMissionState`
(mission state, one row per content type), `AdminWorkerCapabilityScore`
(capability scores), `AdminWorkerCalibrationHistory` (confidence-calibration
history), `AdminWorkerTestGapRecord` (test-gap records), and
`AdminWorkerStucknessRecord` (stuckness records). The worker writes these as the
source of truth each pass; the dashboard and Developer Audit read from them.

Intelligence Laboratory store (migration `0045`) — **26** `Lab*` tables, one
group per lab capability, so the lab's reasoning is durable and auditable rather
than ephemeral: causal model (`LabCausalGraph`, `LabCausalFactor`),
counterfactuals (`LabCounterfactualRun`), safe experiments (`LabExperimentPlan`,
`LabExperimentResult`), hypotheses (`LabHypothesis`), proof packets
(`LabProofPacket`), formal logic rules (`LabLogicRule`, `LabRuleEvaluation`),
Catholic ontology (`LabCatholicOntologyNode`, `LabCatholicOntologyEdge`),
claim/epistemic status (`LabClaimRecord`, `LabClaimEvidence`,
`LabEpistemicStatusHistory`), strategy tournaments (`LabStrategyCandidate`,
`LabStrategyTournament`), benchmark arena + brain-version scores
(`LabBenchmarkCase`, `LabBenchmarkRun`, `LabBrainVersionScore`), digital twin
(`LabDigitalTwinScenario`, `LabDigitalTwinRun`), capability invention
(`LabCapabilityProposal`), self-generated curriculum (`LabCurriculumCase`,
`LabCurriculumRun`), adversarial self-testing (`LabAdversarialCase`), and the
architecture governor (`LabArchitectureIntegrityReport`). The loose-coupling
convention (no cross-FKs, string refs to passes / brain-calls, JSON payloads)
matches the other audit-store tables; `intelligence-lab-store.ts` owns every
read/write and the `/admin/intelligence/lab` dashboard renders them.

### Admin surface

`/admin/intelligence` is a **live capability dashboard**: brain status +
protocol + op count + self-model freshness, worker-IQ, the **self-model
snapshot** (files, lines, routes, models, test coverage, weak/untested/orphan/
duplicate counts, architecture layers, largest modules), a deterministic
**capability strengths/weaknesses** map, the **top self-requested upgrades**,
**multi-layer memory** by type, learned **source reliability**, recent
decisions with confidence + risk, recent **self-explanations**,
**stuckness/blocker** signals, communion-risk flags, and the operation mix. It
links to the **Intelligence Laboratory** sub-dashboard.

`/admin/intelligence/lab` is the **Intelligence Laboratory** dashboard — 20
read-only surfaces over the `Lab*` store: the highest-leverage next change,
architecture-integrity reports, proof packets (+ failed-proof count), active
hypotheses, strategy tournaments, benchmark + brain-version scores,
review-gated capability proposals, adversarial weaknesses, counterfactual
insights, experiments, digital-twin runs, curriculum progress, logic-rule
failures, and claim epistemic statuses. Every panel is guarded so the page
renders even before the lab has recorded anything.

### Commands

```bash
python3 -m intelligence --selftest   # run every op against a sample payload
python3 -m intelligence --list-ops   # list ops + protocol version
npm run brain:test                   # python unit tests (stdlib unittest)
npm run brain:selftest               # same as --selftest
npm run brain:proof                  # unified-intelligence proof (spec proof points 3-13)
npm run admin-worker:proof:brain     # proof points 1-2 (Python is the final brain; no legacy path)
```

**Proof suite.** `intelligence/tests/test_unified_proof.py` +
`tests/admin-worker/proof/unified-intelligence.proof.test.ts` are a single,
auditable demonstration of the spec's 13 proof points: the Python brain is the
unified final decision brain, there is no old competing intelligence path, and
the brain creates a SelfModel, explains its own architecture, finds its own
weaknesses, ranks its own upgrades, detects stuckness, simulates actions,
calibrates confidence, detects missing tests, reasons through Catholic authority,
detects claim conflicts, and stays safe / auditable / review-gated. Both run in
`npm run verify:all`.

The Python runtime ships **inside the worker image** (`Dockerfile.worker`
copies the `python:3.11-slim-bookworm` interpreter + stdlib, the same Debian
release as the node base, plus the `intelligence/` package), so the brain is
a permanent part of the deploy. If Python is ever unavailable the worker
simply uses its deterministic fallbacks. Override the interpreter with
`INTELLIGENCE_PYTHON` or disable entirely with `INTELLIGENCE_BRAIN_ENABLED=0`.

---

## Certified Admin Skill Runtime

The Admin Worker performs real autonomous work through **certified skills**:
typed, executable, verifiable, reversible units under
[`src/lib/admin-worker/skills/`](src/lib/admin-worker/skills/). The architecture
is unchanged — **Python is the final brain, TypeScript is the safe execution
body, Postgres is the durable store** — and the runtime adds the practical layer
that proves work actually happened, repairs failures, learns from outcomes, and
**reports honestly what the worker can and cannot do**.

### Autonomous content lifecycle — every content type the site offers

The worker runs a **continuous loop** (`run-worker.ts` → `runAdminWorkerLoop`,
`maxPasses: Infinity`): it starts the Python brain, then on **every pass** the
brain selects the next safest action and the worker executes the full content
lifecycle and the ongoing-management work:

```
find → fetch → read → classify → extract (per type + subtype) → build package →
verify (fields, citations, authority, claims, duplicate, communion, proof) →
strict QA → publish → verify route + sitemap + search + cache → repair → learn
```

…plus, each pass: **curated-knowledge ingest** (publishes the hand-verified
ground-truth for every type through the real Publish Orchestrator — the
first-pass content source, gated on `PYTHON_FINAL_BRAIN_ACTIVE`),
**structured-knowledge ingest** (keyless Wikidata + cross-referenced
authoritative sources — popes, saints, doctors, rites, church documents,
**ecumenical councils**, devotions, Marian titles, and spiritual practices —
published through the same gate, growing each open type toward its target;
two CHURCH_DOCUMENT ingestors, documents + councils, alternate via a
least-recently-used tiebreak so both keep advancing), **daily readings** refresh +
**full-liturgical-year** backfill (a year back so elapsed days are filled too,
plus a year forward; one row per day, so a repeated reading is never stored
twice), **prayer Latin/Greek coverage** (the
deterministic liturgical translation engine builds + publishes any missing
prayer translation, routing only genuine gaps to review), **learning** (memory +
source reputation + confidence calibration + capability scores), **self-model +
code awareness**, the **Intelligence Laboratory** pass, and a **capability-matrix
refresh**. Live discovery (seven methods) grows content beyond the curated base.

This covers **every content type the site offers**. Each public category maps to
a publishable `ChecklistContentType`, and all of them have an extractor, a
content-type profile, a public route, curated content, a content goal, and a
certified extraction skill:

| Site category         | Publishable type              | Site category                 | Publishable type     |
| --------------------- | ----------------------------- | ----------------------------- | -------------------- |
| Prayers / Litanies    | `PRAYER`                      | Liturgy / Liturgical Calendar | `LITURGICAL`         |
| Saints                | `SAINT`                       | Rites                         | `RITE`               |
| Our Lady              | `MARIAN_TITLE` + `APPARITION` | History / Church Documents    | `CHURCH_DOCUMENT`    |
| Doctors of the Church | `DOCTOR`                      | Devotions                     | `DEVOTION`           |
| Popes                 | `POPE`                        | Novenas                       | `NOVENA`             |
| Sacraments            | `SACRAMENT`                   | Chaplets                      | `GUIDE`              |
| Parishes              | `PARISH`                      | Spiritual Life                | `SPIRITUAL_PRACTICE` |
| Guides                | `GUIDE`                       |                               |                      |

…and their **subtypes** — litany / rosary / consecration; common / Marian /
Eucharistic / saint / liturgical prayers; novena day vs full novena; apparition
approval statuses; encyclical / exhortation / constitution / motu proprio /
council documents; catechism + canon-law references; daily / Sunday readings;
solemnity / memorial / feast / optional memorial; pope / saint / doctor /
parish profiles — each carried on the content type via the catalog and rendered
with a generated **subtitle**.

So with a connected database the worker **continuously and autonomously finds,
builds, verifies, publishes, manages, and repairs all of the site's content**,
across every type and subtype. The only catalogued types it does **not** publish
are four that the site has **no pages for** (creed, diocese, religious order,
homepage block); these have no extractor, so the worker reports them MISSING and
files a developer request rather than fabricating coverage — adding them would
mean new public pages + a schema change, which (per the safety mandate) is a
human decision.

### Two valid states — no silent reversion

The worker has exactly two runtime states (`final-brain.ts`); there is no third
"legacy fallback" that makes final decisions when Python fails:

- **`PYTHON_FINAL_BRAIN_ACTIVE`** — the Python brain's `select_action` is the
  final selector; the decision records `finalBrain: "python"`.
- **`PYTHON_BRAIN_UNAVAILABLE_SAFE_DEGRADED_MODE`** — when the brain is
  disabled, unreachable, times out, returns an invalid shape, or selects a
  disallowed/unsafe action, the worker enters safe degraded mode: security
  defense, diagnostics, reporting, maintenance, and known-safe repair only.
  **It does not publish, make new source-trust decisions, or approve sensitive
  Catholic content** — including the curated-ingest publish path, which is now
  gated on `finalBrain === "python"`.

`tests/admin-worker/proof/final-brain-reachability.proof.test.ts` proves the
worker reaches the Python brain, validates the contract, records the final
decision, and on every failure mode falls into safe degraded mode without ever
reverting to a TypeScript final-decision path.

### Certified skills

Each skill (`skills/types.ts`) declares all of: name, purpose, supported content
types + subtypes, inputs, outputs, preconditions, required permissions, risk
level, idempotency key, execution, verification, rollback/repair, retry policy,
failure classifier, success metrics, required tests, brain ops used, safety
gates, and whether human review is required. The **executor** (`skills/executor.ts`)
runs one lifecycle — **preflight → execute → verify → ledger → outcome learning**
— with a bounded retry loop and failure routing (repair / human review /
developer request / circuit breaker). A skill is **never "successful" until its
verification passes**; medium+ risk failures roll back.

The hard rule (enforced by the **Skill Planner**, `skills/planner.ts`): the
worker may only do autonomous operational work through certified skills. The
planner maps a brain decision to an ordered skill plan (a content build expands
to fetch → read → `extract_<type>` → verify → strict-QA → publish → verify
route/sitemap/cache, with a proof-packet step for sensitive Catholic types). If
a required skill is missing, the plan is **not executable** and the worker files
a developer request — it never pretends it can do the task.

The **source, extraction, verification, and publishing packs are certified**,
so the full content build plan runs end to end through certified skills:

- **Source** (`source-skills.ts`): `fetch_static_html`, `fetch_text_document`
  (approved-host fetcher, which now auto-upgrades JS-only pages via the keyless
  headless-browser fetcher), `read_source_page` (structured blocks),
  `detect_dynamic_page` (detects JS-only pages; the dynamic fetcher renders them
  automatically, so `request_dynamic_fetcher_upgrade` files a developer request
  only when no browser is available), `classify_fetch_failure`.
- **Extraction** (`extraction-skills.ts`): one `extract_<type>` per content type
  backed by a real extractor, wrapping the deterministic `extractByType`.
- **Verification** (`verification-skills.ts`): 13 real gates — required fields,
  citations, source + Catholic authority, claims, epistemic status, duplicate
  safety, communion risk, route/schema/UI support, ontology links, and the
  sensitive-content proof packet.
- **Publishing** (`publishing-skills.ts`): `run_strict_qa`, `publish_content`
  (the single Publish Orchestrator path — full safety + ten-dimension quality +
  proof-based publishing; high-risk with a real unpublish rollback),
  `verify_public_route` / `verify_search_index` / `verify_sitemap` /
  `verify_cache`, and `rollback_publish`.

The **repair, homepage, reporting, security, and maintenance packs are also
certified** — **114 certified skills** across all nine categories (including the
**discovery** pack — `discover_from_sitemap` / `_rss` / `_internal_links` /
`_configured_urls` / `_directory_page` / `_search_page` + `request_dynamic_
fetcher_upgrade` + **`discover_parishes_via_maps`** (Google Maps parish discovery
with a communion-with-Rome website check — see below) — and the **PDF** pack —
detect / fetch / classify / verify PDFs for real, and now **read them**:
`extract_text_pdf` / `extract_vatican_pdf_document` fetch the document and pull
its text with the runtime's dependency-free zlib extractor
([`pdf-extract.ts`](src/lib/admin-worker/pdf-extract.ts)); only a scanned or
encrypted PDF that yields no usable text falls back to a specific OCR developer
request):

- **Repair** (`repair-skills.ts`): infra repairs flag a real cache / sitemap /
  search refresh; content-field repairs file a durable, targeted repair plan the
  orchestrator executes.
- **Homepage + reporting** (`homepage-skills.ts`): `create_homepage_draft` runs
  a real makeover and files an AWAITING_REVIEW draft to preview / publish /
  discard (the live homepage is never mutated autonomously); refresh + verify
  daily readings; `generate_developer_report` / `generate_monthly_report` /
  `run_diagnostics`.
- **Security + maintenance** (`security-skills.ts`, `named-skills.ts`):
  `run_security_defense` plus database / brain / public-site / admin-surface
  health checks, stale-job cleanup, repair-plan closure, capability-matrix
  refresh, and **`ensure_prayer_translations`** — which gives every published
  prayer and litany both Latin and Greek via the deterministic liturgical
  translation engine first, then the AI/Google fallback for the remainder
  (`runMaintenance` runs it through the certified runtime each pass; the machine
  fill auto-publishes by default with `machineTranslated` provenance, or routes to
  review when `TRANSLATION_AUTOPUBLISH_MACHINE=0`). Most are allowed in safe
  degraded mode.

**Content subtitles** are generated, stored, and rendered: a deterministic
`generateContentSubtitle` produces an accurate type/subtype-aware subtitle
(Doctor → "Bishop, Doctor of the Church"; encyclical → "Encyclical of Pope Leo
XIII"), `PublishedContent.subtitle` (migration `0047`) stores it, the
`publish_content_subtitle` skill writes it during the build, and
`PublishedDetail` renders it under the title.

The **skill orchestrator** (`runSkillPlan`) is the dispatcher's skill-execution
path: it asks the planner for a certified plan, runs each step through the
executor + Prisma deps (preflight → execute → verify → ledger → feedback), and
stops safely on the first failure — an e2e proof drives a full prayer
source-to-page build through certified skills and records every step to the
ledger, blocks a non-executable plan rather than faking it, and routes a publish
"review" result to human review without publishing. The live dispatcher itself
consults the planner on every stage and records the certified-skill plan (which
stages route through certified skills, which still need one), so the dashboard
and Developer Audit show real coverage; the per-stage internals are migrated to
the executor incrementally so the heavily-tested publish path is never regressed.

Anything still without a certified skill (PDF _text extraction_ / OCR, a dynamic
fetcher, and the content types with no extractor — creed, diocese, religious
order, homepage block) is reported **MISSING** and a developer request is filed,
rather than overstating what the worker can do. A **no-placeholder enforcement**
test proves
every certified skill has real preflight / execution / verification / declared
tests, and that the matrix never marks a capability CERTIFIED without a
resolvable skill. The worker registers the skills and refreshes the capability
matrix on every pass, so the dashboard and Developer
Audit always reflect live coverage.

### Durable ledger + capability matrix (Postgres)

Migration `0046` adds two tables:

- **`AdminWorkerSkillExecution`** — one row per skill execution attempt
  (preflight / execution / verification / rollback status, risk, idempotency
  key, attempt count, duration, failure reason, brain op, output entity).
  Auditable + replayable; loose-coupled string refs to the pass / decision /
  task / entity.
- **`AdminWorkerSkillCapability`** — the coverage matrix: one row per capability
  with `coverageStatus` (`CERTIFIED` / `PARTIAL` / `MISSING` / `BLOCKED` /
  `REQUIRES_HUMAN_REVIEW` / `REQUIRES_DEVELOPER_WORK`), the certified skill,
  success/verification rates, rollback availability, and the developer request
  filed for a gap.

### Admin surface + proof

`/admin/skills` is the **Certified Admin Skill Runtime dashboard**: the
final-brain state, coverage summary, per-content-type coverage, the blocked
types (with developer requests filed), the certified-skill catalogue, and recent
skill executions from the ledger. The **Developer Audit PDF** has a matching
**Certified Admin Skill Runtime** section (the Worker Capability Report:
certified vs missing vs blocked counts, per-content-type coverage, and recent
ledger executions). `npm run admin-worker:proof:skills` proves the runtime —
final-brain reachability, no silent reversion, safe-degraded publish blocking,
the skill lifecycle (preflight/execute/verify/rollback/retry/idempotency/circuit
breaker), the ledger + capability matrix, missing-skill developer requests,
sensitive-content proof requirement, the end-to-end source-to-page build plan,
and honest coverage — and runs in `npm run verify:all`.

> **Aesthetic consistency.** Every selected filter across the app (the shared
> `FilterChips`, the admin log tabs, the language / rosary toggles) now fills
> with the action/Marian blue (`--action-blue`, via the `vf-filter-active`
> utility), so "selected = blue" is uniform site-wide.

---

## Public site

Every public page renders directly from `PublishedContent`:

```
/prayers              → PublishedContent where contentType=PRAYER
/litanies             → PRAYER where prayerType=litany (a view of /prayers)
/saints               → PublishedContent where contentType=SAINT
/our-lady             → PublishedContent where contentType=MARIAN_TITLE or APPARITION
/doctors              → PublishedContent where contentType=DOCTOR
/popes                → PublishedContent where contentType=POPE
/sacraments           → PublishedContent where contentType=SACRAMENT
/parishes             → PublishedContent where contentType=PARISH
/spiritual-life       → PublishedContent where contentType=SPIRITUAL_PRACTICE
/devotions            → PublishedContent where contentType=DEVOTION
/novenas              → PublishedContent where contentType=NOVENA
/guides               → PublishedContent where contentType=GUIDE
/liturgy              → PublishedContent where contentType=LITURGICAL
/liturgical-calendar  → computed General Roman Calendar (per selected rite)
/liturgy/readings     → internal daily Mass readings (DailyReading; ?date=…)
/rites                → PublishedContent where contentType=RITE
/history              → CHURCH_DOCUMENT as a chronological timeline
/church-documents     → PublishedContent where contentType=CHURCH_DOCUMENT
/liturgy-history      → LITURGICAL + CHURCH_DOCUMENT slugs (same /[slug] route)
/search?q=...         → full-text search across PublishedContent
/api/prayers?take=N   → public list endpoint (clamped at 200)
```

The top navigation groups these as **Home · Prayers · Saints · Sacraments ·
Guides · Liturgy · History**, with dropdowns (desktop) and inline expanders
(mobile) for the grouped tabs (Saints → Our Lady / Doctors / Popes;
Sacraments → Parishes / Spiritual Life; Liturgy → Liturgical Calendar /
Rites; History → Church Documents).

**Liturgical languages (Latin / Greek).** Every prayer, **litany**, and guide
carries its vernacular text plus authentic, verbatim **Latin** and **Greek**
liturgical text (`payload.latin` / `payload.greek`). `buildPrayerVariants`
(`content-shared/prayer-language.ts`) flattens these into the
`PrayerLanguageToggle`. The toggle is **Latin/Greek-only**: the vernacular is
the implicit default and gets **no chip** — only Latin and Greek are offered, and
re-selecting the active chip (or never choosing one) falls back to the
vernacular. The choice is session-persisted, so picking Latin once opens every
prayer that has it in Latin. Latin/Greek are marked `translate="no"` so device or
auto-translation never rewrites the verbatim sacred text.

The worker **builds these translations itself** through a deterministic
**liturgical translation engine**
([`admin-worker/prayer-translator.ts`](src/lib/admin-worker/prayer-translator.ts))
that emits **only the Church's received text** — no AI, no network on this path.
It folds a prayer's English and matches it against the curated corpus
([`knowledge/prayer-translations.ts`](src/lib/checklist/knowledge/prayer-translations.ts)
— Pater Noster / Ave Maria / Gloria Patri in both languages, plus the Creeds,
Salve Regina, Memorare, Anima Christi, St Michael, Confiteor, Magnificat, Te
Deum, Sub Tuum Praesidium's ancient Greek, the Angelus, Come Holy Spirit, the
Acts, …) and emits that prayer's verbatim Latin/Greek, or it assembles a
composite devotion from authoritative segments (the doxologies, the stock litany
responses and closings — `Per Christum Dominum nostrum. Amen.`, `Ora pro nobis.`,
`Kyrie, eleison.`, `Agnus Dei, qui tollis peccata mundi, miserere nobis.` — and
the embedded sub-prayers). It reports honest coverage and **never fabricates**:
when no authentic received form is derivable it emits nothing and returns the
unresolved lines, rather than guessing declensions or inventing a sacred text.

**Every prayer and litany ends up with both Latin and Greek.** Per the site
owner's directive, the worker uses the official/received text first and, for the
long tail the corpus can't resolve, fills the remaining gap with a **machine
translation** so no prayer or litany is left without a Latin or Greek text. The
fallback
([`admin-worker/translation-provider.ts`](src/lib/admin-worker/translation-provider.ts))
tries three providers in order of quality: an OpenAI-compatible AI endpoint
(preferred — it can be steered to the ecclesiastical/liturgical register; a
single AI key under either `TRANSLATION_AI_*` or `EXTRACTION_AI_*` powers both),
then a keyed Google Translate (`GOOGLE_TRANSLATE_API_KEY`), then a **keyless**
Google translate endpoint that needs **no API key at all** — so Latin/Greek
coverage now completes out of the box with zero configuration. The keyless
provider translates the **exact stored prayer text word-for-word** (chunked on
line boundaries to preserve structure) and is on by default
(`ADMIN_WORKER_KEYLESS_TRANSLATE=0` opts out; `ADMIN_WORKER_SKIP_NETWORK=1`
forces it off). The authentic corpus is **always tried first** and is the only
source that can be mistaken for received text; machine fills are recorded with
`source:"machine"` / a `machineTranslated` payload marker so they stay auditable
and a curator can later verify or correct them. Machine drafts **auto-publish by
default** to complete coverage; set `TRANSLATION_AUTOPUBLISH_MACHINE=0` to instead
route them to the `HumanReviewQueue` for confirmation before they go live. Even
with no key configured the keyless endpoint completes the long tail; if the
keyless path is also disabled, the authentic corpus still covers everything it
can and the genuine remainder is surfaced for review — the worker never stalls
and never silently drops a gap. The keyed register caveat applies: the keyless
machine output is modern Latin/Greek, flagged `source:"machine"` for later
review, so add an AI/Translate key when you want the received liturgical wording.

The engine is wired into the worker three ways, all running autonomously:

- The **Publish Orchestrator** auto-fills the authentic Latin (and Greek where it
  exists) on **every** prayer publish, so a prayer ships with its language toggle
  already populated "as if it had it".
- The **`runPrayerTranslationBackfill`** pass runs on **every loop pass**
  (throttled ~hourly, cursor-walked across the whole catalogue so it never
  re-does finished prayers and never gets stuck): authentic corpus first, then the
  machine fallback (auto-filled by default, or routed to review when opted out).
  Covers litanies (published as `PRAYER` with `prayerType:"litany"`) and both
  languages.
- The **`ensure_prayer_translations`** maintenance skill backfills
  **already-published** prayers and litanies each maintenance pass (guides inherit
  coverage from the prayers they reference) through the **certified skill runtime**
  (ledger + verify).

Latin covers the whole canonical corpus + composites; Greek covers the authentic
received forms first and is then completed by the configured translation
provider — sacred texts are never guessed onto a live page without that machine
provenance recorded for review.

**Guide prayers.** Every guide (Rosary, Divine Mercy Chaplet, Confession, …)
lists its applicable prayers at the bottom in the order they are prayed, each a
**dropdown** (`GuidePrayers` + `Disclosure`) so the full text is readily
available, with **one universal Latin/Greek toggle** that switches every prayer
at once (defaulting to the vernacular when neither is selected).

**Sharing.** Every content card carries a **Share** control
([`ui/ShareButton.tsx`](src/components/ui/ShareButton.tsx)) — a hand-drawn
box-with-upward-arrow share glyph (stroked in the same sketched style as the
crucifix favicon) to the left of the word "Share", placed beside the Save
control in the card header (and centred under the title on the daily-readings
page). On a device with the Web Share API it opens the native share sheet; on
everything else it copies the page link and briefly confirms "Link copied". It
shares the current card — no account required. Each public detail page also
exports `generateMetadata` (via `buildPublishedMetadata`) so a shared link
unfurls with that card's own title and summary plus a **branded share image**:
a dynamic Open Graph card ([`app/api/og`](src/app/api/og/route.tsx), built on
`next/og`) showing the **crucifix mark with the content item's own title in it**
(e.g. "Litany of Humility") and a "VIA FIDEI · <type>" label, set as both the
`og:image` and the `summary_large_image` `twitter:image`. The image is
self-contained (the favicon inlined as a data URI, `next/og`'s built-in font)
and falls back to the static crucifix asset on any error, so a shared link never
unfurls broken or as the browser's generic page icon. The root layout supplies a
default branded card for non-content pages and an `apple-touch-icon` so the
small-icon fallback is the crucifix too.

**Source attribution.** Content cards no longer print an "Approved sources" /
"Sources" citation list at the bottom — the worker's verification provenance
lives in the admin surfaces (checklist, artifacts, audit), not on the reader
page. The **one exception is the daily-readings page**, which keeps its modest
"Source: …" link (the authoritative liturgical source for that day's readings),
so a reader can always go to the official text.

**Category filters.** Content-rich tabs split their items into the Church's
natural groupings via URL-driven filter chips (`?filter=…`, the shared
`FilterChips` component + `src/lib/content-shared/*-categories.ts`): Saints by
type, Guides by kind (**Chaplets** surfaces the Divine Mercy Chaplet), Rites by
family (Latin / Eastern), Liturgy by kind, Spiritual Life by practice, Our Lady
by titles/apparitions, Church Documents by category (incl. Dogmas), and
Parishes by designation. Each tab only shows a chip when at least one published
item falls under it.

The **Saints** filters are the Church's groupings that don't already have their
own tab — Martyrs, Apostles & Evangelists, Popes, Bishops, Religious & Founders,
Virgins, Laity. **Doctors of the Church and Our Lady are deliberately not Saints
filters** (each has its own `/doctors` and `/our-lady` tab): a doctor-saint still
appears in the Saints catalogue under "All", and Marian titles + apparitions live
only under Our Lady — so the Saints filters never duplicate a dedicated tab.

**Collapsing long filter rows.** `FilterChips` keeps three or fewer filters as
inline chips, but once a tab offers **more than three** it collapses them into a
single **dropdown filter button** (`collapseAfter`, default 3) so the row never
clutters the page. The button shows the active filter (filled blue) or "Filter"
when nothing is selected; opening it lists every option, choosing one fills it
blue and closes the panel, and re-selecting the active one deselects it (back to
"All"). It works in both link mode (server pages) and client mode (favorites,
history); the reset/all key is excluded from the count via `resetKey`.

**Daily readings.** The Liturgical Calendar's "Official Mass readings for this
day" button links to the **internal** `/liturgy/readings?date=…` page, not an
external site. The page shows the exact celebration, the readings in
proclamation order (public-domain Douay-Rheims for covered days), and a modest
source link at the bottom. The worker keeps it current with
`maybeRefreshDailyReadings` (today) **and** `maybeBackfillDailyReadings` (a
rolling ~year-ahead window, re-verified + self-corrected each scan); any day not
yet covered resolves on-demand to the framing + the official source link, never
fabricated text.

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

The Python intelligence brain has its own deterministic test suites
(stdlib only — no pip installs):

```bash
npm run brain:test       # python3 -m unittest (core, every op, the stdio protocol)
npm run brain:selftest   # every op produces a valid envelope
```

The TS↔Python bridge and the full TS→Python→Postgres loop are covered by
`tests/admin-worker/intelligence/bridge.test.ts` (unit; brain spawns are
opt-in) and `tests/integration/intelligence.test.ts` (integration, needs a
test Postgres). The unit suite defaults `INTELLIGENCE_BRAIN_ENABLED=0` for
determinism; brain-specific tests opt back in. Integration tests run with
`VITEST_INTEGRATION=1` + `TEST_DATABASE_URL`.

### Admin Worker proof gate

```bash
npm run admin-worker:proof                    # full gate: prisma validate + typecheck + lint
                                              #   + unit/integration/full-pipeline tests
                                              #   + no-placeholder tests
                                              #   + offline brain dry run + content-growth proof
npm run admin-worker:proof:content            # one content item through all 16 pipeline stages
npm run admin-worker:proof:all-content-types  # one full pipeline proof per content type (real extractor)
npm run admin-worker:proof:security           # 5 defender flows (login email, threshold, ban, mutation, reuse)
npm run admin-worker:proof:reports            # Developer Audit generates + required sections + secret redaction
npm run admin-worker:proof:live               # back-half proof against a REAL DB: extract → publish a prayer
npm run admin-worker:proof:autonomy           # FULL autonomous loop vs REAL DB + REAL HTTP (local mirror)
npm run admin-worker:proof:dry-run            # full chain → publish DECISION, explained, nothing published
npm run admin-worker:no-placeholders          # build fails on unresolved implementation language
npm run worker:dry-run                        # offline brain action-ranking across synthetic worlds
npm run verify:all                            # complete local verification: prisma validate/generate +
                                              #   brain selftest/tests + typecheck + lint + no-placeholders +
                                              #   unit tests + content/all-types/security/reports proofs + dry-run
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
- **Single-content-path guards** — `runPublishOrchestrator()` is the only
  publish writer and every recent public row traces to an artifact
  (`production-mandates.test.ts`, readiness checks); no dispatcher handler
  only logs without doing work (`dispatcher-no-placeholder-stages.test.ts`);
  every stage returns the full §3.4 result shape
  (`dispatcher-outcome-shape.test.ts`); source reputation updates after all
  ten stages (`source-reputation-stage-coverage.test.ts`); content funnel +
  bottleneck (`content-growth-monitor.test.ts`).
- **Checklist foundation** — slug canonicalization, the authority source
  registry, the build-intent queue (`enqueueBuild`), bulk source curation
  (verify / reject), the curated knowledge base, content-schema
  compliance, the janitor, and the master checklists.
- **App-wide** — API, auth, security, components, data, email,
  observability, i18n, cache test suites.

Total: **2195 passing tests across 273 test files**.

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

| Migration                                          | What it added                                                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001` – `0022`                                    | Original schema (auth, content, ingestion, …)                                                                                                                  |
| `0023_checklist_first_architecture`                | Checklist-first models (ChecklistItem, …)                                                                                                                      |
| `0024_admin_worker`                                | Admin Worker engine tables (15 + enums)                                                                                                                        |
| `0025_drop_legacy_system`                          | Dropped 30+ legacy tables, consolidated UserSaved\* into UserSavedContent                                                                                      |
| `0026_admin_worker_brain`                          | Brain tables: SourceRead, PipelineStage, RepairPlan                                                                                                            |
| `0027_admin_worker_brain_ranking`                  | Brain ranked alternatives + AdminWorkerFetchResult / SourceBlock / CrossSourceVerification                                                                     |
| `0028_admin_worker_pipeline_and_orchestrators`     | Pipeline durability + candidate scoring fields + SourceCoverage + GrowthSnapshot                                                                               |
| `0029_admin_worker_package_artifact`               | AdminWorkerPackageArtifact (built package as a first-class artifact)                                                                                           |
| `0030_admin_worker_strict_qa`                      | AdminWorkerStrictQAResult (durable strict-QA per artifact)                                                                                                     |
| `0031_admin_worker_repair_kinds_strict_qa_quality` | Added STRICT_QA_FAILED + QUALITY_SCORE_FAILED repair kinds                                                                                                     |
| `0032_admin_worker_source_coverage_active_counts`  | SourceCoverage: active / recently-successful / recently-failed source counts                                                                                   |
| `0033` – `0037`                                    | Action-score + reasoning-graph tables; parish / pope / doctor / rite content types                                                                             |
| `0038_intelligence_memory_graph`                   | Intelligence brain store: Embedding (vectors), GraphNode/GraphEdge, DeveloperRequest, BrainCall                                                                |
| `0039_daily_readings`                              | DailyReading (daily liturgical readings as internal content)                                                                                                   |
| `0040_stage_outcomes_rollback_quality_v2`          | AdminWorkerStageOutcome + AdminWorkerRollbackLedger; full ContentQualityScore model; action `fallbackAction`; PublishedContent `contentChecksum`               |
| `0041_drop_legacy_qa_buildlog_version_relation`    | Dropped the legacy WorkerBuildLog / ChecklistQAReport / ChecklistVersion / ChecklistRelation tables (superseded by AdminWorkerStrictQAResult + AdminWorkerLog) |

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
