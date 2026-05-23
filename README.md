# Via Fidei

> _The Way of Faith._ A multilingual Catholic platform — prayers, saints,
> sacramental guidance, liturgy, and trusted Catholic content — presented
> with reverence and clarity.

**Live site: [etviafidei.com](https://etviafidei.com)**

Via Fidei is a Next.js 15 application that pairs a public, reader-facing site
with an authenticated admin console for curating Catholic content. Content is
sourced only from approved Catholic publishers and verified at multiple stages
before it reaches the public.

---

## Architecture: approved-checklist-first

Viafidei runs a **checklist-first content factory** — the only way new content
reaches the public site. The legacy scrape-transform-clean pipeline has been
replaced. Every published item flows through these five stages:

```
   1. APPROVED SOURCE DISCOVERY
        ↓
   2. CHECKLIST APPROVAL (admin)
        ↓
   3. INTELLIGENT WORKER BUILD
        ↓
   4. QA VALIDATION (six-dimension scoring + publishing gate)
        ↓
   5. PUBLISH
```

### 1. Approved source discovery

Sources are listed in `src/lib/worker/sources/authority-registry.ts`. Each
authority has a level: VATICAN, CATECHISM, LITURGICAL_BOOK, USCCB, DIOCESAN,
RELIGIOUS_ORDER, TRUSTED_PUBLISHER, ACADEMIC, COMMUNITY. **The worker physically
refuses to fetch any URL whose host is not on this list.** Admins can add new
sources via the admin UI; the seed script writes them into the `AuthoritySource`
table.

### 2. Checklist approval

Eleven master checklists, in `src/lib/worker/checklists/`, define every item
the app intends to publish:

| Checklist           | Count | File                                               |
| ------------------- | ----- | -------------------------------------------------- |
| Prayers             | 33    | `src/lib/worker/checklists/prayers.ts`             |
| Devotions           | 17    | `src/lib/worker/checklists/devotions.ts`           |
| Saints              | 30    | `src/lib/worker/checklists/saints.ts`              |
| Marian titles       | 16    | `src/lib/worker/checklists/marian-titles.ts`       |
| Apparitions         | 10    | `src/lib/worker/checklists/apparitions.ts`         |
| Novenas             | 12    | `src/lib/worker/checklists/novenas.ts`             |
| Sacraments          | 7     | `src/lib/worker/checklists/sacraments.ts`          |
| Guides              | 14    | `src/lib/worker/checklists/guides.ts`              |
| Church documents    | 19    | `src/lib/worker/checklists/church-documents.ts`    |
| Liturgical topics   | 21    | `src/lib/worker/checklists/liturgical.ts`          |
| Spiritual practices | 12    | `src/lib/worker/checklists/spiritual-practices.ts` |

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

| Script                            | What it does                               |
| --------------------------------- | ------------------------------------------ |
| `npm run worker`                  | Loop forever, draining the build queue     |
| `npm run worker:once`             | Run one build cycle and exit               |
| `npm run seed:checklist`          | Sync authority sources + master checklists |
| `npm run migrate:checklist-first` | Migrate legacy data into new tables        |
| `npm run db:validate`             | Verify the schema is wired correctly       |
| `npm run verify`                  | typecheck + lint + format:check + tests    |
| `npm run verify:full`             | The above + integration + e2e + build      |

---

## Admin UI

The admin console at `/admin/checklist` is the single pane of glass for the
content factory:

- **Dashboard** (`/admin/checklist`) — counts by status + content type.
- **Discovered items** (`/admin/checklist/discovered`) — add citations, mark
  source-verified.
- **Approved for build** (`/admin/checklist/approved`) — waiting for the
  worker.
- **Worker queue** (`/admin/checklist/queue`) — live build job state.
- **QA reports** (`/admin/checklist/qa`) — unreviewed reports sorted by
  weakest score.
- **Published** (`/admin/checklist/published`) — live items on the public
  site.
- **Failed builds** (`/admin/checklist/failed`) — exhausted retry budgets.
- **Authority sources** (`/admin/checklist/sources`) — approved-source
  registry.
- **Item detail** (`/admin/checklist/item/[id]`) — full citations, build
  history, QA reports, version history, relations + manual actions (verify,
  approve, rebuild, publish, unpublish, reject).

Admin API routes live under `/api/admin/checklist/*` and require an
authenticated admin principal.

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
npm test                  # vitest unit/integration tests
npm run test:integration  # integration tests (separate DB)
npm run test:e2e          # Playwright end-to-end
```

The worker module has its own test directory at `tests/worker/` with focused
coverage of:

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
