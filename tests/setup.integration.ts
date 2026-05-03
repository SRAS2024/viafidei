// Setup loaded only for the `integration` Vitest project (gated behind
// VITEST_INTEGRATION=1 in vitest.config.ts). It enforces test-DB
// isolation BEFORE Prisma client construction, so a misconfigured
// integration run cannot accidentally touch a real database.

import { afterAll, beforeAll } from "vitest";

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  throw new Error(
    "TEST_DATABASE_URL must be set for the integration test project. " +
      "Example: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viafidei_test",
  );
}

if (url.includes("prod") || url.includes("production")) {
  throw new Error("Refusing to run integration tests against a production-looking DATABASE_URL.");
}

if (!url.includes("_test") && !url.includes("/test")) {
  throw new Error(
    "TEST_DATABASE_URL must reference a database whose name contains 'test' " +
      "(safety guard against pointing tests at a real DB).",
  );
}

// Point the Prisma client at the test DB. We set this BEFORE any Prisma
// import in the integration tests' setup chain so the client picks it up.
process.env.DATABASE_URL = url;

beforeAll(async () => {
  // Lazy import so non-integration runs never resolve @prisma/client.
  const { prisma } = await import("../src/lib/db/client");
  // Sanity check: confirm we're connected to the test DB.
  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database()
  `;
  const dbName = rows[0]?.current_database ?? "";
  if (!dbName.includes("test")) {
    throw new Error(`Connected to non-test database: ${dbName}`);
  }
});

afterAll(async () => {
  const { prisma } = await import("../src/lib/db/client");
  await prisma.$disconnect();
});
