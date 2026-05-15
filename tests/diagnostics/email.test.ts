import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the underlying checkers so the diagnostic test isn't coupled to
// the exact SQL the real checkers issue. The diagnostic's contract is
// "call these helpers and shape the result"; that contract is what we
// assert here.
const checkAccountEmailDbMock = vi.fn();
vi.mock("@/lib/email/db-health", () => ({
  checkAccountEmailDb: checkAccountEmailDbMock,
}));

beforeEach(() => {
  checkAccountEmailDbMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadEmailDiagnostics() {
  // Re-import so env-var changes inside the test affect the closure that
  // reads RESEND_API_KEY at call time.
  const mod = await import("@/lib/diagnostics/email");
  return mod.runEmailDiagnostics;
}

describe("runEmailDiagnostics", () => {
  it("warns when RESEND_API_KEY is missing but everything else is healthy", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND", "");
    checkAccountEmailDbMock.mockResolvedValue({
      ok: true,
      pieces: [{ kind: "table", name: "User", present: true, message: "" }],
    });
    const runEmailDiagnostics = await loadEmailDiagnostics();
    const section = await runEmailDiagnostics();
    expect(section.id).toBe("email");
    const apiKeyResult = section.results.find((r) => r.id === "email.api_key");
    expect(apiKeyResult?.severity).toBe("warn");
    expect(apiKeyResult?.evidence?.configured).toBe(false);
  });

  it("never reveals the full Resend API key — only the first 4 chars + length", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_super_secret_value_should_never_leak");
    checkAccountEmailDbMock.mockResolvedValue({ ok: true, pieces: [] });
    const runEmailDiagnostics = await loadEmailDiagnostics();
    const section = await runEmailDiagnostics();
    const apiKeyResult = section.results.find((r) => r.id === "email.api_key");
    expect(apiKeyResult?.severity).toBe("pass");
    expect(apiKeyResult?.evidence?.prefix).toBe("re_s");
    // Critical: the full key never appears anywhere in the result body.
    const flat = JSON.stringify(apiKeyResult);
    expect(flat).not.toContain("re_super_secret_value_should_never_leak");
  });

  it("returns a fail result when the account-email tables are missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_present");
    checkAccountEmailDbMock.mockResolvedValue({
      ok: false,
      pieces: [
        { kind: "table", name: "PasswordResetToken", present: false, message: "missing" },
        { kind: "table", name: "EmailVerificationToken", present: true, message: "ok" },
      ],
    });
    const runEmailDiagnostics = await loadEmailDiagnostics();
    const section = await runEmailDiagnostics();
    const dbResult = section.results.find((r) => r.id === "email.db_tables");
    expect(dbResult?.severity).toBe("fail");
    expect(dbResult?.evidence?.missing).toContain("PasswordResetToken");
  });

  it("rolls the section severity to fail when any sub-check failed", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    checkAccountEmailDbMock.mockResolvedValue({ ok: false, pieces: [] });
    const runEmailDiagnostics = await loadEmailDiagnostics();
    const section = await runEmailDiagnostics();
    expect(section.severity).toBe("fail");
  });

  it("rolls the section severity to warn when only soft items failed", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    checkAccountEmailDbMock.mockResolvedValue({ ok: true, pieces: [] });
    const runEmailDiagnostics = await loadEmailDiagnostics();
    const section = await runEmailDiagnostics();
    expect(section.severity).toBe("warn");
  });

  it("shares a single requestId across every result in the section", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    checkAccountEmailDbMock.mockResolvedValue({ ok: true, pieces: [] });
    const runEmailDiagnostics = await loadEmailDiagnostics();
    const section = await runEmailDiagnostics();
    expect(section.requestId).toMatch(/^[A-Za-z0-9_-]+$/);
    for (const r of section.results) {
      expect(r.requestId).toBe(section.requestId);
    }
  });

  it("stamps every result with an ISO timestamp and a numeric duration", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    checkAccountEmailDbMock.mockResolvedValue({ ok: true, pieces: [] });
    const runEmailDiagnostics = await loadEmailDiagnostics();
    const section = await runEmailDiagnostics();
    for (const r of section.results) {
      expect(typeof r.durationMs).toBe("number");
      expect(new Date(r.ranAt).toString()).not.toBe("Invalid Date");
    }
  });
});
