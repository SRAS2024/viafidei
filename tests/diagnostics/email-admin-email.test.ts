import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The email diagnostic now also checks ADMIN_EMAIL. This file
// exercises that one row independently of the broader Resend +
// db-tables checks (which already have their own tests).
vi.mock("@/lib/email/db-health", () => ({
  checkAccountEmailDb: vi.fn().mockResolvedValue({ ok: true, pieces: [] }),
}));

import { runEmailDiagnostics } from "@/lib/diagnostics/email";

beforeEach(() => {
  delete process.env.ADMIN_EMAIL;
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  delete process.env.ADMIN_EMAIL;
  delete process.env.RESEND_API_KEY;
});

describe("runEmailDiagnostics ADMIN_EMAIL row", () => {
  it("warns when ADMIN_EMAIL is unset", async () => {
    const section = await runEmailDiagnostics();
    const adminRow = section.results.find((r) => r.id === "email.admin_email");
    expect(adminRow).toBeDefined();
    expect(adminRow?.severity).toBe("warn");
    expect(adminRow?.evidence?.configured).toBe(false);
  });

  it("passes with the configured address when ADMIN_EMAIL is set", async () => {
    process.env.ADMIN_EMAIL = "ops@example.com";
    const section = await runEmailDiagnostics();
    const adminRow = section.results.find((r) => r.id === "email.admin_email");
    expect(adminRow?.severity).toBe("pass");
    expect(adminRow?.evidence?.configured).toBe(true);
    expect(adminRow?.evidence?.address).toBe("ops@example.com");
  });

  it("renders the API-key row whether ADMIN_EMAIL is set or not", async () => {
    // Both rows exist either way; the API-key row drives Resend
    // configuration and ADMIN_EMAIL drives the recipient address.
    process.env.RESEND_API_KEY = "test_key_1234567890";
    const section = await runEmailDiagnostics();
    expect(section.results.find((r) => r.id === "email.api_key")).toBeDefined();
    expect(section.results.find((r) => r.id === "email.admin_email")).toBeDefined();
  });
});
