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

The Admin Worker is driven by a **permanent Python intelligence brain**
([`intelligence/`](intelligence/)) — a deterministic, pure-stdlib core (no
AI APIs, no network) that TypeScript holds open as an always-on service and
consults on every meaningful decision: **final action selection**, planning +
**mission control**, semantic memory + hybrid retrieval, duplicate detection,
source intelligence with a **Catholic authority graph** + **communion-risk**
screening, **claim-level verification**, quality + **specialist-panel** review,
action **simulation**, **confidence calibration**, knowledge-graph and
schema/UI awareness, a whole-app **self-model**, repair + **stuckness**
analysis, learning, and self-inspection (125 operations).
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

| Model               | Role                                                             |
| ------------------- | ---------------------------------------------------------------- |
| `ChecklistItem`     | One row per concrete item (populated from package artifacts)     |
| `AuthoritySource`   | Approved-source registry (Vatican, USCCB, …)                     |
| `ChecklistCitation` | One citation per (item, URL) with authority level                |
| `WorkerBuildJob`    | Build-intent signal the Admin Worker reads (enqueued on approve) |
| `PublishedContent`  | The only table the public site reads from                        |

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

| Variable                          | Purpose                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                  | Enables transactional + admin emails                                                                                                               |
| `ADMIN_EMAIL`                     | Destination for Admin Worker monthly + security emails                                                                                             |
| `PUBLIC_BASE_URL`                 | Base URL the post-publish probe + verifiers fetch from                                                                                             |
| `WORKER_ID`                       | Stable id for this worker process (auto-generated)                                                                                                 |
| `ADMIN_WORKER_SKIP_NETWORK`       | Test-only: dispatcher skips real fetch + read calls when `1`                                                                                       |
| `ADMIN_WORKER_DISABLE_LIVE_PROBE` | Local/dry-run only: skip the mandatory production live sitemap + cache probe when `1` (verification is otherwise live + fail-closed in production) |
| `INTELLIGENCE_BRAIN_ENABLED`      | Python intelligence brain on/off (default on; `0` disables)                                                                                        |
| `INTELLIGENCE_PYTHON`             | Python executable for the brain (default `python3`)                                                                                                |
| `INTELLIGENCE_TIMEOUT_MS`         | Per brain-call timeout (default `8000`)                                                                                                            |

---

## Admin UI

`/admin` renders a card grid grouped into four sections:

**Admin Worker (autonomous system):**

| Card                | Route                           | Purpose                                                                                                                                                             |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command Center      | `/admin/admin-worker`           | Mission + chosen action + ranked alternatives + content-growth funnel + Why-No-Growth + controls                                                                    |
| System diagnostics  | `/admin/diagnostics`            | Subsystem ratings (incl. automatic-repair status), pause toggle, Developer Audit PDF                                                                                |
| Worker Reasoning    | `/admin/admin-worker/reasoning` | Full "why" chain for any content item (candidate → … → publish), drawn from the reasoning graph                                                                     |
| Pipeline map        | `/admin/admin-worker/pipeline`  | Per-stage queue snapshot across the 22-stage chain                                                                                                                  |
| Package artifacts   | `/admin/admin-worker/artifacts` | Every built artifact + its strict-QA result; per-artifact detail view                                                                                               |
| Admin Worker logs   | `/admin/admin-worker/logs`      | 16-category log viewer with period + severity filters                                                                                                               |
| Admin Worker rules  | `/admin/admin-worker/rules`     | Versioned rule catalogue                                                                                                                                            |
| Worker Intelligence | `/admin/intelligence`           | Live capability dashboard: brain status, self-model, capability strengths/weaknesses, memory, source reliability, decisions, self-explanations, stuckness, upgrades |

The public **daily readings** page lives at `/liturgy/readings` (the
homepage + liturgical calendar link to it); the worker keeps it current and
routes uncertain days to review.

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
  (`finalBrain: "python"` / `"degraded"`) is recorded on every pass.
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
  (canonicalMax 7); Parish 300,000; Prayer 1,000; Pope 267; Saint 1,000;
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
  = the Church-documents timeline, tagged `view`). Each row shows a single
  legible `Have / Target` column, Hard max (— for open types), Gap, and status,
  and reserves "complete" for Sacraments.
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

The repo ships a hand-verified curated knowledge base
(`src/lib/checklist/knowledge/`, `ALL_CURATED_ENTRIES`) of ground-truth,
schema-valid Catholic content with authority citations — the Church's fixed
texts and canonical lists: prayers, litanies, the seven sacraments, saints,
the 37 Doctors, the line of popes, the recognized rites, major basilicas,
Marian titles, approved apparitions, and more. This is the worker's
**first-pass content source**, so canonical content can be published without a
live fetch, while live discovery + cross-source verification grows everything
beyond the curated set.

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
| `liturgical-calendar.ts`                 | Meeus-based liturgical calendar engine                                                                    |
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

| Op                                                                                           | Purpose                                                                           |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `embed`, `semantic_search`                                                                   | semantic memory / vector search                                                   |
| `detect_duplicates`                                                                          | exact + slug + fuzzy + semantic + alias + source/citation duplicate scoring       |
| `score_quality`                                                                              | per-record quality profile + hard publish gates                                   |
| `assess_source`, `detect_communion_risk`, `compare_sources`                                  | source authority, **Catholic communion-risk screening**, contradiction detection  |
| `infer_relationships`                                                                        | recommend knowledge-graph edges                                                   |
| `classify_failure`, `diagnose_fetch`                                                         | repair intelligence + webpage-fetch diagnosis                                     |
| `self_inspect`, `developer_requests`, `iq_metrics`                                           | self-inspection, the worker's developer requests, worker-IQ metrics               |
| `plan`, `prioritize`                                                                         | planning + priority intelligence                                                  |
| `analyze_graph`                                                                              | orphans, weak links, hubs, components, duplicate clusters, missing edges          |
| `scan_content`                                                                               | prompt-injection / manipulation detection on sanitised text                       |
| `classify_freshness`                                                                         | refresh-cadence classification                                                    |
| `extract_knowledge`                                                                          | extract dates, names, citations, sources, claims, sections from sanitised text    |
| `suggest_structure`                                                                          | content-structure intelligence (sections, split recommendations)                  |
| `detect_variants`                                                                            | structural title variants (flags that real translations need source verification) |
| `detect_missing`                                                                             | missing-information detection per record (gaps + severity + completeness)         |
| `learn_from_outcome`                                                                         | turn an outcome / admin feedback into score adjustments + a learned memory        |
| `analyze_schema`                                                                             | schema-awareness: isolated/under-indexed models → schema developer requests       |
| `analyze_ui`                                                                                 | UI-awareness: content types with no public route → UI developer requests          |
| `build_self_model`                                                                           | whole-app self-model from the ingested corpus (files, routes, models, ops, …)     |
| `build_symbol_graph`, `build_route_graph`, `build_schema_graph`, `build_test_coverage_graph` | module/route/model/test graphs (depended-on, orphans, unused, coverage)           |
| `explain_own_architecture`                                                                   | narrate the Python-brain / TS-body / Postgres-memory layering with evidence       |
| `find_weak_modules`, `find_untested_modules`, `find_orphaned_code`, `find_duplicate_logic`   | deep code awareness: why a module is weak + split plan + risk + tests             |
| `rank_self_upgrades`                                                                         | rank the worker's own upgrade requests (evidence, gain, difficulty, rollback)     |
| `detect_stuckness`                                                                           | stage/source/repair loops + no-growth detection → change-strategy recommendation  |

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

### Unified brain capabilities (125 operations)

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
- **Upgrade-request engine** (`upgrades.py`): the worker's internal product
  manager — rank, explain, dedupe, ROI-score, and flag neglected requests.
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
- **Review-gated self-improvement** (`patches.py`): the brain proposes code /
  schema / test patches with risk review + rollback plan, but never applies or
  deploys them (`safe_to_auto_execute` is always false; human review required).

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
  near-duplicates the slug/canonical checks miss, and the **12-member
  specialist panel** (`specialist_reviews`) routes a candidate to review when a
  blocking specialist objects (e.g. an uncited sensitive type, a security or
  duplicate flag) — all before the existing quality/QA gates.
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
  `recommend_unblock_strategy`, filing a developer request when stuck).
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
- **Daily readings** (`daily-readings.ts`): freshness classification +
  review-on-uncertainty.

All of the supplementary wirings above are best-effort and non-blocking —
they never block a pass. The **final action selection** is separate: the
Python brain selects it whenever it is online (the default); otherwise the
worker enters safe degraded mode and never falls back to a TypeScript final
brain.

### Postgres tables (migration `0038`)

`AdminWorkerEmbedding` (vector/semantic-memory store, JSON embeddings — no
pgvector required), `AdminWorkerGraphNode` / `AdminWorkerGraphEdge`
(knowledge graph; inferred edges land `PROPOSED` until approved),
`AdminWorkerDeveloperRequest` (the worker's requests to the developer,
deduped by fingerprint), and `AdminWorkerBrainCall` (audit trail of every
brain call).

### Admin surface

`/admin/intelligence` is a **live capability dashboard**: brain status +
protocol + op count + self-model freshness, worker-IQ, the **self-model
snapshot** (files, lines, routes, models, test coverage, weak/untested/orphan/
duplicate counts, architecture layers, largest modules), a deterministic
**capability strengths/weaknesses** map, the **top self-requested upgrades**,
**multi-layer memory** by type, learned **source reliability**, recent
decisions with confidence + risk, recent **self-explanations**,
**stuckness/blocker** signals, communion-risk flags, and the operation mix.

### Commands

```bash
python3 -m intelligence --selftest   # run every op against a sample payload
python3 -m intelligence --list-ops   # list ops + protocol version
npm run brain:test                   # python unit tests (stdlib unittest)
npm run brain:selftest               # same as --selftest
```

The Python runtime ships **inside the worker image** (`Dockerfile.worker`
copies the `python:3.11-slim-bookworm` interpreter + stdlib, the same Debian
release as the node base, plus the `intelligence/` package), so the brain is
a permanent part of the deploy. If Python is ever unavailable the worker
simply uses its deterministic fallbacks. Override the interpreter with
`INTELLIGENCE_PYTHON` or disable entirely with `INTELLIGENCE_BRAIN_ENABLED=0`.

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

**Category filters.** Content-rich tabs split their items into the Church's
natural groupings via URL-driven filter chips (`?filter=…`, the shared
`FilterChips` component + `src/lib/content-shared/*-categories.ts`): Saints by
type, Guides by kind (**Chaplets** surfaces the Divine Mercy Chaplet), Rites by
family (Latin / Eastern), Liturgy by kind, Spiritual Life by practice, Our Lady
by titles/apparitions, Church Documents by category (incl. Dogmas), and
Parishes by designation. Each tab only shows a chip when at least one published
item falls under it.

**Daily readings.** The Liturgical Calendar's "Official Mass readings for this
day" button links to the **internal** `/liturgy/readings?date=…` page (kept
current by the worker's `maybeRefreshDailyReadings` each pass), not an external
site; that page carries a modest source link at the bottom.

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
