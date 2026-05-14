import { describe, expect, it } from "vitest";
import { finalizeSection, runDiagnostic, severityOf, startSection } from "@/lib/diagnostics";

describe("severityOf", () => {
  it("returns pass for an empty list", () => {
    expect(severityOf([])).toBe("pass");
  });

  it("returns fail when any result is a fail", () => {
    const results = [
      { severity: "pass" as const },
      { severity: "warn" as const },
      { severity: "fail" as const },
      { severity: "skipped" as const },
    ];
    expect(severityOf(results.map((r, i) => mkResult(`r${i}`, r.severity)))).toBe("fail");
  });

  it("returns warn when the worst result is a warn (warn beats skipped/pass)", () => {
    const results = [mkResult("a", "pass"), mkResult("b", "warn"), mkResult("c", "skipped")];
    expect(severityOf(results)).toBe("warn");
  });

  it("returns skipped when nothing ran beyond skipped/pass", () => {
    const results = [mkResult("a", "pass"), mkResult("b", "skipped")];
    expect(severityOf(results)).toBe("skipped");
  });
});

describe("runDiagnostic", () => {
  it("wraps the check function with id/label/ranAt/requestId/duration", async () => {
    const result = await runDiagnostic("email.configured", "API key set", "req-xyz", async () => ({
      severity: "pass",
      summary: "RESEND_API_KEY present",
    }));
    expect(result.id).toBe("email.configured");
    expect(result.label).toBe("API key set");
    expect(result.severity).toBe("pass");
    expect(result.requestId).toBe("req-xyz");
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(new Date(result.ranAt).toString()).not.toBe("Invalid Date");
  });

  it("captures thrown errors as a fail result without crashing the run", async () => {
    const result = await runDiagnostic("email.x", "Throws", "req-1", async () => {
      throw new Error("boom");
    });
    expect(result.severity).toBe("fail");
    expect(result.summary).toContain("boom");
    expect(result.explanation).toContain("requestId");
  });

  it("does not leak the raw error when the thrown value is not an Error", async () => {
    const result = await runDiagnostic("email.y", "Throws non-error", "req-2", async () => {
      throw "raw string"; // eslint-disable-line @typescript-eslint/only-throw-error
    });
    expect(result.severity).toBe("fail");
    expect(result.summary).toContain("unknown_error");
  });
});

describe("startSection / finalizeSection", () => {
  it("generates a stable request id shared across results in the section", async () => {
    const shell = startSection("email", "Email diagnostics");
    expect(shell.id).toBe("email");
    expect(shell.requestId).toMatch(/^[A-Za-z0-9_-]+$/);
    const a = await runDiagnostic("a", "A", shell.requestId, async () => ({
      severity: "pass",
      summary: "ok",
    }));
    const b = await runDiagnostic("b", "B", shell.requestId, async () => ({
      severity: "fail",
      summary: "no",
    }));
    const section = finalizeSection(shell, [a, b]);
    expect(section.requestId).toBe(shell.requestId);
    expect(a.requestId).toBe(shell.requestId);
    expect(b.requestId).toBe(shell.requestId);
    // section severity rolls up to fail because b failed
    expect(section.severity).toBe("fail");
    expect(section.results).toHaveLength(2);
  });
});

function mkResult(id: string, severity: "pass" | "warn" | "fail" | "skipped") {
  return {
    id,
    label: id,
    severity,
    summary: "",
    ranAt: new Date().toISOString(),
    requestId: "test",
  };
}
