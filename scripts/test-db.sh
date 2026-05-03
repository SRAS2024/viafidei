#!/usr/bin/env bash
#
# test-db.sh — set up an isolated Postgres database for integration / E2E tests.
#
# Refuses to run against:
#   * the production DATABASE_URL (anything containing 'prod' / 'production')
#   * databases NOT explicitly named *_test or whose URL is on a non-localhost
#     host without TEST_DB_ALLOW_REMOTE=1 set.
#
# Drops the existing test DB, recreates it, applies migrations, and seeds.
# Safe to run repeatedly.

set -euo pipefail

TEST_URL="${TEST_DATABASE_URL:-}"
if [[ -z "$TEST_URL" ]]; then
  echo "TEST_DATABASE_URL is not set." >&2
  echo "Example: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viafidei_test" >&2
  exit 1
fi

if [[ "$TEST_URL" == *"prod"* || "$TEST_URL" == *"production"* ]]; then
  echo "Refusing to run: TEST_DATABASE_URL appears to point at a production database." >&2
  exit 1
fi

if [[ "$TEST_URL" != *"_test"* && "$TEST_URL" != *"/test"* ]]; then
  echo "Refusing to run: TEST_DATABASE_URL must reference a database whose name contains 'test'." >&2
  echo "Got: $TEST_URL" >&2
  exit 1
fi

if [[ "$TEST_URL" != *"localhost"* && "$TEST_URL" != *"127.0.0.1"* && "${TEST_DB_ALLOW_REMOTE:-0}" != "1" ]]; then
  echo "Refusing to run against a non-localhost test database without TEST_DB_ALLOW_REMOTE=1." >&2
  exit 1
fi

echo "Resetting test database via prisma migrate reset..."
DATABASE_URL="$TEST_URL" npx prisma migrate reset --force --skip-generate

echo "Test database is ready: $TEST_URL"
