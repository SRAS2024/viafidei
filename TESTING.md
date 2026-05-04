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
  fixtures/            # factories.ts, mock-source.ts
  helpers/             # prisma-mock.ts, cookies-mock.ts
  ingestion/           # ingestion validation + mock-source tests
  integration/         # real-DB integration tests (gated)
  middleware.test.ts   # Next.js middleware (incl. /admin redirect protection)
  routes/              # static route coverage:
                       #   route-coverage.test.ts — every page.tsx URL is reachable
                       #   admin-routes.test.ts   — /admin login/logout redirects + no legacy admin path refs
                       #   sitemap.test.ts        — sitemap & robots: published-only, excludes admin/auth pages
                       #   static-files.test.ts   — Google verification file & single-source sitemap
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

## Admin route, sitemap, and verification-file checks

The route-level tests under `tests/routes/` and `tests/middleware.test.ts`
together pin down the behavior the SEO and admin-access requirements care
about. They do not need a database (Prisma is mocked):

- `tests/routes/admin-routes.test.ts` walks the full source tree to confirm no
  stray references to the legacy admin path exist anywhere, and asserts the
  admin login route redirects success → `/admin?welcome=1`, failure →
  `/admin/login?error=invalid`, and logout → `/admin/login`.
- `tests/middleware.test.ts` asserts unauthenticated requests to `/admin` and
  `/admin/<section>` are 303-redirected to `/admin/login`, while
  `/admin/login`, `/api/admin/login`, and `/api/admin/logout` are reachable.
- `tests/routes/sitemap.test.ts` confirms `/sitemap.xml` includes the public
  pages and only `PUBLISHED` content rows (with `updatedAt` as `lastmod`),
  and excludes `/admin`, `/login`, `/register`, `/forgot-password`,
  `/reset-password`, `/verify-email`, and `/profile`. It also confirms
  `robots.txt` points at `/sitemap.xml` and disallows `/admin` plus the
  account routes.
- `tests/routes/static-files.test.ts` confirms `public/google0292583cfdf40074.html`
  exists with the body Google's verification protocol requires, and that
  `public/sitemap.xml` does **not** exist (single source of truth lives at
  `src/app/sitemap.ts`).

## Coverage thresholds

`vitest.config.ts` enforces minimums for the modules listed under
`coverage.include`:

- 80% lines / statements
- 80% functions
- 75% branches

The included set is the security-critical surface (auth, rate-limit,
middleware, the DB diagnostic checks, and the destructive-confirm UI). When
you add a new critical module, extend that list.

## Test database isolation

Integration and E2E tests refuse to run against production. The guards live
in two places:

1. `scripts/test-db.sh` — checks the URL contains `test` in its name, isn't
   on a remote host (without explicit override), and doesn't look like a
   production DB. Then runs `prisma migrate reset --force`.
2. `tests/setup.integration.ts` — repeats those checks at process start, then
   queries `current_database()` after connecting and aborts if the connected
   database name doesn't contain `test`.

## Mocked external sources

Ingestion tests never make real HTTP calls. Use `tests/fixtures/mock-source.ts`:

- `makeMockAdapter({ items, notModified, throwError })` — returns a stub
  `SourceAdapter` whose `fetch` returns canned items, signals 304-equivalent
  via `notModified`, or throws.
- `makeMockFetch({ url: { status, body } })` — returns a `vi.fn()` shaped
  like `globalThis.fetch` for adapters that call it directly.

## Fixtures and factories

`tests/fixtures/factories.ts` exports builders for every major entity
(`user`, `admin`, `prayer`, `saint`, `apparition`, `parish`, `devotion`,
`goal`, `milestone`, `journal`, `media`, `ingestionSource`). Each accepts a
`Partial<T>` overlay so individual tests pin only the fields they need.

## CI

`.github/workflows/ci.yml` runs:

1. Install
2. `prisma validate` (schema sanity)
3. Typecheck → Lint → Format check
4. Vitest unit + component tests (jsdom auto-applied per file via `@vitest-environment` doc-comment)
5. `npm audit --audit-level=high` (vulnerable-dependency gate, advisory)
6. Production build

A separate `e2e` job is wired but only runs on push to `main` and on PRs
labelled `e2e`, since Playwright needs browser install + a running app.
