// Global test setup. Provides deterministic env vars so any module that
// reads SESSION_SECRET / ADMIN_* at import time gets safe values during
// `npm test`. Individual tests still override env via vi.stubEnv when
// needed.

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "test-session-secret-must-be-at-least-32-characters-long";
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin-password-for-tests-only";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

// The Python intelligence brain spawns a subprocess; default it OFF for the
// deterministic unit suite so tests don't depend on python3 being present and
// don't pay per-call spawn cost. Brain-specific tests opt back IN explicitly
// (see tests/admin-worker/intelligence/* and tests/integration/intelligence*).
process.env.INTELLIGENCE_BRAIN_ENABLED = process.env.INTELLIGENCE_BRAIN_ENABLED ?? "0";
