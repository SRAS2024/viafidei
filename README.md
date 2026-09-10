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
any AI APIs**.

**Four pieces, and where each one runs.** The **Next.js app** is deployed on
**Railway** and serves every public page, authentication, sessions and the
lightweight APIs. **Postgres** (also on Railway) is the single source of truth —
published content, the worker's long-term memory, the knowledge graph and the
audit ledger. A permanent **Python "brain"** ([`intelligence/`](intelligence/))
does the reasoning: pure-stdlib, deterministic, no AI APIs and no network, held
open as a resident process and consulted on every meaningful decision. And the
**Admin Worker** — the body that actually fetches, extracts, verifies and
publishes — runs **on the operator's Mac**, not on the server, launched by a
native application whose toolbar carries the one master switch that turns the
whole system on and off. Railway never runs the loop. See
[Admin Worker execution host](#admin-worker-execution-host--the-operators-mac).
There is also a native **iPhone companion** ([`ios/`](ios/)) carrying the same
three views, but it is a remote control rather than a fifth piece: it writes
one durable row and the Mac does the work — see
[The iPhone companion](#the-iphone-companion--a-remote-control-that-never-runs-the-worker).

With a fresh database the Admin Worker fills the site by itself: it ranks the
next safest action, discovers Catholic sources across eight discovery methods
(including open keyword web-search), fetches and reads pages into structured
source blocks, classifies content with confusion detection, builds complete
package artifacts, fetches validation pages from higher-authority hosts to
verify sensitive facts, runs strict QA as a durable artifact-level stage, scores
quality across ten dimensions, publishes through a single Publish Orchestrator
path, independently verifies search + sitemap + cache, repairs failed stages
with real handlers (not just logging), rolls back via an explicit decision tree
(repair → unpublish → log-deletion → human review), defends the admin surface
(without harassing the valid admin), **maintains itself** (see
[Self-maintenance](#self-maintenance)), and emails a monthly operations report.

The Python brain is consulted for **final action selection**, planning +
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

**Where things run.** Railway is the public home and the durable store; the
operator's Mac is the Admin Worker's body and brain host; Postgres is the
worker's long-term memory and the application's source of truth; the native
Via Fidei application is the worker's command center and power switch. See
[Admin Worker execution host](#admin-worker-execution-host--the-operators-mac).

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
  mode** (`PYTHON_BRAIN_UNAVAILABLE`), and **never** falls back to an older
  TypeScript final-decision path. If the brain crashes / times out / mismatches
  protocol it is marked down, but **re-probes and self-heals** after a short
  cooldown (`INTELLIGENCE_DOWN_RETRY_MS`, default 60 s) so a transient outage
  can't pin the worker degraded for the process lifetime.
- **Degraded mode still publishes already-vetted content — the deterministic
  funnel is the quality gate, not the brain's availability.** The Python brain is
  the intelligent _action selector_ (what to work on next) and the approver of
  new source-trust + doctrinally-sensitive content — it is **not** a per-item
  publish veto. So content that has cleared the deterministic pipeline (strict
  7-dimension QA + stored cross-source evidence + the publish orchestrator's own
  gates) **publishes even when the brain is degraded**. Without this, a Python
  outage silently stalls _all_ publishing while extraction keeps building — the
  recurring `EXTRACTING_WITHOUT_PUBLISHING` failure. The only safe-degraded
  carve-out on publishing is **doctrinally-sensitive content**
  (`APPARITION` / `SACRAMENT` / `CHURCH_DOCUMENT`), which still waits for the
  active brain; parishes (deterministically verified) and every other type keep
  flowing.

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
`EmailVerificationToken`, and the two tables behind the interactive admin
sign-in — `AdminSession` and `AdminTwoFactorChallenge` (see
[Two-factor admin sign-in](#two-factor-admin-sign-in) and
[Admin sessions](#admin-sessions)). Those two are read and written through
**parameterised raw SQL** rather than the Prisma client, because a generated
client may not know about a table its migration only just created. The models
are still declared, so the schema tells the truth about the database — without
them a later `prisma migrate dev` would see an unknown table and generate a
`DROP` — and so `scripts/validate-db.js` can pin them at boot: a missing table
here locks the administrator out of a **running** site rather than failing a
deploy. (The
heartbeat-unification transition is complete:
worker liveness is read solely from `AdminWorkerState.lastHeartbeatAt`; the
legacy `WorkerHeartbeat` dual-write and its diagnostics rating were removed.)

See `prisma/schema.prisma` for the full definitions.

---

## Running locally

**Prerequisites:** Node.js 20–22 (the `engines` field pins `>=20 <23`),
PostgreSQL 14+ (16 recommended), and — for the intelligence brain —
Python **3.10+** (the brain uses `@dataclass(slots=…)`, which is 3.10+; the
project targets 3.11). On macOS the system `python3` is 3.9, so install a
newer one (`brew install python@3.11`) and point the worker at it with
`INTELLIGENCE_PYTHON=/opt/homebrew/opt/python@3.11/bin/python3.11`. The
worker still runs without the brain (deterministic fallbacks), but the
content-growth lanes only fire when the brain is active, so a working
`python3.10+` is required for autonomous content growth.

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

# Run the Admin Worker in another terminal. It executes on THIS machine — the
# plain `npm run worker` entry point refuses to run (see Worker entry point).
npm run worker:local

# …or run the full local host + Admin Worker command center (what the native
# Via Fidei application launches when the green pill is switched ON):
npm run worker:host

# Refresh today's daily readings (the worker also does this on a schedule)
npm run readings:refresh

# Exercise the Python intelligence brain (needs python3 on PATH)
npm run brain:selftest
npm run brain:test
```

That is the **local development** recipe, against a local Postgres. It is not how
the worker runs against production: for that the operator links the checkout to
Railway and launches the native app, which resolves the production database and
refuses to start against a local one — see
[Admin Worker execution host](#admin-worker-execution-host--the-operators-mac).

The intelligence brain needs `python3` (**3.10+**, stdlib only — no pip
installs; the project targets 3.11). Set `INTELLIGENCE_PYTHON` when the
default `python3` on PATH is older than 3.10 (e.g. macOS ships 3.9). When no
suitable Python is present the worker still runs and uses its deterministic
fallbacks, but the content-growth lanes stay idle (they only fire when the
brain is active), so autonomous growth needs the brain online.

Required environment variables (production):

| Variable         | Purpose                            |
| ---------------- | ---------------------------------- |
| `DATABASE_URL`   | Postgres connection string         |
| `SESSION_SECRET` | 32+ char iron-session secret       |
| `ADMIN_USERNAME` | Admin console username             |
| `ADMIN_PASSWORD` | Admin console password (12+ chars) |

Optional environment variables:

| Variable                                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`                                        | Enables transactional + admin emails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ADMIN_EMAIL`                                           | Destination for Admin Worker monthly + security emails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PUBLIC_BASE_URL`                                       | Base URL the post-publish probe + verifiers fetch from                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `WORKER_ID`                                             | Stable id for this worker process (auto-generated)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ADMIN_WORKER_SKIP_NETWORK`                             | Test-only: dispatcher skips real fetch + read calls when `1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ADMIN_WORKER_DISABLE_LIVE_PROBE`                       | Local/dry-run only: skip the mandatory production live sitemap + cache probe when `1` (verification is otherwise live + fail-closed in production)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ADMIN_WORKER_OPEN_INTERNET`                            | Lets the worker fetch sources beyond the registry (any diocese, conference, EWTN, database, accurate site) and follow links across the open web. Accuracy is still enforced by cross-source verification + strict QA; local/social/commerce hosts stay blocked. On by default; set `0`/`false`/`off` to restrict to the registry                                                                                                                                                                                                                                                                                                                                         |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`     | OPTIONAL higher-volume/quality upgrade for open keyword web-search discovery (Google Programmable Search). Web search is keyless by default (DuckDuckGo); set these to use Google instead. The worker queries per content type to find sources nothing it knows links to                                                                                                                                                                                                                                                                                                                                                                                                 |
| `BING_SEARCH_API_KEY`                                   | OPTIONAL alternative keyed search provider (Bing Web Search). Web search is keyless by default; this is only a quality/volume upgrade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ADMIN_WORKER_KEYLESS_WEB_SEARCH`                       | Keyless open web search via DuckDuckGo — on by default, no API key. Lets the worker discover sources nothing it already links to (feeds parishes + every content gap). Results still pass the full pipeline (host filter → classify → cross-source verify → strict QA). Set `0`/`false`/`off` to disable; forced off by `ADMIN_WORKER_SKIP_NETWORK=1`                                                                                                                                                                                                                                                                                                                    |
| `INTELLIGENCE_BRAIN_ENABLED`                            | Python intelligence brain on/off (default on; `0` disables)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `INTELLIGENCE_PYTHON`                                   | Python executable for the brain (default `python3`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `INTELLIGENCE_TIMEOUT_MS`                               | Per brain-call timeout (default `8000`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GOOGLE_PLACES_API_KEY`                                 | Enables Google Maps parish discovery (Places API). Unset → the `discover_parishes_via_maps` skill is a no-op                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PARISH_DISCOVERY_LOCATIONS`                            | Optional `;`-separated localities to search for parishes (e.g. `Boston, MA; Rome, Italy`). Unset → seeds derive from the cities already in the catalog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ADMIN_WORKER_OSM_PARISHES`                             | Keyless OpenStreetMap (Overpass) parish discovery — on by default; the path used when `GOOGLE_PLACES_API_KEY` is unset. Set `0`/`false`/`off` to disable. A persistent **tile-grid sweep** of the Catholic world, with the full set of politeness and budget knobs documented under [Finds parishes keyless via OpenStreetMap](#what-it-does)                                                                                                                                                                                                                                                                                                                            |
| `OVERPASS_ENDPOINTS`                                    | **Extra Overpass endpoint(s)** for OSM parish discovery (comma-separated), tried **before** the built-in public mirrors (`overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee`). The public instances are individually unreliable, so prepending your own (a self-hosted or paid Overpass) is what makes parish growth deterministic                                                                                                                                                                                                                                                                                                                     |
| `ADMIN_WORKER_ALWAYS_ON_DISCOVERY`                      | Always-on web scanning — on by default. Runs the full discovery orchestrator (all 8 methods, incl. open-web keyword search + cross-host crawl) on **every** pass (throttled), not only when the brain picks the DISCOVERY stage, so the worker is constantly finding new sources and the fetch/extract pipeline never starves for candidates. Set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                           |
| `ADMIN_WORKER_DISCOVERY_SWEEP_MS`                       | Throttle interval (ms) for the always-on discovery sweep (default `300000` = 5 min)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ADMIN_WORKER_LITURGICAL_API`                           | Keyless Liturgical Calendar ingest (the open Liturgical Calendar API → General Roman Calendar feasts of the Lord + solemnities) — on by default; set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ADMIN_WORKER_ARCHIVE_FALLBACK`                         | Keyless Internet Archive (Wayback Machine) fetch fallback — when a live fetch 404s, errors, or hits a login wall, the worker serves the most recent archived snapshot of that exact URL instead of parking the artifact in repair (`finalUrl` honestly shows web.archive.org). On by default; set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                                                                           |
| `ADMIN_WORKER_DYNAMIC_FETCHER`                          | Keyless dynamic (JS-rendering) fetcher — when a fetched page is a JavaScript-only shell with no usable text, the worker re-renders it in a headless Chromium so client-rendered sources flow through the normal pipeline. No API key (the worker image ships Chromium). On by default; fully fail-open (no-op where no browser is available); set `0`/`false`/`off` to disable                                                                                                                                                                                                                                                                                           |
| `ADMIN_WORKER_CHROMIUM_PATH`                            | Optional explicit path to the Chromium binary for the dynamic fetcher. Unset → the worker resolves `PLAYWRIGHT_BROWSERS_PATH` or Playwright's bundled browser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ADMIN_WORKER_DYNAMIC_FETCHER_TIMEOUT_MS`               | Navigation timeout (ms) for the dynamic fetcher (default `15000`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ADMIN_WORKER_DISCOVERY_SEEDER`                         | Keyless structured discovery seeder — queries Wikidata for apparitions / novenas / prayers & litanies (the types whose verbatim or approval-status content needs an approved source, not an abstract) and enqueues their authoritative source URLs (official websites, reference URLs) for the live extraction pipeline, so the content types with no structured ingestor still get fed authoritative sources. Devotions, Marian titles, and spiritual practices now have their own keyless ingestors and are no longer seeded here. Discovery only (every candidate still passes extraction + verification + QA). On by default; set `0`/`false`/`off` to disable       |
| `LITURGICAL_CALENDAR_API_URL`                           | Override the Liturgical Calendar API endpoint (default: the public litcal General Roman Calendar, US adaptation). Any endpoint returning the litcal `{ litcal: [...] }` shape works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` / `NO_PROXY` | **Outbound egress through a proxy.** The worker's code already permits fetching ANY host (open-internet on by default), but Node's `fetch` ignores these standard proxy vars on its own — so in a locked-down deployment that only allows egress via a proxy, every outbound request fails. When any of these is set, the worker installs a proxy-aware global dispatcher at startup (`outbound-network.ts`) so ALL `fetch()` (web fetcher + Wikidata/Wikipedia ingest) routes through the proxy; `NO_PROXY` is honoured. A complete no-op when unset (direct egress). This is how you let the worker "go outbound to anywhere" in a restricted environment              |
| `NODE_EXTRA_CA_CERTS`                                   | Path to a CA bundle to trust — required only when the outbound proxy re-terminates TLS with a private CA (so the worker trusts the proxy's certificate). Set alongside `HTTPS_PROXY` in such deployments                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ADMIN_WORKER_STRUCTURED_LIMIT`                         | Max NEW records the structured (Wikidata) ingest publishes per pass (default `15`). Raise to close a large gap faster (e.g. the 10k SAINT target) when the source is reachable; the per-row Wikipedia fetches run concurrently, so a bigger limit does not linearly slow the pass                                                                                                                                                                                                                                                                                                                                                                                        |
| `ADMIN_WORKER_STRUCTURED_BATCH`                         | Rows the structured ingest fetches from the source per pass before mapping/dedup (default `50`). A wider batch considers more candidates each pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ADMIN_WORKER_OSM_MAX_QUERIES`                          | Tiles the OSM parish lane queries per run (default `1`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ADMIN_WORKER_OSM_MAX_PUBLISH`                          | Max NEW parishes published per OSM run (default `250`), checked before any per-candidate work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ADMIN_WORKER_OSM_OUT_CAP`                              | Max parish elements returned per tile query (default `500`). Hitting the cap marks the tile DENSE, and it is quartered rather than truncated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ADMIN_WORKER_OSM_THROTTLE_MS`                          | Minimum interval between OSM parish runs (default `180000` = 3 min). See also `ADMIN_WORKER_OSM_RUN_BUDGET_MS`, `ADMIN_WORKER_OSM_DAILY_BUDGET`, `ADMIN_WORKER_OSM_MIN_SPACING_MS`, `ADMIN_WORKER_OSM_RESWEEP_DAYS`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ADMIN_WORKER_PARISH_SPRINT_SIZE`                       | Parishes grown per **sprint** before the worker stands down to grow the OTHER content types (default `10000`). PARISH is the largest goal (200k) and grows on its own OSM lane; the sprint scheduler ([`parish-sprint.ts`](src/lib/admin-worker/parish-sprint.ts)) keeps it from starving the rest — grow a sprint, cool down, come back — while still driving hard toward 200k                                                                                                                                                                                                                                                                                          |
| `ADMIN_WORKER_PARISH_SPRINT_COOLDOWN_MS`                | Cooldown after a completed parish sprint, during which the worker focuses the other content types (default `86400000` = 24 h). Overridden automatically: if EVERY other goal is met, parishes run continuously; if PARISH is met, the lane idles                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ADMIN_WORKER_PARISH_VERIFY_LIMIT` / `…_BUDGET_MS`      | Parish websites re-checked for communion per run (default `30`) and the wall-clock budget for that run, kept under the lane watchdog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ADMIN_WORKER_SELF_MAINT`                               | The [self-maintenance](#self-maintenance) sweep — on by default; `0` disables the whole capability. Per-repair switches: `ADMIN_WORKER_SELF_MAINT_TRIM`, `…_SAMPLE`, `…_LANE`, `…_CURSOR`, `…_ARTIFACT`, `…_RESTORE`, `…_ESCALATE`. Cadence: `ADMIN_WORKER_SELF_MAINT_INTERVAL_MS` (default `900000` = 15 min)                                                                                                                                                                                                                                                                                                                                                           |
| `ADMIN_WORKER_EVENT_BUDGET_PER_HOUR`                    | Rows one `eventName` may write per hour before it is sampled (default `120`); `ADMIN_WORKER_EVENT_COOLDOWN_MS` is how long it stays suppressed (default `600000` = 10 min). WARN/ERROR rows are never sampled                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ADMIN_WORKER_LANE_CONCURRENCY` / `…_LANE_TIMEOUT_MS`   | Global lane concurrency cap (default `8`, keep at or below `PRISMA_CONNECTION_LIMIT`) and the default per-lane watchdog (default `120000`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `INTERNAL_API_SECRET`                                   | Bearer token for `POST /api/internal/revalidate` (the worker's cross-process cache flush). Unset ⇒ the `SESSION_SECRET`-derived token is used; with neither configured the route refuses everything                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `SITE_MEMO_DISABLED`                                    | `1` bypasses the public site's in-process memo cache (debugging)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `WIKIDATA_SPARQL_ENDPOINTS`                             | **Fallback SPARQL endpoint(s)** for structured ingest (comma-separated). The canonical Query Service `query.wikidata.org` aggressively rate-limits / blocks datacenter IPs, so on a cloud host it is often unreachable even when `en.wikipedia.org`/`www.wikidata.org` are fine — starving structured bulk ingest. `runSparql` tries `query.wikidata.org` first, then each endpoint here, and the first REACHABLE one wins. Point this at a reachable Query Service mirror or a self-hosted/proxied endpoint to keep structured growth flowing without the canonical host. Unset ⇒ canonical only. (Alternatively set `HTTPS_PROXY` so the canonical host is reachable.) |
| _(no AI extraction/translation env vars)_               | The Admin Worker uses **no external AI API** — no OpenAI/LLM extraction, no AI/machine translation. Extraction is deterministic (typed extractors + structured-data blocks); when a source leaves required fields missing the worker **reroutes to another approved source**, it never invents fields. Latin/Greek is filled only from the internal, keyless, network-free `prayer-translator` corpus (authentic received text); prayers it can't resolve are left as-is. There is intentionally nothing to configure here                                                                                                                                               |
| `ADMIN_WORKER_REQUIRE_HUMAN_REVIEW`                     | **Off by default — the worker is fully independent and never parks work for a human.** Every situation that would otherwise need review gets the worker's own terminal decision: publish when the evidence clears the bar, otherwise SKIP (never publish unverified, never delete on uncertainty) and revisit autonomously. The human-review UI still exists (a human _may_ act), but the worker never depends on it, so the queue never blocks growth. Set `1`/`true`/`on` to restore human-gated review (uncertain items are queued for a person)                                                                                                                      |
| `ADMIN_WORKER_GOVERNOR_ENABLED`                         | Pipeline governor — on by default. Each pass, just before dispatch, it reads the per-stage outcome ledger over a sliding window; if the brain's chosen content stage has spun without forward progress (or growth stalled despite an open gap) it overrides the choice with the highest-priority productive downstream stage, or a terminal diagnostic when nothing downstream is making progress. Only changes which already-gated handler runs (never bypasses QA/publish); acts only in active mode and never when paused. Set `0`/`false`/`off` to disable                                                                                                           |
| `ADMIN_WORKER_GOVERNOR_WINDOW_MIN`                      | Governor sliding-window size in minutes (default `15`) — how far back it looks when judging whether a stage is advancing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ADMIN_WORKER_GOVERNOR_MIN_SAMPLES`                     | How many non-productive runs of a stage in the window before the governor intervenes (default `3`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ADMIN_WORKER_GOVERNOR_MAX_ENTITY_RETRIES`              | How many non-advancing attempts on the same entity (e.g. a poison source read) before it is flagged exhausted in the governor verdict (default `3`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

## Content goals &amp; the largest-gap-first scheduler

Every content type has a growth **target** ([`content-goals.ts`](src/lib/admin-worker/content-goals.ts)); the worker attacks the goal with the **largest gap first** and keeps recognised, verified content flowing past a target rather than treating it as a ceiling. The dominant goal is **PARISH (200,000)**, followed (by design intent) by the **liturgical calendar's daily readings** and **SAINT**.

The repository also ships a hand-verified **curated knowledge base** that seeds
every one of those goals offline. `npx tsx scripts/curated-counts.ts` prints the
live picture (measured 2026-09-07):

| Type                 | Curated in repo |  Target | Grown by                                      |
| -------------------- | --------------: | ------: | --------------------------------------------- |
| `SAINT`              |             190 |  10,000 | curated + structured Wikidata ingest          |
| `PRAYER`             |             241 |   1,000 | curated + web pipeline                        |
| `POPE`               |              94 |     267 | curated + structured Wikidata ingest          |
| `CHURCH_DOCUMENT`    |             137 |     200 | curated + structured (documents + councils)   |
| `GUIDE`              |             103 |     100 | curated only (never web-extracted)            |
| `NOVENA`             |              31 |     100 | curated + discovery-seeded approved sources   |
| `LITURGICAL`         |              98 |     100 | curated + the keyless liturgical-calendar API |
| `DEVOTION`           |              82 |     100 | curated + structured Wikidata ingest          |
| `APPARITION`         |              39 |      50 | curated + discovery-seeded approved sources   |
| `SPIRITUAL_PRACTICE` |              52 |      50 | curated + structured Wikidata ingest          |
| `MARIAN_TITLE`       |              59 |      50 | curated + structured Wikidata ingest          |
| `DOCTOR`             |              37 |      37 | curated (the complete set)                    |
| `RITE`               |              35 |      24 | curated (the recognized rites + sui iuris)    |
| `SACRAMENT`          |               7 |       7 | curated — the one **closed** type             |
| `PARISH`             |              27 | 200,000 | the keyless OpenStreetMap tile sweep          |

**1,232 curated entries**, and six goals (`GUIDE`, `SPIRITUAL_PRACTICE`,
`MARIAN_TITLE`, `DOCTOR`, `RITE`, `SACRAMENT`) are already met by curated
content alone, with no network at all. Only `SACRAMENT` carries a true
`canonicalMax`; every other type is open and keeps growing past its target at a
slower maintenance pace.

Because PARISH is so much larger than the rest, it grows on its own keyless OpenStreetMap lane under a **sprint scheduler** ([`parish-sprint.ts`](src/lib/admin-worker/parish-sprint.ts)) so it never starves the other types:

- grow a **sprint** of parishes (`ADMIN_WORKER_PARISH_SPRINT_SIZE`, default 10,000),
- then **stand down for a cooldown** (`ADMIN_WORKER_PARISH_SPRINT_COOLDOWN_MS`, default 24 h — long enough to let the other types advance, short enough that a 200k goal is reachable) during which the worker drives the other content types (the web-extraction campaign surges on the next-largest **web-growable** gap — saints, church documents, …),
- then return for the next parish sprint, and so on toward 200k.

Two automatic overrides keep it sensible: if **every other goal is already met** the parish lane runs continuously (nothing else to do); if the **PARISH goal itself is met** the lane idles. The structured-knowledge campaign ([`major-goal-campaign.ts`](src/lib/admin-worker/major-goal-campaign.ts)) independently DRAIN→SURGEs the largest web-growable gap, so the non-parish types are always being worked during a parish cooldown.

---

## Admin Worker execution host — the operator's Mac

The Admin Worker is **not** a cloud workload. Its active execution host is the
operator's Mac, through the native **"Via Fidei.app"**:

```
   Railway (web service)        Postgres (Railway)          Mac (Via Fidei.app)
   public site, auth,      ◄──► durable source of truth ◄──► THE ADMIN WORKER
   sessions, user data,         content, worker memory,      TypeScript body +
   lightweight APIs,            knowledge graph, logs,       Python brain +
   request-time security        provenance, artifacts        browser rendering,
                                                             discovery, QA,
   receives results ────────────────────────────────────────  publishing
```

- **Railway runs the website and the database.** It serves public requests,
  authentication, sessions, user data and the lightweight APIs, and it keeps
  every request-time protection (auth, CSRF, headers, validation, rate limits,
  banned devices, the request defender). It does **not** run the autonomous
  loop, the Python brain, Chromium, discovery, verification, homepage analysis,
  worker reports or worker email.
- **The Mac runs the worker.** Discovery, crawling, rendering, parsing,
  reasoning, extraction, verification, classification, comparison, formatting,
  security analysis, document processing and report generation all consume this
  machine's CPU, memory, disk and internet connection.
- **Postgres stays the long-term memory.** Shutting the Mac down does not erase
  what the worker learned; switching it back on resumes from the durable state.

### One-time setup

```bash
npm install                          # the app launches the worker from this repo
npx playwright install chromium      # headless rendering for JavaScript-only sources

railway login                        # authenticate the Railway CLI once
railway link                         # choose environment "production", service "viafidei"

bash scripts/desktop-app/install.sh  # install/update the app, leaving exactly one copy
open "$HOME/Desktop/Via Fidei.app"
```

`railway login` + `railway link` are what make the worker write to **production**
rather than to whatever a local `.env` happens to name. This is not a nicety: for
thirty days the worker published nothing to production because the desktop
launcher fell back to the repository `.env` and wrote to a **local** Postgres,
while every dashboard reported an active, healthy worker. The launcher now
refuses that outcome outright (see [The database preflight](#the-database-preflight)).

`install.sh` is the whole install step: it quits a running instance, removes
every other `Via Fidei*.app` copy it can find (Desktop, Downloads,
`~/Applications`, `/Applications`, Documents), builds a fresh universal bundle
from the checkout, then verifies the result and refuses to finish unless exactly
one copy exists. `build.sh` remains available when you just want a bundle
somewhere without touching what is installed.

Run it from **Terminal.app**: macOS App Management stops one program from
replacing another program's bundle, so a terminal (or IDE) needs that permission
under System Settings → Privacy & Security → App Management — and because the
grant only applies to a newly launched process, quit and reopen the terminal
after enabling it. The script says exactly this if it is blocked.

The Chromium step is optional — everything else works without it — but until it
is done, sources that render their text client-side fall back to their static
shell. The command center says so explicitly (`Browser rendering: unavailable`)
rather than reporting the capability as present, and the worker files a
developer request for the gap instead of silently abandoning those sources.

The app builds a **universal binary** (arm64 + x86_64), so the bundle runs on
Apple Silicon and Intel Macs, and it finds Node through Homebrew, the official
installer, nvm, volta, fnm, asdf or `n`. It looks for the repository in the path
baked in at build time, then `~/Desktop`, `~/Documents`, `~/Developer`,
`~/Projects`, `~/src`, `~/code`, `~/repos` and `~` — and if it still cannot find
one it opens a folder picker rather than sitting there. The repository path can
be changed from the app's **Admin Worker → Choose Repository Folder…** menu.

The app talks to the local runtime over **127.0.0.1 only**, on an ephemeral
port, with a token generated per launch and handed to the app on stdout.
Nothing is exposed to the internet and no credential is stored in the app or the
WebView.

### How the launcher resolves the database

[`scripts/desktop-app/launch-worker-host.sh`](scripts/desktop-app/launch-worker-host.sh)
starts the host under `railway run`, so the linked service's variables are
injected into the process for its lifetime and **nothing is written to disk**.
Railway stays the single source of truth; there is no second copy of production
secrets on the laptop.

One thing `railway run` cannot do on its own. Inside Railway every service
reaches Postgres over the **private network**: the web service's `DATABASE_URL`
names `postgres.railway.internal`, a hostname that resolves nowhere else. A
worker on a laptop that simply inherited it would connect to nothing. Railway's
Postgres service also publishes `DATABASE_PUBLIC_URL` — a `*.proxy.rlwy.net` TCP
proxy — for exactly this case. So before the host starts,
[`scripts/desktop-app/railway-public-db-url.mjs`](scripts/desktop-app/railway-public-db-url.mjs)
resolves, and prints as one JSON line:

- the linked **environment** (from `railway status --json` plus the CLI's own
  `~/.railway/config.json` link file, which is the only offline way to learn
  which environment `railway link` chose);
- the **web service** — the one whose variables carry `SESSION_SECRET` /
  `ADMIN_USERNAME`;
- the **Postgres service** — the one exposing `DATABASE_PUBLIC_URL`;

all scoped to that one environment, so a staging Postgres can never be paired
with production credentials. It then **dry-runs** `railway run --service <web>
--environment <env> -- /usr/bin/true`, so a broken link is reported as JSON
_before_ the launcher exec's and loses the ability to report anything. Every CLI
call is bounded to 15 s. The public URL is kept only in the launcher's process
environment; it is never printed or written.

Inside the injected environment the launcher swaps a `*.railway.internal`
`DATABASE_URL` for the public proxy URL and records which route it took
(`railway-public-proxy`, `railway-service-variable`,
`railway-internal-unreachable`, `blocked-local`, `none`) — surfaced in the app's
configuration label.

Precedence, and it is verified behaviour rather than an assumption:
`@prisma/client` loads the repository `.env` itself, but it does **not**
overwrite a variable already present in the environment — and an **empty** value
counts as present. So injected Railway values win, a local `.env` is only the
fallback, and exporting `DATABASE_URL=""` is how the launcher forbids the `.env`
fallback outright.

### The database preflight

The launcher and the host both refuse to run the worker against the wrong
database ([`local-config.ts`](src/lib/admin-worker/local-config.ts) →
`computeLocalConfig`, which returns one structured `blockingReason`, never a
regex over warning prose):

| `blockingReason` | When                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `local_db`       | `DATABASE_URL` names `localhost` / `127.x` / `[::1]`                      |
| `internal_host`  | `DATABASE_URL` names `*.railway.internal` — unreachable from this machine |
| `no_db`          | no connection string at all (including one the launcher blanked)          |
| `unreachable`    | a remote host that is not answering                                       |

When the Railway link is missing and the repository `.env` points at a loopback
Postgres, the launcher blanks `DATABASE_URL`, starts the host anyway (the app
needs a control surface to display the error rather than a dead window) and says
so: _"Refusing the LOCAL database … production would not be updated."_

**The escape hatch is `VIAFIDEI_ALLOW_LOCAL_DB=1`**, and it exists only for
deliberate local testing. With it set, a loopback `DATABASE_URL` from the
environment or the repository `.env` is allowed through.

### Exit codes

`scripts/run-worker.ts` exits with a distinct code per outcome, so the
supervising host (and any wrapper) can tell them apart without parsing logs
([`classifyWorkerExit`](src/lib/admin-worker/local-config.ts)):

| Code | Meaning                                                     | What the host does                                                |
| ---- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `0`  | Clean stop — the master switch went OFF                     | Nothing; this is the intended stop                                |
| `3`  | Refused at boot: switch OFF, or the lease is held elsewhere | Surfaces the reason; never restarts into a lease it cannot hold   |
| `4`  | The database could not be reached to read the master switch | Waits for the database instead of burning the restart budget      |
| `5`  | The execution lease was lost to another runtime mid-run     | Stops — the other runtime now owns execution                      |
| `1`  | Fatal, unexpected                                           | Restarts with backoff, up to 5 consecutive restarts, then reports |

### Environment knobs on this path

Every one of these has a working default; none has to be set for a normal
install.

| Variable                           | Default                                                                        | Purpose                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VIAFIDEI_ALLOW_LOCAL_DB`          | unset (`0`)                                                                    | `1` permits a loopback `DATABASE_URL`. Deliberate local testing only — production is not updated                                                                                              |
| `VIAFIDEI_RAILWAY_SERVICE`         | auto-detected                                                                  | Names the Railway **web** service instead of probing for the one carrying `SESSION_SECRET` / `ADMIN_USERNAME`                                                                                 |
| `VIAFIDEI_RAILWAY_ENVIRONMENT`     | the linked environment                                                         | Overrides the environment the resolver scopes to                                                                                                                                              |
| `VIAFIDEI_HOST_CONNECTION_LIMIT`   | `3`                                                                            | Prisma pool for the **host** process (it only reads status, renews the lease and runs operator jobs)                                                                                          |
| `VIAFIDEI_WORKER_CONNECTION_LIMIT` | `10`                                                                           | Prisma pool the host gives the **worker child**, which does the real work                                                                                                                     |
| `PRISMA_CONNECTION_LIMIT`          | `10` (the launcher sets `3` for the host)                                      | `connection_limit` appended to the datasource URL. Keep it at or above `ADMIN_WORKER_LANE_CONCURRENCY` (default 8) or concurrent lanes starve the pool (`P2037`)                              |
| `PRISMA_POOL_TIMEOUT`              | `20` (seconds)                                                                 | How long a query waits for a free pooled connection                                                                                                                                           |
| `PRISMA_CONNECT_TIMEOUT`           | `15` (seconds)                                                                 | Connect timeout, applied to **non-local** hosts only, so an unreachable Railway proxy fails in seconds instead of hanging a pass. Those hosts also get `sslmode=require`                      |
| `INTELLIGENCE_PYTHON`              | the launcher prefers `/opt/homebrew/opt/python@3.11/bin/python3.11` if present | The interpreter for the Python brain. An explicit value is used **verbatim** and the boot probe reports loudly if it is broken. Unset, the bridge probes a candidate list for ≥ 3.10          |
| `VIAFIDEI_LEASE_RENEWED_BY_HOST`   | set to `1` by the host                                                         | Tells the worker **child** that the host owns lease renewal, so the child stops rewriting the same row every pass and every 20 s. A bare `npm run worker:local` has no host and renews itself |

### The master switch

The app's toolbar carries one green **ON / OFF pill**. It is the master
activation control for the entire Admin Worker, and it is stored in Postgres —
as an `AdminWorkerMemory` row under `worker.execution.switch`, so it needs no
schema change and every runtime reads the same fact
([`execution-host.ts`](src/lib/admin-worker/execution-host.ts)).

| State   | What exists                                                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OFF** | No worker loop, no Python brain, no Chromium, no discovery, no security scans, no diagnostics passes, no self-maintenance sweep, no reports, no worker email — **on this Mac or anywhere else**. Railway does not take over.                                 |
| **ON**  | The app launches `scripts/local-worker-host.ts`, which claims the single execution lease, starts `scripts/run-worker.ts --origin local`, and brings the brain, acquisition tools and browser rendering online — resuming from the state already in Postgres. |

**OFF consumes nothing, and that is structural rather than a promise.** Every
periodic capability the worker has — including the self-maintenance sweep — runs
as a lane _inside a pass_; a pass runs only inside the loop; the loop runs only
while the switch is ON (`checkLoopAuthority`). There is deliberately no timer, no
cron and no background interval anywhere in the worker. Switch OFF and the only
thing left on the Mac is the app window.

Reading the switch is fail-safe in the honest direction: `readMasterSwitch`
returns `known: false` when the database cannot be read, and callers that stop
work on OFF must treat that as "keep doing what you were doing" and surface the
error, rather than reading an outage as an operator's OFF.

Because the switch is a row rather than a message to a process, the toolbar
pill is not the only thing that can write it. The operator's iPhone writes the
same row over HTTPS, and `npm run worker:local -- --switch-on` writes it from a
terminal. What makes such a write take effect on this Mac is
[the durable switch poll](#the-durable-switch-poll) — without it a row set from
anywhere else would sit there doing nothing.

### The execution lease

Alongside the switch, `worker.execution.lease` records **which runtime currently
holds the sole right to execute worker computation** — its runtime id, origin,
host label, pid and renewal time.

- One executor, ever. A lease is claimed at boot, renewed every ~20 s
  (`LEASE_RENEW_INTERVAL_MS`, with ±20 % jitter so two runtimes over a shared
  proxy do not line up their round trips) and released on shutdown. A second
  runtime cannot claim a live lease, so the Mac and a cloud worker can never both
  drain the same queue — and `PublishedContent @@unique([contentType, slug])`
  makes double-publishing impossible at the database level even under a race.
- A lease older than `LEASE_TTL_MS` (90 s) is treated as abandoned — the Mac
  slept, quit or crashed — and may be claimed by the next runtime.
- **There is no automatic cloud failover.** A lost local lease simply expires;
  nothing takes over. The site, accounts, logins and published content are
  unaffected; the worker is just unavailable. If the local runtime crashes while
  the switch is ON, the app restarts it locally and says so.
- Liveness means "the LOCAL runtime is alive": a fresh heartbeat only counts
  while a live local execution lease exists. Diagnostics distinguishes **Admin
  Worker intentionally inactive** (switch OFF — reported as healthy, not a
  production failure), **active locally**, **switched on but disconnected** (a
  genuine local failure), and **paused**.

Every entry point is gated twice — by the process-level rule in
`execution-context.ts` (the Next.js server runtime can never run worker
computation, spawn the Python brain or launch Chromium) and by the durable rule
in `execution-host.ts` (the switch must be ON and this runtime must hold the
lease).

### The durable switch poll

A durable switch only works as a remote control if this Mac notices when
something else writes the row. Until
[`switch-poll.ts`](src/lib/admin-worker/switch-poll.ts) landed it did not:
[`scripts/local-worker-host.ts`](scripts/local-worker-host.ts) read
`worker.execution.switch` exactly twice — once at startup, and again on the
child-exit paths — so a row set ON from anywhere else did **nothing at all**
until the application was relaunched. That is the worst shape such a gap can
take, because nothing looked broken: the write succeeded, every surface
reported the switch ON, and no worker ran.

`reconcileSwitchTick` in the host closes it. Every **7 s**
(`SWITCH_POLL_INTERVAL_MS`) the host reads the durable switch and makes this
machine match it, in **both** directions — a switch flipped ON elsewhere has to
_start_ the worker here, not only stop it. Each tick is scheduled with the same
**±20 % jitter** the lease renewal uses (`leaseRenewDelayMs`), so the 7 s
reconcile, the 20 s lease renewal and the 2 s dashboard tick never convoy onto
one congested instant of the Railway proxy link, and the timer is `unref`'d so
it can never hold the process open. A status read from the last **2 s**
(`SWITCH_POLL_CACHE_MS`) is reused rather than re-fetched, so a tick landing
just after the dashboard's own refresh costs nothing. Worst-case actuation
latency is therefore 7 s + 2 s ≈ **9 s**, and that number is shipped to clients
as `actuation.expectedLatencyMs` instead of being hard-coded in each of them.

The decision itself is a pure function — `planSwitchPoll(input)` returns
exactly one of `start`, `stop` or `none`, with the reason — so the rules below
are pinned by `tests/admin-worker/local-switch-poll.test.ts` (37 tests) with no
database, no process tree and no clock.

- **An unreadable switch is UNKNOWN, never OFF.** `known: false` means the
  database did not answer. Reading that as OFF would stop a healthy worker
  mid-pass over one bad round trip, so the tick does nothing at all
  (`switch_unknown`) — the same fail-open rule lease renewal follows.
- **It reuses the existing start and stop paths.** ON runs the sequence the
  app's own switch runs: probe the database, refuse if `blockingReason` says
  this is not a database the worker may write to, claim the execution lease,
  then `startWorkerChild()`. OFF runs `stopWorkerChild()`, shuts down the
  resident Python brain and releases the lease. There is no second lifecycle.
  The one thing both paths omit is the switch write itself — the row already
  holds the value, and rewriting it would erase who set it and from where.
- **It is idempotent, and silent when the world already matches.** Switch ON
  with a child running is `already_running`; switch OFF with nothing running is
  `already_stopped`. Neither changes anything and neither logs a line, which is
  the normal case several times a minute.
- **It stands aside rather than competing.** While an existing path already
  intends to (re)start the child — a crash backoff, a deferred resume after a
  database outage — `pendingStarts` is non-zero and the poll declines
  (`start_pending`); a child mid-start or mid-stop is `transitioning`; an
  operator OFF still waiting to be recorded durably is `pending_durable_off`
  and belongs to the lease tick. A tick still working blocks the next one
  outright (`reconcileInFlight`). The poll therefore cannot double-start a
  worker, which is the failure this design is most exposed to.
- **A runtime that gave up needs a deliberate re-arm.** Five crashes in a row,
  a spawn error, or a lease taken by another computer leave the runtime in the
  `failed` state, and a switch that is _merely still ON_ does not restart it
  (`failed_needs_operator`) — otherwise a worker that dies on every launch
  would be relaunched every seven seconds. It takes an OFF→ON edge, which is
  exactly what the give-up message asks the operator for and which can happen
  at most once per operator action. Because the poll **samples** the row rather
  than observing events, that edge is recognised two ways: the value crossing
  from `false` to `true`, or `MasterSwitch.changedAt` moving since the previous
  read. The second one matters because a thumb can tap OFF and then ON well
  inside one 7 s interval — two writes, one observation — and nothing writes
  that row on a timer, so a moved timestamp is reliable evidence that somebody
  deliberately set it. Only on that edge does the tick reset the crash-restart
  counter (`clearFailure`), exactly as the app's own switch endpoint does — a
  start that happens merely because the switch is still ON inherits the streak
  it already had.
- **A refused start goes on cooldown.** When the lease is held elsewhere, or
  the database is not one this host may work against, starts are suppressed for
  60 s (`SWITCH_POLL_START_COOLDOWN_MS`) and only the _first_ occurrence of each
  distinct refusal is logged — a lease held by another computer for an hour
  must not write five hundred lines. A deliberate re-arm always gets a fresh
  attempt regardless of the cooldown.

Both directions are recorded in the durable log with the reason
(`local_worker_activated` / `local_worker_deactivated`, tagged
`trigger: "switch-poll"`), so a worker that started because a phone wrote the
row says so in the same place every other lifecycle event is written.

### The host presence row

The reconcile tick is also the one thing that runs whether the worker is on or
off, which makes it the right place to answer a question no other signal
answers: **is the Mac runtime itself alive?**

[`host-presence.ts`](src/lib/admin-worker/host-presence.ts) writes one more
`AdminWorkerMemory` row in the same `worker.execution.*` namespace the switch
and the lease already use — `worker.execution.host` (`HOST_PRESENCE_KEY`) — so
there is no new table. It carries the runtime id (the same one the lease uses),
a short machine label, the supervisor pid and run state, whether a worker child
exists and when it started, the switch as this runtime last read it, any
failure reason (truncated to 400 characters, so no stack trace or connection
string can reach a screen), and whether the lease is held elsewhere.

Two liveness facts stay deliberately separate, and conflating them is the whole
reason the row exists:

| Question                   | Signal                                     | Written                                       |
| -------------------------- | ------------------------------------------ | --------------------------------------------- |
| Is the **worker** alive?   | `AdminWorkerState.lastHeartbeatAt`         | only while a worker child is actually running |
| Is the **Mac host** alive? | `AdminWorkerMemory(worker.execution.host)` | every reconcile tick, worker on **or** off    |

Without the second, "the application is running with the worker switched off"
and "the Mac is asleep" are indistinguishable from off the machine — and only
the first of those can honour a remote switch-ON.

Freshness is a contract, not a guess. The row carries its own `intervalMs`
(7 s) and `staleAfterMs` (`HOST_PRESENCE_STALE_MS`, **30 s** — three missed
ticks plus slack), so a reader need not hard-code the cadence: `readHostPresence`
reports `alive` only when the row's age is inside its own stale window. A clean
shutdown deletes the row (and only the runtime that owns it may delete it), so
a quit shows as "not running" immediately instead of waiting out the window. A
database error comes back as `known: false` — unknown, never "the Mac is off".

**The presence row is display only.** Nothing gates on it. In particular the
iPhone toggle is not disabled when presence is stale: the switch is a durable
row precisely so it can be written while the Mac is away and honoured when it
wakes.

### What the app contains

- The complete **Admin Worker command center** — worker status, mode, priority,
  heartbeat, content goals and coverage, pipeline state, current task, recent
  passes and decisions, brain reasoning and ranked alternatives, source
  reputation and coverage, knowledge and memory, logs, rules, skills, repair
  plans, review queue, package artifacts, quality scores, strict QA, rollbacks,
  security activity, homepage drafts, diagnostics, intelligence status, current
  source activity, publishing activity, content growth, self-maintenance, and
  live local resource usage (`scripts/desktop-app/dashboard.html`, served by the
  local runtime).
- **Manual passes and the homepage makeover run locally.** A button in the app
  starts a local operation; it never calls a server endpoint that would do the
  work on Railway.
- **File ingestion.** Drag a file anywhere onto the window, use ⌘I, or click
  "choose a file" in the command center, and the local worker reads it — see
  [Operator file ingestion](#operator-file-ingestion).
- The original **Standard Site / Admin Site** tabs onto `https://etviafidei.com`,
  unchanged.

The same runtime can be driven from a terminal when useful:

```bash
npm run worker:host    # the local host + command center (what the app launches)
npm run worker:local   # the worker loop alone, on this machine
```

### The retained Railway worker service

The Railway worker service is **kept, not deleted** — `Dockerfile.worker` and
`railway.worker.json` still build and deploy, and the image still contains
everything a cloud worker would need (Node, tsx, the Prisma client, Python 3.11
for the brain, Chromium for the dynamic fetcher) so the service stays genuinely
recoverable. What changed is what it _runs_: `scripts/worker-service-parked.sh`
— a `sleep` loop with no Node, no Python, no Prisma client, no database polling
and no browser — plus `deploy.sleepApplication: true` so Railway sleeps the
idle service.

Note the one non-obvious constraint: Railway's own schema requires
`deploy.numReplicas >= 1`, so "run nothing" **cannot** be expressed as
`numReplicas: 0` — that value makes the service fail to deploy at all. The
parked start command is what delivers the near-zero footprint, and
`tests/admin-worker/railway-worker-service-parked.test.ts` pins both facts.

Restoring cloud execution later is a deliberate, manual change: switch the
local worker OFF, set `deploy.sleepApplication` to `false` (a worker service
receives no inbound traffic, so app-sleep would park a restored worker
permanently), and set the start command to
`npm run worker -- --force-remote-execution "reason"`. The execution lease
guarantees the two runtimes can never both drain the same queue.

`npm run worker` without that flag exits **non-zero** rather than pretending to
work, so a cron entry or deploy hook wrapped around it fails visibly instead of
silently doing nothing.

---

## The iPhone companion — a remote control that never runs the worker

[`ios/`](ios/) is a native SwiftUI application for the operator's iPhone. It
carries the same three views the Mac application carries — the **Admin Worker**
command centre, the **Standard Site** and the **Admin Site** — redesigned for a
phone rather than shrunk onto one. It exists for one job: to observe the worker
and to switch it on and off from wherever the operator happens to be, without
the Mac in front of him.

### The guarantee: turning it on from the phone runs the worker on the Mac

Switching the worker ON from the iPhone starts it **on the Mac**, using the
Mac's CPU, memory, disk and internet connection. The phone spends nothing on
the work beyond one HTTPS request.

That is structural rather than a promise, and the structure is the one
described above:

- the master switch is a **durable row** in Postgres
  (`AdminWorkerMemory` → `worker.execution.switch`);
- the phone's one mutation writes **that row and nothing else** — the route
  does not claim the execution lease, does not spawn anything, and does not
  touch the worker;
- the **Mac** claims the lease and spawns the worker child, on its own
  [durable switch poll](#the-durable-switch-poll).

```
iPhone                          Railway (Next.js + Postgres)            the Mac
------                          ----------------------------            -------
POST /api/admin/worker/switch ─► setMasterSwitch()
     { on: true }                writes ONE durable row
                                 worker.execution.switch
                                                          ◄──── reconcile poll,
                                                                every 7 s:
                                                                reads the row,
                                                                claims the lease,
                                                                spawns the worker
GET  /api/admin/worker/status ─► reads the durable rows    ◄──── writes host
GET  /api/admin/worker/snapshot                                  presence +
                                                                 heartbeat
```

The phone has no database driver, no worker entry point, no ingest and no way
to start a process, and `tests/ios/iphone-app-structure.test.ts` (20 tests)
pins that so a later change cannot quietly turn the companion into something
that could execute a pass. Verified here against this tree:

- **No dependencies to link.** `ViaFideiCommandCentre.xcodeproj` contains zero
  `XCRemoteSwiftPackageReference`, `XCLocalSwiftPackageReference` and
  `XCSwiftPackageProductDependency` entries, and its `PBXFrameworksBuildPhase`
  has an **empty** `files` list. There is nothing to link that could open a
  database connection.
- **The shipped binary links only Apple system code.** `otool -L` on
  `build/Build/Products/Release-iphoneos/ViaFideiCommandCentre.app/ViaFideiCommandCentre`
  lists Foundation, Combine, Network, Security, SwiftUI, UIKit and WebKit from
  `/System/Library/Frameworks`, plus `libobjc`, `libSystem` and the Swift
  runtime dylibs from `/usr/lib`. Nothing else, and the bundle has no
  `Frameworks/` directory at all.
- **One POST in the whole application.** `httpMethod = "POST"` appears exactly
  once in the Swift sources — the private `post(_:)` request builder in
  `Core/APIClient.swift`, shared by sign-in, the 2FA verify and resend,
  sign-out and the switch write. The only one of those that changes worker
  state is `setSwitch(on:)`, and all it sends is `{ on, client, reason }`.
- **A closed list of destinations.** Every `URL(string:)` literal in the app is
  under `https://etviafidei.com`, and the sources contain no `Process(`,
  `NSTask`, `posix_spawn`, `dlopen`, `NSAppleScript`, `DATABASE_URL` or
  Postgres connection string.

The bundle identifier is `com.viafidei.commandcentre`, deliberately **not** the
macOS app's `com.viafidei.devapp`: separate identities, so neither app's state
can disturb the other's.

### The three views

The Mac app switches views with an `NSSegmentedControl`. The phone uses a
`TabView` (`App/RootView.swift`), which is a real design decision rather than a
translation: each tab keeps its own state alive, so both web tabs stay loaded
and signed in and the command centre keeps its scroll position and its folded
sections, where a picker inside one screen would tear the web view down and
rebuild it on every switch; a picker pinned under a large navigation title
would also permanently eat the most valuable strip of a tall, data-dense
screen; and the tab bar sits in the thumb's reach.

1. **Worker** — the command centre. The switch and its attribution ("Set by
   _operator_ from _iphone-app_"), the Mac's presence and run state, execution
   and lease liveness, the worker heartbeat, then mode / priority / goal / task
   / blocker, published content and the QA and publish rates, per-lane counts
   against their targets, recent passes and brain decisions, and — folded below
   — growth, pipeline and artifacts, funnel and coverage, brain reasoning and
   ranked alternatives, quality and review, security / repair / skills, sources
   / memory / knowledge, recently published, and the worker log.
2. **Live Site** (the Mac app's _Standard Site_) — `https://etviafidei.com` in
   a `WKWebView`.
3. **Admin Site** — `https://etviafidei.com/admin` in a `WKWebView`.

`SessionStore` mirrors the two session cookies (`vf_session` and the device
credential `vf_dev_id`) **both ways** between the `HTTPCookieStorage` that
`URLSession` uses and the `WKWebsiteDataStore` the web views use, and observes
the web cookie store, so a session rotated inside a web view reaches the API
immediately and the Admin Site tab is already signed in. Session material is
kept in the **Keychain** with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
(so it is not in an iCloud backup); the password lives in memory for the length
of one request and is then cleared. Nothing goes to `UserDefaults`, and the app
contains no logging statements at all.

### The switch shows confirmed durable state, not an optimistic flip

`WorkerStore.displayedOn` is read straight out of the last server payload —
`status.master.isOn`, nothing else. **Tapping the toggle does not move it; the
server's answer does.** A toggle that flips locally and then silently diverges
from the Mac is exactly the failure this is built to make impossible.

1. Tap. The control becomes inert and shows "Saving…" underneath. The toggle
   has not moved.
2. `POST /api/admin/worker/switch` writes the durable row — and nothing else.
3. The response carries the **confirmed** durable value plus a freshly forced
   status. If it does not match what was asked for, or could not be read back,
   or the write failed (503 `switch_write_failed`), the card says so in plain
   words and the toggle stays where the server says it is.
4. Confirmed: the toggle moves, and the card reads "Saved — waiting for the
   Mac" while execution catches up, bounded by the server's own
   `actuation.pendingWindowMs` (15 s). Past that window it reads "Saved, but
   the Mac has not picked it up" — a true statement about the Mac, not a false
   one about the write, and it settles silently if the Mac later obeys.
5. If the switch is moved at the Mac while the phone is waiting, the durable
   row wins and the phone stops waiting.

An unreadable switch renders as **"Unknown"**, never as OFF.

### Polling, and only while you are looking

- Status every **4 s** while the Worker tab is frontmost, **8 s** on the other
  two tabs or on cellular / Low Data Mode, **2 s** while a switch change is
  settling — and never faster than the server's own `nextPollAfterMs`.
- Snapshot on the server's `cache.nextPollAfterMs` (30 s while executing, 5 min
  idle).
- **Immediately** on returning to the foreground, so a change made at the Mac
  is on screen within a second of looking.
- **Nothing in the background.** `scenePhase` leaving `.active` cancels the
  poll task outright. While the phone is offline no request is attempted at
  all; the loop only wakes every 3 s to notice that connectivity came back.
- Pull to refresh forces `?refresh=1`, the one phone-triggered path that runs
  the ~30 production queries on demand, which is why the server rate-limits it
  to six per five minutes and the refusal is surfaced rather than swallowed.

### Connectivity: the only reason the toggle is ever disabled

`Core/NetworkMonitor.swift` wraps a single `NWPathMonitor`. When **this iPhone**
has no usable path to the network, the toggle is dimmed (35 % opacity,
saturation removed) and genuinely non-interactive, and **"No internet" appears
directly below the switch**. It re-enables the moment connectivity returns.

The toggle is **never** disabled because of anything about the Mac — not a
stale host-presence row, not `degraded: true`, not a crashed worker, not an
unreadable database. The switch is a durable row precisely so it can be written
while the Mac is asleep and honoured when it wakes; greying it out because the
Mac is unreachable would remove the one capability the row exists to provide.

One non-obvious detail keeps that working. `WorkerStore` holds `NetworkMonitor`
as a plain reference, so flipping `isOnline` publishes nothing on the store and
a view observing only the store can miss the change entirely — the switch would
stay bright and apparently tappable with the phone offline until some unrelated
state happened to move. `SwitchCard` therefore observes the monitor itself
(`@ObservedObject var network: NetworkMonitor = .shared`). It is load-bearing
even though the view "does not use the network for anything", and
`tests/ios/iphone-app-structure.test.ts` pins both the subscription and the
position of the "No internet" label below the toggle.

**The macOS application deliberately does not have this greying.** Its
`PillSwitch` refuses a click only while a change is in flight (`isBusy`); there
is no connectivity check in it and none was added. The operator asked for the
dimming on the phone — the device that actually loses signal in a pocket — and
the macOS dashboard was deliberately left as it was.

### The control route is gated exactly like every other admin mutation

`POST /api/admin/worker/switch` can start a real workload against production,
which makes it a high-value target, so it gets **no** special treatment: it
calls [`gateAdminApiCall`](#the-central-admin-gate) as the first thing it does,
like every other admin mutation. There is deliberately no second authentication
path for the phone, no API key, and no new environment variable.

A native client satisfies the browser-shaped rules by presenting what a browser
presents:

- **CSRF.** `evaluateCsrf` passes safe methods through, so the two GETs need no
  header. For the POST the app sets `Origin: https://etviafidei.com` verbatim,
  plus `Referer: https://etviafidei.com/admin` as the documented fallback. In
  production `getTrustedOrigins` returns the canonical constants from
  `src/lib/config.ts` and never anything derived from a request header, so the
  header the app sends can only match or fail — it cannot widen the trusted
  set. A POST carrying neither is refused **403** before authentication is
  consulted, and the refusal is reported as a Security Breach.
- **Banned device.** The app carries `vf_dev_id` like a browser, so the ban
  check applies unchanged — and fails closed with 503 if the ban store cannot
  be read.
- **The session.** The app drives the real two-stage admin sign-in
  (`POST /api/admin/login`, then `POST /api/auth/admin-2fa/verify`, both
  form-encoded, with the 303 deliberately not followed because its `Location`
  is the answer). A password-only PENDING session is refused exactly like an
  anonymous caller: half a sign-in does not reach the switch.

Beyond the gate the route is per-operator rate limited (12 switch writes a
minute), requires `on` to be **strictly boolean** — accepting `"true"` or `1`
would let a client typo start a production workload — and records every
accepted change twice with the actor: an `AdminActionLog` row (distinct action
types per direction, so the collapsing window cannot swallow the OFF that
follows an ON) and an `AdminAuditLog` row carrying the before/after value. A
failed write is recorded too, and answered **503 `switch_write_failed`** rather
than a cheerful 200 — claiming success would leave the phone showing a state
the Mac will never reconcile to. `tests/security/worker-remote-control-gate.test.ts`
(24 tests) pins all of it, including that the three route files reach the
central gate in every exported handler.

The two reads are gated the same way and are cheap by construction: `/status`
is three small durable reads cached 2 s per server instance, and `/snapshot`
single-flights, caches (30 s executing, 5 min idle), never writes content goals,
and trims the payload before it crosses a cellular link.

### Building and installing the iPhone app

Nobody has to open Xcode. The project is a checked-in `.xcodeproj` using an
**objectVersion 77 file-system-synchronized root group**, so the project file
lists no individual sources: everything under `ios/ViaFideiCommandCentre/` is
compiled and adding a `.swift` file needs no project edit.

`xcode-select -p` on this Mac points at `/Library/Developer/CommandLineTools`,
which ships no `xcodebuild` at all — running it there answers _"tool
'xcodebuild' requires Xcode, but active developer directory
'/Library/Developer/CommandLineTools' is a command line tools instance"_ and
stops. So **every** command below is prefixed with `DEVELOPER_DIR` to point the
toolchain at the full Xcode (26.6) instead. The prefix is required, not
decorative, and nothing here changes the selected developer directory.

```bash
cd "/Users/ryansimonds/Developer/Via Fidei/ios"

# Compile for the device SDK without signing — the fast "does it still build?"
# check after touching anything under ios/.
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project ViaFideiCommandCentre.xcodeproj \
  -scheme ViaFideiCommandCentre -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
#   → ** BUILD SUCCEEDED **
#     build/Build/Products/Release-iphoneos/ViaFideiCommandCentre.app
```

To put it on the phone, build signed and install with `devicectl`. The device
identifier comes from `devicectl list devices`; a phone that is plugged in (or
paired over the network) shows as `connected`:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun devicectl list devices
#   → RSimonds   C5F31905-3CB8-541C-A359-9AF9AEBEEF6F   connected   iPhone 17

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project ViaFideiCommandCentre.xcodeproj \
  -scheme ViaFideiCommandCentre -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build-signed \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=<TEAM_ID> build

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun devicectl device install app \
  --device C5F31905-3CB8-541C-A359-9AF9AEBEEF6F \
  build-signed/Build/Products/Release-iphoneos/ViaFideiCommandCentre.app
#   → App installed:  bundleID: com.viafidei.commandcentre
```

`-allowProvisioningUpdates` is what lets `xcodebuild` create or renew the
provisioning profile itself instead of requiring one that is already installed
— it is the flag that keeps the whole flow on the command line. Deployment target is iOS 17.0,
iPhone only. Build output lives under `ios/build`, `ios/build-sim` and
`ios/build-signed`, all of which are ignored by both git and Prettier.

#### The app icon, and why there is a generator for it

[`ios/tools/make-app-icon.swift`](ios/tools/make-app-icon.swift) exists because
the app first reached the phone showing a **blank tile**. Two causes, both
silent:

- the asset catalog declared a 1024 slot with **no image in it**, so there was
  nothing to draw; and
- iOS rejects an app icon that has an **alpha channel** — it does not warn, it
  simply does not use the icon. The site's own `public/icon-512.png` is 512×512
  _with_ alpha, so it had to be upscaled **and** flattened.

The generator does exactly that, and nothing else: it draws the source onto an
opaque 1024×1024 bitmap created with `CGImageAlphaInfo.noneSkipLast` (so the
PNG carries no alpha channel at all), fills the ground with `#fbf8f1` — the
site's own `background_color` from `public/site.webmanifest`, so the tile
matches the product instead of sitting on an arbitrary white square — and insets
the artwork by 6 %, because iOS rounds the corners and artwork run to the very
edge gets clipped by the mask.

```bash
cd "/Users/ryansimonds/Developer/Via Fidei"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  swift ios/tools/make-app-icon.swift public/icon-512.png \
  ios/ViaFideiCommandCentre/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
#   → wrote …/AppIcon-1024.png (1024x1024, no alpha)
```

The committed `AppIcon-1024.png` is byte-for-byte this command's output, so
re-running it is a no-op; `sips -g hasAlpha` on the result reports `no`, which
is the property that actually matters.

### Signing

**The app is signed under the paid Apple Developer Program**, on team
`9PS2WKDYU3` ("SAMUEL RYAN-ANDREW SIMONDS"). The profile currently embedded in
the installed build is portal-issued, `TimeToLive` **365**, expiring
**2027-09-10**. The app stays on the phone for a year; there is no weekly
ritual.

**The trap that makes an active membership look inactive.** An Individual
enrollment **upgrades the existing personal team in place** — the team
identifier does _not_ change. `9PS2WKDYU3` was the free personal team before
enrollment and is the paid team after it. So the `DEVELOPMENT_TEAM` already
stored in the project needed no edit at all, and hunting for a "new" paid team
identifier is a dead end.

What _does_ change is the kind of profile Apple will issue for that team — and
Xcode will not go and find out on its own. A free personal team is provisioned
**locally**: Xcode generates a `LocalProvision` profile with a seven-day
`TimeToLive` without contacting Apple. Once such a profile is sitting in
`~/Library/Developer/Xcode/UserData/Provisioning Profiles` and is still valid,
**every subsequent build reuses it**, including builds run with
`-allowProvisioningUpdates`. There is no portal round trip, so the membership
is never noticed. Quitting Xcode does not help; neither does deleting Xcode's
cached team list. The build keeps succeeding, and keeps producing a seven-day
app.

The fix is to remove the stale profile so the build has nothing to reuse:

```bash
# 1. Delete the locally-generated profile for this bundle id.
D=~/Library/Developer/Xcode/UserData/Provisioning\ Profiles
for f in "$D"/*.mobileprovision; do
  n=$(security cms -D -i "$f" | plutil -extract Name raw -)
  case "$n" in *commandcentre*) rm "$f";; esac
done

# 2. Rebuild. With no profile to reuse, Xcode asks the portal, and the
#    membership is finally visible.
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project ios/ViaFideiCommandCentre.xcodeproj \
             -scheme ViaFideiCommandCentre \
             -destination 'generic/platform=iOS' \
             -allowProvisioningUpdates build
```

Verify that what you got is genuinely portal-issued rather than another local
profile — `TimeToLive` and the absence of `LocalProvision` are the tell, and
they are more reliable than the team name:

```bash
P=$(ls ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/*.mobileprovision | head -1)
security cms -D -i "$P" | plutil -extract TimeToLive raw -      # → 365   (7 = still free)
security cms -D -i "$P" | plutil -extract TeamName raw -        # → SAMUEL RYAN-ANDREW SIMONDS
security cms -D -i "$P" | plutil -extract LocalProvision raw -  # → absent (True = still free)
```

A free personal team still signs the app perfectly well; its profile is simply
valid for seven days, after which iOS refuses to launch the app — it stays on
the Home screen and will not open — until it is rebuilt and reinstalled. That
is a property of free signing, not of this app.

Confirm the signature on the built bundle:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  codesign -dv --verbose=2 build-signed/Build/Products/Release-iphoneos/ViaFideiCommandCentre.app
#   → Authority=Apple Development: samuelrasimonds@gmail.com (3PSTX7KY36)
#     Authority=Apple Worldwide Developer Relations Certification Authority
#     Authority=Apple Root CA
#     TeamIdentifier=9PS2WKDYU3
```

### What the phone deliberately cannot do

- **No worker actions.** The desktop console can also trigger a pass, approve a
  review item and act on a homepage draft over its loopback API. Those
  endpoints are not exposed to the phone by the server at all, so this app
  observes and toggles; approving is done on the Admin Site tab.
- **No push notifications.** Nothing here wakes the phone. It polls while you
  are looking at it and stops the moment you are not.

### How the phone-to-Mac contract is proven

The phone shows nothing of its own: every field it renders is decoded from the
three worker routes. A field renamed on the server and not in the Swift decoder
produces exactly the symptom seen on 2026-09-10 — _"could not connect to the
command centre"_, with an otherwise healthy Mac — so the contract is tested
from both ends rather than by eye.

- [`tests/integration/worker-remote-console-live.test.ts`](tests/integration/worker-remote-console-live.test.ts)
  drives the **real** `status`, `snapshot` and `switch` handlers against a real
  Postgres with a real completed-2FA admin session, and pins the exact key sets
  of every response object. It proves both worlds: with a fresh
  `worker.execution.host` row (`alive: true`, a `runtimeId`, a `hostLabel`) and
  with **no presence row at all** — the second being the operator's actual case,
  where the response is still `200` with every top-level key present, so an
  absent Mac is stated as a fact about the _Mac_ (`"Not running"`) and never
  leaks into the switch as `"Unknown"`. It also pins the gate: no session →
  `401`, a password-only (2FA-pending) session → `401`.
- [`tests/api/worker-ios-contract.test.ts`](tests/api/worker-ios-contract.test.ts)
  parses the `CodingKeys` and property declarations **out of the Swift sources**
  in `ios/ViaFideiCommandCentre/Core` and checks them against the live payload,
  so the two cannot drift silently. Negative controls keep the check from
  passing vacuously: mutating the real payload — renaming a field, dropping a
  required one, changing a type — must fail the assertion, and each mutation is
  asserted to be caught.

---

## Self-maintenance

The worker's own doctor: [`self-maintenance.ts`](src/lib/admin-worker/self-maintenance.ts),
running from the **`maint-self-heal`** ops lane.

**Why it exists — measured, not hypothetical.** On 2026-09-07 the production
database was **21 GB**, of which `PublishedContent` was **12 MB**. The rest was
the worker's own telemetry: 33.4 million rows across the ledger tables
(`AdminWorkerActionScore` alone held 16,909,035 rows in 5.7 GB;
`AdminWorkerBrainCall` 6,016,374; `AdminWorkerReasoningGraph` 1,976,739;
`AdminWorkerCalibrationHistory` 1,548,893). In the same window the worker
published **nothing**. `worker_stuck` fired **207,830** times — and
`AdminWorkerStucknessRecord` held exactly 207,830 rows, one per detection, with
nothing ever acting on any of them. `loop_paused` was written **once per second**
while the loop was paused.

Every one of those was a signal the worker could have read about **itself**. It
had no organ that did. This module is that organ, and it runs a four-step cycle.

**SENSE.** Cheap aggregate queries → typed `Signal`s. Sizes come from
`pg_class` / `pg_total_relation_size` and `pg_database_size`; an exact row count
is only paid for once a size crosses a threshold. **`n_live_tup` is never
trusted**: production reported 4,932 rows for a table holding 16.9 million,
because autovacuum had never run on it and a never-analyzed table reports `-1`.
The bytes come back in the same query and are maintained by the storage layer,
not by `ANALYZE`, so they are the trustworthy half.

**DIAGNOSE.** Signals become named `Condition`s, each carrying its evidence and
exactly **one** remedy:

| Condition                      | What it means                                                                      | Remedy                                          |
| ------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| `LEDGER_BLOAT`                 | A telemetry table (or the database) is over its row/byte threshold                 | `trim_telemetry`                                |
| `LEDGER_DEAD_SPACE`            | Dead-tuple ratio past 0.4 / 0.6 on an already-large relation                       | `escalate` — only an operator can reclaim disk  |
| `PAUSED_LOOP_HOT_LOOP`         | A paused loop is logging every tick instead of backing off                         | `sample_noisy_event`                            |
| `LOG_EVENT_SPAM`               | One event name is over its hourly budget                                           | `sample_noisy_event`                            |
| `LANE_WEDGED`                  | A lane still "running" after 30 min, or `worker_stuck` / watchdog events piling up | `reset_wedged_lane`                             |
| `CURSOR_OUT_OF_RANGE`          | A structured-ingest cursor has swept repeatedly finding nothing (it wrapped)       | `reset_cursor`                                  |
| `ARTIFACT_PARKED`              | An artifact stuck in a non-terminal state for over 7 days                          | `requeue_artifact`                              |
| `ORPHANED_UNPUBLISHED_CONTENT` | Content a gate unpublished, which now passes that gate again                       | `restore_unpublished_content`                   |
| `PUBLISH_FUTILITY`             | 200+ passes in 24 h with **zero** publishes                                        | `escalate` — nothing here can _make_ it publish |

**REPAIR.** Bounded, reversible, least-destructive-first, and individually
disable-able. Every action actually taken writes **exactly one** `AdminWorkerLog`
row (`self_maintenance_action`) — never one per tick, which is the very bug the
module exists to stop — and a sweep that finds nothing writes nothing at all.

**It can never delete published content.** The telemetry tables are an
allow-list; nothing builds a statement from a table name it did not declare.
Re-publishing a row that a gate unpublished, and which now passes that gate
again, is the **only** content-mutating action in the file: it snapshots the
current state to `PublishedContentVersion` first (so the restore is itself
reversible), skips anything a human still owns in the review queue, and logs its
reason (`self_maintenance_content_restored`).

**VERIFY.** The signal that was acted on is re-read. A repair that does not move
its signal is recorded as ineffective; **three** consecutive ineffective attempts
escalate the condition and back it off for **six hours** rather than retrying
forever — the `worker_stuck` × 207,830 failure mode, encoded as a rule. A trim is
judged on the rows it _moved_, not on whether the table is under the threshold
yet, so a productive prune against a multi-million-row backlog is never mistaken
for a failure.

**What it escalates rather than fixes.** A `DELETE` does not return disk to the
operating system — it only marks tuples dead. A plain `VACUUM` (which the trim
issues after a large delete) makes the space reusable and stops the growth, but
past the dead-ratio threshold the only thing that returns the disk is an
operator-run `VACUUM FULL`. So `LEDGER_DEAD_SPACE` escalates **by name**, through
`fileHumanReview` with `alwaysQueue` (so it survives full-autonomy mode), and
points at the operator script below instead of pretending a repair exists.

Everything is fail-open: a failing probe or repair degrades to "did nothing" and
the next sweep retries. It can never stop a pass. The sweep self-throttles to
~15 minutes against a durable `AdminWorkerMemory` marker, so the lane calling it
every pass is free.

**Where it surfaces.** Every action lands in the audit ledger
(`self_maintenance_action`, `self_maintenance_content_restored`) and on the
browser admin's **`/admin/diagnostics`** page, which carries a dedicated
**Self-maintenance** panel and health rating: the last sweep's headline, open
conditions, repairs applied in the last 24 h, content rows restored, database
size against the trim threshold, the largest telemetry table, and any condition
currently backed off after repeated ineffective repairs.

### A worked example: the 0 ms watchdog

Worth recording in full, because it is one bug standing for a whole class of
them — a default that silently never applies.

`envInt` in [`loop.ts`](src/lib/admin-worker/loop.ts) reads a numeric setting
from the environment. Its guard was:

```ts
const n = Number((process.env[name] ?? "").trim());
return Number.isFinite(n) && n >= 0 ? n : fallback;
```

`Number("")` is **0, not NaN**. So an **unset** variable produced `0`, `0`
satisfied `n >= 0`, and the fallback was never reached. None of the three
variables this helper reads is set anywhere in this project, so in production
every one of them was 0.

The consequences were not subtle:

- The **dispatch watchdog** was **0 ms**, so every dispatched stage was killed
  the instant it started. Production recorded **46 stage failures** in 12 hours
  reading `dispatch watchdog: stage exceeded 0ms`. Worse, a watchdog cannot
  cancel the promise it raced, so each stage was **double-counted** in the
  outcome ledger — one instant `failure` row plus the real row when the work
  finished in the background. That is what pushed `SOURCE_FETCH` past the
  threshold and produced the **`LOOPING` escalation the operator received**.
- The **idle backoff** was 0 ms too, so an idle loop never rested and kept
  writing bookkeeping rows — a prime suspect for the ledger growth documented
  above.

The sibling helpers were already safe, by two different routes, and the
distinction is the actual lesson. Around ten of them guard with `n > 0`, which
rejects the empty string's `0` as a side effect. Six others — in `fetcher.ts`,
`parish-osm-overpass.ts`, `always-on-discovery.ts`, `parish-geocode.ts` (twice)
and `intelligence/client.ts` — use `>= 0` **deliberately**, because an explicit
`0` is a meaningful value there (no lookups, no pacing delay); each one is
correct only because it tests the raw string _before_ converting, and two carry
a comment saying exactly why (`Number("") is 0, not NaN`). So `>= 0` was never
the bug on its own. The bug was `>= 0` **without that guard**, which existed in
one place: the loop's copy. The fix makes absent, empty, blank,
unparseable and negative all mean "use the fallback", and honours an explicit
`0` **only where the caller opts in** (`allowZero`) — `0` is a meaningful "never
wait" for the idle backoff in tests and manual runs, but a 0 ms watchdog is never
wanted, so `dispatchTimeoutMs()` does not pass the flag and always falls back to
the 10-minute default. `envInt` and `dispatchTimeoutMs` are both **exported and
pinned by name** in `tests/admin-worker/envint-fallback.test.ts` rather than
inferred through a caller or raced against a real timer, because this helper is
what took the worker down.

The escalation it produced is also now answerable rather than merely repeated.
Forcing a different stage keeps the **pass** productive but leaves the **blocked
item** exactly where it was, so a stage whose source is exhausted fixates again
as soon as the governor's window rolls. The governor
([`governor.ts`](src/lib/admin-worker/governor.ts)) therefore judges fixation
**per content type** — a stage that advances `SAINT` but never `GUIDE` is
fixated for `GUIDE`, which is the scope the escalation actually had — and, for an
acquisition stage, takes a **`reroute_source`** corrective: it reads the fetch
ledger for the approved host whose recent fetches all failed and boosts the best
unfetched candidate of the same content type on a **different** approved host, so
the next acquisition pass reads something new. No external key is involved. Every
intervention records which corrective it took (`reroute_source` /
`drain_backlog` / `advance_stage` / `diagnostic`) and what it achieved, and the
self-assessment reads that back so the `LOOPING` warning says what the worker
already did about it — after which the escalation resolves itself once the
alternate source advances.

### The operator escape hatch

```bash
# Dry run — prints what WOULD be deleted, changes nothing
npx tsx scripts/maintenance/prune-worker-ledger.ts --railway

# The real thing, including reclaiming the disk
npx tsx scripts/maintenance/prune-worker-ledger.ts --railway --confirm --vacuum
```

| Flag        | Effect                                                                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--railway` | Resolves the linked Railway project's **public** Postgres URL through the same helper the desktop launcher uses, so no credential is ever pasted on a command line. Without it, `DATABASE_URL` selects the target |
| `--confirm` | Actually delete. **The default is a dry run**                                                                                                                                                                     |
| `--vacuum`  | After deleting, `VACUUM (FULL, ANALYZE)` every admin-worker telemetry relation with real bloat — because deleting rows alone returns no disk                                                                      |

Its safety rules are enforced in the script, not by convention: `TABLES` is an
exhaustive allow-list of admin-worker telemetry (so no content table can be
touched even by a typo), children are trimmed before `AdminWorkerPass` (whose
five inbound keys are `ON DELETE SET NULL`), deletes are batched by `ctid` so
each statement takes a short lock, and `PublishedContent` is counted before and
after — the script **throws** if that count moves.

**What actually happened in production, 2026-09-07.** This script was run against
the live database. It deleted the telemetry backlog — 33.4 million rows across
the six tables that were 99 % of the bloat — and vacuumed. The database went from
**21 GB to 493 MB**. `PublishedContent` was verified **unchanged**: 3,415
published rows of 3,457 total, every content type at exactly its previous count.
That is the whole reason both this script and the self-maintenance lane exist —
so that the next person understands the ledger, not the content, was the problem,
and so that the worker now notices before an operator has to.

---

## Admin UI

There are now **two** admin surfaces, and the split is deliberate:

- the **native Via Fidei application** holds the Admin Worker command center —
  everything that makes the worker _do_ something (see
  [Admin Worker execution host](#admin-worker-execution-host--the-operators-mac));
- the **browser `/admin`** holds the surfaces the operator wants reachable from
  any machine, and exposes **no way to start Admin Worker work**.

This is a structural separation, not hidden buttons: the worker pages
(`/admin/admin-worker/**`, `/admin/intelligence`, `/admin/skills`) and the
worker control routes (`/api/admin/admin-worker/**`,
`/api/admin/developer-audit`) were removed from the web application, and
`tests/admin-worker/web-admin-has-no-worker-controls.test.ts` fails the build if
one comes back.

**Browser admin (`/admin`):**

| Card                   | Route                           | Purpose                                                                                                                          |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| User Accounts          | `/admin/users`                  | User management                                                                                                                  |
| System diagnostics     | `/admin/diagnostics`            | Subsystem ratings, the **Self-maintenance** panel, and a **read-only** Admin Worker execution panel (local / off / disconnected) |
| Logs                   | `/admin/logs`                   | Account, admin and worker logs                                                                                                   |
| Admin Worker logs      | `/admin/logs/worker`            | Read-only worker log, filterable by severity / step / pass, showing which runtime executed each operation                        |
| Checklist surfaces     | `/admin/checklist/**`           | Read-only views of what the worker produced, plus source curation (row marking, no worker compute)                               |
| Homepage mirror editor | `/admin/homepage`               | Hand-edited homepage blocks                                                                                                      |
| Search index / Media   | `/admin/search`, `/admin/media` | Site surfaces edited by hand                                                                                                     |
| Banned devices         | `/admin/banned-devices`         | Request-time security enforcement records                                                                                        |

Signing in to either surface is now a **two-stage** flow — password, then a
six-digit code emailed to the configured admin address — and signing out revokes
server-side state rather than only clearing a cookie. Both are described under
[Security](#security). Ordinary user accounts and the Admin Worker are
unaffected by all of it.

The public **daily readings** page lives at `/liturgy/readings?date=…` (the
homepage + liturgical calendar link to it), and the worker owns it end to end —
the calendar engine, the committed lectionary tables, the Douay-Rheims store and
the rolling backfill are all described under [Liturgy](#liturgy).

The Command Center's **Daily readings** card tracks coverage live
(`dailyReadingsCoverage`): how many days are framed, how many carry verified
text vs citations only, today's status, the covered date range, and the
verified-text coverage of the next 30 / 90 days. There is **no target
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

| Card          | Route          | Purpose                                                         |
| ------------- | -------------- | --------------------------------------------------------------- |
| Logs          | `/admin/logs`  | Logs hub — account, **admin-action audit**, and worker sub-logs |
| User accounts | `/admin/users` | Registered users                                                |

**Console formatting + wiring.** The admin console is responsive and
overflow-safe on phone / tablet / laptop / desktop. The shared key-value
`Field` primitive and every diagnostic value cell carry `min-w-0 break-words`,
so long unbreakable tokens (enums like `NO_CANDIDATES_PRIORITIZED`, table names,
URLs, checksums) wrap **inside** their card instead of spilling past the border;
all data tables scroll horizontally in their own container. Every dashboard card
and in-page link resolves to a live route and every action button is wired to a
real handler/API route — the legacy `/admin/audit` and `/admin/email` redirect
stubs (and the "Audit" nav card that duplicated Logs) have been removed, and the
email-not-configured banner points to the real **Diagnostics** page.

---

## Admin Worker

The **Admin Worker** is the autonomous website-administrator system,
fully coded and operating **without any AI APIs**. Code lives under
`src/lib/admin-worker/`. The operator surface is the **command center in the
native Via Fidei application** on the operator's Mac, which is also where
the worker executes; the browser keeps `/admin/diagnostics` (per-subsystem
ratings + a read-only execution panel). It is the **only** system that creates
public content
(see [Single content path](#single-content-path)).

The whole intelligence layer is presented as **one identity: the Admin
Worker**. The console marks it with a single sketched, no-colour **atom**
glyph — a nucleus with a crossed hammer and wrench inside it
(`AdminWorkerIcon` in `_ui.tsx`), rendered in `currentColor` so it inherits
the surrounding tone — in place of the old 🧠 "brain" emoji, and every
identity label reads "Admin Worker" rather than "brain" / "final brain".
The Python brain is still named accurately as the _intelligence layer_ in
contextual notes (e.g. "intelligence layer unavailable — the Python brain
could not be used"), because that is a true, actionable description; only
the top-level identity was renamed.

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
- **Brain IQ diagnostics.** The command center's intelligence panel shows brain
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
  fabricated exact day). All **21 ecumenical councils** also ship as a **curated
  backbone** ([`knowledge/church-history.ts`](src/lib/checklist/knowledge/church-history.ts)),
  so the timeline fills from 325 → 1965 even with no network at all. The registry
  further covers **DOCTOR** (Doctors of the Church), **RITE** (the
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

  Two SPARQL-reliability rules keep this engine from silently starving (the
  failure mode that had frozen the catalog): (1) every enumeration query matches
  the target **type items directly by QID** (`VALUES ?type { … }` /
  `wdt:P166 wd:Q192499` / `wdt:P31/wdt:P279* wd:Q51645`) instead of scanning
  every instance-of/position **label** with `FILTER(CONTAINS(…))` — the label
  scans reliably exceeded the Query Service's 60 s server timeout and returned
  **zero rows**, which the loop could only read as "source unreachable"; the
  QID-indexed form returns in well under a second. (2) `runSparql` gives each
  query a **55 s budget** (the grouped/aggregated saint query legitimately takes
  15–25 s, so the old shared 20 s HTTP timeout aborted it under any load) and
  **retries once** on a transient blip before moving to the next endpoint, so a
  slow-but-successful query completes rather than being misread as unreachable.

- **No external AI — the worker escapes EXTRACTION by switching sources, not by
  inventing fields.** The Admin Worker deliberately uses **no OpenAI/LLM
  extraction and no AI/machine translation**; wiring content growth to an
  external AI would defeat the point of a self-contained worker. Extraction is
  fully deterministic (typed extractors + JSON-LD/microdata/OpenGraph
  structured-data blocks). When a source leaves required fields missing, the
  worker does **not** fabricate them — it files an `EXTRACT_FAILED` repair **and
  actively reroutes**: `rerouteToAlternateSource`
  ([`repair.ts`](src/lib/admin-worker/repair.ts)) boosts the best still-unfetched
  candidate of the same content type on a **different** approved host so the next
  `SOURCE_FETCH` reads it instead. Verification is by **cross-source evidence
  only** — an artifact clears when independent approved sources agree; when they
  don't (unreachable or disagreeing) it stays blocked and routes to another
  source, never waved through by an AI. This is the worker's own coded path
  (`DISCOVERY → CANDIDATE_PRIORITIZATION → SOURCE_FETCH → SOURCE_READ → EXTRACTION
→ VALIDATION → BUILD → QA → PUBLISH`) doing the work end-to-end.

- **Finds parishes on Google Maps — and verifies communion with Rome.**
  When `GOOGLE_PLACES_API_KEY` is set, `discover_parishes_via_maps`
  ([`parish-places.ts`](src/lib/admin-worker/parish-places.ts) +
  [`parish-discovery-runner.ts`](src/lib/admin-worker/parish-discovery-runner.ts))
  text-searches the Places API for Catholic churches in a locality (from
  `PARISH_DISCOVERY_LOCATIONS` or, absent that, the cities/states already in the
  catalog). Maps lists "Catholic" churches that are **not** in communion with
  Rome, so every candidate is run through a **communion-with-Rome verifier**
  ([`communion-verifier.ts`](src/lib/admin-worker/communion-verifier.ts)) that
  reads the parish's own website. It does **not** require an explicit "in
  communion with Rome" statement — a site rarely says that. Instead it confirms
  communion the way a real parish identifies itself: the name of the
  **(arch)diocese or (arch)eparchy** it belongs to, or the name of **any of the
  24 sui iuris Churches / rites** of the Catholic communion (Roman/Latin,
  Maronite, Melkite, Ukrainian & other Byzantine/Greek Catholic, Chaldean,
  Syro-Malabar, Syro-Malankara, Coptic, Armenian, Syriac, Ethiopian/Eritrean, …),
  as well as "Roman Catholic", USCCB / Holy See, or an explicit communion
  statement. Any one of those confirms it (so the worker keeps publishing);
  disqualifying signals — Old Catholic / Union of Utrecht, Polish National
  Catholic, sedevacantist, **the SSPX (not in communion at present)**,
  independent/national "Catholic" bodies, women's ordination, Orthodox/Anglican
  identity — are checked first and always win → **rejected, never published**. A
  bare "Catholic" alone is still never enough (Old Catholics call themselves
  Catholic too) and stays unknown. A no-op when no key is configured.

- **Free, keyless data sources — no API key for any of it.** The worker reaches
  its growth targets entirely on free, public endpoints, with paid keys only ever
  an optional quality/volume upgrade: **Wikidata** (SPARQL, CC0) + **Wikipedia
  REST** for structured entity facts and abstracts; the open **Liturgical
  Calendar API** for the General Roman Calendar; **OpenStreetMap Overpass** for
  parishes; **DuckDuckGo** for open web search; the **Internet Archive** Wayback
  API for dead/walled pages; the free **Google translate endpoint** for
  Latin/Greek; and **schema.org / OpenGraph / microdata** embedded in the pages
  it already fetches. There is no widely-available free _Catholic-specific_ REST
  API beyond these — Vatican.va, the USCCB, and most diocesan sites expose no
  API — so the worker treats those as HTML/PDF sources (now incl. JS-rendered
  pages via the headless fetcher) and lifts their structured data directly.

- **Finds parishes keyless via OpenStreetMap — a persistent tile sweep of the
  Catholic world.** When no `GOOGLE_PLACES_API_KEY` is configured, parish
  discovery runs on the free, public **Overpass API**
  ([`parish-osm.ts`](src/lib/admin-worker/parish-osm.ts)), asking for churches
  tagged `amenity=place_of_worship` + `religion=christian` +
  `denomination=roman_catholic|catholic` and publishing the named ones through
  the strict parish schema and the real publish orchestrator.

  The geography is a **tile grid**, not a rotation of hand-picked metros
  ([`parish-osm-tiles.ts`](src/lib/admin-worker/parish-osm-tiles.ts)). A curated
  table of country/region bounding boxes is cut into integer-degree tiles — 1°
  where parishes are dense and OSM is well tagged, 2° where they are sparse —
  and each tile's state (status, element count, last swept, next due) lives in
  one `AdminWorkerMemory` row keyed `osm-tile:<id>`, so there is no new table and
  no migration. A tile whose query comes back **at the element cap is DENSE**:
  it is quartered (quadtree) and its children are queued ahead of the catalogue,
  so no element is ever silently truncated — the failure mode of the old
  35-bounding-box rotation, which re-scanned the same first 500 results forever.
  Swept tiles come due again quarterly, empty tiles wait longer, failed tiles
  retry with a growing backoff. Selection is a cursor plus a LIFO queue of split
  children: a bounded number of small memory reads per run, never a scan of every
  tile.

  Nothing is invented: a candidate needs its OSM name plus **either** a locality
  tag **or** coordinates; a missing city may be filled from `is_in` or one
  bounded Nominatim reverse lookup, otherwise the record publishes on its
  coordinates with an empty city. Dedup runs cheapest-first — `sourceRef`,
  `addressKey`, same-name-within-200 m, then slug (a collision gets a stable
  suffix, never a silent skip) — and a re-swept parish **enriches its own row in
  place**.

  **Politeness and budget** ([`parish-osm-overpass.ts`](src/lib/admin-worker/parish-osm-overpass.ts)):
  one query at a time, at least 5 s apart, at most 2 mirrors tried per query, a
  90 s server-side timeout, a real User-Agent, and a **daily budget** counted in
  HTTP attempts. Endpoints are `overpass-api.de`, `overpass.kumi.systems` and
  `overpass.private.coffee`, with `OVERPASS_ENDPOINTS` prepending your own
  (a self-hosted or paid instance) to make parish growth deterministic.

  | Variable                                | Default  | Purpose                                                                    |
  | --------------------------------------- | -------- | -------------------------------------------------------------------------- |
  | `ADMIN_WORKER_OSM_PARISHES`             | on       | `0`/`false`/`off` disables the lane entirely                               |
  | `ADMIN_WORKER_OSM_MAX_QUERIES`          | `1`      | Tiles queried per run                                                      |
  | `ADMIN_WORKER_OSM_MAX_PUBLISH`          | `250`    | New parishes published per run (checked **before** any per-candidate work) |
  | `ADMIN_WORKER_OSM_OUT_CAP`              | `500`    | Elements returned per tile query — hitting it marks the tile DENSE         |
  | `ADMIN_WORKER_OSM_THROTTLE_MS`          | `180000` | Minimum interval between runs (3 min)                                      |
  | `ADMIN_WORKER_OSM_RUN_BUDGET_MS`        | `360000` | Wall-clock deadline per run, under the lane watchdog                       |
  | `ADMIN_WORKER_OSM_DAILY_BUDGET`         | `600`    | Overpass HTTP attempts per day                                             |
  | `ADMIN_WORKER_OSM_REVERSE_DAILY_BUDGET` | `1000`   | Nominatim reverse lookups per day                                          |
  | `ADMIN_WORKER_OSM_MIN_SPACING_MS`       | `5000`   | Minimum gap between consecutive Overpass requests                          |
  | `ADMIN_WORKER_OSM_RESWEEP_DAYS`         | `90`     | How long before a swept tile comes due again                               |
  | `ADMIN_WORKER_OSM_EMPTY_RESWEEP_DAYS`   | `180`    | Same, for a tile that yielded nothing                                      |
  | `OVERPASS_ENDPOINTS`                    | unset    | Comma-separated endpoints tried **before** the public mirrors              |

- **The discovery lane never fetches a parish website — a separate lane does.**
  Splitting the two is what lets discovery publish hundreds per run inside its
  watchdog instead of stalling on 10-second site fetches. The **parish website
  verification lane** ([`parish-website-verification.ts`](src/lib/admin-worker/parish-website-verification.ts))
  works through the published catalog at **30 sites per run, one at a time, 10 s
  each**, under a wall-clock budget below its own watchdog, persisting the cursor
  after **every** site so a killed run never repeats work
  (`ADMIN_WORKER_PARISH_VERIFY_LIMIT`, `ADMIN_WORKER_PARISH_VERIFY_BUDGET_MS`).
  Each parish's verdict and `nextDueAt` live in
  `payload._meta.websiteVerification` — meta, so a re-check never counts as a
  content change. The verdicts:
  - **not in communion** (Old Catholic / Union of Utrecht, Polish National
    Catholic, sedevacantist, the SSPX, independent "Catholic" bodies, women's
    ordination, Orthodox / Anglican identity) → the row is **unpublished, never
    deleted**, a human-review row explains why, and discovery is told not to
    republish it for a year (`osm-skip`);
  - **in communion** → kept, and any phone / Mass times / confession times the
    site shows are folded in (enrich-only, through the content-protection gate);
    re-checked in 180 days;
  - **unknown** (site unreadable, no signal) → **kept** on the strength of the
    explicit OSM `roman_catholic` tag, which already excludes Old Catholic /
    sedevacantist / Orthodox; re-checked in 90 days.

  The verifier ([`communion-verifier.ts`](src/lib/admin-worker/communion-verifier.ts))
  does **not** require an explicit "in communion with Rome" statement — a parish
  site rarely says that. It confirms communion the way a real parish identifies
  itself: the name of the **(arch)diocese or (arch)eparchy** it belongs to, or of
  **any of the 24 sui iuris Churches** of the Catholic communion (Roman/Latin,
  Maronite, Melkite, Ukrainian and other Byzantine/Greek Catholic, Chaldean,
  Syro-Malabar, Syro-Malankara, Coptic, Armenian, Syriac, Ethiopian/Eritrean, …),
  or "Roman Catholic", USCCB / Holy See. Disqualifying signals are checked first
  and always win. A bare "Catholic" alone is never enough — Old Catholics call
  themselves Catholic too — and stays unknown.

- **A parish publishes on just its name + address — it never gets stuck on
  missing detail.** Name + address (+ city) is the minimum publishable record;
  **phone, Mass times, and confession times are best-effort extras**, filled from
  OSM tags at discovery and from the website by the verification lane, and simply
  omitted when not found. Nothing about a missing phone or schedule ever blocks a
  publish or routes a parish to review.

- **Duplicates are judged by address, not name.** Two parishes at the same
  address are the same place however their names are spelled ("St. Mary" vs
  "Saint Mary Catholic Church"), so every parish carries a normalized
  `addressKey` ([`parish-address.ts`](src/lib/admin-worker/parish-address.ts):
  lower-cased, de-accented, street-type/directional words folded to a canonical
  form). A candidate whose `addressKey` matches an already-published parish is
  **not published again**. A continuous, keyless maintenance sweep
  ([`parish-refresh.ts`](src/lib/admin-worker/parish-refresh.ts), the
  `refresh-parishes` lane) walks the whole published catalog, back-stamping
  `addressKey` on every row and unpublishing any duplicate — so _previously_
  published parishes are de-duplicated too, not just new discoveries.

- **End-of-month parish refresh — with an email report, and never a time sink.**
  During the **last 7 days of each month** the same lane re-reads every published
  parish's website and refreshes its **Mass times, confession times, and phone**
  when they've changed, cursoring through the catalog a batch per pass so it
  covers all parishes across the window (`runParishMonthlyRefresh`). The **moment
  it finishes it stops for the month** and the worker returns to its normal tasks
  — it never burns the remaining days. If anything actually changed, the
  developer gets a **"Parish Directory Monthly Update" email** in the standard
  admin-email aesthetic stating how many parishes were updated
  ([`sendAdminWorkerParishRefreshReport`](src/lib/email/admin-send.ts)); if
  nothing changed, no email is sent. If the sweep can't make progress (repeated
  hard errors, or the month ends before it finishes) it **escalates to the
  developer**. Batch sizes are tunable via `ADMIN_WORKER_PARISH_REFRESH_BATCH`
  and `ADMIN_WORKER_PARISH_DEDUP_BATCH`; both sweeps are fail-open.

- **What the worker collects and what the site shows are two different
  questions.** The lane above still gathers designation, phone, Mass times,
  confession times and the rest, and they are still written to the payload and
  still published. The public card no longer displays them — see
  [The parish card, and "parishes near me"](#the-parish-card-and-parishes-near-me).
  Nothing in this pipeline changed when the card did.

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

- **Polite, resilient transport on approved hosts.** Authority hosts throttle
  or bot-block a worker that fetches too fast, and those failures — not junk
  candidates — are what the Fetcher health rating measures. So the static
  fetcher ([`fetcher.ts`](src/lib/admin-worker/fetcher.ts)) paces consecutive
  requests to the SAME host (`ADMIN_WORKER_FETCH_HOST_PACE_MS`, default 750ms;
  different hosts still run in parallel), **retries `429` (rate-limited) honoring
  the `Retry-After` header** instead of treating it as a hard client error, and
  retries `5xx`/network/timeout with exponential backoff. The per-request timeout
  is tunable (`ADMIN_WORKER_FETCH_TIMEOUT_MS`, default 15s) so a slow-but-alive
  authority host or a large encyclical PDF isn't failed by an over-aggressive
  cap. Deterministic `4xx` (404/403/…) are not retried; a genuine transport
  failure still falls through to the Wayback rescue below.

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

- **Lifts machine-readable structured data from every page — keyless.**
  Alongside the prose reader, a structured-data toolkit
  ([`structured-data-extractors.ts`](src/lib/admin-worker/structured-data-extractors.ts))
  parses the machine-readable facts most real Catholic pages already embed but
  that plain text discards: **schema.org JSON-LD** (incl. `@graph`), **OpenGraph
  / Twitter cards**, **microdata** (`itemprop`), **Dublin Core + standard
  `<meta>`**, and **definition lists / two-column fact tables** (how feast days,
  patronages, and reign/birth/death dates are usually presented). It normalises
  them into one `StructuredFacts` object — title, description, type, author,
  publication/modification dates, names, and labelled properties — which the
  source reader folds into extraction (and uses to recover a missing page
  title). Pure, deterministic, no API key, no model, and a **strict no-op** on
  pages with no structured data, so it only ever adds accurate signal. This lets
  the worker "determine the right info from what it scrapes" across **every**
  content type.

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
    `applyHomepageDraft` / `discardHomepageDraft`), driven from the local
    command center (`POST /api/homepage-draft/[id]` on 127.0.0.1).

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
  not banned, and (3) the `requireAdminWithDefender` wrapper, which
  adds the same reporting to a caller that needs the bare principal.
  Every admin API route now goes through the gate, so (3) guards no
  route today; it adds reporting, never authority. Confirmed brute force results in an
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
  unapproved hosts, validation sources unreachable, publish gated on evidence),
  it appends the **internal corrective path** first and, only for a genuine
  keyless/network toggle, the exact remediation
  ([`capability-gaps.ts`](src/lib/admin-worker/capability-gaps.ts)): e.g.
  _"reroute the blocked item to a different approved source and re-run the
  pipeline"_ or _"set `ADMIN_WORKER_OPEN_INTERNET=1`"_. It never recommends an
  external AI/API key — there is none to add. The Why-No-Growth panel appears on
  the Command Center and is included in every Developer Audit PDF.

- **Pipeline governor — forces productive forward movement every pass.** The
  brain's anti-fixation feedback is scoring-only: it can lower a stage's score
  but never _forbid_ it, so a stage with a high baseline (EXTRACTION/DISCOVERY
  tied to an open content gap) could still win pass after pass while producing
  nothing — re-planning a poison source read, or re-attempting a cross-source
  verification whose sources are all down. The governor
  ([`governor.ts`](src/lib/admin-worker/governor.ts)) closes that gap. Just
  before dispatch it reads the exact per-stage outcome ledger
  (`AdminWorkerStageOutcome`) over a short sliding window and, if the chosen
  content stage has been picked `MIN_SAMPLES`+ times with **zero** forward
  progress — or content growth has stalled despite an open gap — it overrides
  the choice. **Discovery does not count as forward progress**: surfacing
  candidate URLs (or scoring them) is top-of-funnel prep, not movement toward the
  public site, so only `SOURCE_FETCH → … → PUBLIC_PUBLISH` advancement clears the
  growth-stall check. (This was the exact freeze behind the "3403" incident:
  discovery "succeeded" every pass by surfacing candidates, so the stall never
  tripped and the fetcher was never forced while 600 candidates sat unfetched.)
  On a stall it forces the highest-priority **productive downstream** stage that
  has queued work (publish-first: PUBLIC_PUBLISH → STRICT_QA → cross-source
  verification → … → fetch), draining in-flight artifacts toward published
  content; and when nothing downstream is making progress it runs a terminal
  diagnostic (REPAIR → REPORTING → MAINTENANCE) for the main slot — one that can
  never loop into publishing — while the keyless ground-truth ingest that
  already runs every active pass keeps content growing. It only changes **which**
  already-gated handler runs — every QA/publish gate is unchanged, so forced
  publishing still requires `QA_PASSED` — and it acts **only in active mode and
  never when paused**, so it fully respects the safe-degraded-mode contract and
  introduces no publishing path the brain wouldn't already take. It never forces
  a stage that is itself spinning (so it converges down the ladder instead of
  oscillating), never overrides a stage that advanced even once in the window,
  and is deterministic, fail-open, and default-on
  (`ADMIN_WORKER_GOVERNOR_ENABLED=0` opts out). Every override writes a
  `governor_forced_stage` log so the audit trail shows "brain chose X →
  governor forced Y, because …". The brain's own stuck signal now also counts
  `needs_repair` (repair-planned) outcomes, not just `no_op`, so its soft penalty
  finally fires on the most common fixation too.

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
  improvements, remaining blockers). The due-check runs from the always-on
  **reporting lane on every pass** (plus a best-effort check at startup) —
  originally it ran ONLY at process startup, so the report fired only if the
  worker container happened to restart on the last day of the month, and a
  continuously-running worker silently skipped month-end (the June 2026
  report that never arrived). The job is idempotent per month via a durable
  `AdminDeveloperReportLog` marker (`MONTH:<yyyy-mm>` — at most one email no
  matter how many passes hit the gate), **catches up a missed month** on a
  later pass (only when the worker actually ran that month), and backs off
  6h between retries after a failed send. The "Monthly report generation"
  diagnostic now tracks these job rows, not manual audit pulls.

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
  (canonicalMax 7); Parish 200,000; Prayer 1,000; Pope 267; Saint 10,000;
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
- **Per-subtype coverage self-knowledge** (`coverage-model.ts`). Goals are
  type-level, but the catalog (`skills/catalog.ts`) declares the **subtypes**
  each type must cover (PRAYER → common / marian / eucharistic / saint /
  liturgical; CHURCH*DOCUMENT → encyclical / exhortation / council constitution
  / …). A type can hit its numeric target while a whole subtype sits at zero. So
  each pass the worker counts published items per `(contentType, contentSubtype)`
  in one grouped query, compares against the catalog, and builds a coverage map:
  which subtypes are present, which are **missing**, ranked neediest-type-first.
  Discovery then **steers toward the missing subtype** — even for a type already
  at its numeric target — biasing the open web-search query toward it (e.g.
  `eucharistic_prayer` → *"Catholic eucharistic prayer full text list"\_), so the
  worker methodically fills **every type and subtype** instead of over-serving
  the easy ones. Deterministic, fail-open, surfaced on the discovery log
  (`targetSubtype` + `coverageSummary`) and exposed via `computeCoverageModel`.
  Every published item is **stamped with its subtype at publish time**
  (`content-subtype.ts`, applied in the publish orchestrator): single-subtype
  types get their sole subtype, prayers/apparitions/church-documents are
  classified by clear signals (never a guess for a doctrinal document), so the
  coverage map reads real per-subtype counts instead of "untagged".

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

### Curated knowledge — the offline first-pass source

The repo ships a large, hand-verified curated knowledge base
(`src/lib/checklist/knowledge/`, `ALL_CURATED_ENTRIES`) of ground-truth,
schema-valid Catholic content with authority citations — **1,232 entries across
every content type**: the Church's fixed texts and canonical lists. Depth per
type is in the [content-goals table](#content-goals--the-largest-gap-first-scheduler)
above; six goals are met by curated content alone, with no network at all.

**Layout.** Each content type has a **file** that exports the aggregated array,
and — for the types that outgrew a single reviewable file — a **directory of
group files** beside it that the aggregator imports:

```
src/lib/checklist/knowledge/
  index.ts                  ALL_CURATED_ENTRIES + findCuratedEntry
  prayers.ts                aggregates →  prayers/batch-1.ts … batch-8.ts
  guides.ts                 aggregates →  guides/rosary-chaplets.ts, sacraments-1.ts,
                                          confession-adoration.ts, seasons-ocia.ts, …
  church-documents.ts       aggregates →  church-documents/group-1.ts, group-2.ts
  devotions.ts              aggregates →  devotions/group-1.ts, group-2.ts
  liturgical.ts             aggregates →  liturgical/group-1.ts, group-2.ts
  novenas.ts                aggregates →  novenas/group-1.ts, group-2.ts
  apparitions.ts            aggregates →  apparitions/group-1.ts
  marian-titles.ts          aggregates →  marian-titles/group-1.ts
  rites.ts                  aggregates →  rites/group-1.ts
  spiritual-practices.ts    aggregates →  spiritual-practices/group-1.ts
  saints.ts  popes.ts  doctors.ts  sacraments.ts  litanies.ts
  parishes.ts  church-history.ts  prayer-translations.ts
```

The split is purely so each file stays reviewable; a group file exports the same
`CuratedEntry[]` shape as the aggregate. Every entry validates against its
per-type content schema (`tests/checklist/knowledge.test.ts`), and one group file
can be checked on its own before it joins the registry:

```bash
npx tsx scripts/validate-curated-file.ts src/lib/checklist/knowledge/prayers/batch-7.ts
npx tsx scripts/validate-curated-file.ts src/lib/checklist/knowledge/*/*.ts   # all 645 group entries
```

It checks payload-schema validity, slug uniqueness inside the file and against
`payload.slug`, that citations are real page URLs rather than bare origins, that
referenced prayer / saint / devotion slugs actually exist (in the registry or in
the other files passed on the same command line, so a batch can be checked
together before it is aggregated), and that no novena day text is
template-generated. It lists **every** problem, never just the first.

**How curated content is published.** Through the real pipeline, not a back
door: `runCuratedIngest()` ([`curated-ingest.ts`](src/lib/admin-worker/curated-ingest.ts),
the `ingest-curated` lane) runs each pass as a bounded, idempotent, fail-open
step that publishes the next batch (default 25) of not-yet-live curated entries
through `runPublishOrchestrator()` — full safety gate, ten-dimension quality
gate, verifier evidence, persist — then refreshes the content goals. Curated
entries carry citations and a verifier sign-off, so the orchestrator's
brain-backed _advisory_ screens (communion-risk, semantic dedupe) are skipped for
them (`skipBrainScreens`) while every deterministic gate still runs.
`npm run seed:content` runs the same publish path once from the CLI
(`scripts/seed-curated-content.ts`) for a fresh local DB or any offline
environment.

**How a curated EDIT reaches production — fingerprint-gated re-publish.** The
seed skips every slug that is already published, so for a long time a corrected
prayer text or a rewritten guide shipped to production and the public page kept
showing the old words forever. `syncCuratedUpdates()`
([`seed-curated-content.ts`](src/lib/admin-worker/seed-curated-content.ts)) closes
that gap, and it is **not** new-slug-only:

1. A **stable sha256 fingerprint** is computed over the whole corpus —
   `(contentType, slug, payload)` with payload keys sorted — so it changes
   exactly when the shipped knowledge changes and not otherwise.
2. That fingerprint is compared with the one recorded in `AdminWorkerMemory`
   after the last **complete** sync. Equal ⇒ the sync returns immediately
   without touching a row. This is what makes running it every pass free.
3. Different ⇒ the live rows for each type are read in one query per type, and
   each entry's proposed payload is merged in memory. Fields the **publish path**
   stamped after the entry left the knowledge base (`contentSubtype`, `latin`,
   `greek`, `translations`, …) are preserved rather than treated as content the
   curated entry "removed".
4. A genuinely changed row goes through `applyProtectedContentUpdate` — the
   current row is snapshotted to `PublishedContentVersion`, the version is
   bumped, and the change is applied. A destructive replace is **explicitly
   allowed here**, because curated text carries the highest authority the worker
   has (quality 0.95, evidence = its own citations) — and it is reversible
   because of the snapshot.
5. The work is **bounded per call** (25 by default) and the fingerprint is only
   remembered once **nothing** is left to update, so a large rewrite keeps
   draining across passes until every live row matches.

**Curated-built types are not web-extracted.** `GUIDE` and `MARIAN_TITLE` grow
from the curated base (and, for Marian titles, the keyless structured Wikidata
ingestor) — not from live discovery. Arbitrary discovered "how-to" / devotional
pages classified into these near-catch-all types rarely yield a complete,
publishable record, so web-extracting them produced `needs_repair` on every pass
and the EXTRACTION stage looped with zero successes. They keep a real extractor
(the "every type is buildable" guarantee holds — see
`tests/admin-worker/content-types.test.ts`), but `CURATED_BUILT_CONTENT_TYPES`
excludes them from `WEB_EXTRACTION_CONTENT_TYPES`, which is the set BOTH the
extraction dispatcher and the brain's extraction-backlog count use — so the
worker never loops on them.

### Structured Wikidata knowledge, and the lane that repairs it

The biggest deterministic lever is not "read messy HTML" but "ingest structured
knowledge". The structured-knowledge engine
([`structured/`](src/lib/admin-worker/structured)) queries **Wikidata** (free,
CC0, citable) by QID, pulls **Wikipedia** lead abstracts and parsed infoboxes for
narrative and cited fields, maps each entity to a schema-valid record, and
publishes the not-yet-live ones through the same real gate as everything else —
no API key, no model, no hallucination surface. It is **self-advancing** (a
per-ingestor cursor in `AdminWorkerMemory` walks the corpus across passes and
wraps to re-sweep), **self-improving** (the same row accumulates a
success/failure signal), and **self-expanding** (each ingested entity's official
website joins the discovery queue). The registry covers `POPE`, `SAINT`,
`CHURCH_DOCUMENT` (documents **and** the 21 ecumenical councils), `DOCTOR`,
`RITE`, `DEVOTION`, `MARIAN_TITLE` and `SPIRITUAL_PRACTICE`.

**Saints are the largest structured corpus, so they get a repair lane of their
own.** `repair-structured-saints` ([`structured/saint-repair.ts`](src/lib/admin-worker/structured/saint-repair.ts))
is a bounded, idempotent, cursor-based sweep over the **already-published**
saints that came from Wikidata (identified by their `wikidata.org/wiki/Q…`
citation or `sourceRef`). It re-derives from the structured record, by QID and
through the rules the ingestor uses today, the three things the early ingest got
wrong:

- **canonization status** — mapped by label, so Orthodox / Anglican / Coptic /
  folk "saints" had been published as Catholic `canonized`, and the Orthodox
  honorific "The Venerable" as the Catholic `venerable`;
- **saint type** — scanned from prose, so St Patrick came out an "apostle" and
  St John Vianney a "virgin";
- **display title** — the bare Wikidata label, so structured saints sat next to
  the curated "Saint Joseph" with no honorific at all;

plus a re-check of a multi-feast saint's published day against the
infobox-first corroboration rule (the old `SAMPLE()` pick was frozen forever).

Corrections go through `applyProtectedContentUpdate` — versioned, reversible,
evidence-gated. A row is **unpublished only when the structured record PROVES
the veneration is not Catholic** (`isProvenNonCatholic`), never on doubt, and
every unpublish leaves both an `AdminWorkerLog` row and a `HumanReviewQueue` row
so an operator can restore it with one click. **Nothing is deleted.** The lane is
bounded (25 rows and one batched query per pass), cursor-driven, honours the
shared source cool-down, and is deliberately **not** `activeOnly` — it is pure
deterministic re-derivation with no brain judgement, so it keeps the catalog
honest even while the brain is degraded.

The types whose required content is **verbatim or doctrinally sensitive** — an
apparition's official approval status, a novena's nine-day prayer text, a
prayer's verbatim body — are **not** abstract-ingested. The structured
**discovery seeder** ([`discovery-seeder.ts`](src/lib/admin-worker/structured/discovery-seeder.ts))
instead enumerates them from Wikidata and feeds their **authoritative source
URLs** to the live extraction + cross-source-verification pipeline, so they grow
from approved sources rather than from an encyclopedia.

### Every rejection reports a reason

The structured ingest used to throw away most of what it fetched and record
nothing about why. Production, 2026-09-07:

```
wikidata-spiritual-practices  fetched 68,   1 already live,  66 SKIPPED
wikidata-saints               fetched 100, 34 already live,  40 SKIPPED
wikidata-marian-titles        fetched 6,    0 already live,   3 SKIPPED
wikidata-rites                fetched 2,    0 already live,   1 SKIPPED
```

Ninety-seven percent of one ingestor's page vanished, and nothing in the log
line, the log payload or the worker's own self-diagnosis could tell a **correct**
rejection ("this is a Buddhist practice, not a Catholic one") from a **bug**
("the infobox parser regressed and every feast day now fails to corroborate").
`ingestors.ts` alone held **65 `return null` statements**, and the pass log was
gated on `published > 0` — so a page that published nothing wrote no line at
all. The one case that most needed explaining was the one case that was silent.

**The contract is a type, not a convention.** A mapper no longer answers
`Promise<CuratedEntry | null>`; it answers
`MapResult = CuratedEntry | MapRejection`, and a `MapRejection` can only be built
by `reject(code, detail?)` with a code from the closed `REJECTION_CODES` set
([`structured/reject.ts`](src/lib/admin-worker/structured/reject.ts)). That
choice — a typed **result**, rather than a `reject()` recorder handed in on the
context — is what makes the guarantee a compile-time one: `return null` inside a
mapper is now a type error, so a silent discard cannot be written, not merely
detected afterwards. The closed union does the same job for the code itself: a
typo'd code fails `tsc` instead of quietly opening a histogram bucket nobody
counts. The `code` is the aggregatable half; `detail` is free text for a human,
trimmed and capped at 200 characters, and is **never** counted. Attribution does
no I/O and cannot throw — recording _why_ a row was dropped must never be able to
change _whether_ it was dropped.

**The 30 codes**, grouped by where the decision is made rather than by severity
(a correct rejection and a bug can share a code — telling them apart is the
diagnostic script's job, below):

| Group                      | Codes                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Row shape** (5)          | `no_english_label`, `missing_required_field`, `slug_unresolvable`, `invalid_url`, `antipope_excluded`                                                                                                              |
| **Narrative sourcing** (5) | `no_wikipedia_article`, `wikipedia_fetch_failed`, `description_too_short`, `no_source_url`, `narrative_too_short`                                                                                                  |
| **Catholicity / kind** (3) | `not_catholic_context`, `unrecognized_type`, `owned_by_other_ingestor`                                                                                                                                             |
| **Church documents** (3)   | `date_unparseable`, `no_key_themes`, `no_canonical_url`                                                                                                                                                            |
| **Saints** (9)             | `saint_facts_unparseable`, `not_catholic_status`, `non_catholic_religion`, `no_catholic_religion`, `no_canonization_date`, `feast_unparseable`, `feast_uncorroborated`, `feast_ambiguous`, `biography_unavailable` |
| **Orchestration** (5)      | `map_threw`, `duplicate_in_page`, `schema_invalid`, `publish_rejected`, `publish_threw`                                                                                                                            |

The orchestration codes are recorded by `ingest.ts`, not by a mapper, and they
close two holes the counters never showed: a mapper that **throws** is now
`map_threw` rather than a vanished row, and a same-page duplicate — dropped by
the dedup, incrementing no counter at all — is now `duplicate_in_page`.

**Reading the log line.** `structured_knowledge_ingest` is written whenever the
pass published something **or dropped something**, which is the change that
matters; the old `published > 0` condition is what made the 66-row case
invisible. The message ends with the top five reasons, highest first, ties broken
alphabetically so two passes with the same counts render identically. Wrapped
here for width, this is the line the spiritual-practice page diagnosed further
down would write:

```
Structured-knowledge ingest (wikidata-spiritual-practices): published 0 new
SPIRITUAL_PRACTICE record(s) from Wikidata + Wikipedia (fetched 25, 0 already
live, 25 skipped, 0 live page(s) skipped). Dropped 25: no_source_url 15,
not_catholic_context 8, unrecognized_type 2.
```

`safeMetadata` carries the same information in machine form: `rejected` (the
total), `skipReasons` (the **whole** histogram, not just the top five),
`topSkipReasons`, and `skipSamples` — up to ten `code: detail` strings, so one
log row can show _which_ entities a reason fired on without carrying a page of
scraped text.

The severity stays **INFO** even on a page that published nothing and dropped
everything, which is deliberate and is worth knowing before someone "fixes" it:
`writeAdminWorkerLog` routes only INFO through the per-`eventName` hourly budget
in `event-sampler.ts`, so a WARN here would be **unsampled**, and `cleanup.ts`
retains non-INFO for 90 days instead of 14. A barren corpus is barren on _every_
pass, indefinitely — an unsampled row per pass, carrying a histogram plus ten
samples and kept six times longer, is exactly the shape the sampler was written
to stop. The drop information is in the message and the payload at either
severity; raising a stuck lane is the diagnostics path's job, not this row's.

**The ratchet.** `structured/reject-coverage.ts` re-reads the directory from disk
and fails CI if any mapper — or any `MapResult`-returning helper — can reach a
bare `return null`, or if any `reject(…)` / `note(…)` / `tallyRejection(…)` /
`code:` literal names a code outside the closed set. The compiler already
forbids both today; the scanner catches the two things the compiler cannot see
coming: a future `map()` written back to `CuratedEntry | null` (where
`return null` type-checks again — the exact regression that produced the
production symptom), and a `code` parameter widened to `string`. It is
deliberately syntactic and blanks comments and string bodies — offsets and
newlines preserved — before any pattern is applied, so prose about `return null`
in a doc comment is never mistaken for code; template literals get real handling
because a naive scanner desynchronises on the pope summary's nested `${…}` and
silently drops a whole file from the scan, and a guard that quietly stops
covering a file is worse than no guard.

`tests/admin-worker/structured-reject-coverage.test.ts` drives it, modelled on
`tests/security/admin-gate-coverage.test.ts`: it first proves the scanner
**detects** planted violations in a throwaway fixture repo — a bare return in a
mapper, a bare return in a helper, a one-letter-off code — so the clean
assertions against the real tree cannot pass vacuously. Measured on this tree on
**2026-09-08**: 15 files scanned, 9 reporting regions (8 mappers — one per
registered ingestor — plus one `MapResult` helper), **0** bare returns, **0**
unknown codes, and **30 of 30** declared codes actually in use. That last
assertion matters as much as the others: a declared-but-never-used code is a
bucket that can never be counted, which means either the rule it named was
deleted or a call site forgot it. The suite also hands **every** registered
ingestor a row it cannot possibly map and asserts the answer is an attributed
rejection with an in-set code.

```bash
npx vitest run tests/admin-worker/structured-reject-coverage.test.ts
#   → 24 passed (1 file)
```

### Diagnosing a page: `diagnose-structured-ingest.ts`

The histogram says `feast_uncorroborated 6`. The next question is always _which
six_, and the answer decides whether to leave the ingestor alone or go fix it.
[`scripts/maintenance/diagnose-structured-ingest.ts`](scripts/maintenance/diagnose-structured-ingest.ts)
replays exactly one page — the same SPARQL query, the same mappers, the same
guards — and prints the histogram with example entities per reason.

```bash
# What can be diagnosed (exits 0; with no target at all it prints this and exits 1)
npx tsx scripts/maintenance/diagnose-structured-ingest.ts --list

# By content type …
npx tsx scripts/maintenance/diagnose-structured-ingest.ts SPIRITUAL_PRACTICE

# … or by ingestor id, deeper into the corpus, with more examples
npx tsx scripts/maintenance/diagnose-structured-ingest.ts wikidata-saints \
    --batch 40 --offset 200 --examples 5

# Machine-readable (the full diagnosis plus the by-code grouping)
npx tsx scripts/maintenance/diagnose-structured-ingest.ts SAINT --json
```

| Flag              | Default | Effect                                                             |
| ----------------- | ------- | ------------------------------------------------------------------ |
| _(positional)_    | —       | A content type (`SAINT`) **or** an ingestor id (`wikidata-saints`) |
| `--list`          | —       | List every ingestor id and its content type, and stop              |
| `--batch N`       | `25`    | Rows to request (clamped to the ingestor's own `maxPageSize`)      |
| `--offset N`      | `0`     | Cursor offset to read at — `0` is the start of the corpus          |
| `--examples N`    | `3`     | Example entities printed per reason code                           |
| `--concurrency N` | `2`     | Concurrent mapper runs                                             |
| `--spacing MS`    | `400`   | Pause between mapper batches                                       |
| `--json`          | —       | Emit the diagnosis as JSON instead of the report                   |

**It cannot write to a database, and that is structural rather than promised.**
The page fetch was split out of `ingest.ts` into
[`structured/source-page.ts`](src/lib/admin-worker/structured/source-page.ts)
precisely so this script does not have to import the ingest lane: `ingest.ts`
pulls in the publish orchestrator, the checklist validator and the worker log,
so a diagnostic that imported it would drag a Prisma-touching module graph into
a tool whose whole promise is that it cannot write. There is no Prisma client
anywhere in this script's import graph, it never advances a cursor and never
touches `AdminWorkerMemory` — so it is safe to run on the operator's Mac while
the production worker is publishing. It is also deliberately gentler on the
sources than the ingest lane (concurrency **2**, not the lane's 8, with a pause
between batches), because a human running a diagnostic has no business spending
the worker's Wikidata and Wikipedia rate budget. `ADMIN_WORKER_SKIP_NETWORK=1`
makes it say so and exit rather than reporting a page of `wikipedia_fetch_failed`,
and a SPARQL failure is reported as a source failure with a non-zero exit rather
than as an empty corpus.

### What the measurement actually showed

This is the part worth carrying forward: **most of those skips were correct.**
Both runs below are real output from this tree on **2026-09-08**.

The spiritual-practice corpus is the alarming one — 100 % of the first page
dropped — and it is not a bug:

```
wikidata-spiritual-practices  (SPIRITUAL_PRACTICE)
  enumerated 25, hydrated 25 row(s)
  mapped OK  0
  dropped    25 (100% of the page)

  REASON HISTOGRAM
      15   60%  no_source_url
       8   32%  not_catholic_context
       2    8%  unrecognized_type

    not_catholic_context (8)
      - sound bath [Q101007375]
      - deity yoga [Q10940474]
      - shijie [Q11042475]
      - sauma [Q111660986]
    no_source_url (15)
      - plain speech [Q102111981]
          no P856 / P973 / en.wikipedia article on the entity
```

Wikidata's "spiritual practice" class is a **world-religions** class, and the
first page is a fair sample of it: deity yoga is Vajrayana Buddhist, _shijie_ is
Taoist, a sound bath is New Age, and the corpus goes on through Islamic, Sikh
and Falun Gong practice. Refusing to publish any of them as a **Catholic**
spiritual practice is the guard working, not failing. The larger bucket is
duller still:
sixty percent of the page has no P856, no P973 and no English Wikipedia article,
so there is nothing citable to publish **from** — a corpus-definition problem,
permanent by nature, not a transient failure. That is precisely why the pass log
stays INFO: this lane is sterile on every pass, forever.

The saints corpus behaves differently — half the page publishes — and its
rejections are individually defensible:

```
wikidata-saints  (SAINT)
  enumerated 30, hydrated 30 row(s)
  mapped OK  15
  dropped    15 (50% of the page)

  REASON HISTOGRAM
       6   20%  feast_uncorroborated
       3   10%  biography_unavailable
       2    7%  description_too_short
       2    7%  no_wikipedia_article
       1    3%  feast_ambiguous
       1    3%  no_canonization_date

    feast_uncorroborated (6)
      - Liberius [Q102105]
          Liberius: P841 08-27 vs enwiki
    biography_unavailable (3)
      - Florencia Caerols Martínez [Q10282823]  (plwiki only)
```

`Liberius [Q102105]` is the worked example. Wikidata asserts a feast of
27 August for him; the English article does not state one, so the
infobox-first corroboration rule refuses the date and the row is dropped.
That is the right answer — Liberius is the one fourth-century pope **not**
venerated as a saint, absent from the Roman Martyrology, and the reason no
article corroborates a feast is that there is no feast. `biography_unavailable`
is the same shape of honesty: a Spanish martyr whose only article is on the
Polish Wikipedia yields no English biography worth publishing, and the ingest
declines rather than inventing one.

**So: a high rejection rate is not by itself a bug.** The histogram tells you
_which_ question to ask, and the script tells you _whom_ it fired on; the
judgement is still a human's. What has changed is that the judgement is now
possible at all. A ratio that _should_ raise an eyebrow is a sudden shift in the
**shape** of a lane's histogram — `feast_uncorroborated` jumping from six on a
page to thirty, say — because that is what a regressed parser looks like, and it
is exactly what the old silent skip made invisible.

### Pipeline rules the content path encodes

Each of the following is a rule the pipeline now enforces because its absence
caused a measured, named stall. They are listed with the failure they prevent so
none of them is quietly removed as "unnecessary complexity".

- **Structured-feed-built types are not web-extracted either.** `PARISH` grows
  from **OpenStreetMap** via `parish-osm.ts` (the `discover-parish-osm` lane
  publishes clean, deduplicated records), not from arbitrary parish web pages.
  Web-extracting parishes was the root of two simultaneous escalations: pages
  with a parseable address produced artifacts that collide on generic names
  (many "St. Mary Catholic Church") → `duplicateSafety=0` → never published
  (`EXTRACTING_WITHOUT_PUBLISHING`), and pages without one produced
  missing-field artifacts whose `EXTRACT_FAILED` repair plans re-extracted the
  same source, failed, and abandoned (`Repair orchestrator` FAIL). `PARISH` now
  lives in a separate `STRUCTURED_BUILT_CONTENT_TYPES` set — excluded from
  `WEB_EXTRACTION_CONTENT_TYPES` like the curated-built types, and (like them)
  **never the web-pipeline mission target or a major-goal campaign target**: a
  web surge can't close a gap that only the OSM lane fills, and because `PARISH`'s
  ~200k gap dwarfs every other goal, leaving it eligible pinned both selectors on
  `PARISH` forever — the campaign SURGE'd on `PARISH`, the whole web pipeline
  chased a type it can't grow, `0` published, and the gap never shrank so it never
  escaped (the recurring `EXTRACTING_WITHOUT_PUBLISHING` escalation, build
  `9e7d3cd`: `major_goal_campaign SURGE on PARISH (gap 199972)` → `governor_forced_stage
SOURCE_FETCH→EXTRACTION` → `worker_stuck: SOURCE_FETCH 10/10 passes`). It is
  still a real growth goal (its gap counts toward "goals met" and keeps the worker
  growing), just grown by its OSM lane, which runs every pass regardless of the
  campaign phase — so the campaign is free to surge on the biggest **web-growable**
  gap (saints, prayers, …) and actually publish. The repair orchestrator also
  short-circuits an `EXTRACT_FAILED` plan for a structured-built type
  (re-extraction is futile) so those plans resolve instead of churning to
  abandonment.

- **The worker reconciles the old plans a code update makes moot — it "knows
  we fixed it."** Making `PARISH` structured-built stops _new_ un-repairable
  plans, but historical `EXTRACT_FAILED` plans filed before the fix still sat in
  the repair queue pinning the `Repair orchestrator` health red. So every repair
  pass now begins with `reconcileObsoletePlans`
  ([`repair-orchestrator.ts`](src/lib/admin-worker/repair-orchestrator.ts)): it
  scans open plans (`PENDING`/`RUNNING`/`ABANDONED`), resolves each one's content
  type from the cheapest reliable signal (the type recorded on the plan's
  metadata → the source read behind it → the artifact it targeted), and closes
  any that target a now-structured-built type as `SUCCEEDED` with a
  `reconciled: … closed after code update` note (surfaced as
  `repair_plans_reconciled` + `plansReconciled` in the pass log). This clears the
  historical backlog automatically the first pass after the fix ships — the
  general mechanism for "the worker escalated something, we pushed a fix, and it
  recognises the old items are resolved" without a human draining the queue.

- **A duplicate source can never wedge the extraction queue — it heals instead.**
  Artifacts are unique on `(contentType, normalizedSlug, packageChecksum)` ≈
  (type, normalized title), and the SAME entity routinely arrives via a second
  source-read: a mirror/alternate URL with the same title, or a re-fetch of a
  page whose body changed (new checksum ⇒ new read row). A blind `create` then
  threw `P2002`; with that error silently swallowed, the read never got an
  artifact, stayed the oldest classified read, and was re-picked on EVERY pass —
  extraction logged `→ CHECKLIST_READY` every ~15 s while `0` artifacts were
  actually created and `0` published (the live `package artifact (?)` loop, the
  real EXTRACTING_WITHOUT_PUBLISHING wedge on build `fc87335`). `runExtraction`
  now detects the duplicate FIRST: the redundant read is consumed with a
  terminal **`DUPLICATE`** verdict (like `UNUSABLE`/`WRONG` — it leaves the
  extraction queue and the brain's backlog count permanently), and when the
  existing artifact is still broken pre-funnel (`EXTRACTED`/`NEEDS_REPAIR`/
  `REJECTED`) and the new extraction is complete, the duplicate **heals it in
  place** to `CHECKLIST_READY` — a second source is a second witness, not waste.
  Any real persistence error is loud (`reportQueryError`) and the stage reports
  `failed` — never a silent fake success (`extraction_duplicate` log events).

- **The BUILD_READY drain diagnoses citations from the right column.** The
  drain's `MISSING_CITATIONS` gate read `extractedFields` (the display payload)
  for citations, but extraction records sourcing in the **`fieldProvenance`**
  column — so every fully-provenanced artifact was misdiagnosed as citation-less
  → `NEEDS_REPAIR` → an unrepairable repair plan → abandoned → `REJECTED`
  (the census: 15 NEEDS_REPAIR / 4 REJECTED / 31 abandoned plans, "Repair
  orchestrator FAIL"). `diagnoseArtifactGate` now treats non-empty
  `fieldProvenance` as citations, with the embedded-payload check kept as a
  fallback.

- **The publish specialist panel counts provenance as citations (the real
  "built but never published" plateau).** At the publish step the
  orchestrator runs a 12-member specialist panel; its citation specialist
  objects — routing the item to `NEEDS_REVIEW` — when `citationCount === 0`.
  That count was derived **only** from a `citations`/`sources` array inside the
  payload, which live-extracted artifacts don't populate (they store sourcing
  in the `fieldProvenance` column, surfaced to the orchestrator as
  `hasSourceEvidence`). So a fully-provenanced item that had **already cleared
  strict QA** (finalScore ~0.94) was scored 0-citation, objected to, and parked
  at `NEEDS_REVIEW` — where nothing recovered it. Curated + structured ingest
  publish fine because they pass `skipBrainScreens: true`; only the live-fetch
  path hit this, so every web-extracted item silently stalled at publish. The
  fix folds the provenance signal into `citationCount` (matching the drain's
  `lacksCitations` and strict-QA's provenance dimension), so the panel's notion
  of "cited" is consistent with the rest of the pipeline; genuinely uncited
  content still scores 0 and can still be objected to. Proven end-to-end against
  a live Postgres: a seeded `BUILD_READY` prayer now flows
  `BUILD_READY → QA_PASSED → PUBLISHED` and `publishedContent` increments.

- **The drain self-heals the misrouted-review backlog.** Items the old citation
  gate stranded at `NEEDS_REVIEW` are not seen by the funnel (which scans
  `BUILD_READY` / `VERIFICATION_READY` / `QA_PASSED`), so the fix alone wouldn't
  free the existing backlog. `runBuildReadyDrain` now recovers them: a
  `NEEDS_REVIEW` artifact parked with the specific citation-objection reason that
  **holds a `PASSED` strict-QA row and carries field provenance** is reset to
  `QA_PASSED` (a proven false positive) so the fixed publish path re-publishes it
  the same pass. Scoped tightly by the exact reason string so genuine QA
  review-band holds are untouched; also proven end-to-end against live Postgres.

- **Post-publish verification no longer deletes content it merely couldn't
  reach.** After publishing, the worker HTTP-probes the live public page. The
  probe's `catch` branch (fetch threw — DNS/connection-refused/TLS/timeout, or
  the worker simply can't loop back to its own public host because its egress is
  proxied/firewalled, or the site is mid-deploy) returned `FAIL`, which drove
  `rollbackPlan` to **unpublish-and-delete** the freshly-published, QA-passed
  item. In any environment where the worker can't reach the site that silently
  flattens all growth — publish → probe can't connect → delete → republish →
  delete — and destroys vetted content on a transient blip. An **unreachable**
  probe now returns `WARN` (unverified, not failed): it does not aggregate to
  `FAIL`, so no rollback fires and the content stays published to be re-verified
  on a later pass. A genuine HTTP **error response** (`!res.ok`) still `FAIL`s —
  that is the site actively reporting the page is broken, which is real evidence,
  unlike an unreachable host. (Observed first-hand: running the worker without
  the web service up rolled back curated council documents purely because the
  probe couldn't connect.)

- **Repair plans can actually repair now.** The drain files `EXTRACT_FAILED`
  plans keyed by ARTIFACT id; the handler only knew how to resolve a source-read
  id, so those plans failed all 5 attempts by construction and abandoned.
  `loadSourceReadForPlan` now resolves `metadata.artifactId` (and an artifact-id
  `failedEntity`) → the artifact's `sourceReadId` → the read; the drain also
  records `sourceReadId` on the plans it files. Repair success is honest —
  re-extraction (now block-aware, same strength as the dispatcher's) must yield
  a COMPLETE package (no fatal reasons AND no missing fields); the old test
  checked fatal reasons only, so a still-broken re-extraction "succeeded",
  deleted the artifact, the stage rebuilt the same broken artifact, and a fresh
  plan was filed — churn forever. On success the artifact is **healed in place**
  to `CHECKLIST_READY` (no delete/rebuild). And `reconcileObsoletePlans` now
  also closes artifact-scoped plans that are moot: target artifact already
  in/past the funnel (repair achieved), source read consumed as `DUPLICATE`, or
  both targets gone (dangling).

- **Cross-source verification can use the worker's own corpus as a witness.**
  Evidence-gathering depended on a handful of hardcoded probe URLs per
  (type, field) — when those 404'd, every sensitive field came back MISSING and
  the artifact parked `NEEDS_REPAIR` (eventually `REJECTED`) no matter how true
  its facts were. `findCorpusValidationEvidence` adds a deterministic fallback:
  a stored source-read from a DIFFERENT approved host whose page states both
  the entity and the expected value IS independent cross-source evidence, and
  the corpus grows with every discovery pass, so verification converges instead
  of starving. The gate itself is unchanged — sensitive facts still never
  publish without stored MATCH evidence from an independent source; the network
  probes still run first.

- **Reports and advisories only name work the web pipeline can act on.**
  `mission_control` ranked its "next" mission over ALL goals, so `next = PARISH`
  was the permanent (and misleading) recommendation; `adviseNextWork` likewise
  advised the biggest raw gap; and the growth orchestrator filed a
  `DISCOVERY_FAILED` plan for `PARISH` every stuck-week. All three now exclude
  curated/structured-built types — the mission tree still shows every mission
  (parishes included; they grow on the OSM lane), but "next action" style
  outputs only ever name goals the web pipeline can actually advance.

- **OSM parishes publish on the tag; the website is checked later, separately.**
  A candidate carries OpenStreetMap's curated `denomination=roman_catholic` tag,
  which already excludes Old Catholic / sedevacantist / Orthodox bodies, so
  discovery publishes on it and never fetches the site. Making discovery wait for
  a website verdict was what stranded nearly every OSM parish: an _unreadable_
  site (blocked egress, site down, non-HTML) returns `unknown`, which is **not**
  evidence against communion, yet treating `unknown` as "route to review" made an
  unreadable site _more_ restrictive than no site at all — and the 10-second
  fetches meant a run could barely finish a handful of parishes inside its
  watchdog. The communion check now lives in its own bounded
  [`verify-parish-websites`](#internal-worker-lanes--concurrency-controls) lane,
  where only a verdict that _proves_ not-in-communion unpublishes a row (never
  deletes it). The bulk `overpass-api.de` source is also probed by the
  outbound-reachability diagnostic (best-effort, non-critical) so an egress block
  on the parish feed is visible rather than silent.

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
| **`discovery-orchestrator.ts`**          | 8 discovery methods + per-type strategies + cadence                                                       |
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
| **`readings-source.ts`**                 | Readings-source registry — one adapter: the committed lectionary tables                                   |
| **`self-maintenance.ts`**                | Sense → diagnose → repair → verify on the worker's own health (the `maint-self-heal` lane)                |
| **`event-sampler.ts`**                   | Per-event hourly log budget, enforced inside `writeAdminWorkerLog`                                        |
| **`brain-mutex.ts`**                     | Serialises brain callers — the resident brain answers one request at a time                               |
| **`parish-osm-tiles.ts`**                | The persistent 1°/2° tile grid + quadtree split for OSM parish discovery                                  |
| **`parish-osm-overpass.ts`**             | Overpass transport: mirror failover, request pacing, daily budget                                         |
| **`parish-website-verification.ts`**     | Bounded communion re-check of published parish websites                                                   |
| **`structured/saint-repair.ts`**         | Cursor-based re-derivation of published Wikidata saints (versioned, never deletes)                        |
| **`structured/reject.ts`**               | The mapper contract: `MapResult`, the closed 30-code rejection set, the reason histogram                  |
| `structured/reject-coverage.ts`          | Source scanner behind the "a null must report" ratchet test                                               |
| `structured/source-page.ts`              | One page of source rows — shared by the ingest and the read-only diagnostic                               |
| **`structured/diagnose.ts`**             | Read-only replay of one page: histogram + example entities, no publish path, no Prisma                    |
| `security-defender.ts`                   | Defender + automatic ban + email                                                                          |
| `security-detectors.ts`                  | 10 deterministic detector functions                                                                       |
| **`request-defender.ts`**                | 7 helpers (failed login, brute force, mutation, …)                                                        |
| **`admin-route-guard.ts`**               | `requireAdminWithDefender` — defender reporting around a bare `requireAdmin()`; never a second gate       |
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

The human admin is the site's super-admin. The **master ON/OFF pill** in the
native application is the primary control: OFF stops the entire local workload —
loop, Python brain, browser rendering, discovery, scans, reports and worker
email — and nothing takes over in the cloud.

The finer-grained `paused` flag remains in `AdminWorkerState` for the running
worker: when paused it stops all non-security work — the security defender keeps
running so the site is never unprotected — writes a single "Admin Worker is
paused (reason)" log entry per pass, and skips the rest of the loop.

Liveness now means "the LOCAL runtime is alive": a fresh heartbeat only counts
while a live local execution lease exists. Diagnostics distinguishes **Admin
Worker intentionally inactive** (master switch OFF — reported as healthy, not a
production failure), **active locally**, **switched on but disconnected**
(a genuine local failure), and **paused**.

### Liveness & crash resilience

A pass row is created `RUNNING` at the top of each cycle and only reaches a
terminal status when the pass finishes. Three guarantees keep a crash from
poisoning that state (the developer audit had found a pass orphaned
`RUNNING` for 16 h after the process died mid-pass):

- **`runOnePass` always reaches a terminal status.** Everything after
  `startPass` runs inside a `try/catch/finally`; the `finally` closes the
  row as `FAILED` if any earlier step — the brain run, the governor, a
  decision log, even the catch block — throws before a terminal status is
  written. A pass can never be left `RUNNING`.
- **One throwing pass never kills the loop.** `runAdminWorkerLoop` isolates
  each iteration in `try/catch`: a throw is counted, backed off, and the
  loop continues instead of exiting the process.
- **Stale passes are reaped at startup.** `reapStaleRunningPasses`
  (`passes.ts`) runs before the loop and marks any pass still `RUNNING`
  past the 10-minute liveness cutoff as `FAILED` (it can't belong to a
  fresh process). The worker also logs a `brain_startup` event so the audit
  can tell "brain never started this process" apart from "brain made no
  recent decision". The Command Center's Recent Passes table flags any
  stuck `RUNNING` row in rose before the reaper closes it.

#### Keeping the process itself alive

The three guarantees above assume the Node process is still running. The
2026-07-12 audit showed it wasn't: the worker died "cleanly between passes"
and stayed dark for ~28 h. The worker is a bare `tsx` process, so the
`uncaughtException`/`unhandledRejection` handlers in `src/instrumentation.ts`
(gated to `NEXT_RUNTIME === "nodejs"`) never load for it — **any** stray
process-level throw terminated it silently with no catchable error and no
restart. Four layers now prevent that (`worker-supervisor.ts`,
`intelligence/client.ts`, `dynamic-fetcher.ts`):

- **Process-level safety net.** `installProcessSafetyNet` registers
  `uncaughtException`/`unhandledRejection` handlers that convert a fatal,
  silent exit into a loud, survivable event — console + audit-log + a
  throttled (15-min) critical-failure email — and **keep the process alive**.
  Safe because every pass re-reads all state from Postgres, so no in-memory
  invariant can be corrupted across passes by a single stray throw.
- **Supervisor restart.** In continuous mode `runLoopSupervised` re-enters
  `runAdminWorkerLoop` after a bounded exponential backoff (2s → 60s cap) if
  the loop **machinery itself** throws or returns unexpectedly, so the worker
  self-heals in-process rather than exiting the container (whose restart
  policy may back off or give up). One-shot / `--max-jobs` runs still execute
  exactly once and propagate errors.
- **Brain stdio never crashes the worker.** The resident Python brain is a
  long-lived child; a Node stream that emits `'error'` with no listener
  throws. When the brain dies abruptly the OS pipe can emit `EPIPE`/`EIO` on
  stdout/stderr, so **all three** stdio streams (not just stdin) now carry an
  `'error'` swallow — the dying pipe can't take the worker with it.
- **Headless-Chromium OOM prevention.** The dynamic fetcher launches a full
  Chromium per render; unbounded, N concurrent lanes could fan out N browsers
  and trip an OS OOM-kill (SIGKILL — uncatchable in JS, a credible cause of a
  silent death and the `LOOPING SOURCE_FETCH` escalation). `renderPage` now
  bounds concurrent renders with a hand-off semaphore (default 1, env
  `ADMIN_WORKER_DYNAMIC_FETCHER_CONCURRENCY`), enforces a hard wall-clock cap
  over the whole render (`ADMIN_WORKER_DYNAMIC_FETCHER_HARD_CAP_MS`) so a
  wedged browser can't hang forever holding a slot, and tears each browser
  down hard — bounded `close()` then `SIGKILL` of the underlying process — so
  zombie browsers never accumulate.

The Command Center also surfaces productivity at a glance: a **Pending
builds** stat (built artifacts awaiting QA/publish, with the QA-passed and
needs-repair split) and, when the worker is live but built artifacts are
piling up with nothing passing QA, a **pipeline-stall banner** that points
the operator at the funnel bottleneck and repair plans. The pipeline
governor (`governor.ts`) forces the downstream drain
(publish → strict QA → cross-source verification → …) whenever the
intelligence layer is active, so a live, active worker never fixates while
built artifacts wait.

### BUILD_READY drain + per-item gate triage

The governor forces the _right stage_; the **drain** (`build-ready-drain.ts`,
run every pass) makes sure the built-artifact backlog actually clears and that
every stuck item explains itself. Each pass it owns the **whole downstream
funnel** — `CHECKLIST_READY → BUILD_READY → VERIFICATION_READY → QA_PASSED →
published`:

- **Bridges `CHECKLIST_READY` → `BUILD_READY`.** The EXTRACTION stage stamps a
  fully-populated package `CHECKLIST_READY`, but the checklist/citation
  orchestrator that promotes it to `BUILD_READY` was previously _only_ reachable
  when the brain happened to pick the checklist stage that pass. If the brain
  fixated elsewhere, complete artifacts piled up at `CHECKLIST_READY` — extraction
  succeeding while **nothing published** (the `EXTRACTING_WITHOUT_PUBLISHING`
  escalation). The drain now runs that bridge itself every pass, so a complete
  artifact is promoted, QA'd and published deterministically without depending on
  brain stage selection. (`bridged` is reported on every drain.)
- **`diagnoseArtifactGate`** (pure, unit-tested) names the EXACT gate blocking
  each built item — `READY_TO_PUBLISH`, `AWAITING_QA`, `AWAITING_VERIFICATION`,
  `VERIFICATION_INCOMPLETE`, `MISSING_REQUIRED_FIELDS`, `MISSING_CITATIONS`,
  `LOW_CONFIDENCE`, or `DUPLICATE` — and the outcome to route it to. The gate is
  written to the artifact (`gateDiagnosis`) so the operator can see, per item,
  **why it isn't publishing** (surfaced by the "Build → publish drain"
  diagnostics rating and the developer audit).
- It then **routes** each item: publish · run strict QA · run cross-source
  verification · create validation-evidence repair · file a repair plan · move
  to human review with a clear reason · mark duplicate · block — and **drives
  the real gate handlers** (checklist bridge → verification → QA → publish) in a
  bounded loop to drain the backlog, prioritising the downstream drain over more
  upstream extraction. It never bypasses a gate (it just runs the same handlers
  over the backlog). The publish step runs **regardless of brain mode** — a
  `QA_PASSED` artifact has already cleared strict QA + the publish orchestrator's
  gates, so it publishes even when the Python brain is degraded (the fix for the
  recurring `EXTRACTING_WITHOUT_PUBLISHING` stall). Only doctrinally-sensitive
  content is held for the active brain (`allowSensitive = active`).

The **Package-artifacts diagnostic** now reports the `CHECKLIST_READY` and
`EXTRACTED` counts alongside `BUILD_READY` / `QA_PASSED` / `NEEDS_REPAIR` /
`REJECTED`, so a stall _before_ `BUILD_READY` is visible instead of reading as
"0 BUILD_READY" with no explanation; `CHECKLIST_READY` is likewise counted in the
self-assessment publish backlog.

### Database schema-integrity guard (silent-stall prevention)

Almost every funnel read is fail-open (`.catch(() => [])`) so a transient hiccup
can't wedge a pass — but that has a sharp edge: if the **deployed database is
behind the Prisma schema** (a migration didn't apply, a column is missing), a
full-row `findMany` throws `P2022`, the fail-open catch swallows it as "no rows",
strict QA sees "no artifacts pending", and **nothing publishes while builds keep
succeeding** — the recurring `EXTRACTING_WITHOUT_PUBLISHING` escalation with no
error surfaced anywhere. Two guards make that failure impossible to be silent:

- **A schema-integrity self-check** ([`schema-integrity.ts`](src/lib/admin-worker/schema-integrity.ts))
  probes every critical table with a full-row read at **worker startup** and on
  **every diagnostics pass**. On a drift it names the exact missing column, logs
  a critical `schema_drift_detected` event, emails the developer, and turns the
  **Database schema integrity** diagnostic **red** with the fix
  (`prisma migrate deploy`) — instead of a mysterious no-publish.
- **The publish-path reads no longer mask DB errors as empty**: the strict-QA
  candidate fetch and the BUILD_READY drain now `reportQueryError` (loud
  `console.error` with the Prisma code) on a schema/DB error before failing open,
  so a `P2022` can never again read as "nothing to do".

### Review-queue intelligence

Review items never sit unexplained. Every `HumanReviewQueue` row now carries a
**blocking gate**, **needed action**, **repair suggestion**, and **next
automated action** alongside its reason and before/after version — and the drain
routes an item to review only when it needs human judgment; anything repairable
goes to a repair plan instead of waiting on a human.

### Internal worker lanes + concurrency controls

The worker used to run its per-pass supplementary workstreams strictly serially —
one `await` after another, one task type at a time. They now run as **many
fine-grained parallel lanes inside the same worker process** (no extra deployed
service): every independent workstream is its own lane, so the worker fires a lot
of tasks at once instead of blocking on each other (`lanes.ts` + `worker-lanes.ts`).
Each lane is individually tracked, so you can see exactly what every one is doing.

**Content lanes** run only while the Python final brain is active (`activeOnly` —
they publish). **Ops lanes** run every pass regardless of brain mode. Both run
only inside a pass, which runs only while the master switch is ON.

| Lane                       | Kind    | Watchdog | What it does                                                                                                                                                         |
| -------------------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingest-curated`           | content | 120 s    | Publishes the next batch of curated entries + the fingerprint-gated re-publish of edited ones                                                                        |
| `ingest-structured`        | content | 6 min    | Wikidata/Wikipedia structured ingest for the type furthest from its goal                                                                                             |
| `ingest-liturgical`        | content | 120 s    | Keyless liturgical-calendar ingest (feasts of the Lord + solemnities)                                                                                                |
| `enrich-translations`      | content | 120 s    | Authentic Latin/Greek backfill from the internal corpus                                                                                                              |
| `enrich-reviews`           | content | 120 s    | Review-queue auto-resolve                                                                                                                                            |
| `enrich-pope-cleanup`      | content | 120 s    | Pope-record cleanup                                                                                                                                                  |
| `discover-structured`      | content | 6 min    | Structured discovery seeding                                                                                                                                         |
| `discover-parish-osm`      | content | 8 min    | The OSM tile sweep. A content lane, but deliberately **not** `activeOnly`: it is deterministic and brain-free, so it grows parishes even while the brain is degraded |
| `discover-web`             | content | 120 s    | The 8-method web discovery orchestrator                                                                                                                              |
| `drain`                    | ops     | 10 min   | The BUILD_READY drain (a legitimately long-running lane, hence the higher watchdog)                                                                                  |
| `readings`                 | ops     | 120 s    | Daily-readings refresh + the rolling backfill                                                                                                                        |
| `maint-schema`             | ops     | 120 s    | Schema-awareness (brain, under the mutex)                                                                                                                            |
| `maint-ui`                 | ops     | 120 s    | UI-awareness (brain, under the mutex)                                                                                                                                |
| `maint-self-model`         | ops     | 120 s    | The whole-app self-model pass (brain, under the mutex)                                                                                                               |
| `maint-custody`            | ops     | 120 s    | Content custody / missing-information scan (brain, under the mutex)                                                                                                  |
| `maint-hygiene`            | ops     | 120 s    | Display repairs on live rows (slug-shaped titles, stale subtitles) **and the hourly ledger prune**                                                                   |
| `maint-self-heal`          | ops     | 6 min    | [Self-maintenance](#self-maintenance) — sense → diagnose → repair → verify                                                                                           |
| `reporting`                | ops     | 120 s    | Reporting pass + the month-end report gate                                                                                                                           |
| `refresh-parishes`         | ops     | 120 s    | Continuous address-dedup + the last-7-days-of-month parish refresh                                                                                                   |
| `repair-structured-saints` | ops     | 6 min    | Re-derives published Wikidata saints against their source — deterministic, so it runs regardless of brain mode                                                       |
| `verify-parish-websites`   | ops     | 6 min    | 30 parish sites per run, communion verdict + `nextDueAt`                                                                                                             |
| `intelligence`             | ops     | 120 s    | Post-pass analysis + lab + skill matrix + code-version — **the single brain-calling lane**                                                                           |
| `escalation`               | ops     | 120 s    | Self-assessment → governance → escalation                                                                                                                            |
| `innovation`               | ops     | 120 s    | The measure-only innovation lab                                                                                                                                      |

**Priority: content goals first, then management + security.** While any goal has
an open gap the growth lanes (`ingest-*`, `discover-*`, tagged `growth: true`)
run at full pace every active pass. Once **every** content goal is met
(`contentGoalsMet` — no `ContentGoal` row has `gapCount > 0`), those growth lanes
drop to a slow maintenance sweep (`ADMIN_WORKER_GROWTH_SWEEP_MS`, default 30 min)
that still catches newly-added feasts and saints without building past target at
full pace, and the worker's active work becomes the management + security lanes —
while the decision brain itself idles to `MAINTENANCE`. Security response is
always-on independent of the loop (request-path middleware + the `escalation`
lane). Non-growth lanes are never throttled.

**Major-goal campaigns (`major-goal-campaign.ts`).** When a single goal has a gap
big enough to be "getting in the way of sustainable progress" — the unmet,
web-growable goal with the largest absolute gap, ≥ `ADMIN_WORKER_CAMPAIGN_MIN_GAP`
(default 1000) — the worker runs it as a **campaign** instead of letting it
trickle:

1. **DRAIN** — first finish everything already built and waiting to publish (the
   funnel) and take on **no new discovery** (the `discovery: true` lanes are
   paused), so nothing in-flight is abandoned.
2. **SURGE** — once the funnel is clear, **all** discovery + pipeline resources
   point at the campaign goal: `nextPriorityContentType` forces the mission
   target onto it (overriding the normal de-rank + rotation) until its gap
   closes.
3. Then the **next-biggest** goal becomes the campaign; when every remaining gap
   is below the threshold the worker returns to NORMAL rotation.

It is generic (any **web-growable** type, picked by gap size), read-only +
fail-open (any error ⇒ NORMAL), and the active phase + goal are logged
(`major_goal_campaign`). Curated-built (`GUIDE`, `MARIAN_TITLE`) **and
structured-feed-built (`PARISH`)** types are never campaign targets — a web surge
can't close a gap that only their own ingest lane fills. `PARISH` matters most
here: its ~200k gap dwarfs every other goal, so leaving it eligible pinned the
campaign on `PARISH` forever — the surge commandeered the entire web pipeline for
a type the web pipeline can't grow, `0` published while the OSM lane was starved,
and the gap never shrank so it never escaped (the recurring
`EXTRACTING_WITHOUT_PUBLISHING` escalation). It is excluded from **both** the
campaign target and `nextPriorityContentType`'s mission target (and from the
`discovery-orchestrator` fallback + `why-no-growth` auto-focus), so the campaign
surges on the biggest goal it can actually publish while `PARISH` keeps growing on
its OSM lane every pass.

Concurrency is made **safe by construction, not by luck**:

- Lanes touch **disjoint work domains** (curated vs structured vs OSM vs
  liturgical ingest publish different content sets; the drain owns artifacts;
  discovery owns candidates), so they don't fight over the same rows.
- `PublishedContent @@unique([contentType, slug])` makes double-publishing
  **impossible at the DB level** even under a race — idempotency by constraint.
- **Artifact leases** (`claimArtifact`, `AdminWorkerPackageArtifact.leasedBy` /
  `leaseExpiresAt`) give explicit **task ownership**: a lane claims an artifact via
  an atomic conditional `updateMany` before mutating it, so two lanes (or two
  worker processes) never double-work the same item. A crashed lane's lease
  **expires and is reclaimed** (`reapArtifactLeases`).
- A global **concurrency cap** (`ADMIN_WORKER_LANE_CONCURRENCY`, default 8) bounds
  resource use — extra lanes queue and run as slots free. It is kept at or below
  the Prisma connection pool (`PRISMA_CONNECTION_LIMIT`, default 10) so many
  concurrent lanes never starve the pool (`P2037`); raise **both together** on a
  bigger machine.
- Stale lane rows from an earlier lane layout are pruned each pass
  (`pruneUnknownLaneStates`), so the live board only ever shows lanes that are
  actually running.
- Every lane is **isolated** (its own try/catch): a failing lane never kills the
  others, and it enters a **backoff cooldown** (5 min) before retrying, so a
  hard-failing lane can't hot-loop.
- Every lane is raced against a **watchdog** (`ADMIN_WORKER_LANE_TIMEOUT_MS`,
  default 120 s, with the higher per-lane values in the table above): a lane whose
  `run()` never settles is timed out, recorded as errored, and the others proceed
  — a hung lane can never wedge the pass or orphan a `RUNNING` row.
- **Brain-calling work lives in one lane.** See
  [The Python brain bridge does not queue](#the-python-brain-bridge-does-not-queue).

Each lane records its live state to `AdminWorkerLaneState` — status, current
item/gate/strategy, capacity, concurrent tasks, last outcome/error/duration —
which is the practical **operational-self-awareness** surface the "Internal worker
lanes" diagnostics rating + the pipeline page show: which lanes ran, which are in
error-backoff, and what each last did.

### The Python brain bridge does not queue

Worth stating plainly, because the obvious assumption is wrong and the
consequences were expensive.

The resident brain answers **strictly one request at a time**, and the bridge
([`intelligence/client.ts`](src/lib/admin-worker/intelligence/client.ts)) **does
not queue**: every caller writes straight to the child process's stdin and starts
its own timeout **the moment it writes**. Responses are multiplexed back by id
over newline-delimited JSON, so concurrent callers are not an error — but they
are not concurrent work either. Two lanes calling the brain at once do not run in
parallel: the second one waits inside the Python loop while its 8 s timeout is
already ticking, and a lane the watchdog has given up on keeps queueing calls
into the next pass.

So callers **serialize through a mutex**
([`brain-mutex.ts`](src/lib/admin-worker/brain-mutex.ts)): at most one of them
talks to the brain at a time, and each one's timeout starts only once it actually
holds the process. It is deliberately tiny — a promise chain, no re-entrancy, no
priorities; a holder that throws still releases (the chain settles in `finally`),
and every brain call carries its own timeout, so a holder can never hang the
queue indefinitely. `brainMutexState()` exposes live occupancy for diagnostics.

Two structural rules keep this honest: **all** post-pass brain work lives in the
single `intelligence` lane, and the lanes that must call the brain from outside it
(`maint-schema`, `maint-ui`, `maint-self-model`, `maint-custody`) take the mutex
around their brain work.

When the brain is unavailable the bridge returns `null` rather than throwing —
resilience, not optionality: it is always consulted, it simply never blocks a
pass. A crash / timeout / protocol mismatch marks it down, but it **re-probes and
self-heals** after a cooldown (`INTELLIGENCE_DOWN_RETRY_MS`, default 60 s) so a
transient outage can't pin the worker degraded for the process lifetime. All
three stdio streams carry an `'error'` swallow, so a dying pipe can't take the
worker with it.

### Ledger retention

The worker's own bookkeeping is what destroyed the production database once (see
[Self-maintenance](#self-maintenance)), so retention is now explicit, layered,
and it runs where it will actually run.

**Where.** `pruneLedgerRows` ([`cleanup.ts`](src/lib/admin-worker/cleanup.ts)) is
called from the **`maint-hygiene` lane every pass**, not from the CLEANUP mission
stage. The stage only runs when the brain picks it, which can be days apart,
while the ledgers grow by ~35 rows on **every** pass. The prune throttles itself
to once an hour per process and is fail-open per table, so calling it every pass
costs nothing.

**What, and for how long:**

| Table                           | Kept    |
| ------------------------------- | ------- |
| `AdminWorkerLog` (INFO)         | 14 days |
| `AdminWorkerLog` (WARN / ERROR) | 90 days |
| `AdminWorkerActionScore`        | 14 days |
| `AdminWorkerBrainCall`          | 14 days |
| `AdminWorkerReasoningGraph`     | 14 days |
| `AdminWorkerDecision`           | 14 days |
| `AdminWorkerPass`               | 14 days |
| `AdminWorkerStageOutcome`       | 30 days |
| `AdminWorkerCalibrationHistory` | 30 days |
| `AdminWorkerStucknessRecord`    | 30 days |
| `PostPublishVerification`       | 30 days |
| `AdminWorkerRepairPlan`         | 30 days |

Deletes are batched (`DELETE … WHERE id IN (SELECT id … LIMIT 5000)`) so each
statement takes a short lock. Content, and WARN/ERROR audit rows inside their
window, are never touched. `AdminWorkerReasoningGraph`,
`AdminWorkerCalibrationHistory`, `AdminWorkerStucknessRecord` and
`PostPublishVerification` were added to this list _because_ the post-mortem found
them unpruned; between them and `AdminWorkerActionScore` / `AdminWorkerBrainCall`
they were 99 % of the 21 GB.

**And a per-event budget.** `writeAdminWorkerLog` consults the
[event sampler](src/lib/admin-worker/event-sampler.ts) on **every INFO write**:
one `eventName` may write `ADMIN_WORKER_EVENT_BUDGET_PER_HOUR` rows per hour
(default 120) before it is suppressed for `ADMIN_WORKER_EVENT_COOLDOWN_MS`
(default 10 min), and the next row it does write says how many were dropped.
Enforcing the budget **inside the writer** is what makes the `LOG_EVENT_SPAM`
repair real for every event name, including ones added later — the earlier design
mutated a map only nine call sites ever consulted, so suppressing anything else
changed nothing at all. **WARN and ERROR rows are never sampled**: they are the
audit trail.

### Stuck protections

Five independent mechanisms, each catching a different way the worker can stop
making progress:

1. **The pass can never be left `RUNNING`.** Everything after `startPass` runs
   inside `try/catch/finally`; the `finally` closes the row as `FAILED` if any
   earlier step throws. `reapStaleRunningPasses` closes anything a crashed
   process left behind, at the next boot.
2. **Per-lane watchdogs.** Every lane is raced against its timeout (table above);
   an expired lane is recorded as errored and enters cooldown while the others
   proceed. A hung lane can never wedge a pass.
3. **The pipeline governor** ([`governor.ts`](src/lib/admin-worker/governor.ts))
   reads the exact per-stage outcome ledger just before dispatch and, when the
   chosen content stage has been picked repeatedly with **zero** forward
   progress, forces the highest-priority productive downstream stage instead.
   Discovery does not count as forward progress — surfacing candidate URLs is
   top-of-funnel prep, not movement toward the public site. It only changes
   _which_ already-gated handler runs. It also judges fixation **per content
   type** and can force a **corrective path out of** a fixated acquisition stage
   rather than only routing around it — see
   [A worked example: the 0 ms watchdog](#a-worked-example-the-0-ms-watchdog).
4. **Adaptive idle backoff with a floor** ([`loop.ts`](src/lib/admin-worker/loop.ts)).
   A pass that does no work still costs ~140 database round trips, so the less a
   pass can achieve the longer the loop waits: an ordinary idle pass waits the
   configured start value (`ADMIN_WORKER_IDLE_BACKOFF_MS`, default 15 s, doubling
   to `ADMIN_WORKER_IDLE_BACKOFF_MAX_MS`, default 120 s), a **brain-degraded**
   pass at least 30 s, a **paused** pass at least 60 s. And a pause is treated as
   a **state, not an event**: the transition in, the transition out, and a
   heartbeat at most once a minute in between. Production wrote 649,793
   `loop_paused` rows because a paused pass logged once per tick and ticked once
   per second; `backoffFloorMs` is the exported rule that stops it, pinned by a
   test rather than inferred from timing. Those defaults are only defaults if an
   unset variable actually reaches them, which for a while it did not — see
   [A worked example: the 0 ms watchdog](#a-worked-example-the-0-ms-watchdog).
5. **Stuckness detection that is acted on.** The brain's `detect_stuckness` runs
   each pass; when it fires, `runStucknessPass` takes real corrective action
   (aggressive review-queue auto-resolve, capability diagnosis, a high-priority
   developer request naming the precise remediation) before asking for help. Both
   the `worker_stuck` log row **and** the durable `AdminWorkerStucknessRecord` are
   now gated by **one** sampling decision — gating only the log row is exactly
   what let the durable table grow to 207,830 unpruned rows — and
   [self-maintenance](#self-maintenance) is what escalates when the condition
   persists.

Above all of that sits the self-monitoring → governance → escalation layer
described below, which decides how to respond to the worker's **overall** state
and pages the admin at most once per open issue.

### Adaptive strategy memory + innovation lab

The worker already has strong _per-source_ adaptivity (reputation, host memory)
and two fixed fallback chains (fetch: static → headless Chromium → Wayback
archive; extraction: deterministic → AI). Phase C/D adds _per-**method**_
learning so the worker knows which approach works and gets better over time:

- **Per-method memory (`method-memory.ts` → `AdminWorkerStrategyStat`).** Every
  method records its outcome per _(dimension, method, content type)_ —
  `recordMethodOutcome` maintains attempts/successes/failures and a
  recency-weighted success rate (EWMA). Discovery already feeds it: each pass
  records which discovery method (SITEMAP / RSS / INTERNAL_LINK / SEARCH_PAGE /
  WEB_SEARCH / DIRECTORY / CONFIGURED / API) surfaced candidates for that content
  type — "which method worked, and why".
- **Ranking + advisory use (deliberately not auto-disabling).** `rankMethods`
  orders methods by EWMA (preferring content-type-specific data over the `*`
  aggregate) to answer "which method is most productive for this type," surfaced
  in diagnostics + the operational summary. It is intentionally **not** used to
  disable a live discovery method: for a coverage-maximising worker, "a method
  surfaced nothing this pass" is the normal steady state of a source that is
  simply caught up — not a failure — so skipping on it would stop the worker
  polling healthy sources for newly-published content. Active method-switching on
  hard failure is already handled where it is safe: the fetch chain
  (static → headless → archive), the extraction chain (deterministic → AI), and
  the source-reputation layer that pauses genuinely-bad hosts.
- **Innovation lab (`innovation-lab.ts`).** A throttled, **measure-only** ops
  lane that runs a bounded 2-group experiment over the recorded stats (never a
  live traffic split, never publishes): it picks the dimension with the most
  competing methods, compares the top two, and persists a `LabExperimentPlan` +
  `LabExperimentResult`. When the margin is decisive with enough data on both
  sides, it **remembers the winner** (`AdminWorkerMemory` `strategy_winner:*`) as
  a durable, operator-visible recommendation surfaced in diagnostics and the
  operational summary (advisory — not auto-applied to disable a live method).
  This is the TypeScript experiment runner the schema and Python brain were
  designed for but never had.

The "Strategy memory + innovation" diagnostics rating surfaces the best method
per dimension and the most recent experiment's verdict.

### Published-content protection (versioned, reversible, conservative)

The worker enriches and repairs already-published content — but it must never
quietly destroy good content. `content-protection.ts` makes every automated edit
to a live `PublishedContent` row **conservative, versioned, and reversible**:

- **`evaluateContentChange`** (pure, unit-tested) classifies a proposed change vs
  the current payload as **enrich** (fill an empty field, extend an existing
  one), **replace** (an existing non-empty field would be removed, shortened, or
  swapped for different content), or **noop**.
- **`applyProtectedContentUpdate`** routes the write through the gate:
  - _enrich_ → **snapshot the current row** to `PublishedContentVersion`, bump
    `PublishedContent.version`, then apply. The prior title/subtitle/payload/
    checksum are preserved, so the edit is **reversible**.
  - _replace_ (destructive) → **refused** and logged (`protected_update_blocked`)
    unless it is _explicitly allowed_ AND backed by `qualityScore` +
    `evidenceCount` above the floor. Good content is preserved, not overwritten.
  - _noop_ → nothing happens.
- **`restorePublishedContentVersion`** rolls a live row back to any prior
  snapshot (snapshotting the current state first, so the restore is itself
  reversible) — the payload-level rollback the unpublish-only path was missing.

The prayer-translation enrichment now writes through this gate, so its Latin/Greek
fills are snapshotted and reversible. The "Published-content protection"
diagnostics rating surfaces how many versions were captured (reversibility) and
how many destructive overwrites were refused (content preserved).

### Operational self-awareness (what am I doing / why / what's next)

`operational-summary.ts` composes all of the above into ONE answer to the
operator's real questions — surfaced on the pipeline page and available to
reports:

- **Am I working?** heartbeat freshness + paused + blocker, and how many lanes
  are active vs in error-backoff.
- **What am I doing?** the current mission stage + reason (from the brain's
  selected action) and the live lane states.
- **Which strategy?** the best-performing method per learned dimension.
- **Why isn't more publishing?** the BUILD_READY backlog broken down by blocking
  gate (`AWAITING_QA`, `AWAITING_VERIFICATION`, `MISSING_CITATIONS`, …).
- **What changed after a deploy?** the latest recorded running code version.
- **What next?** `deriveNextBestAction` returns a single mission-aware
  recommendation, prioritising meaningful progress: resume-if-paused → address
  escalations → clear errored lanes → **drain the built backlog (naming the
  dominant gate)** → fix liveness → continue/generate.

### Self-monitoring, governance & escalation

Above the in-pass governor sits a higher-order self-monitoring → governance →
escalation layer that decides how to respond to the worker's OVERALL state and
recent history, and pages the human admin when something is seriously wrong.

- **Self-assessment (`self-assessment.ts`).** A composer — it adds no new
  scoring, it folds the signals the worker already records (operational state,
  the sampled world, the exact per-stage outcome ledger, quality scores, growth)
  into one `SelfAssessment`: current task/content-type, idle time, retry
  patterns, duplicate work, in-flight backlog, and whether it is actually moving
  **published** content forward. It classifies typed WARNINGS —
  `LOOPING`, `EXTRACTING_WITHOUT_PUBLISHING`, `PUBLISHING_LOW_QUALITY`,
  `BURNING_STORAGE`, `REPEATED_TYPE_FAILURE`, `NO_VALUE` — every threshold
  env-tunable, and stays silent when the worker is paused or offline (that is
  expected idleness, surfaced by the banner, not a productivity fault).
- **Governance (`governance.ts`).** A pure, deterministic layer that turns the
  assessment into ONE decision — continue · retry · skip · pause · escalate ·
  changeStrategy. `escalate` is reserved for SERIOUS conditions (any ERROR-level
  warning, or a "no value / wasting resources" warning); it never escalates when
  paused/offline. It can recommend a pause on the worst cases, which the loop
  honours only when explicitly enabled (auto-pause is destructive, so it is off
  by default).
- **Escalation (`escalation.ts`).** When governance decides to escalate, the
  engine **deduplicates by a stable fingerprint** (`kind + content-type + build
SHA`) via the `AdminWorkerEscalation` table: an issue that is already open and
  already emailed only bumps its occurrence count — **the admin is emailed at
  most once per open issue**. A "skipped" delivery (no `ADMIN_EMAIL` configured)
  is retried; a "sent" one is not.
- **Knowing when something is fixed (code-update aware).** The worker records
  every build it runs (`code-version.ts`: git SHA + a deterministic corpus
  fingerprint of the code shape, so a change is detected even with no `.git`),
  and the escalation engine uses that to close issues the moment a fix ships. An
  open escalation is resolved — with a recorded **`resolvedReason`** — when
  either (a) the warning is **gone from the live assessment**
  (`condition_cleared`, gated to a live, non-paused worker so an offline lull
  never mass-closes real issues), or (b) a **newer build is running**
  (`superseded_by_upgrade`): a code update may well have fixed it, and because
  the build SHA is in the dedup fingerprint, a genuinely-persistent issue simply
  re-escalates afresh under the new build (a new email), so closing the
  prior-build row loses no signal.
- **Post-upgrade grace.** Every warning is computed over a rolling window, so
  right after a fix deploys the window still contains pre-upgrade activity and
  can't yet tell a shipped fix from a still-broken issue. When an upgrade landed
  **inside** the assessment window, the engine **holds the page** for a grace
  window (defaults to the assessment window;
  `ADMIN_WORKER_ESCALATION_UPGRADE_GRACE_HOURS` overrides, `0` disables) and logs
  `escalation_deferred_post_upgrade`. Once the window fully post-dates the
  upgrade, a genuinely-persistent issue escalates for real — so a deployed fix is
  never spuriously re-escalated on stale data, and a real regression still pages.
- **Escalation email + PDF.** A serious escalation emails the admin using the
  shared admin-email aesthetic (`sendAdminWorkerEscalation`, reusing
  `renderAdminEmail`/`sendAdminEmail`) with four sections — **what happened /
  what the system detected / what the worker needs / action required** — plus a
  version-context row, and attaches **`Admin Worker Escalation.pdf`**
  (`generateAdminWorkerEscalationPdf`, reusing the same `ReportBuilder` as the
  Developer Audit). The PDF documents the escalation, live worker state, the
  code/version context, current diagnostics, the "why content isn't growing"
  chain, the worker logs for the timeframe, AND the full developer report for
  that same timeframe. Everything is fail-open and throttled (~15 min); it runs
  every pass and once at startup, and never affects the pass outcome.

The Developer Audit gains an **Open Escalations** section, and diagnostics gains
a **Worker escalations** rating, so open escalations are visible in-app as well
as by email.

#### Diagnostics report reality, not false alarms

Several health ratings are deliberately **context-aware** so the board reflects
genuine problems, not stale assertions or "no work to do" states:

- **Content schemas** verifies COMPLETENESS against the live
  `ChecklistContentType` enum (every type has a registered schema) instead of a
  hard-coded count — growing the catalog is not a failure.
- **Content goals** and **Autonomous progress** are long-horizon targets
  dominated by the 200k-parish goal, so they score by **health (is the worker
  still making forward progress)**, not raw completion %: green while content is
  being published (progress in the last 7d), red only when genuinely STALLED.
  The true completion count/percent stays in the summary.
- **Cross-source verifier** and **Strict QA** pass when there is **no eligible
  artifact work** (an empty build funnel is healthy — most content publishes via
  curated/structured ingest, which doesn't route through those stages); they warn
  only when artifacts are actually waiting and not being processed. **Strict QA**
  further measures its pass rate over artifacts that remain **viable** — an
  artifact QA correctly caught as junk and that was then terminally `REJECTED` is
  QA _working_, so it is excluded from the rate rather than counted as a QA
  failure (and small windows never hard-fail).
- **Fetcher** measures **transport health**, not candidate quality: benign
  policy rejections (unapproved host, login wall, binary/PDF, or a JS-only shell
  the dynamic fetcher couldn't render) are the fetcher _correctly refusing_
  unusable content and are excluded from the failure denominator. Only genuine
  network / HTTP / timeout failures on approved hosts count — so the rating no
  longer reads red merely because discovery surfaced off-registry or dynamic
  candidates.
- **Checklist + citation bridge** scores by **current backlog**, not lifetime
  yield: the only artifacts the CHECKLIST_CREATION / CITATION_CREATION stage
  still owes are those sitting at `CHECKLIST_READY` without a `checklistItemId`.
  An empty backlog is caught-up (pass); a growing one is a genuine stall. The old
  `bridged / all-artifacts-ever` ratio pinned this red forever once normal
  web-extract rejects accumulated, even while the bridge worked perfectly.
- **Source coverage** credits the always-available curated knowledge base, so a
  type is flagged "blocked by source coverage" only when it genuinely has **no
  way to produce content** (no curated entries AND too few primary sources) — not
  merely because it had no fresh web activity this week.
- **Outbound reachability** treats `query.wikidata.org` as **best-effort** (its
  WDQS commonly rate-limits datacenter IPs, and the worker already falls back to
  alternate SPARQL endpoints + Wikipedia); the rating passes when the CRITICAL
  hosts (Wikipedia, Vatican) are reachable and notes the handled fallback.
- **Repair orchestrator** measures repair failures in a **rolling 7-day window**
  (abandoned plans are terminal history that accumulates forever), and when a
  plan is abandoned its linked artifact is driven to a terminal `REJECTED` state
  so it stops sitting in `NEEDS_REPAIR` limbo and inflating the backlog. Two
  further fixes stop plans from _reaching_ abandonment needlessly: (1) an
  `EXTRACT_FAILED` plan re-extracts the SAME stored read, which is deterministic
  — so if a required field is missing once it is missing every time. Rather than
  burn all `maxAttempts` reproducing the gap and then abandon, the handler now
  resolves such a plan **terminally in one attempt** (rejecting the stuck
  artifact so it leaves the funnel, and deferring the alternate source to
  discovery), and curated-built types (`GUIDE` / `MARIAN_TITLE`) short-circuit
  like PARISH. (2) `filePlan` will not **re-file** a `(kind, failedEntity)` that
  ABANDONED within a 7-day cooldown, so a proven dead-end can't re-flood the
  window with fresh maxAttempts cycles; after the cooldown a genuine retry is
  allowed again. The same terminal-resolution rule now covers every deterministic
  dead-end so none of them abandons: `CLASSIFY_FAILED` (re-classifying the same
  stored read is deterministic), `VALIDATION_FAILED`/`VALIDATION_EVIDENCE_MISSING`
  on an unresolvable artifact (re-checking a vanished id is futile — also added
  to the reconcile sweep), and `DISCOVERY_FAILED` when a clean run surfaces 0 for
  a saturated type (the normal steady state, not a repair failure — only a
  genuine discovery error is retried). And the two skill-runtime filers now go
  through `filePlan` (not a raw create), so the coalesce + cooldown apply to
  skill-driven repairs too instead of minting a fresh cycle every pass.

### When a rejection is not a failure — the classifier-rejection loop

**Measured, not hypothetical.** On 2026-09-10 a `SOURCE_FETCH` **LOOPING**
escalation fired for `SAINT`: 19 failures, 1 `needsRepair`, 0 successes in six
hours. Nothing was stuck. Every one of those "failures" was a fetch that
**succeeded**, of a `gcatholic.org` diocese page that the classifier scored
between **0.05 and 0.25** against the 0.55 threshold and correctly refused.
Via Fidei has no `DIOCESE` content type. The network worked, the fetcher
worked, the reader worked, and the classifier worked. The worker was being
handed URLs it could never use — a **discovery-quality** problem wearing the
costume of a pipeline stall.

Three causes compounded:

1. **The wrong index was being crawled.** `discoverFromDirectories()` took no
   arguments and walked _every_ configured `DIRECTORY_PAGES` entry on every
   call. `gcatholic.org/dioceses/` is such an entry, declared with
   `expectedContentType: PARISH` — but only `SAINT` reaches `DIRECTORY`
   discovery, so **saint passes were crawling the worldwide diocese index**.
   Directory pages are now selected by content type
   (`selectDirectoryPages(contentType)`).

2. **Self-amplification.** Internal-link discovery seeded itself from
   `where: { detectedContentType: { not: null } }` — but a rejected page's
   `detectedContentType` is the literal string **`"UNUSABLE"`**, which is not
   null. Every rejection therefore qualified as a seed, and a diocese page
   links to its sibling dioceses, so **each rejection surfaced up to 100 more
   URLs** that would be rejected in their turn. Seeds now exclude the
   unclassifiable result types (`notIn: ["UNUSABLE", "WRONG"]`).

3. **Rejections counted toward LOOPING**, so the detector meant to say "the
   worker is stuck and needs a human" fired on a condition no human action
   would fix.

**The fixes keep the volume visible rather than hiding it** — a suppression the
operator cannot see is a blocklist:

- **`retireClassifierRejection`** makes a **second** rejection terminal, kept
  deliberately distinct from a transient fetch retry: one refusal may be a bad
  render, two is the page.
- **`unclassifiablePrefixes` / `isSuppressedUrlShape`** suppress URL _shapes_
  the worker has proven it cannot classify, through the **existing** source
  reputation machinery rather than a new blocklist. A prefix **clears itself**
  the moment one page under it classifies, or when its rejections age out of
  the evidence window. Activation is logged as a `WARN` naming the prefix, the
  rejection count and an example URL.
- **`retireSuppressedCandidates`** drains the backlog already queued under a
  newly-suppressed shape, so the fix applies to work in flight.
- **`UNUSABLE_INPUT_RESULT_TYPE`** gives unusable input its own bucket in the
  stage-outcome ledger. The row is still written — **same stage, same result,
  same summary** — so the volume stays a first-class, queryable number; only
  the coarse bucket differs, so LOOPING stops treating it as evidence of a
  stall. A genuine fetch failure still counts, exactly as before.

**What was deliberately _not_ done.** The 0.55 classifier threshold is
unchanged, and `gcatholic.org` remains an approved host. Lowering the threshold
would publish content Via Fidei does not model, and de-listing the host would
lose the parish pages it serves well. The pages in question are simply not
content this project has a type for.

Covered by 16 tests in
[`tests/admin-worker/classifier-rejection-loop.test.ts`](tests/admin-worker/classifier-rejection-loop.test.ts).

### Code / version memory

The platform remembers its OWN code (`code-version.ts` + the
`AdminWorkerCodeVersion` table). At boot and once per pass it resolves the
running build — git SHA from the deploy env, a build-time `.build-version`
file, or `git rev-parse HEAD`, plus `npm_package_version` — and computes a
deterministic **corpus fingerprint** (a sorted hash of the self-model corpus:
source files + exports + Prisma models + routes + stages + brain ops). When the
SHA or fingerprint changes it records a new row with a human diff summary
(files/routes/models added or removed, commit moved), updates
`AdminWorkerState.workerVersion` (previously a static default), and logs the
upgrade. This lets the system recognize when its worker code changed and what
changed between versions, and it feeds:

- **diagnostics** — a "Code / version memory" rating,
- **the Developer Audit** — a "Code Version History" section,
- **escalation context** — an escalation raised shortly after an upgrade is
  annotated as possibly upgrade-related (build + last-change summary in both the
  email and the PDF).

Set `ARG GIT_SHA` at image build (or `RAILWAY_GIT_COMMIT_SHA` / `GIT_SHA` /
`GIT_COMMIT` in the environment) so the recorded version carries a real commit;
without it the fingerprint alone still detects code-shape changes.

### Operator actions

The Command Center — in the native application, executing on the operator's
Mac — exposes one-click actions for every named pass. Each button starts a
**local** operation; none of them calls a server endpoint that would do the work
on Railway. Each is **also run autonomously** by the loop on its own cadence —
the buttons only let the operator drive one on demand. The six single-stage
buttons **force the exact requested stage** (they do not route through the
brain's scoring, so "Run diagnostics" always runs diagnostics rather than
whatever the brain would have scored highest), via `runOperatorPass`
(`operator-passes.ts`), which dispatches the forced stage through the same
dispatcher + pass lifecycle as an autonomous pass — so operator passes show
correctly in Recent Passes with their real type and are liveness-safe:

- **Run diagnostic pass** → forces `REPORTING` (diagnostics + growth + coverage)
- **Run source discovery pass** → forces `DISCOVERY` (the discovery orchestrator)
- **Run homepage pass** → forces `HOMEPAGE_WORK` (homepage publish orchestrator)
- **Run source repair pass** → forces `REPAIR` (drains durable repair plans)
- **Run report generation** → forces `REPORTING` (report on demand)
- **Run security defense pass** → forces `SECURITY_DEFENSE` (even when paused)
- **Run content goal pass** — runs the full autonomous pipeline (`runOnePass`);
  advancing content toward its goals _is_ the whole brain-driven pass, not one
  stage
- **Run cleanup pass** — runs the custodian directly (`runCleanupPass`)
- **Request Homepage Makeover** — operator-triggered redesign that
  files a reviewable draft, then offers Preview / Discard / Publish
  (with an editable full-screen preview)
- **Download Developer Audit** — last 24 h / 7 d / 30 d PDF, generated on this
  Mac (the server-side `/api/admin/developer-audit` route is gone)
- **Give the worker a file** — drag-and-drop anywhere on the window, ⌘I, or the
  command center's own file picker; see
  [Operator file ingestion](#operator-file-ingestion)

Every one of these obeys the master switch: with the Admin Worker OFF the local
runtime answers `409 worker_off` rather than starting work.

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
npm run worker:host                        # the local host + command center (what the app launches)
npm run worker:local                       # the worker loop on this machine

tsx scripts/run-worker.ts --origin local   # claim the local (Mac) runtime
tsx scripts/run-worker.ts --one-shot       # one pass then exit
tsx scripts/run-worker.ts --max-jobs N     # exit after N passes
tsx scripts/run-worker.ts --worker-id X    # stable worker id / lease holder
tsx scripts/run-worker.ts --switch-on      # also flip the master switch on (CLI use)
```

Run without `--origin local` and the process **refuses to execute**: the Admin
Worker's execution host is the operator's Mac, and there is no automatic
cloud failover. Restoring cloud execution is deliberate and manual:
`npm run worker -- --force-remote-execution "reason"`.

Every entry point is gated twice — by the process-level rule in
`execution-context.ts` (the Next.js server runtime can never run worker
computation, spawn the Python brain or launch Chromium) and by the durable rule
in `execution-host.ts` (the master switch must be ON and this runtime must hold
the single execution lease, stored in `AdminWorkerMemory` — no schema change).

`run-worker.ts` drives `runAdminWorkerLoop` — each pass runs the
ranked-action brain then the mission dispatcher, which walks the artifact
pipeline (there is no separate build-queue engine). On startup it first
**reaps stale `RUNNING` passes** left by a previous crashed process and
logs a `brain_startup` event recording whether the intelligence layer came
online. It is safe to run with multiple replicas; per-stage work is
idempotent and durable. The monthly Admin Worker Report fires once per
worker startup when `isLastDayOfMonth(today)` is true, so a restart on the
last day of the month still sends the email.

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
crashing: `intelligence/tests/test_chaos.py` feeds every op in the
registry (233 of them) empty / type-confused / nested-garbage payloads, isolates a crashing
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
  code/refactor, and process needs). Also surfaced live on the command
  center's intelligence panel.
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
  resolves its readings from the committed lectionary tables against the
  Douay-Rheims store, and autonomously fills a rolling three-year window into
  `DailyReading` — re-verifying + self-correcting each scan, never downgrading a
  verified day. The brain owns its own copy of the calendar/lectionary knowledge
  (`liturgical_day`, `lectionary_readings`); the worker consults it each refresh
  and records it, plus freshness classification + review-on-uncertainty. See
  [Liturgy](#liturgy).

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
read/write; the command center renders them.

### Admin surface

The command center's **intelligence** panel is a live capability view: brain status +
protocol + op count + self-model freshness, worker-IQ, the **self-model
snapshot** (files, lines, routes, models, test coverage, weak/untested/orphan/
duplicate counts, architecture layers, largest modules), a deterministic
**capability strengths/weaknesses** map, the **top self-requested upgrades**,
**multi-layer memory** by type, learned **source reliability**, recent
decisions with confidence + risk, recent **self-explanations**,
**stuckness/blocker** signals, communion-risk flags, and the operation mix. It
links to the **Intelligence Laboratory** sub-dashboard.

The **Intelligence Laboratory** surfaces sit alongside it — 20 read-only views
over the `Lab*` store: the highest-leverage next change,
architecture-integrity reports, proof packets (+ failed-proof count), active
hypotheses, strategy tournaments, benchmark + brain-version scores,
review-gated capability proposals, adversarial weaknesses, counterfactual
insights, experiments, digital-twin runs, curriculum progress, logic-rule
failures, and claim epistemic statuses. Every panel is guarded so the page
renders even before the lab has recorded anything.

### Commands

The brain needs Python >= 3.10 (`@dataclass(slots=True)`, `match`), and on a
stock Mac bare `python3` is Apple's 3.9, which fails at import. Every command
below goes through `scripts/brain-python.sh`, which picks the first usable
interpreter — honouring `INTELLIGENCE_PYTHON` when it is set, exactly as the
worker's own resolver does. Call the script directly for anything ad hoc
rather than typing `python3`.

```bash
npm run brain:test                   # python unit tests (stdlib unittest) → 230 tests
npm run brain:selftest               # every op against a sample payload → 233/233 ops
npm run brain:proof                  # unified-intelligence proof (spec proof points 3-13)
npm run admin-worker:proof:brain     # proof points 1-2 (Python is the final brain; no legacy path)

sh scripts/brain-python.sh -m intelligence --list-ops    # ops + protocol version
sh scripts/brain-python.sh -m intelligence --selftest    # same as brain:selftest
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
refresh**. Live discovery (eight methods) grows content beyond the curated base.

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
  refresh, and **`ensure_prayer_translations`** — which fills published prayers
  and litanies with authentic Latin and Greek via the deterministic, keyless,
  network-free liturgical translation engine (`runMaintenance` runs it through
  the certified runtime each pass). There is no AI/machine-translation fallback:
  a prayer the corpus can't resolve keeps the languages it has (or, only under
  `ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1`, is surfaced for a curator to source an
  authentic translation). Most are allowed in safe degraded mode.

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

The command center's **skills** panel is the Certified Admin Skill Runtime view: the
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

## Operator file ingestion

Files handed to the worker — dragged onto the app, or chosen with ⌘I — are
processed **locally** and enter the same intellectual and quality framework as
anything discovered on the internet. A file does not get a shortcut into
published content because a human supplied it.

`file-extractors.ts` identifies the type from magic bytes (then the extension)
and extracts text with Node built-ins only: text, Markdown, HTML, JSON/JSON-LD,
XML/RSS/Atom, CSV/TSV, PDF (the existing dependency-free extractor), and the
ZIP-based office formats (DOCX, PPTX, XLSX, ODT) through a bounded reader.
`file-ingest.ts` then:

1. records provenance — `OPERATOR`, with the operator, filename and sha256;
2. re-expresses the document's title/headings/paragraphs as simple markup and
   hands it to the **existing** `readSource` — one parser, one classifier, one
   extractor set, one pipeline;
3. compares it with live content (exact + near-duplicate by normalised title);
4. adjudicates contradictions against published values through the conflict
   resolver;
5. requires external corroboration before publishing, because operator-supplied
   material carries no external authority of its own;
6. queues it on the normal chain — classification → package → cross-source
   verification → strict QA → publish gate — or routes it to **review** when
   classification confidence is below threshold or a contradiction is
   unresolved. It never invents a type or a missing field.

**Files are untrusted data.** Nothing inside one is executed: no macros, no
scripts, no embedded programs, no shell commands. Macro-bearing office
documents are reported and read as data; `<script>` blocks are stripped;
instruction-shaped text (`ignore all previous instructions`, `publish this
immediately`, `skip QA`, embedded shell commands) is **flagged, logged as a
SECURITY event, and never obeyed** — it is source material, not authority.
Size, entry-count and compression-ratio ceilings guard against decompression
bombs and memory exhaustion, and a malformed document degrades to a reported
failure rather than an exception.

### How a file actually reaches the worker (and the WKWebView lesson)

There are two routes in, and they are handled by two different layers, which is
why they failed in two different ways.

**⌘I and the app's own drop target are AppKit.** The menu item opens an
`NSOpenPanel` directly, and the window's content view is a `DropView` registered
for `.fileURL`, so anything landing on the chrome around the web view is read
from the dragging pasteboard and handed to `ingest(urls:)`. Both paths refuse
politely when the worker is OFF rather than queueing work nothing will do.

**Everything inside the dashboard is WebKit**, and that is where both bugs
lived. The command center (`scripts/desktop-app/dashboard.html`) is a page
rendered by a `WKWebView`, and a `WKWebView` **cannot present macOS UI on its
own**.

- The dashboard's "choose a file" button drives a hidden `<input type="file">`.
  The app implemented `WKNavigationDelegate` but never `WKUIDelegate`, and never
  set `webView.uiDelegate` at all — so WebKit had nowhere to send the request and
  **discarded it**. No panel, no error, no log line, no exception: clicking the
  button did precisely nothing. The fix is `runOpenPanelWith`, which builds an
  `NSOpenPanel` mirroring what the page asked for (`allowsMultipleSelection`,
  `allowsDirectories` — a single-file input stays single-select) and sheets it
  onto the app's own window so it can never appear behind the app. The same
  missing delegate was swallowing `alert()` and `confirm()`, which is how a page
  error can vanish instead of reaching the operator, so
  `runJavaScriptAlertPanelWithMessage` and `runJavaScriptConfirmPanelWithMessage`
  went in alongside it.
- **Drag-and-drop was bound only to the small dashed drop zone.** A file dropped
  a few pixels outside `#drop` was not claimed by the page, and WebKit's default
  for an unclaimed file drop is to **navigate to the file** — the command center
  would disappear and be replaced by the contents of whatever was dropped. Both
  the `dragover` and the `drop` listeners are now bound to the **whole
  document**: preventing the default everywhere keeps the page, and a file
  dropped anywhere on the window is handed to the worker. The dashed zone is now
  only a hint about where to aim, not the thing that works.

**The lesson, stated plainly, because it will happen again:** a `WKWebView`
silently ignores anything that needs a UI delegate, and a silently ignored
request is indistinguishable from a dead button. There is no console warning to
find, no rejected promise, no failed network call — the page does everything
right and nothing happens. When something inside the web view does nothing at
all, check whether it needs `uiDelegate` **before** looking for a bug in the
page. The same reasoning covers the drop: anything the page does not explicitly
claim, WebKit handles itself, and its defaults were written for a browser, not
for an application shell.

---

## Eyes, ears, legs — how the worker acquires information

The worker already owned a static fetcher, a headless renderer, structured
extractors, Wikidata/Wikipedia/Overpass ingestors, RSS + sitemap discovery, a
PDF extractor and a durable source-read cache. What it lacked was a single
place that decides **which** of them to use, and a memory of what worked.

- **Ears — noticing change** (`change-sensing.ts`). Every source read already
  stored a sha256, an ETag and a Last-Modified header; those now feed a change
  sense. `senseUrl` answers "is this worth a request, and with which
  conditional headers?", `recordObservation` learns each host's real change
  cadence (a page that changes yearly stops being polled hourly),
  `senseFeedChange` diffs a feed/sitemap against what has already been read, and
  `runFreshnessSweep` re-queues genuinely overdue sources at the head of the
  discovery stage. A caught-up corpus produces no work at all.
- **Adaptive acquisition** (`acquisition-planner.ts`). `planAcquisition`
  returns an ordered, cheapest-first plan — durable read → conditional HTTP →
  structured API → feed → sitemap → static HTML → PDF → headless browser →
  archive — with a cost and a learned success probability per step. Outcomes
  are written back to the existing per-method strategy memory plus a per-host
  preference, so "this host needs a browser" and "this host has a JSON
  endpoint" become durable knowledge. The fetch stage now skips the request
  entirely when the durable read still covers the URL.
- **Information gain** (`information-gain.ts`). Before spending resources the
  worker asks what it would actually learn: goal gap, source authority,
  whether the material is already known, whether this method already failed,
  and whether a cheaper untried method exists. `applyInformationGainToCandidates`
  blends that into the candidate queue's priority, so a URL behind a met goal
  loses to one that closes a real gap.
- **Conflict handling** (`conflict-resolution.ts`). When two sources disagree
  the worker records **both** claims, compares Catholic authority, then
  recency (supersession), then corroboration, assigns a confidence, escalates a
  genuine standoff to review rather than keeping whichever page it read first,
  and **remembers** the adjudication so the same uncertainty is not
  re-litigated. Wired into the cross-source verification stage and into file
  ingestion.

None of this replaces an existing system: there is still one crawler, one
publishing pipeline, one knowledge graph, one QA system and one brain.

---

## Liturgy

Everything the site says about the Church's year is computed in this repository
from committed data. There is **no remote readings dataset**, and there never
was: an earlier `LECTIONARY_DATA_URL` adapter was a phantom — no public dataset
used this repo's key scheme, no URL was ever configured, and nothing in the tree
produced such a file, so coverage could not actually grow by configuration. It
has been removed. Coverage grows by rebuilding the tables.

### The calendar engine

[`content-shared/liturgical-calendar.ts`](src/lib/content-shared/liturgical-calendar.ts)
(mirrored in the Python brain as `lectionary.py`) computes the exact liturgical
day for **any** date in any year — no lookup table, no network:

- **Two calendars.** `roman-general` (the General Roman Calendar) and
  **`roman-us`**, the calendar of the Dioceses of the United States, which is the
  **default** because the site's readings follow the USCCB Lectionary. The US
  calendar moves Epiphany and Ascension to Sunday (Ascension can be kept on
  Thursday with an option), places Corpus Christi accordingly, and adds the
  proper US feasts and memorials.
- **Season, cycles, colour, rank.** Season, Sunday cycle A/B/C, weekday cycle
  I/II, liturgical colour, and the celebration's rank.
- **Precedence, transfer and omission** under the UNLY rules, memoised per
  (year, calendar). An impeded **solemnity transfers** to the first free day;
  anything of lower rank is simply **omitted** that year. Nothing is invented and
  nothing silently overwrites a higher-ranking day.
- **Holy days of obligation**, per calendar. The US set is modelled exactly:
  Immaculate Conception, Christmas and Ascension always oblige; Mary Mother of
  God, the Assumption and All Saints **lose the obligation when they fall on a
  Saturday or a Monday**.

`npx tsx scripts/lectionary/check-calendar.ts` and the golden-export script
under `scripts/lectionary/` pin the engine's output.

### The Scripture store — Douay-Rheims, and its provenance

[`content-shared/bible/`](src/lib/content-shared/bible/) is a server/worker-only
public-domain Scripture store. The text is the **Douay-Rheims Bible, Challoner
revision, 1899 American Edition**, as distributed by
[ebible.org](https://ebible.org/find/details.php?id=engDRA) (`engDRA`, USFM/USX),
public domain, converted to JSON — 73 books, one file per Paratext/USFM code.
Verse and chapter numbers are the **Douay/Vulgate** ones exactly as published
(Vulgate psalm numbering, 1–4 Kings, Esther's Greek additions, Daniel 13–14):
nothing was renumbered in the data.

The lectionary cites the **modern** (NAB / Hebrew-based) numbering, so all
mapping happens at resolve time, through a **verified alignment table**
(`alignment.ts`) that records the evidence read for every rule, guarded by
per-chapter modern verse counts (`modern-verses.ts`). `resolveDouayPassage`
returns one of three alignments — `exact`, `remapped` (with a note, e.g.
"Psalm 98 of the lectionary is Psalm 97 in the Douay-Rheims"), or
**`unverified`, which returns no text at all**. A wrong or shifted passage is
never returned; a citation the resolver cannot align with certainty is shown as a
citation only. Where the Lectionary reads part of a verse ("16bc") the whole
Douay verse is shown and that is surfaced as `partialVerses`, never passed off as
an exact pericope.

### The committed lectionary tables — and their credits

[`content-shared/lectionary/tables/`](src/lib/content-shared/lectionary/tables/)
holds the generated tables: **723 lectionary numbers, 3,260 sections, 428 engine
keys** (171 Sunday, 327 weekday, 224 sanctoral, 1 common). They carry
**citations and labels only — never Scripture text**; the text layer resolves
those citations against the Douay-Rheims store.

They are built **offline** by
[`scripts/lectionary/build-tables.ts`](scripts/lectionary/build-tables.ts) from
three sources, and the script is idempotent — re-running it on the same sources
rewrites byte-identical JSON, so `npm run lectionary:check` can assert in CI that
the committed tables still match. **Edit the script or its sources, never the
JSON.**

The three sources, and the credits they are published with
(`LECTIONARY_ATTRIBUTION`, rendered on the readings page):

- **catholic-resources.org** — the lectionary index (Sundays, weekdays, the
  sanctoral), which is what supplies the days a dated source never shows.
  Its licence asks for this line, and the page carries it verbatim:

  > **Material provided by Rev. Felix Just, S.J., at http://catholic-resources.org**

- **[westhong/catholic-daily-readings](https://github.com/westhong/catholic-daily-readings)**
  (**MIT**) — a USCCB-derived JSON map of civil date → the Masses published for
  that date, each with its Lectionary number and section citations. It is
  **dated, not keyed**, which is precisely what makes it the join partner that
  turns the calendar engine's `lectionaryKey` into a Lectionary number.
- **USCCB Liturgical Calendars** for the Dioceses of the USA (2026–2028), plus
  the Lectionary for Mass for Use in the Dioceses of the United States of America
  — credited as **United States Conference of Catholic Bishops**,
  <https://bible.usccb.org/daily-bible-reading>.

The build joins them across 2023–2028 and emits five files: `by-number.json`
(the formularies), `key-map.json` (engine key → Lectionary number, per Sunday
cycle, principal Mass first with the day's alternative "or" Masses beside it),
and the `sundays` / `weekdays` / `sanctoral` indexes.

`lookupLectionary()` is fail-open by contract: an unknown key or a formulary that
is not in the table returns **null**, and callers fall back to the celebration
heading alone rather than inventing readings or borrowing a neighbouring day's.

### Coverage

```bash
npx tsx scripts/lectionary/check-coverage.ts
```

resolves every `(key, cycle)` combination the calendar engine emits from 2020 to
2100 against the tables. Measured 2026-09-07:

```
tables: 723 lectionary numbers, 3260 sections, 428 keys
engine 2020-2100: 2556 (key, cycle) combinations
resolved: 2556 (100.00%)
  FIRST_READING    2556  100.0% of days
  PSALM            2556  100.0% of days
  SECOND_READING    452   17.7% of days
  ACCLAMATION      2312   90.5% of days
  GOSPEL           2556  100.0% of days
```

100 % of the keys the calendar emits resolve. (Second readings are 17.7 % because
only Sundays and solemnities have one; that is the Lectionary, not a gap.) The
two table keys the 2020–2100 calendar never emits — `christmas-2-sunday`,
`easter-7-sunday` — are the days the US calendar transfers, and are reported so
the difference is visible rather than silent. `--strict` (`npm run
lectionary:coverage`) fails on any unresolved key.

### The readings page and the backfill

`/liturgy/readings?date=…` shows the exact celebration, the readings in
proclamation order with the Douay-Rheims text wherever it aligns, the Lectionary
number, the alternatives the Lectionary offers as a choice rather than silently
dropping one, and the attribution above. It is the **internal** page the
Liturgical Calendar's "Official Mass readings for this day" button links to, not
an external site, and it keeps a modest "Source: …" link so a reader can always
reach the official text.

The worker keeps it current from the `readings` lane:

- `maybeRefreshDailyReadings` re-verifies **today** (a `PUBLISHED` row is fresh
  for ~20 h, so a daily run catches stale or wrong-date readings);
- `backfillDailyReadings` fills a **three-year window** — one year back, so the
  days already elapsed this liturgical year are filled too, plus two years
  forward, which covers the whole Sunday cycle A/B/C and both weekday cycles
  (1,096 days, throttled to every 6 h). There is exactly **one row per (date,
  calendar, locale)**, so a reading that recurs on a later day is never stored
  twice.

Each scan creates missing rows, **updates** rows that have drifted from the
engine's current output (a day upgrades REVIEW → PUBLISHED the moment its
lectionary entry lands), and leaves unchanged rows untouched — so most scans
write nothing. It **never downgrades a PUBLISHED day**, so coverage can only
improve. A day with any verified text is PUBLISHED; a day that resolves to
citations only stays REVIEW; a day the tables do not cover stores the
deterministic framing and the official source link. Text is never fabricated.

Database failures are **counted, not swallowed**: a run where nothing succeeded
and something failed throws, so a mis-pointed or unreachable database can no
longer be reported to the Command Center as "readings refreshed".

The readings-source registry ([`readings-source.ts`](src/lib/admin-worker/readings-source.ts))
holds exactly one adapter — `lectionary-table`, priority 100 — and is kept only
so a genuinely external source could be registered later, and so tests can inject
one. Registering is the only way in.

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
/history              → the static event spine merged with published CHURCH_DOCUMENTs
/church-documents     → PublishedContent where contentType=CHURCH_DOCUMENT
/liturgy-history      → LITURGICAL + CHURCH_DOCUMENT slugs (same /[slug] route)
/search?q=...         → ranked full-text search across PublishedContent
/sitemap.xml          → the sitemap INDEX; chunks at /sitemaps/[type]/[chunk].xml
/api/prayers?take=N   → public list endpoint (clamped at 200)
```

The top navigation groups these as **Home · Prayers · Saints · Sacraments ·
Guides · Liturgy · History**, with dropdowns (desktop) and inline expanders
(mobile) for the grouped tabs (Saints → Our Lady / Doctors / Popes;
Sacraments → Parishes / Spiritual Life; Liturgy → Liturgical Calendar /
Rites; History → Church Documents).

### Server pagination

List pages paginate **in Postgres**, not in the browser
([`data/published.ts`](src/lib/data/published.ts)): `DEFAULT_PAGE_SIZE` is 30,
`MAX_PAGE_SIZE` 100, and both the page number and the page size are clamped
before they reach a query, so a hand-edited `?page=` or `?pageSize=` can never
ask for the whole table. Every list returns `{ items, total, page, pageSize,
pageCount }` — the true total from a counted query, not the length of the page —
and the row projection excludes `payload`, so a list page never ships a
detail-sized document per row. This is what makes a 200,000-row parish directory
a normal page rather than an outage.

### Search

Search used to be an unindexed `ILIKE '%q%'` over title and slug with no ranking:
"st john" missed "Saint John", "mary" returned fifty rows in heap order, and
every keystroke of the header autocomplete was a sequential scan.

**Migration `0055`** gives `PublishedContent` a weighted **`tsvector`** —
title (both `simple`, so proper names stay searchable verbatim, and `english`,
for stemming) weighted A, subtitle B, and a truncated slice of the payload prose
C so one enormous document cannot dominate the index — maintained by a `BEFORE
INSERT OR UPDATE` trigger, with a partial **GIN** index on the published rows.
Where the extension is available it also creates a **`pg_trgm` trigram index on
title**, which is what lets a typo ("Aquinis") still find Aquinas.

Both are **optional, and the application probes for them at runtime**
(hourly, memoised). The probe asserts the **whole mechanism**, not just the
column: in the state "column exists, trigger does not" every `searchVector` is
NULL, `@@` matches nothing, and search would go silently dark while still
reporting itself indexed. Without the vector, search falls back to the original
predicate — a slow search box beats an empty one.

The migration is written to degrade rather than fail a deploy, because
`scripts/start.sh` exits non-zero on a failed migration and that takes the site
down. `CREATE EXTENSION pg_trgm` is wrapped in a `DO` block that swallows
**any** error (a managed Postgres refuses this in at least four different
SQLSTATEs); the function/trigger/backfill block and each index are likewise
guarded against `insufficient_privilege` — since PostgreSQL 15 the public schema
no longer grants `CREATE` to `PUBLIC`, so "this role has owned these tables for a
year" does not imply "this role can create a function". Every statement is
`IF NOT EXISTS` / `OR REPLACE` / drop-then-create, and the file takes a
`lock_timeout` of 5 s so a migration that merely _waits_ on the Admin Worker's
own write transaction cannot take the live site's reads down with it. **Deploy
with the master switch OFF.**

Ranking combines full-text relevance (`ts_rank_cd`) with the signals a visitor
expects: an exact title match wins outright (+3), a title that starts with what
was typed beats one that merely mentions it (+1), a whole-word title match adds
+2, and trigram similarity is added only where `pg_trgm` exists. The header
dropdown prefix-expands the last term so it answers while you type; the results
page deliberately does not, because the expansion floats obscure near-spellings
above the thing that was asked for. Results carry the true total, a page, and a
grouping by content type with a real human type label.

### The parish card, and "parishes near me"

There is exactly **one** parish presentation
([`ui/ParishCard.tsx`](src/components/ui/ParishCard.tsx)), rendered by both the
directory list (`variant="list"`, an `h2` that links to the parish) and the
parish's own page (`variant="detail"`, an `h1`, because there the parish _is_ the
page). A parish shows, in this order and nothing else:

- the **name**, in title type;
- an optional **distance line** directly under the name;
- one line labelled **Diocese**, whose value is the record's city, state and
  country joined with `", "` ("Denver, Colorado, United States");
- the **postal address**, with a **Get directions** button beside it —
  `MapsAddressLink` in its block variant, which opens Apple Maps on iPhone/iPad
  and Google Maps everywhere else, using the record's exact coordinates when it
  has them so the pin lands on the right building;
- the **website**, when the record has one, as a domain rather than a raw URL
  (a stored `stmarys.org` with no scheme still becomes a working `https` link).

Designation, phone, Mass times, confession times, background and summary are
**still in the schema and still in the published payload** — they simply stopped
being displayed. The detail page no longer goes through `PublishedDetail`, which
prints every remaining payload key, for exactly that reason.

The consequence worth naming: this is a **rendering** change, so all ~9,700
published parishes (9,731 at the time) changed presentation the moment the
component did — **no migration, no backfill, no worker pass** over a single row.
That is the payoff of keeping the card a pure function of the payload
([`content-shared/parish.ts`](src/lib/content-shared/parish.ts) holds the three
helpers it needs, and none of them reads or reshapes stored data).

Honest caveat: only about a **third** of published parishes currently carry a
city, and the OSM sweep is where the rest will come from. When city, state and
country are **all** absent, the whole labelled line is omitted rather than
printed empty — a "Diocese" eyebrow with nothing after it reads as a broken row.

**"Use my location", and why it widens.** The directory page ships one page of
thirty projected rows and does no distance work at all until it is asked to.
Pressing **Use my location** asks the browser for a fix (`enableHighAccuracy`, a 15 s timeout, and
a `maximumAge` of 30 s — long enough for a cold fix, short enough that a stale
one cannot mislabel every card after a drive) and calls
[`/api/parishes/near`](src/app/api/parishes/near/route.ts), which does the
bounding-box + haversine work in SQL and returns at most fifty rows.

That endpoint **widens its own radius** rather than returning a blank list. It
walks a ladder — the requested radius (50 miles from the page), then 150, then
500, then unbounded "nearest records wherever they are" — and stops at the first
rung that answers, reporting `requestedRadiusMiles`, the `radiusMiles` that
actually answered, and `widened`. The page says so in words: _"No parishes within
50 miles yet. Here are the nearest ones, within 150 miles."_ This exists because
the previous behaviour was an unexplained empty list everywhere the OSM tile
sweep had not yet reached, which reads as "there are no Catholic parishes near
you" rather than "we have not swept your region yet". The coordinate goes to this
site's own API and nowhere else, is never written down, and lives in component
state only while the near-me view is on screen.

**Distance, and where its units come from**
([`content-shared/distance.ts`](src/lib/content-shared/distance.ts)). A distance
line appears **only after the visitor uses "Use my location"** — the plain
directory has no origin to measure from and therefore no distance to claim, and
the detail page never shows one. The number is recomputed by haversine from the
visitor's own fix (the SQL distance is only the fallback for a row whose stored
coordinate did not come back with the projection), so the label cannot drift from
the coordinate the device just handed over.

The units come from the **device's** region — `navigator.languages`, falling back
to `navigator.language`, resolved through `Intl.Locale` (using
`measurementSystem` where the runtime implements the proposal, and a region
allow-list of `US`, `LR`, `MM`, `GB` otherwise) — **not** from where the
coordinates fall. A US-configured phone in Rome still reads miles; a German phone
in Denver still reads kilometres. Deriving the unit from the visitor's position
would switch a traveller's units mid-trip, which is exactly the thing people find
disorienting. With no usable locale at all the fallback is imperial, because the
API, the ladder and the stored distances are all already in miles.

The thresholds, as implemented:

| System   | Below the threshold                       | Above it                                        |
| -------- | ----------------------------------------- | ----------------------------------------------- |
| Imperial | under **0.1 miles** → whole **feet**      | **miles**, one decimal ("3.2 miles away")       |
| Metric   | under **1,000 metres** → whole **metres** | **kilometres**, one decimal ("12.4 kilometres") |

The metric switch sits higher than the imperial one deliberately: "150 metres
away" beats "0.2 kilometres away" for a parish you can see from where you are
standing, and a kilometre is where mapping apps change unit too. At three digits
the decimal is dropped (it reads like a machine, not a distance). A parish on the
doorstep reads as at least "1 foot", never "0 feet"; a negative or non-finite
value renders nothing at all. Search **radii** are formatted by a separate
function, because "50 miles" is a round number we chose and "50.0 miles" would
read like a measurement of something.

Share and Save sit in the card's action slot on the detail page — they are
controls, not parish information, so they do not count against the list above.

### The memo cache, cache tags, and the internal revalidate endpoint

Every public page is `force-dynamic` (the root layout reads `headers()`), so
Next's own data cache never engages. In front of the cheap, shared aggregates
sits an in-process, **single-flight** TTL memo
([`cache/memo.ts`](src/lib/cache/memo.ts)): concurrent callers share the
in-flight promise, so a cold key under load produces **one** query. Three tiers —
`list` 60 s, `daily` 600 s (today's saints, featured prayers), `sitemap` 3600 s.
It is fail-open by construction: a failing loader is never stored, and a stale
value is served in preference to surfacing an error. `SITE_MEMO_DISABLED=1`
bypasses it.

Alongside it, [`cache/tags.ts`](src/lib/cache/tags.ts) is the single source of
truth for the tag names producers and consumers share —
`content-type:<Type>`, `content-slug:<Type>:<slug>`, `tab:<TabKey>`, `sitemap`,
`search-index` — and `cache/revalidate.ts` wraps `revalidateTag()` so call sites
don't have to know which tags to touch, recording every call into a rolling
`cacheRevalidationLog` that the admin "cache health" diagnostic reads.

**The worker runs in a different process — usually on a different machine — so
its `revalidateTag()` could never reach the web server.** After a publish it
POSTs to **`/api/internal/revalidate`** instead
([route](src/app/api/internal/revalidate/route.ts)), which drops the web
server's memo (by tag prefix, or everything for an unrecognised tag) so a newly
published row appears on list pages, the "today" block and the sitemap before
their TTLs expire. Auth is a bearer `INTERNAL_API_SECRET` when set, otherwise the
`SESSION_SECRET`-derived token the rest of the internal surface uses, compared in
constant time; with neither configured **the route refuses everything** — it is
disabled by default, never open by default. Nothing there reads or writes
content: the worst a valid token can do is make the next few page views re-query
Postgres.

### Sitemaps

`/sitemap.xml` is a **sitemap index**, not a single file: it points at one
chunked sitemap per content type at `/sitemaps/<type>/<n>.xml`, at most
`SITEMAP_CHUNK_SIZE` (40,000) URLs each, which is what keeps the site indexable
past the protocol's 50,000-URL-per-file limit as the parish directory grows. The
URL is unchanged — robots.txt has always named `/sitemap.xml` — so nothing
already registered with Search Console has to be re-submitted. Chunks project
only slug + `updatedAt`, are memoised for an hour, and an unknown type or an
out-of-range chunk returns a valid **empty `<urlset>`** rather than a 404, since a
crawler that guessed a URL should not see an error.

### The history timeline

`/history` is the one page that is not purely database-driven. Its spine is a
**static, hand-curated dataset of 232 events**
([`content-shared/church-history/`](src/lib/content-shared/church-history/),
split across four files purely to stay reviewable and merged in chronological
order by `church-history-events.ts`). Every event carries exactly **one**
citation, and a dataset test enforces that it is an `https` page on an
allow-listed host — so a typo or an unvetted source can never ship as a "Source"
link.

The timeline merges that spine with the published `CHURCH_DOCUMENT` rows
([`church-history/timeline.ts`](src/lib/content-shared/church-history/timeline.ts)):
a published document whose slug matches a static event's `links.documentSlug`
**enriches** that event (it gains the document page and the official text URL)
instead of appearing twice; every other published document becomes its own
document/council event placed by its issue date. Curated councils were published
with a `-01-01` placeholder day, so a council document dated `-01-01` is rendered
at **year precision** rather than as a fabricated 1 January. Related links to
popes, saints, doctors and apparitions are kept only when the referenced slug is
actually published. This is why the timeline reads 325 → 1965 even on a database
with no church documents in it at all.

### Reading experience

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

**Prayers and litanies are filled with authentic Latin and Greek — using the
worker's own engine only.** The engine renders Latin/Greek from the internal,
keyless, **network-free** corpus + rules ([`admin-worker/prayer-translator.ts`](src/lib/admin-worker/prayer-translator.ts)):
received texts (Pater Noster, Ave Maria, Gloria Patri, the Te Deum, Sub Tuum
Praesidium's ancient Greek, …) and composites assembled from authoritative
segments. There is **no external AI or machine-translation fallback** — the
Admin Worker never calls OpenAI, an LLM, or Google Translate to invent
liturgical text. A prayer whose text the corpus can't faithfully resolve is left
with the languages it has (or, only under `ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1`,
surfaced to a curator to source + verify an authentic translation). The worker
reports honest coverage and never fabricates a sacred text.

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
`next/og`) showing the **crucifix logo with the content item's own title in it**
(e.g. "Litany of Humility") and a "VIA FIDEI · <type>" label, set as both the
`og:image` and the `summary_large_image` `twitter:image`. The image is
self-contained (the crucifix logo `crucifix-logo.png` inlined as a data URI at
module load, `next/og`'s built-in font) and falls back to the static crucifix
asset on any error, so a shared link never unfurls broken or as the browser's
generic page icon. The root layout supplies a default branded card for
non-content pages.

**Favicon everywhere.** The site logo — the crucifix (`crucifix-logo.png`) — is
the universal favicon across every surface and device, so a shared/opened link
shows the crucifix next to the address bar, in the tab, on the iOS home screen,
and as the Android/PWA icon. The root layout's `icons` metadata + a
`site.webmanifest` point every size at the crucifix centred on the brand cream:
`favicon.ico` (16/32/48, for classic `/favicon.ico` requests and email clients),
`favicon-32.png`, `apple-touch-icon.png` (180), and `icon-192.png` /
`icon-512.png` (manifest / Android / share fallback). All are generated from the
one logo, so there is a single source of truth for the mark.

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
proclamation order (public-domain Douay-Rheims wherever the citation aligns with
certainty), the required lectionary credits, and a modest source link at the
bottom. The worker keeps it current with `maybeRefreshDailyReadings` (today) and
`backfillDailyReadings` (a rolling three-year window, re-verified +
self-corrected each scan). See [Liturgy](#liturgy).

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

### A worked example: the Catholic boundary in `statusFromInfobox`

The clearest illustration of what "Catholic accuracy is a hard constraint"
costs in practice is the saint ingest's sainthood guard,
`statusFromInfobox` in
[`structured/ingestors.ts`](src/lib/admin-worker/structured/ingestors.ts). It
runs on the branch of the corpus where Wikidata states **no** P411 canonization
item at all, so the article's own infobox has to supply both facts that matter:
**who** venerates this person, and at **which stage**. An adversarial pass over
it found two real ways a non-Catholic saint could have been published as a Roman
one, and both are now closed.

**A borrowed word is not communion with Rome.** The guard asked whether
`venerated_in` matched `/\bcatholic\b/`. It does — for the **Polish National
Catholic Church**, the **Anglican Catholic Church**, the **Liberal Catholic
Church** and the Irvingian **Catholic Apostolic Church**, none of which is in
communion with Rome. Each would have published its own saints as Roman
canonizations on the strength of a shared adjective. Those names (with Old,
Independent, American, Traditionalist and Palmarian Catholic) are now **struck
out of the field before the question is asked** — and, subtly but necessarily,
striking one **counts as naming another communion**. Without that second half,
"Old Catholic Church" reduces to " Church" and reads as no venerating body at
all, which is the same failure wearing a different hat.

**But the boundary has to stay open where the Church is.** Naming another
communion disqualifies a row only when **no** Catholic body is named alongside
it. That is what lets the **Coptic Catholic** and **Syro-Malabar Catholic**
churches — Eastern Catholic, in full communion — publish, even though they trip
the "other communion" patterns, and it is the same clause that keeps a
pre-schism saint venerated by both Rome and the East.

**The floor applies to both rules, and is checked first.** A stated
canonization or beatification **date** is the strongest evidence the guard
accepts, and on its own it asks nothing at all about who canonised whom — it
only looks for four digits in a field. So a `venerated_in` naming another
communion and no Catholic one now disqualifies the row **outright, date or no
date**, before either rule runs. The honorific fallback exists because a formal
canonization process only dates from the twelfth century, so a pre-congregation
saint can never carry a date; it is deliberately **narrower** on Catholicity than
the date rule it complements, demanding that the article name the Catholic
Church as the venerating body on top of the Catholic P140 the caller has already
required.

**An office is not a title.** The stage was read from `titles` / `title` as well
as `honorific_prefix`, and an office routinely carries a place name. Measured
against the real corpus, `titles = Bishop of St Albans`, `title = Abbot of
St Gall` and `titles = Bishop of Saint-Denis` each matched
`/\bsaint\b|\bst\.?\b/` and published the person as **canonized**.
A diocese named after a saint says nothing whatever about its bishop's cause. The
stage is now read **only** from `honorific_prefix` — the parameter whose entire
purpose is the honorific — and most-restrictive-first, so a "Blessed" is never
promoted to `canonized`, and an article that states no stage at all yields
nothing. Skip on doubt.

Tightening a guard costs recall, and the diagnostic script above is how that
cost is checked rather than assumed: the saints page measured on 2026-09-08 still
maps half its rows, and the rows it drops drop for reasons that name themselves.

Every clause above is pinned by name in
`tests/admin-worker/structured-saint.test.ts` — each separated communion
rejected under both rules, a saint venerated by Rome and the East still
accepted, Coptic Catholic and Syro-Malabar still accepted, and `Bishop of
St Albans` no longer promoting anyone:

```bash
npx vitest run tests/admin-worker/structured-saint.test.ts
#   → 26 passed (1 file)
```

---

## Testing

The commands that gate every change, in the order they are usually run. Every
one below was executed against this tree on **2026-09-09** and the results are
what is printed here — not what they are expected to be.

```bash
npm run typecheck            # tsc --noEmit                      → 0 errors
npm test                     # unit + component + worker         → 4782 passed, 1 skipped
                             #                                     (502 files passed, 1 skipped; ~13 s)
npm run lint                 # eslint                            → no warnings or errors
npm run format:check         # prettier --check .                → all matched files use Prettier style
npm run build                # prisma generate && next build     → succeeds
npm audit --omit=dev         # what actually ships               → found 0 vulnerabilities
npm audit                    # including devDependencies         → 3 moderate (see below)
```

The three moderate advisories are **entirely in the test tooling**: one
`@vitest/mocker` path-traversal advisory, reported three times because `vitest`
and `@vitest/coverage-v8` each depend on it. Nothing in that tree is imported by
the site, the worker or the brain, which is why `npm audit --omit=dev` — the
thing that describes what is actually deployed — is clean. It is recorded here
rather than quietly rounded to zero: `npm audit` printing `found 0
vulnerabilities` is no longer a true statement about this tree, and a README that
says it is teaches the next person to ignore the command.

Two suites need a database or a browser, so they are run separately:

```bash
# Integration. TEST_DATABASE_URL must name a database whose name contains
# "test"; scripts/test-db.sh refuses anything else (and any non-localhost host
# without TEST_DB_ALLOW_REMOTE=1).
TEST_DATABASE_URL=postgresql://…/viafidei_test npm run test:integration
#   → 33 passed (5 files)

# End to end. Playwright starts the standalone production server itself
# (scripts/start-standalone.sh) — `next start` cannot serve an
# output:"standalone" build. Browsers are not installed by default:
# npx playwright install --with-deps
E2E_DATABASE_URL=postgresql://…/viafidei_e2e_test npm run test:e2e
#   → 24 passed, 6 skipped (chromium + mobile-chromium)
```

The six skipped e2e tests are the visual-regression snapshots, which are opt-in
behind `RUN_VISUAL_TESTS=1` until baselines are committed. The e2e suite is also
what proves the per-request CSP nonce did not break hydration: it loads every
primary route against the same production server the container runs and asserts
the header renders and survives navigation.

The iPhone companion is a separate Xcode target, so none of the commands above
touch it — but it builds from the command line, without anyone opening
Xcode.app, and that is the check to run after changing anything under `ios/`.
`xcode-select` on this Mac points at the Command Line Tools, which ship no
`xcodebuild` at all, so the `DEVELOPER_DIR` prefix is required rather than
optional:

```bash
cd ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project ViaFideiCommandCentre.xcodeproj \
  -scheme ViaFideiCommandCentre -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
#   → ** BUILD SUCCEEDED **
```

What the app must never become is pinned by `npm test` rather than by the
build: `tests/ios/iphone-app-structure.test.ts` (20 tests) reads the Xcode
project and the Swift sources and fails if the target gains a package
dependency or a linked framework, imports anything that is not an Apple system
framework, gains a way to spawn a process or reach a database, talks to a host
other than `etviafidei.com`, stops rendering the durable switch value, or dims
the toggle for any reason other than the phone being offline. See
[The iPhone companion](#the-iphone-companion--a-remote-control-that-never-runs-the-worker).

`npm test` is the same as `npx vitest run`; `npm run verify` chains typecheck →
lint → format:check → test, and `npm run verify:full` adds the integration
suite, Playwright and the build.

Two data checks that are worth running on their own, because they are fast and
they fail loudly on exactly the mistakes that are easy to make:

```bash
# Every (key, cycle) the calendar engine emits, 2020-2100, resolved against the
# committed lectionary tables. Add --strict (npm run lectionary:coverage) to
# fail the run on any unresolved key.
npx tsx scripts/lectionary/check-coverage.ts
#   → tables: 723 lectionary numbers, 3260 sections, 428 keys
#     engine 2020-2100: 2556 (key, cycle) combinations
#     resolved: 2556 (100.00%)

# Every curated knowledge group file: payload schema, slug uniqueness, real page
# citations, cross-referenced slugs, no template-generated novena text.
npx tsx scripts/validate-curated-file.ts src/lib/checklist/knowledge/*/*.ts
#   → OK — 645 entries valid

# One file at a time while writing it (this is the normal use):
npx tsx scripts/validate-curated-file.ts src/lib/checklist/knowledge/prayers/batch-7.ts

# The curated corpus against the live goals.
npx tsx scripts/curated-counts.ts
#   → total curated entries: 1232
```

### The Python brain

The brain is pure-stdlib and needs **Python ≥ 3.10** (`@dataclass(slots=…)`).
On a stock Mac bare `python3` is Apple's **3.9**, which fails at import, so the
npm scripts go through `scripts/brain-python.sh`. That picks the first usable
interpreter from the same candidate list the worker uses
(`PYTHON_CANDIDATES` in `src/lib/admin-worker/intelligence/client.ts`) and
honours `INTELLIGENCE_PYTHON` when it is set. Keep the two lists in sync.

```bash
npm run brain:test           # → Ran 230 tests … OK
npm run brain:selftest       # → SELFTEST OK: 233/233 ops produced valid
                             #   envelopes (protocol v1)
npm run brain:proof          # the unified-intelligence proof (spec proof points 3-13)

# Anything ad hoc goes through the resolver too, never bare python3:
sh scripts/brain-python.sh -m intelligence --list-ops
sh scripts/brain-python.sh -m unittest discover -s intelligence/tests -t .
```

`intelligence/tests/test_chaos.py` feeds every op empty / type-confused /
nested-garbage payloads, isolates a crashing op to an error envelope, and
recovers the stdio loop from malformed lines;
`tests/admin-worker/intelligence/resilience.test.ts` drives a configurable fake
brain through protocol mismatch, malformed output, timeout and the restart
circuit breaker, and proves real-brain op-error round-trips, process death +
auto-recovery, and concurrent id-multiplexing.

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
npm run admin-worker:proof:content            # one content item through every pipeline stage
npm run admin-worker:proof:all-content-types  # one full pipeline proof per content type (real extractor)
npm run admin-worker:proof:security           # 5 defender flows (login email, threshold, ban, mutation, reuse)
npm run admin-worker:proof:reports            # Developer Audit generates + required sections + secret redaction
npm run admin-worker:proof:brain              # Python is the final brain; no legacy path
npm run admin-worker:proof:skills             # the certified skill runtime end to end
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
through the orchestrator. It confirms the worker autonomously publishes PRAYER +
DEVOTION and — via a real fetch-and-compare against an INDEPENDENT validation
mirror — the doctrinally-sensitive SAINT (name + patronage + birthplace + lived
dates + feast day + background), with the feast day cross-source verified before
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
  builder + per-content-type chain proof, confusion detector, structured source
  reader, fetcher (host allow-list, login/binary rejection, checksum),
  candidate scorer, discovery orchestrator, validation source resolver +
  validation fetcher, verifier (sensitive-field whitelist), strict-QA artifact +
  gate, 10-dim quality scoring, publish orchestrator, independent
  search/sitemap/cache verifiers, post-publish rollback decision tree, repair
  orchestrator (real per-kind handlers), memory decay (30-day half-life),
  per-stage source-reputation hooks, growth orchestrator, source coverage,
  homepage publish orchestrator (snapshot + verify + rollback), pipeline resume
  by checksum, why-no-growth chain walk, developer audit data + sections,
  packaging, publish safety, post-publish probe, homepage designer + mutator.
- **Execution host** — the launcher's configuration precedence, the Railway
  resolver's JSON contract, the loopback-database refusal and its
  `VIAFIDEI_ALLOW_LOCAL_DB` escape hatch, worker exit-code classification, and
  the lease-renewal split between host and child
  (`tests/admin-worker/local-launcher*.test.ts`,
  `loop-lease-authority.test.ts`).
- **Self-maintenance** — sense/diagnose/repair/verify, the verify-backoff rule,
  the per-repair env switches, that the `maint-self-heal` lane is an OPS lane and
  not a content lane, and that no repair path can delete published content
  (`tests/admin-worker/self-maintenance.test.ts`).
- **Structured ingest** — the Wikidata/Wikipedia lane and the guarantee that it
  can never discard a row silently: the reason histogram's counting, stable
  top-N rendering and bounded detail; every registered ingestor answering an
  in-set code for a row it cannot map; and the source scanner behind the
  ratchet, proved against planted violations before it is trusted against the
  real tree (`tests/admin-worker/structured-reject-coverage.test.ts`). 241 of
  these tests live across the 21 files matching `tests/admin-worker/structured`.
- **Liturgy** — the calendar engine against golden output (transfers, holy days
  of obligation, both calendars), the committed lectionary tables against their
  sources (`--check` rebuild determinism), the Douay-Rheims alignment table, and
  the readings-source registry.
- **Site** — pagination clamps, the search capability probe and both query
  paths, the memo's single-flight + stale-on-error behaviour, cache tags, the
  sitemap index + chunking, and the history dataset's citation rules.
- **Security** — defender + 10 detectors + auto-ban + emails, request-path
  defender, admin-route guard (defender fires on POST/PUT/PATCH/DELETE only —
  never on GET), brute-force ban tests, "valid admin is not harassed" tests. Plus
  the two-stage admin sign-in end to end, the two-factor challenge lifecycle
  (expiry, single use, attempt ceiling, supersession, rate limits), the admin
  session store (pending refused, rotation, idle/absolute expiry, revocation,
  logout), the gate-coverage scanner (including a planted ungated fixture route,
  so it cannot pass vacuously), the admin-session prune **placement**, and the
  worker/user exemptions from two-factor.
- **Parish presentation** — the card's exact field set and its omissions, the
  Diocese line and its all-absent case, the distance formatter's thresholds and
  device-locale unit rule, the near-me route's validation and widening ladder,
  and the SQL near-query itself.
- **Single-content-path guards** — `runPublishOrchestrator()` is the only
  publish writer and every recent public row traces to an artifact
  (`production-mandates.test.ts`, readiness checks); no dispatcher handler
  only logs without doing work (`dispatcher-no-placeholder-stages.test.ts`);
  every stage returns the full result shape (`dispatcher-outcome-shape.test.ts`);
  source reputation updates after all ten stages; content funnel + bottleneck.
- **Checklist foundation** — slug canonicalization, the authority source
  registry, the build-intent queue (`enqueueBuild`), bulk source curation
  (verify / reject), the curated knowledge base, content-schema compliance, the
  janitor, and the master checklists.
- **App-wide** — API, auth, security, components, data, email, observability,
  i18n, cache test suites.

Total: **4,640 passing tests across 495 test files** (plus 1 skipped test in 1
skipped file), on top of **24** integration tests, **24** end-to-end tests and
**230** Python brain tests.

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
   admin API routes; **every** admin handler now goes through it (see
   [The central admin gate](#the-central-admin-gate)). On unauthorized
   POST/PUT/PATCH/DELETE, the gate fires `defendUnauthorizedMutation` so an
   `AdminWorkerSecurityAction` row is recorded alongside the
   `SecurityEvent`. GET is never defender-flagged, so admins redirected
   once to login are not banned.
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

### Two-factor admin sign-in

A human administrator now signs in through two stages:

**password → PENDING → six-digit code emailed to the configured admin address →
authenticated.**

A correct username and password no longer produce an administrator. They produce
a **PENDING** `AdminSession` row, which carries no authority at all, plus a
challenge row ([`auth/admin-2fa.ts`](src/lib/auth/admin-2fa.ts)). Which stage
`/admin/login` renders is decided by the **server** — the presence of a pending
session — never by the query string, so nobody reaches the code form, or skips
it, by editing a URL. The only function in the codebase that grants the ADMIN
role is `completeAdminTwoFactor`, and it refuses unless a challenge was verified
first.

The code, as implemented:

| Property      | Value                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Length        | exactly **six digits**, from `crypto.randomInt` (uniform, no modulo bias; `Math.random()` appears nowhere)   |
| Lifetime      | **5 minutes**                                                                                                |
| Reuse         | **single use** — a correct code is consumed by a conditional `UPDATE`, so a racing duplicate cannot also win |
| Wrong guesses | **5 attempts** per challenge, then the challenge is superseded and the pending session torn down             |
| Supersession  | issuing a replacement invalidates the previous code in the same call — there is only ever **one live code**  |
| Rate limits   | issue **5 / 15 min**, verify **15 / 15 min**, each enforced across four buckets at once                      |

The rate-limit buckets are the pending challenge, the IP, the device credential
and the admin username, and **every** bucket must allow the call, so an attacker
can neither spread guesses across devices nor rotate IPs to stay under a limit.
The buckets hold only derived values and land in the same durable limiter table
everything else uses.

**The code is never logged, never returned to the client, and never stored in
plaintext.** It appears in exactly one place: the body of the email to the
configured admin mailbox. What the database holds is an **HMAC-SHA256** under the
purpose-separated `admin-2fa` subkey, with the challenge id mixed into the
message as a per-row salt so two challenges that happen to draw the same code do
not produce the same stored value. A plain digest would not do: the six-digit
space is 10⁶ and a `SHA-256` of every value is computable in under a second, so
a database dump would be reversible. The HMAC is not, because reversing it also
needs `SESSION_SECRET`.

Every refusal is the same refusal. Wrong code, expired challenge, already-used
challenge, superseded challenge and exhausted attempts all render "That code is
not valid" — the internal reason exists only to pick which security event to
record. The eligibility check and the attempt increment are **one** statement
whose `WHERE` clause is the authorization, so two concurrent submissions cannot
both read `attempts` before either writes it, and the comparison is
constant-time over the keyed representation.

Three exclusions, stated plainly because they are the constraints that shaped
the design:

1. **Ordinary user accounts are unaffected and are never prompted.** They sign in
   at `/api/auth/login` and never touch this module.
2. **The Admin Worker and every automated process are completely independent of
   this and never need a code.** They authenticate by their own machine paths
   (`security/cron-auth.ts`). A worker that had to read an inbox would not be
   autonomous, and production would stop.
   `tests/security/admin-2fa-worker-exempt.test.ts` pins that structurally —
   nothing in the worker, cron or user surface can even reach the challenge
   module — and behaviourally, by showing machine authentication still authorizes
   with no challenge in existence.
3. **No new environment variable was introduced for any of it.** The HMAC key is
   derived from the existing `SESSION_SECRET` through the key registry below, and
   the destination is the already-configured `ADMIN_EMAIL`, read through the
   existing email module. No address is ever accepted from the request.

If email is unconfigured or delivery fails, the challenge still exists and still
has to be answered: failing open would mean "email down ⇒ no second factor",
which is the exact bypass the feature exists to prevent. The operator sees the
delivery problem on the login page instead.

### Admin sessions

An admin session is **not** trusted merely because a cookie says `ADMIN`. That
was a bearer token with no server-side lifecycle: it could not express "password
verified, second factor outstanding", it survived sign-out on any copy, and it
could be neither expired for idleness nor revoked. Every admin authorization
decision now resolves against a row in `AdminSession`
([`auth/admin-session.ts`](src/lib/auth/admin-session.ts)), which carries:

- its **own identity** — an opaque 32-byte session id that lives only inside the
  encrypted cookie. What is persisted is an **HMAC** of that id under the
  session-purpose subkey, so a dump of the table cannot be replayed as a session;
- **both authentication timestamps** — when the password was accepted, and when
  the second factor was verified;
- **last activity**, with a sliding **idle expiry** of 30 minutes (written at
  most once a minute, so a page render is not a row update);
- an **absolute expiry** of 8 hours that activity cannot extend;
- **revocation** state — who, why, when.

`resolveAdminSession` is valid only for a row that is `AUTHENTICATED`, carries a
2FA timestamp, is unrevoked and sits inside **both** windows. A **PENDING**
(password-verified, pre-2FA) session cannot pass `requireAdmin()`: it resolves to
`pending_two_factor`, which is a deny, and so `requireAdmin()`,
`evaluateAdminTrust()` and `gateAdminApiCall()` all refuse it exactly like an
anonymous caller. So does an `AUTHENTICATED` row with no 2FA timestamp — both
halves must agree. Everything fails closed: an unreachable store, an unparsable
row and a missing row all deny. That means a database outage locks the human
administrator out; it does not affect ordinary users, and the Admin Worker does
not call this at all.

Promotion after the second factor **rotates** the session id, atomically in one
CTE — the id that existed while the session was only password-verified must never
be the id that carries full admin authority, so a fixated or leaked pending id is
worthless afterwards. Rotating `ADMIN_USERNAME` revokes sessions minted for the
previous identity on their next request.

**Logout revokes server-side state.** `/api/admin/logout` revokes the
`AdminSession` row **first** and then destroys the cookie. The order is
load-bearing: clearing the cookie alone leaves the row live, so any copy of the
cookie taken before sign-out would still authorize.

Dead rows are kept for **7 days** after they die — "was this session still alive
when the breach happened?" is a question an incident review has to be able to
answer — and are then pruned by an operator command:

```bash
# Dry run — counts what WOULD be deleted, changes nothing
npx tsx scripts/maintenance/prune-admin-sessions.ts

# The real thing
npx tsx scripts/maintenance/prune-admin-sessions.ts --confirm
npx tsx scripts/maintenance/prune-admin-sessions.ts --confirm --batch 1000
```

**Why that lives outside the worker tree.** The obvious home for a recurring
sweep is the Admin Worker's cleanup lane, and it is exactly the wrong place:
`tests/security/fail-closed.test.ts` pins that **no** module under
`src/lib/admin-worker/**` imports `lib/auth/admin-session`. That structural
isolation is what keeps the Admin Worker out of interactive admin authentication
entirely, and wiring the sweep into a lane would create the import — trading a
real security property for a cron slot. So the sweep is an operator command
outside the worker tree, and `tests/security/admin-session-prune-placement.test.ts`
checks the placement as well as the behaviour, so the isolation cannot be quietly
reintroduced through the new file. (The alternative considered — an opportunistic
sweep at the admin-auth entry point — was rejected because it puts a `DELETE` on
the hot authorization path and makes cleanup timing depend on admin traffic.)
There is no second implementation of the delete: the script drives the same
bounded, batched, never-throwing `pruneExpiredAdminSessions` the store exports,
touches no table but `AdminSession`, deletes nothing without `--confirm`, and
stops at a 200-batch ceiling.

### The central admin gate

Every admin API handler passes through **`gateAdminApiCall(req)`**
([`security/admin-gate.ts`](src/lib/security/admin-gate.ts)) as the first thing
it does. The contract is four checks in one place:

1. **CSRF**, on mutations only — safe methods pass through. A failure is a
   Security Breach event and an unconditional refusal, with no second evaluation
   that could disagree and let the mutation through.
2. **Banned device** — blocked before any admin work runs. Unlike the public
   `assertNotBanned`, a store failure here is **not** read as "not banned": if
   the ban table cannot be read we cannot prove the device is clear, so the
   request is refused with 503 and the outage is reported.
3. **Admin session trust** — a completed-2FA session, unrevoked and inside both
   windows, per the section above. A PENDING session is refused here exactly like
   an anonymous caller.
4. On denial, the request is counted toward **admin-route scan detection**, and
   an unauthorized mutation additionally fires the worker's request-path defender
   — fire-and-forget, deliberately not part of the authorization decision, so the
   worker can never become a dependency of basic admin authentication.

Only `/api/admin/login` and `/api/admin/logout` are exempt, and both by
definition: login is where a principal is created, so it cannot require one, and
logout must stay reachable by a session that is already half-broken (expired,
revoked, pending 2FA) or such a session would be stranded.

Coverage is enforced statically by
[`security/admin-route-coverage.ts`](src/lib/security/admin-route-coverage.ts),
which reads the route files from disk (it is imported by tests, never by
anything on the request path, so `node:fs` never reaches a bundled route) and
reports, per route, which guard protects each exported handler. The current tree
reports **zero ungated handlers across all 25 admin routes**.

The lesson is worth recording, because it is the kind of scanner bug that
manufactures false confidence: the scanner used to answer **per file**. A single
mention of `gateAdminApiCall` anywhere in a route marked the whole file gated —
so four routes that paired a gated mutation with a bare `requireAdmin()` read
(`media`, `media/[id]`, `email`, `email/admin-test`) were all reported as covered
while their `GET`s skipped banned-device enforcement entirely — a bare
`requireAdmin()` checks the session and nothing else. An empty debt list proved
nothing about them. The scanner now slices each file into
handler bodies and judges **each handler on its own body**; a route counts as
gated only when **every** exported handler reaches the gate. Module-level code
above the first handler is prepended to each body, so a route that builds its
guard once at the top and awaits it in each handler is still correctly read as
guarded — the goal is to avoid false alarms while refusing to grant false
assurance. Those four `GET`s were then converted, and the tests were falsified
before being trusted: patching one route to discard the gate result turns four
tests red, and planting an ungated fixture route makes the scanner fail.

### Cryptographic domain separation

The deployment has exactly **one** piece of root secret material
(`SESSION_SECRET`) and several independent uses for it. Reusing the same bytes
for encryption, HMAC fingerprinting and code verification means a weakness in one
use — or an oracle in one protocol — leaks into all the others. So
[`security/keys.ts`](src/lib/security/keys.ts) derives **purpose-separated
subkeys via HKDF-SHA256** from that same root secret, each under its own fixed
context label:

| Purpose                | HKDF `info` label                        | Declared for                                   | Reached today by                           |
| ---------------------- | ---------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `session`              | `viafidei/v1/session-security`           | Session-scoped secrets                         | The stored HMAC of an admin session id     |
| `at-rest`              | `viafidei/v1/at-rest-encryption`         | AES-256-GCM encryption of database columns     | `crypto.ts`, for `v2` payloads             |
| `security-fingerprint` | `viafidei/v1/security-event-fingerprint` | HMAC fingerprints on security-event/audit rows | `hash.ts`, for every non-legacy kind       |
| `admin-2fa`            | `viafidei/v1/admin-2fa-code`             | HMAC over the six-digit admin codes            | `admin-2fa.ts` (via `getTwoFactorHmacKey`) |
| `internal-auth`        | `viafidei/v1/internal-auth-signature`    | Internal / machine-to-machine signatures       | Declared; no caller yet                    |

The salt is a fixed non-secret constant (RFC 5869 §3.1 — the entropy comes from
the root secret and the separation from the `info` label) so derivation is
reproducible across processes and deploys. Callers name a **purpose**; they never
touch the root secret and never invent their own derivation, and asking for an
unknown purpose throws rather than deriving a key from `undefined`. Labels are
part of the on-disk contract: editing one silently rotates that key and
invalidates everything derived under it, so a new use gets a new label rather
than an edited one.

The iron-session cookie itself is still sealed with the raw `SESSION_SECRET`, not
a subkey — [`auth/session.ts`](src/lib/auth/session.ts) cannot import from
`keys.ts` without dragging `node:crypto` into the edge-runtime middleware bundle,
so the two hold the dev-fallback constant in deliberate lockstep instead.

**Already-encrypted production records remain decryptable.** At-rest payloads are
versioned: `v1` (key = `SHA-256(SESSION_SECRET)`, no AAD) is what every release
before domain separation wrote, so **production rows are v1**. `decryptAtRest`
still reads them through the retained `deriveKey()`; nothing writes `v1` any
more, and `v2` uses the derived subkey plus its version string as AAD so a `v2`
payload cannot be replayed as another version. The same compatibility rule
applies to fingerprints: `ip`, `device` and `ua` are **lookup keys** on live rows
(`BannedDevice.deviceCredentialHash` is unique, and the live ban check is a
`findUnique` on it), so re-keying them would silently un-ban every banned device.
Those three keep the original root-secret HMAC; every newer kind uses the derived
`security-fingerprint` subkey.

### CSP and CSRF

`src/middleware.ts` no longer allows **`script-src 'unsafe-inline'`**. Each
request gets a fresh **nonce** (16 CSPRNG bytes, base64, generated with
`crypto.getRandomValues` and `btoa` so no `node:crypto` import sneaks into the
edge bundle), the policy goes on both the request and the response headers, and
Next reads the nonce back off the request header and stamps it onto every
framework script it emits — the bootstrap script and the `self.__next_f.push(…)`
flight-data scripts — so the app keeps hydrating while an injected inline script
does not execute. **`object-src` is `'none'`**: the app embeds no plugins,
applets or `<object>`/`<embed>` content, and that is the classic
SVG/Flash-style XSS vector. `'unsafe-eval'` is added **outside production only**,
because the webpack dev build evaluates modules with `eval()` and the production
bundle never does. `style-src` keeps `'unsafe-inline'` — Next inlines critical
CSS and `next/font` injects a `<style>` block — which is a far weaker concession,
since an inline style cannot execute script.

The **e2e suite is what proves the nonce work did not break hydration**: it runs
the same standalone production server the container runs, loads every primary
route, and asserts the header renders and survives navigation. A nonce the
renderer and the browser disagree about does not throw — the scripts simply do
not run, and the page arrives looking correct and doing nothing. That is
invisible to a type check, a unit test and a component test alike; only something
that loads the real page in a real browser catches it, which is why the e2e run
is a gate on this work rather than a nicety.

**CSRF no longer lets a forwarded host header decide the origin a request is
validated against.** `evaluateCsrf` compares the browser-attached `Origin` (or,
absent it, the `Referer`) against `getTrustedOrigins`, which in production is the
constant canonical set derived from `src/lib/config.ts` and **never** anything a
header said; outside production it is the origin the request actually arrived on
plus loopback, so `next dev`, Playwright and unit tests still work on whatever
port they bound. An earlier revision derived the expected origin from
`X-Forwarded-Host`, which means an attacker able to inject that header anywhere
in the proxy chain also chooses the value their own forged `Origin` is compared
against — reducing the whole module to a no-op. The same rule now governs
redirects: `getPublicOrigin` (and the middleware's own inlined copy) accepts a
forwarded host in production only when it names a host this deployment actually
serves, and answers with the canonical origin otherwise, so a spoofed header
cannot turn the `/admin` login redirect into an open redirect.

### Password recovery

`POST /api/auth/forgot-password` returns the **same public response whether or
not an account exists** — the same 200 and the same `{ sent: true }` body for
every well-formed request, which the client renders as "If an account exists for
this email address, password reset instructions have been sent." An earlier
revision returned `404 not_found` for unknown addresses and leaked the mail
provider's error text for known ones, which let anyone confirm membership one
address at a time and read deployment internals while doing it. The only two
distinguishable status codes left are properties of the **request**, not of the
account: 400 for a malformed email, 429 for the per-IP rate limit.

Sameness of the body is not enough on its own. The recovery work — a token write
plus a network round-trip to the mail provider — only happens when the address
matches an account, so awaiting it would make that path hundreds of milliseconds
slower and re-create the same enumeration as a timing oracle. The work is
therefore detached (handed to `after()` so the request context stays alive), and
both cases cost one indexed lookup on the response path. A lookup **failure** is
also swallowed into the same response, so the endpoint cannot be used to probe
the database's health either.

**Internal diagnostics are unchanged**: storage-unavailable, token issued,
delivery rejected, delivery skipped and flow-failed each still log their real
outcome with the fields `/admin/email` renders — never the raw token, never the
API key, never the email body, and never the probed address itself, so an
unauthenticated caller cannot fill the operator's log with addresses they are
testing. **Every existing token protection is untouched**: 32 random bytes,
SHA-256 hashed at rest, 15-minute expiry, single use, sibling tokens invalidated
on consume, and every session torn down after the password rotates. The one
behavioural change beyond the response is that the route now **fails closed**
rather than repairing schema mid-request — an auth route must not run DDL, so a
genuinely missing token table is an operator-log event and a startup-validator
failure, not something an unauthenticated request quietly fixes.

---

## Deploy path

`railway.json` → `Dockerfile` → [`scripts/start.sh`](scripts/start.sh), and each
step of that chain is load-bearing:

1. **Wait for the database** (up to 60 s).
2. **`prisma migrate deploy`**, via
   [`scripts/migrate-deploy.sh`](scripts/migrate-deploy.sh) — which **exits
   non-zero on failure**, taking the container down rather than serving a site
   whose schema is behind its code. That is why migrations `0055`/`0056` guard
   every statement a managed Postgres role might be refused (see below): an
   unguarded `CREATE EXTENSION` or `CREATE FUNCTION` failing here takes the site
   down on the next restart.
3. **`scripts/validate-db.js`** — a startup sanity check on the schema the app
   actually needs. It deliberately does **not** require the optional search
   column or index to exist.
4. **`exec`** the Next standalone server.

The Admin Worker is not part of this path: it is deployed to the operator's Mac
by `bash scripts/desktop-app/install.sh`, and the retained Railway worker service
runs [a parked `sleep` loop](#the-retained-railway-worker-service).

---

## Migration history

| Migration                                          | What it added                                                                                                                                                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001` – `0022`                                    | Original schema (auth, content, ingestion, …)                                                                                                                                                                                       |
| `0023_checklist_first_architecture`                | Checklist-first models (ChecklistItem, …)                                                                                                                                                                                           |
| `0024_admin_worker`                                | Admin Worker engine tables (15 + enums)                                                                                                                                                                                             |
| `0025_drop_legacy_system`                          | Dropped 30+ legacy tables, consolidated UserSaved\* into UserSavedContent                                                                                                                                                           |
| `0026_admin_worker_brain`                          | Brain tables: SourceRead, PipelineStage, RepairPlan                                                                                                                                                                                 |
| `0027_admin_worker_brain_ranking`                  | Brain ranked alternatives + AdminWorkerFetchResult / SourceBlock / CrossSourceVerification                                                                                                                                          |
| `0028_admin_worker_pipeline_and_orchestrators`     | Pipeline durability + candidate scoring fields + SourceCoverage + GrowthSnapshot                                                                                                                                                    |
| `0029_admin_worker_package_artifact`               | AdminWorkerPackageArtifact (built package as a first-class artifact)                                                                                                                                                                |
| `0030_admin_worker_strict_qa`                      | AdminWorkerStrictQAResult (durable strict-QA per artifact)                                                                                                                                                                          |
| `0031_admin_worker_repair_kinds_strict_qa_quality` | Added STRICT_QA_FAILED + QUALITY_SCORE_FAILED repair kinds                                                                                                                                                                          |
| `0032_admin_worker_source_coverage_active_counts`  | SourceCoverage: active / recently-successful / recently-failed source counts                                                                                                                                                        |
| `0033` – `0037`                                    | Action-score + reasoning-graph tables; parish / pope / doctor / rite content types                                                                                                                                                  |
| `0038_intelligence_memory_graph`                   | Intelligence brain store: Embedding (vectors), GraphNode/GraphEdge, DeveloperRequest, BrainCall                                                                                                                                     |
| `0039_daily_readings`                              | DailyReading (daily liturgical readings as internal content)                                                                                                                                                                        |
| `0040_stage_outcomes_rollback_quality_v2`          | AdminWorkerStageOutcome + AdminWorkerRollbackLedger; full ContentQualityScore model; action `fallbackAction`; PublishedContent `contentChecksum`                                                                                    |
| `0041_drop_legacy_qa_buildlog_version_relation`    | Dropped the legacy WorkerBuildLog / ChecklistQAReport / ChecklistVersion / ChecklistRelation tables (superseded by AdminWorkerStrictQAResult + AdminWorkerLog)                                                                      |
| `0042` – `0047`                                    | Content-goal target model; unified intelligence tables; Intelligence Laboratory; certified skill runtime; PublishedContent subtitle                                                                                                 |
| `0048_admin_worker_escalation_and_code_version`    | AdminWorkerEscalation (dedup escalation memory) + AdminWorkerCodeVersion (system/code-update version memory)                                                                                                                        |
| `0049` – `0050`                                    | Adaptive worker lanes: `AdminWorkerLaneState` + the artifact-lease columns                                                                                                                                                          |
| `0051_published_content_version`                   | `PublishedContentVersion` — the snapshot every protected content update writes before it changes a live row                                                                                                                         |
| `0052_admin_worker_strategy_stat`                  | `AdminWorkerStrategyStat` — per-(dimension, method, content type) outcome memory                                                                                                                                                    |
| `0053_escalation_resolved_reason`                  | `resolvedReason` on AdminWorkerEscalation (condition cleared vs superseded by upgrade)                                                                                                                                              |
| `0054_published_content_query_columns`             | Indexed query columns on PublishedContent (feastMonth, feastDayOfMonth, sortYear, subtype, latitude, longitude, region, sourceRef, addressKey)                                                                                      |
| `0055_published_content_search`                    | Search: the weighted `searchVector` tsvector + trigger + partial GIN index, and an **optional** pg_trgm trigram index. Every privileged statement is guarded so a role that cannot create it degrades instead of failing the deploy |
| `0056_admin_worker_log_event_index`                | `AdminWorkerLog (eventName, createdAt)` — the index the retention prune and the per-event readers walk                                                                                                                              |
| `0060_admin_session_store`                         | `AdminSession` — the server-side admin session lifecycle (stage, both authentication timestamps, last activity, idle + absolute expiry, revocation). Keyed on an **HMAC** of the session id, never the id itself                    |
| `0061_admin_two_factor_challenge`                  | `AdminTwoFactorChallenge` — the pending second factor. Stores a keyed HMAC of the six-digit code (never the code), and an HMAC of the pending session id                                                                            |

`0057`–`0059` do not exist: concurrent security work in this tree claimed those
numbers and did not ship. The gap is intentional and harmless — Prisma applies
migrations in directory-name order and records them by name. Both new files only
`CREATE` new tables and their indexes, so no statement can queue behind readers
of a live table; each sets a `lock_timeout` anyway so a pathological catalog lock
fails fast rather than stalling `scripts/start.sh`.

Migrations `0055` and `0056` both take a `lock_timeout` of 5 s, because
`prisma migrate deploy` runs each file in one transaction and a queued
`ACCESS EXCLUSIVE` request blocks every reader behind it. **Deploy with the
Admin Worker master switch OFF**, and confirm the worker process has exited, so
the migration is not waiting on the worker's own write transaction.

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
