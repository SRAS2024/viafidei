# Integration tests

These tests run against a real Postgres instance, isolated to a database whose
name contains `test`. They are excluded from the default `npm test` run and only
execute when:

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viafidei_test \
  VITEST_INTEGRATION=1 \
  npm run test
```

Or, more conveniently:

```
npm run test:integration
```

## Pre-requisites

Before the first integration run, reset the test database from migrations:

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viafidei_test \
  npm run test:db:setup
```

Safety guards in `scripts/test-db.sh` and `tests/setup.integration.ts` refuse to
run if `TEST_DATABASE_URL` looks like a production database, doesn't contain
`test` in its name, or points at a non-localhost host (override with
`TEST_DB_ALLOW_REMOTE=1` only when you really mean it).

## Adding a test

1. Place the file at `tests/integration/<feature>.test.ts`.
2. Import the real Prisma client from `@/lib/db/client` and use it directly.
3. Each test should clean up rows it created (or use a `beforeEach` truncate).
