# Via Fidei

> _The Way of Faith._ A multilingual Catholic platform — prayers, saints,
> sacramental guidance, liturgy, and trusted Catholic content — presented
> with reverence and clarity.

**Live site: [etviafidei.com](https://etviafidei.com)**

Via Fidei is a Next.js 15 application that pairs a public, reader-facing site
with an authenticated admin console for curating Catholic content. Content is
sourced only from approved Catholic publishers and verified at multiple stages
before it reaches the public. The worker is an autonomous custodian: with a
fresh database it fills the site by itself, drawing on a curated knowledge
base of foundational Catholic content.

---

## Architecture: approved-checklist-first

Viafidei runs a **checklist-first content factory** — the only way new content
reaches the public site. The legacy scrape-transform-clean pipeline has been
replaced. Every published item flows through these five stages:

```
   1. APPROVED SOURCE DISCOVERY
        ↓
   2. CHECKLIST APPROVAL (admin or autonomous worker)
        ↓
   3. INTELLIGENT WORKER BUILD (curated knowledge or live fetch)
        ↓
   4. QA VALIDATION (six-dimension scoring + publishing gate)
        ↓
   5. PUBLISH
```

### 1. Approved source discovery

Sources are listed in `src/lib/worker/sources/authority-registry.ts` (16
approved hosts at last count). Each authority has a level: VATICAN, CATECHISM,
LITURGICAL_BOOK, USCCB, DIOCESAN, RELIGIOUS_ORDER, TRUSTED_PUBLISHER, ACADEMIC,
COMMUNITY. **The worker physically refuses to fetch any URL whose host is not
on this list.** Admins can add new sources via the admin UI; the seed script
writes them into the `AuthoritySource` table.

### 2. Checklist approval

Eleven master checklists, in `src/lib/worker/checklists/`, define every item
the app intends to publish — **191 items in total**:

| Checklist           | Count | File                                               |
| ------------------- | ----- | -------------------------------------------------- |
| Prayers             | 33    | `src/lib/worker/checklists/prayers.ts`             |
| Saints              | 30    | `src/lib/worker/checklists/saints.ts`              |
| Liturgical topics   | 21    | `src/lib/worker/checklists/liturgical.ts`          |
| Church documents    | 19    | `src/lib/worker/checklists/church-documents.ts`    |
| Devotions           | 17    | `src/lib/worker/checklists/devotions.ts`           |
| Marian titles       | 16    | `src/lib/worker/checklists/marian-titles.ts`       |
| Guides              | 14    | `src/lib/worker/checklists/guides.ts`              |
| Novenas             | 12    | `src/lib/worker/checklists/novenas.ts`             |
| Spiritual practices | 12    | `src/lib/worker/checklists/spiritual-practices.ts` |
| Apparitions         | 10    | `src/lib/worker/checklists/apparitions.ts`         |
| Sacraments          | 7     | `src/lib/worker/checklists/sacraments.ts`          |

Every checklist item moves through a lifecycle tracked on its row:

```
DISCOVERED → SOURCE_VERIFIED → APPROVED_FOR_BUILD →
BUILT → QA_PENDING → APPROVED → PUBLISHED
```

with side-branches for `REJECTED` and `NEEDS_HUMAN_REVIEW`.

### 3. Intelligent worker build

The worker (`src/lib/worker/`) is **self-sufficient, intelligent, and
schema-driven**:

- Loads the approved checklist item and its verified citations.
- Fetches every source via `fetchApprovedSource()` (host-allowlist enforced).
- Extracts candidate values per field using a type-specific extractor.
- Reconciles across sources: higher authority wins, agreement raises
  confidence, conflict at the same level raises `needsHumanReview`.
- Refuses to invent doctrine, feast days, indulgences, titles, apparitions,
  or promises — any required field without source provenance is rejected.
- Generates a canonical slug, runs duplicate detection, and stamps source
  provenance onto every field.
- Validates the final payload against the strict Zod schema for the content
  type (see `src/lib/worker/schemas/`).
- Emits a structured `WorkerBuildLog` row per step and a confidence number
  per build.
- Retries failed builds with exponential backoff; preserves partial results
  via `partialPayload` so a build does not have to restart from scratch.

### 4. QA validation

Every build runs through `runQA()` in `src/lib/worker/qa/index.ts`, which
scores six dimensions:

| Dimension      | What it measures                                |
| -------------- | ----------------------------------------------- |
| completeness   | Every required field populated                  |
| accuracy       | Catholic-accuracy guardrails pass               |
| sourceCoverage | Minimum citations met                           |
| formatting     | No script tags, no broken whitespace            |
| readability    | Average word length plausible                   |
| appCompat      | Payload validates against the strict Zod schema |

The aggregate score plus the issue list produce a recommendation:
**publish**, **review**, or **reject**. The QA report is persisted in
`ChecklistQAReport` for every build attempt.

### 5. Publishing gate

`publish()` in `src/lib/worker/publishing/index.ts` is the **single
chokepoint** between the worker and the public site. It refuses to publish
unless QA passed AND no human review is required (admins can force a bypass).
Successful publish writes a `PublishedContent` row (the only table the public
site reads from) and a `ChecklistVersion` snapshot for rollback.

---

## Data model (overview)

The new checklist-first models live alongside (and replace the content roles
of) the legacy `Prayer`, `Saint`, `Devotion`, etc. tables.

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

See `prisma/schema.prisma` for the full definitions.

---

## Running locally

```bash
# Install deps and generate Prisma client
npm install

# Push the schema and seed authority sources + master checklists
npm run db:push
npm run seed:checklist

# Start the dev server
npm run dev

# In a separate terminal, run the worker
npm run worker
```

Useful scripts:

| Script                            | What it does                                                            |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                     | Start the Next.js dev server on :3000                                   |
| `npm run build`                   | Production build (`prisma generate && next build`)                      |
| `npm run start`                   | Start the production server                                             |
| `npm run worker`                  | Loop forever, draining the build queue + autonomous promotion when idle |
| `npm run worker:once`             | Run one build cycle and exit                                            |
| `npm run seed:checklist`          | Sync authority sources + master checklists (idempotent)                 |
| `npm run migrate:checklist-first` | Migrate legacy data into the new tables (idempotent)                    |
| `npm run db:push`                 | Push the Prisma schema to the database                                  |
| `npm run db:migrate`              | Apply Prisma migrations                                                 |
| `npm run db:validate`             | Verify the schema is wired correctly                                    |
| `npm run typecheck`               | `tsc --noEmit`                                                          |
| `npm run lint`                    | ESLint                                                                  |
| `npm run format` / `format:check` | Prettier                                                                |
| `npm test`                        | Vitest unit + component + worker tests                                  |
| `npm run test:integration`        | Real-DB integration tests (`VITEST_INTEGRATION=1`)                      |
| `npm run test:e2e`                | Playwright end-to-end                                                   |
| `npm run verify`                  | typecheck + lint + format:check + tests                                 |
| `npm run verify:full`             | The above + integration + e2e + build                                   |

### Notable runtime dependencies

- **Next.js 15** (`next`) — application framework.
- **Prisma 5** (`@prisma/client`, `prisma`) — Postgres ORM and migrations.
- **Zod** (`zod`) — strict content schemas.
- **pdfkit** (`pdfkit`) — server-side PDF generation for the Developer
  Audit download.
- **argon2** — password hashing.
- **iron-session** — admin session cookies.

---

## Admin UI

The admin home page (`/admin`) renders a card grid that links to every part
of the system. The cards include:

| Card                | Route                              | Purpose                                   |
| ------------------- | ---------------------------------- | ----------------------------------------- |
| Checklist dashboard | `/admin/checklist`                 | Main pane of glass — counts, bulk actions |
| System diagnostics  | `/admin/diagnostics`               | Live health + developer audit             |
| Worker build queue  | `/admin/checklist/queue`           | Live build job state                      |
| QA reports          | `/admin/checklist/qa`              | Unreviewed reports                        |
| Published content   | `/admin/checklist/published`       | Items live on the public site             |
| Approved sources    | `/admin/checklist/sources`         | Authority registry                        |
| Janitor: edits      | `/admin/checklist/janitor/edits`   | Items the worker wants to rebuild         |
| Janitor: deletes    | `/admin/checklist/janitor/deletes` | Items the worker wants to remove          |
| Failed builds       | `/admin/checklist/failed`          | Exhausted retry budgets                   |
| Homepage editor     | `/admin/homepage`                  | Public homepage mirror                    |
| Search index        | `/admin/search`                    | Search                                    |
| Media library       | `/admin/media`                     | Image assets                              |
| Logs                | `/admin/logs`                      | Application logs                          |
| User accounts       | `/admin/users`                     | Registered users                          |
| Audit log           | `/admin/audit`                     | Admin actions                             |

### Checklist dashboard (`/admin/checklist`)

The single pane of glass for the content factory. It shows:

- Counts by approval status and by content type.
- **Bulk action buttons** at the top — always clickable (a lighter shade
  when there is nothing to do):
  - **Verify all** (indigo) — flips every DISCOVERED item that has at
    least one approved citation to SOURCE_VERIFIED.
  - **Build all** (emerald) — approves and enqueues every
    SOURCE_VERIFIED item; pulses ⚡ when verification just completed
    and only the build step remains.
  - **⚡ Run autonomous cycle** (purple) — runs the full custodian
    pipeline in-process: bootstrap citations from the knowledge base,
    promote, build, publish, up to 50 builds per call.
  - **Reject all discovered** (rose) — prompts for a reason and rejects
    every DISCOVERED item.
- Discovered / Source verified / Approved for build / Queue pending /
  QA pending / Published / Failed builds / Needs human review cards.
- Per-item detail at `/admin/checklist/item/[id]` with full citations,
  build history, QA reports, version history, relations, and manual
  actions (verify, approve, rebuild, publish, unpublish, reject, add
  citation).

### Diagnostics page (`/admin/diagnostics`)

Colour-coded live health status for every part of the system. Twelve
live checks cover: database connectivity, schema registration, checklist
seed completeness, authority source registry, curated knowledge base,
autonomous progress (published-vs-total percentage), worker queue,
QA pipeline, publishing health, published-content coverage per type,
worker activity in the last 24h, and janitor findings. The header
exposes four controls:

1. **Period selector + Download Developer Audit (PDF)** (emerald) —
   downloads the full audit for the last 24 hours, 7 days, or 30 days.
2. **⚡ Run autonomous now** (purple) — kicks one full custodian cycle
   in-process from the diagnostics view: bootstrap citations, promote,
   build, publish.
3. **Developer report** (indigo) — generates the same audit as Markdown
   and copies it to the clipboard.
4. **← dashboard** — back link.

### Admin API routes

All require an authenticated admin principal.

| Route                                               | Method   | Purpose                                |
| --------------------------------------------------- | -------- | -------------------------------------- |
| `/api/admin/checklist/[id]/verify-sources`          | POST     | Mark single item SOURCE_VERIFIED       |
| `/api/admin/checklist/[id]/approve`                 | POST     | Approve single item for build          |
| `/api/admin/checklist/[id]/rebuild`                 | POST     | Re-enqueue single item                 |
| `/api/admin/checklist/[id]/publish`                 | POST     | Force-publish single item              |
| `/api/admin/checklist/[id]/unpublish`               | POST     | Unpublish single item                  |
| `/api/admin/checklist/[id]/reject`                  | POST     | Reject single item                     |
| `/api/admin/checklist/[id]/add-citation`            | POST     | Attach an approved citation            |
| `/api/admin/checklist/janitor/[id]`                 | POST     | Accept / dismiss a janitor finding     |
| `/api/admin/checklist/bulk/verify-all`              | POST     | Verify every DISCOVERED item           |
| `/api/admin/checklist/bulk/build-all`               | POST     | Build every SOURCE_VERIFIED item       |
| `/api/admin/checklist/bulk/reject-all`              | POST     | Bulk reject by status / content type   |
| `/api/admin/checklist/bulk/run-autonomous`          | POST     | One full autonomous custodian cycle    |
| `/api/admin/checklist/seed`                         | POST     | Re-seed authority sources + checklists |
| `/api/admin/checklist/worker-run`                   | POST     | Run one worker cycle in-process        |
| `/api/admin/diagnostics`                            | GET/POST | Live diagnostics + Markdown report     |
| `/api/admin/diagnostics/developer-audit?period=...` | GET      | Download Developer Audit PDF           |

### Diagnostic status colour scheme

- **Green** — pass: the part is healthy.
- **Yellow** — warn: the part is degraded but functioning.
- **Red** — fail: the part is broken; the status badge is white-on-red and
  the row uses black-on-red highlighting for high visibility.

## The autonomous custodian

The worker is the site's custodian. It is its own admin: it bootstraps,
verifies, approves, builds, and publishes content without needing human
clicks. It runs a continuous five-step cycle:

1. **Curated knowledge bootstrap.** The worker ships with a curated
   knowledge base in `src/lib/worker/knowledge/` containing canonical
   text for **117 of the most foundational Catholic items**: every one
   of the seven sacraments with theology, matter, form, minister,
   effects, and CCC references; the foundational prayers (Our Father,
   Hail Mary, Glory Be, both Creeds, the Acts of Faith / Hope / Love /
   Contrition, Memorare, Angelus, Regina Caeli, Salve Regina, Prayer to
   St. Michael, Morning Offering, Grace before/after meals, Anima
   Christi, Magnificat, Confiteor, Te Deum, Veni Creator Spiritus,
   Divine Praises, Prayer of St. Francis); 21 saints with feast day and
   biography; the four defined Marian dogmas; five approved Marian
   apparitions; five novenas with all nine days written out; the major
   liturgical solemnities and seasons plus the structure of the Roman
   Rite Mass; eight spiritual practices; the Rosary, Confession, and
   Examination-of-Conscience step-by-step guides; the most influential
   devotions; and eleven Vatican documents (CCC, Lumen Gentium,
   Dei Verbum, Sacrosanctum Concilium, Gaudium et Spes, Humanae Vitae,
   Veritatis Splendor, Evangelium Vitae, Deus Caritas Est, Laudato Si',
   Evangelii Gaudium). When an item has no admin-attached citations,
   the worker self-cites from this registry — so the site fills itself
   starting from a fresh database.

   The curated knowledge base by content type:

   | Type                | Curated entries |
   | ------------------- | --------------- |
   | Prayers             | 24              |
   | Saints              | 21              |
   | Liturgical          | 18              |
   | Church documents    | 11              |
   | Marian titles       | 8               |
   | Spiritual practices | 8               |
   | Devotions           | 7               |
   | Sacraments          | 7               |
   | Novenas             | 5               |
   | Apparitions         | 5               |
   | Guides              | 3               |

2. **Autonomous promotion.** When the build queue is idle, the worker
   advances DISCOVERED → SOURCE_VERIFIED (any item with at least one
   approved citation) → APPROVED_FOR_BUILD (any item whose schema does
   not mandate human review and has enough citations). APPARITION items
   are never auto-promoted past SOURCE_VERIFIED because Church approval
   status is doctrinally significant.

3. **Curated build short-circuit.** When the build engine processes an
   item with a curated knowledge entry, it uses the curated payload
   directly. This gives production-quality content with confidence 0.95
   even when network fetches fail.

4. **Self-publishing.** Every successful build attempts to publish. The
   publishing gate refuses anything QA rejected. Packages flagged for
   review that meet the confidence bar (≥0.75) and have not hard-failed
   QA are auto-published; lower-confidence packages stay in QA_PENDING
   for an admin.

5. **Janitor.** Walks published and built content and surfaces edit /
   delete recommendations on `/admin/checklist/janitor/edits` and
   `/admin/checklist/janitor/deletes`.

The admin can also kick this whole cycle manually via the **⚡ Run
autonomous cycle** button on the dashboard (purple, sits next to the
Verify / Build / Reject buttons). It calls
`/api/admin/checklist/bulk/run-autonomous` and runs one full cycle:
bootstrap citations → promote → drain up to 50 build jobs.

The worker has no off switch for its accuracy guards: it never invents
content, never publishes uncited required fields, and never accepts a
source outside the authority registry.

### Developer Audit (PDF)

The diagnostics page (`/admin/diagnostics`) has a **Download Developer
Audit (PDF)** button at the top right with a period selector —
**Last 24 hours**, **Last 7 days**, or **Last 30 days**. The PDF bundles:

- Diagnostics snapshot (current state of every system part)
- Every QA report from the period
- Every worker build log line from the period
- Every build job from the period
- Curated knowledge base availability by content type
- System overview: checklist counts, published-content counts, knowledge total

It's served from `GET /api/admin/diagnostics/developer-audit?period=24h|week|month`,
generated server-side with **pdfkit**, and downloaded by the browser as
a timestamped PDF file. The smaller **Developer report** button next to
it produces the same content as Markdown and copies it to the clipboard.

---

## Migration from the legacy system

If you have data from the old scraper-first pipeline, run:

```bash
npm run migrate:checklist-first
```

This:

1. Seeds the new authority registry + master checklists.
2. Imports every legacy `Prayer`, `Saint`, `Devotion`, `MarianApparition`,
   `LiturgyEntry`, and `SpiritualLifeGuide` row into the new `ChecklistItem`
   and `PublishedContent` tables.
3. Removes legacy `IngestionJobQueue` rows that point at the old worker.

The migration is idempotent: running it again is safe.

---

## Catholic accuracy rules

The worker treats Catholic accuracy as a hard constraint:

- **No invented doctrine, feast days, indulgences, titles, apparitions, or
  promises.** Any required field without source provenance triggers an
  accuracy warning and bars publication.
- **Vatican.va beats USCCB beats diocesan beats trusted publishers.**
  Conflicts at the same level flag human review.
- **Apparitions default to "needs human review"** because Church approval
  status is doctrinally significant.
- **The seven sacraments are the only sacraments.** The schema enforces this.
- **Novenas must have exactly nine days.** The schema enforces this.
- **Indulgences require an Apostolic Penitentiary or Vatican citation.** No
  citation, no indulgence claim.

These rules live in code, not in policy documents — see the `accuracyRules`
field on each `BuildInstruction` in `src/lib/worker/schemas/`.

---

## Testing

```bash
npm test                  # vitest unit/integration tests (918+ tests)
npm run test:integration  # integration tests (separate DB)
npm run test:e2e          # Playwright end-to-end
```

The worker module has its own test directory at `tests/worker/` with focused
coverage across 16 files:

- `source-validation.test.ts` — authority registry + fetch host gate.
- `schema-compliance.test.ts` — every Zod schema accepts/rejects correctly.
- `duplicate-detection.test.ts` — slug + alias + normalized-name matching.
- `qa-approval.test.ts` — six-dimension scoring + publishing-gate behavior.
- `cross-source.test.ts` — authority-weighted reconciliation.
- `build-engine.test.ts` — extractor + accuracy-guard behavior.
- `build-queue.test.ts` — lease + retry-with-backoff + partial save.
- `relations.test.ts` — typed relationship extraction.
- `publishing.test.ts` — gate refuses bad packages, versions on republish.
- `checklists.test.ts` — every master checklist is well-formed.
- `catholic-accuracy.test.ts` — Catholic-accuracy guards in code.
- `bulk-actions.test.ts` — verify-all / build-all / bulk-reject helpers.
- `janitor.test.ts` — janitor edit/delete recommendations.
- `autonomous.test.ts` — autonomous promotion pipeline.
- `knowledge.test.ts` — curated knowledge base validates and is complete.
- `diagnostics.test.ts` — system health checks + developer report.
- `end-to-end-build.test.ts` — engine guard accepts every rebuild state and
  the curated short-circuit produces complete packages without HTTP.

---

## Worker entry point

```bash
tsx scripts/run-worker.ts                # loop forever
tsx scripts/run-worker.ts --one-shot     # one cycle then exit
tsx scripts/run-worker.ts --max-jobs N   # exit after N cycles
tsx scripts/run-worker.ts --worker-id X  # stable worker id
```

The worker self-leases jobs and is safe to run with multiple replicas. Each
build job is leased for five minutes; stale leases are reclaimed
automatically.

**Production behavior:** the worker loop runs `runOneBuildCycle` to drain
the queue and, on every idle tick, calls `bootstrapCitationsFromKnowledge`
followed by `autonomousPromote` so a freshly-deployed worker fills the
site by itself without admin intervention. There is no separate cron
process — running `npm run worker` is enough to keep the pipeline moving.

---

## Admin Worker

The **Admin Worker** is the autonomous website-administrator system. It is
fully coded, deterministic, durable, observable, and autonomous, and it
operates **without any AI APIs**. Code lives under `src/lib/admin-worker/`;
the operator-facing surface is at `/admin/admin-worker` (Command Center)
and `/admin/diagnostics` (24 health ratings + pause toggle).

What it does:

- discovers approved Catholic source URLs and classifies candidates
  (junk URLs — livestreams, donations, bulletins, store pages, etc. —
  are rejected before fetch)
- reads source pages and extracts Catholic content
- validates content correctness against the existing strict Zod schemas
- formats content into complete packages
- publishes valid content automatically when QA + quality score + source
  evidence + confidence all pass; humans only see ambiguous edge cases
- maintains the homepage (deterministic 8-dimension score; small
  high-confidence improvements auto-publish, major redesigns route to
  review)
- monitors diagnostics (24 health ratings — heartbeat, queue, sources,
  classification, building, formatting, validation, QA, publishing,
  post-publish, search, sitemap, cache, homepage, cleanup, review queue,
  security, email, monthly report, database, env, content goals)
- generates **Developer Audit** PDFs for the last 24 hours, last 7 days,
  or last 30 days (operator-triggered from the diagnostics card)
- generates the **Monthly Admin Worker Report** email on the last day
  of each month with a PDF attachment
- defends against brute-force admin login attempts. Only confirmed
  brute force results in an automatic device ban; suspicious activity
  alone never bans. A valid authenticated admin login is not treated
  as suspicious — a calm "Admin Log In" email confirms the sign-in.
- learns operationally through outcome counts and per-source reputation
  (no facts are ever invented; the learning loop only nudges priorities)

Pause / resume toggle sits on the diagnostics page directly above the
Developer Audit button. Pausing stops all non-security work; the
security defender keeps running.

**Internal model names** (`ChecklistItem`, `WorkerBuildJob`,
`WorkerBuildLog`, `WorkerHeartbeat`) deliberately keep their existing
names for code and migration compatibility — the rename to "Admin Worker"
is in the admin-facing UI only.

Phase 1 (already shipped):

- 15 new database tables (`AdminWorkerState`, `AdminWorkerPass`,
  `AdminWorkerTask`, `AdminWorkerLog`, `AdminWorkerMemory`,
  `AdminWorkerSourceReputation`, `AdminWorkerDecision`,
  `CandidateSourceUrl`, `ContentGoal`, `HumanReviewQueue`,
  `HomepageWorkerDraft`, `AdminDeveloperReportLog`,
  `AdminWorkerSecurityAction`, `PostPublishVerification`,
  `ContentQualityScore`, `HomepageQualityScore`)
- central decision loop with deterministic priority selection
- source reputation engine (EWMA-smoothed)
- content goals + autonomous planner
- 24-rating diagnostics surface
- rule engine + decision log
- confidence-gated publishing wrapper
- learning memory (success/failure counts only)
- homepage designer + scoring
- security defender layered on top of the existing
  `SecurityEvent`/`BannedDevice` flow
- cleanup custodian
- post-publish verification record + rollback decision
- Command Center page + Admin Worker API routes (pause / resume /
  run pass / state)
- Monthly Admin Worker Report email + Admin Worker Banned Device email

Phase 2 (previous PR):

- production worker (`scripts/run-worker.ts`) now drives the Admin
  Worker loop directly instead of the legacy build-only loop; it
  checks the monthly report job on startup so a restart on the last
  day of the month still fires the email
- planner that enqueues build jobs from content goals automatically —
  the worker creates its own work when goals are unmet, no manual
  trigger required
- deletion module with the 9 spec-defined deletion reasons + a
  confidence-gated `evaluateDeletion` that routes uncertain cases to
  human review and logs every deletion with the spec's required
  fields (content type, title, source URL, reason, failed fields,
  confidence, timestamp, worker task id)
- source ranking that combines all 10 criteria from spec section 19
  (credibility, source role, publish rate, QA pass, validation
  usefulness, fetch reliability, duplicate rate, wrong-content rate,
  legal usability, content-type coverage) into a deterministic rank
- real PDF rendering for Developer Audit (table of contents +
  7 sections: Diagnostics, Worker Logs, System Logs, Security Logs,
  Content Growth, Homepage Actions, Recommended Repairs; secrets
  redacted; AdminDeveloperReportLog records every download)
- real PDF rendering for the Monthly Admin Worker Report (monthly
  summary + best/worst sources + content goal progress + per-day
  sections)
- monthly report job that gates itself on "is today the last day of
  the month?" (handles February + shorter months); called daily from
  the worker startup hook
- expanded repair handlers: heartbeat staleness, discovery gap,
  QA-missing-field source rotation, cache / sitemap / search refresh
  flagging
- new admin pages:
  - `/admin/admin-worker/rules` — visible rule catalogue grouped by
    spec category (publish, deletion, homepage_design, security, …)
  - `/admin/admin-worker/logs` — section tabs + period / severity /
    content type / source host filters
- Admin Worker pass breakdown table on `/admin/diagnostics` with
  every spec-required column (pass id, started, completed, status,
  tasks planned / completed / failed, content built / published /
  rejected, security actions, homepage actions, logs link)
- POST `/api/admin/developer-audit` route — accepts period +
  optional section filter; returns the PDF directly
- additional tests covering: planner enqueues work for gaps;
  deletion routes below-threshold confidence to review; source
  ranking prefers Vatican over community for equal QA; reputation
  tier transitions over time (TRUSTED → PAUSED); monthly report
  job runs on the last day of every month including Feb 28 / Feb 29;
  Developer Audit PDF emits a valid `%PDF-` buffer + writes the
  AdminDeveloperReportLog row.

Phase 3 (previous PR):

- live post-publish HTTP probe: the publisher actively triggers cache
  revalidation, fetches the public page, confirms the title shows in
  the rendered HTML, and on FAIL automatically unpublishes; ambiguous
  failures route to human review, clear failures route to deletion
- live sitemap discovery: the web navigator fetches `/robots.txt` +
  `/sitemap.xml` on every approved authority host, parses `<loc>`
  URLs, applies the existing junk-URL classifier, and inserts the
  survivors as CandidateSourceUrl rows; honours `Sitemap:` and
  `Disallow:` directives in robots.txt
- per-content-type packaging validators for spec section 7
  (`validatePrayerPackage`, `validateNovenaPackage` with Day 1–9
  enforcement, `validateRosaryPackage` requiring exactly 5
  mysteries per set, `validateConsecrationPackage` with daily
  prayers, `validateHistoryPackage` enforcing only the 12 approved
  Church history types, etc.)
- publish-safety pattern blockers for spec section 15: incomplete
  prayers, articles about prayers, saint-named institutions,
  livestream / event / donation / store source URLs, missing source
  evidence, unapproved scripture translations
- explicit security detectors for spec section 14:
  banned-device-reuse, set-public-flag-outside-worker,
  internal-route-manipulation, suspicious-request-burst (with
  per-detector severity + classification + confidence)
- `verifyPublished` is wired into the existing `publish()` flow via
  dynamic import — every successful publish now triggers the probe
  in production; non-production environments skip the network call
- new admin worker public route helpers (`publicRouteFor`,
  `publicUrlFor`, `publicOrigin`) so the probe + cache + UI all
  agree on URL shape
- 51 new tests covering publish-safety, packaging validators,
  post-publish probe + rollback, sitemap discovery, security
  detectors, and public route mapping

Phase 4 (this PR):

- defender now actually bans: when `decideAction` returns BAN_DEVICE
  on a confirmed Breach, `defend()` upserts a BannedDevice row + sends
  the "Admin Worker Banned Device" email. Ban + email failures are
  logged but never break the loop. Middleware already reads
  BannedDevice on every request, so the ban is enforced immediately.
- homepage redesign mutator: `redesignHomepage()` reads the current
  HomePageBlock rows + live PublishedContent, scores the homepage,
  proposes a refreshed set of featured blocks (drawn only from the
  supported block-type allowlist — never invents components),
  computes a confidence + section diff, and files a
  HomepageWorkerDraft routed AUTO_PUBLISHED / PROPOSED / AWAITING_REVIEW
  per the existing decideDraftStatus rules. Major redesigns and
  section-deletion changes always route to review.
- Command Center metrics: new `loadCommandCenterMetrics()` computes
  publishRate30d, qaPassRate30d, deletionRate30d, reviewQueueCount,
  recentSecurityActions24h, publishedContentLive, queueInFlight, and
  monthlyReport last-generated + freshness. The Command Center page
  renders these as a metric strip at the top.
- expanded repair handlers: `fetchWithBackoff` (exponential retry,
  logs each attempt), `reportPersistenceFailure`,
  `reportValidationEvidenceMissing`. Section 20 coverage now spans
  heartbeat staleness, queue stalls, discovery gaps, source rotation,
  cache / sitemap / search refresh, fetch backoff, and persistence
  failures.
- diagnostics ratings now populate `latestSuccess` / `latestFailure`
  / `currentBlocker` from real DB queries (queue + publishing rating);
  the diagnostics page already renders these when present.
- Developer Audit button: new dropdown with period picker + section
  checkboxes; POSTs `/api/admin/developer-audit` with the chosen
  sections so the operator can pull a partial report (e.g. "just
  Security Logs").
- 17 new tests: defender ban (Suspicious never bans, Breach + high
  confidence does ban + sends email + survives email failure),
  homepage mutator (no draft above threshold, small refresh
  auto-publishes, section deletion routes to review), Command Center
  metrics (publish rate / QA rate / deletion rate math + monthly
  report freshness gate), fetchWithBackoff retries, persistence /
  validation-evidence reporters.

Tests: 1118 / 1118 passing (was 1101).

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
```

There is no other code path from the database to the public site.

---

## License

ISC. See [LICENSE](./LICENSE).
