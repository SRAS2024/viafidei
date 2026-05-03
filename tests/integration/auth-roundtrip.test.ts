// Integration smoke: prove that a real Postgres + real Prisma client + real
// password hashing actually round-trips a user create / authenticate flow.
//
// This test is excluded from the default `npm test` run and only executes
// under VITEST_INTEGRATION=1 against an isolated test database (see
// tests/setup.integration.ts for the safety guards).

import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { authenticate, createUser, findUserByEmail } from "@/lib/auth/user";
import { factories } from "../fixtures/factories";

afterEach(async () => {
  // Clean up users this test created so re-runs stay green.
  await prisma.user.deleteMany({ where: { email: { contains: "@integration.test" } } });
});

describe("auth round-trip (real DB)", () => {
  it("creates a user, finds them by email, and authenticates with the password", async () => {
    const email = `${factories.user().id}@integration.test`;
    const password = "integration-password-1234";

    const created = await createUser({
      firstName: "Int",
      lastName: "Test",
      email,
      password,
    });
    expect(created.email).toBe(email.toLowerCase());

    const found = await findUserByEmail(email);
    expect(found?.id).toBe(created.id);

    const authed = await authenticate(email, password);
    expect(authed?.id).toBe(created.id);

    const wrong = await authenticate(email, "wrong-password");
    expect(wrong).toBeNull();
  });
});
