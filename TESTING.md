# Testing

This document describes the testing stack, how to run each layer locally, and
what each layer is responsible for.

## Stack

| Concern                       | Tool                                     |
| ----------------------------- | ---------------------------------------- |
| Unit + integration tests      | **Vitest** (with v8 coverage)            |
| React component tests         | **React Testing Library**                |
| End-to-end tests              | **Playwright**                           |
| API tests                     | Direct Next route handler import         |
| DOM environment for component | **jsdom**                                |
| Accessibility smoke           | **jest-axe**                             |
| Coverage                      | **@vitest/coverage-v8**                  |
| Database (integration / E2E)  | Isolated Postgres at `TEST_DATABASE_URL` |

## Project layout

```
tests/
  auth/                # auth module unit tests (Node)
  api/                 # route handler tests (Node, mocked Prisma)
  components/          # React component tests (jsdom)
  db/                  # checkRequiredTables / checkSeedContent
  fixtures/            # factories.ts
  helpers/             # prisma-mock.ts, cookies-mock.ts
  worker/              # checklist-first worker tests:
                       #   source-validation.test.ts
                       #   schema-compliance.test.ts
                       #   duplicate-detection.test.ts
                       #   qa-approval.test.ts
                       #   cross-source.test.ts
                       #   build-engine.test.ts
                       #   build-queue.test.ts
                       #   relations.test.ts
                       #   publishing.test.ts
                       #   checklists.test.ts
                       #   catholic-accuracy.test.ts
  integration/         # real-DB integration tests (gated)
  middleware.test.ts   # Next.js middleware (incl. /admin redirect protection)
  routes/              # static route coverage
  security/            # rate-limit
  setup.ts             # shared env stubs
  setup.dom.ts         # jsdom + RTL cleanup
  setup.integration.ts # real-DB safety guards (only loaded when VITEST_INTEGRATION=1)

e2e/
  smoke.spec.ts        # Playwright smoke + visual regression + perf checks
```

## Commands

```
npm run test              # All unit + component tests. Mocked Prisma.
npm run test:watch        # Vitest in watch mode.
npm run test:coverage     # Vitest with coverage report + threshold gate.
npm run test:integration  # Real-Postgres integration tests (gated).
npm run test:e2e          # Playwright E2E (requires `npx playwright install`).
npm run test:db:setup     # Reset the test DB from migrations + seeds.
npm run verify            # typecheck + lint + format:check + test
npm run verify:full       # verify + integration + e2e + production build
```

## Worker tests

The `tests/worker/` directory covers every guarantee the checklist-first
factory makes. Each file is focused and self-contained — no real DB or HTTP.

- **source-validation** — authority registry + fetcher host gate.
- **schema-compliance** — every Zod content schema accepts/rejects payloads.
- **duplicate-detection** — slug + normalized-name + alias matching.
- **qa-approval** — six-dimension QA scoring + publishing-gate behavior.
- **cross-source** — authority-weighted reconciliation.
- **build-engine** — HTML extraction + accuracy-guard behavior.
- **build-queue** — lease + retry-with-backoff + partial-save state machine.
- **relations** — typed relationship extraction (saint→feast day, etc.).
- **publishing** — gate refuses bad packages, versions on republish.
- **checklists** — every master checklist is well-formed (no duplicate slugs).
- **catholic-accuracy** — invented-content guards.

## Coverage thresholds

`vitest.config.ts` enforces minimums for the modules listed under
`coverage.include`:

- 80% lines / statements
- 80% functions
- 75% branches

The included set is the security-critical surface (auth, rate-limit,
middleware, the DB diagnostic checks, the worker module, and the
destructive-confirm UI). When you add a new critical module, extend that list.

## Test database isolation

Integration and E2E tests refuse to run against production. The guards live
in two places:

1. `scripts/test-db.sh` — checks the URL contains `test` in its name, isn't
   on a remote host (without explicit override), and doesn't look like a
   production DB. Then runs `prisma migrate reset --force`.
2. `tests/setup.integration.ts` — repeats those checks at process start, then
   queries `current_database()` after connecting and aborts if the connected
   database name doesn't contain `test`.

## CI

`.github/workflows/ci.yml` runs:

1. Install
2. `prisma validate` (schema sanity)
3. Typecheck → Lint → Format check
4. Vitest unit + component + worker tests
5. `npm audit --audit-level=high` (advisory)
6. Production build

A separate `e2e` job is wired but only runs on push to `main` and on PRs
labelled `e2e`, since Playwright needs browser install + a running app.
