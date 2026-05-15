import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

vi.mock("@/lib/email/db-health", () => ({
  checkAccountEmailDb: vi.fn(),
}));

import { runAccountDiagnostics } from "@/lib/diagnostics/accounts";
import { checkAccountEmailDb } from "@/lib/email/db-health";

const checkAccountEmailDbMock = vi.mocked(checkAccountEmailDb);

beforeEach(() => {
  resetPrismaMock();
  checkAccountEmailDbMock.mockReset();
});

describe("runAccountDiagnostics", () => {
  it("returns pass when every read succeeds and email tables are present", async () => {
    prismaMock.user.count.mockResolvedValue(10);
    prismaMock.profile.count.mockResolvedValue(7);
    prismaMock.session.count.mockResolvedValue(3);
    prismaMock.rateLimitBucket.count.mockResolvedValue(15);
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ exists: true }]);
    checkAccountEmailDbMock.mockResolvedValue({ ok: true, pieces: [] });

    const section = await runAccountDiagnostics();
    expect(section.id).toBe("accounts");
    expect(section.severity).toBe("pass");
  });

  it("returns fail when one of the saved-item tables is missing", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.profile.count.mockResolvedValue(0);
    prismaMock.session.count.mockResolvedValue(0);
    prismaMock.rateLimitBucket.count.mockResolvedValue(0);
    // 3 of 5 saved-item tables exist, 2 missing.
    let callIndex = 0;
    prismaMock.$queryRawUnsafe.mockImplementation(() => {
      const exists = callIndex < 3;
      callIndex += 1;
      return Promise.resolve([{ exists }]);
    });
    checkAccountEmailDbMock.mockResolvedValue({ ok: true, pieces: [] });

    const section = await runAccountDiagnostics();
    const savedItems = section.results.find((r) => r.id === "accounts.saved_items");
    expect(savedItems?.severity).toBe("fail");
    expect(section.severity).toBe("fail");
  });

  it("returns fail when account-email tables are missing", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.profile.count.mockResolvedValue(0);
    prismaMock.session.count.mockResolvedValue(0);
    prismaMock.rateLimitBucket.count.mockResolvedValue(0);
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ exists: true }]);
    checkAccountEmailDbMock.mockResolvedValue({
      ok: false,
      pieces: [{ kind: "table", name: "PasswordResetToken", present: false, message: "missing" }],
    });
    const section = await runAccountDiagnostics();
    const emailTokens = section.results.find((r) => r.id === "accounts.email_tokens");
    expect(emailTokens?.severity).toBe("fail");
  });

  it("shares a request id across every result in the section", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.profile.count.mockResolvedValue(0);
    prismaMock.session.count.mockResolvedValue(0);
    prismaMock.rateLimitBucket.count.mockResolvedValue(0);
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ exists: true }]);
    checkAccountEmailDbMock.mockResolvedValue({ ok: true, pieces: [] });
    const section = await runAccountDiagnostics();
    for (const r of section.results) {
      expect(r.requestId).toBe(section.requestId);
    }
  });
});
