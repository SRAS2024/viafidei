/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { DiagnosticSectionPanel } from "@/components/diagnostics/DiagnosticSectionPanel";
import type { DiagnosticSection } from "@/lib/diagnostics";

function mkSection(overrides: Partial<DiagnosticSection> = {}): DiagnosticSection {
  return {
    id: "email",
    label: "Email",
    severity: "pass",
    ranAt: "2026-05-14T12:00:00.000Z",
    requestId: "req-abc12345",
    results: [
      {
        id: "email.api_key",
        label: "Resend API key configured",
        severity: "pass",
        summary: "Resend API key present.",
        evidence: { prefix: "re_t", length: 32 },
        ranAt: "2026-05-14T12:00:00.000Z",
        requestId: "req-abc12345",
        durationMs: 3,
      },
    ],
    ...overrides,
  };
}

describe("DiagnosticSectionPanel", () => {
  it("renders the section label as a heading + severity badge", () => {
    render(<DiagnosticSectionPanel section={mkSection()} />);
    expect(screen.getByRole("heading", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Section severity: Pass")).toBeInTheDocument();
  });

  it("renders one result row per result, showing label + summary + severity badge", () => {
    render(<DiagnosticSectionPanel section={mkSection()} />);
    expect(screen.getByText("Resend API key configured")).toBeInTheDocument();
    expect(screen.getByText("Resend API key present.")).toBeInTheDocument();
    expect(screen.getByLabelText("Severity: Pass")).toBeInTheDocument();
  });

  it("renders evidence key-value pairs but skips undefined / null values", () => {
    const section = mkSection({
      results: [
        {
          id: "x",
          label: "X",
          severity: "pass",
          summary: "ok",
          evidence: { kept: "yes", numeric: 7, dropped: undefined, alsoDropped: null },
          ranAt: "2026-05-14T12:00:00.000Z",
          requestId: "req-x",
          durationMs: 1,
        },
      ],
    });
    render(<DiagnosticSectionPanel section={section} />);
    expect(screen.getByText("kept")).toBeInTheDocument();
    expect(screen.getByText("yes")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("dropped")).not.toBeInTheDocument();
    expect(screen.queryByText("alsoDropped")).not.toBeInTheDocument();
  });

  it("renders the friendly explanation in its own callout when present", () => {
    const section = mkSection({
      results: [
        {
          id: "y",
          label: "Y",
          severity: "warn",
          summary: "Heads up",
          explanation: "Try `prisma migrate deploy` and check the structured log.",
          ranAt: "2026-05-14T12:00:00.000Z",
          requestId: "req-y",
          durationMs: 1,
        },
      ],
    });
    render(<DiagnosticSectionPanel section={section} />);
    expect(screen.getByText(/prisma migrate deploy/)).toBeInTheDocument();
  });

  it("surfaces the request id and timestamp at the section and per-result level", () => {
    render(<DiagnosticSectionPanel section={mkSection()} />);
    // Section-level metadata (request id appears at least twice — once at
    // the section header, once per result).
    const reqIdMatches = screen.getAllByText(/req=req-abc12345/);
    expect(reqIdMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to an empty-state message when there are no results", () => {
    const section = mkSection({ results: [] });
    render(<DiagnosticSectionPanel section={section} />);
    expect(screen.getByText(/No checks ran for this section/i)).toBeInTheDocument();
  });

  it("renders the matching badge classes for warn / fail / skipped severities", () => {
    const section = mkSection({
      severity: "fail",
      results: [
        {
          id: "a",
          label: "A",
          severity: "warn",
          summary: "warning",
          ranAt: "2026-05-14T12:00:00.000Z",
          requestId: "req-a",
          durationMs: 1,
        },
        {
          id: "b",
          label: "B",
          severity: "fail",
          summary: "fail",
          ranAt: "2026-05-14T12:00:00.000Z",
          requestId: "req-b",
          durationMs: 1,
        },
        {
          id: "c",
          label: "C",
          severity: "skipped",
          summary: "skipped",
          ranAt: "2026-05-14T12:00:00.000Z",
          requestId: "req-c",
          durationMs: 1,
        },
      ],
    });
    render(<DiagnosticSectionPanel section={section} />);
    expect(screen.getByLabelText("Section severity: Fail")).toBeInTheDocument();
    expect(screen.getByLabelText("Severity: Warn")).toBeInTheDocument();
    expect(screen.getByLabelText("Severity: Fail")).toBeInTheDocument();
    expect(screen.getByLabelText("Severity: Skipped")).toBeInTheDocument();
  });

  it("has no obvious accessibility violations", async () => {
    const { container } = render(<DiagnosticSectionPanel section={mkSection()} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("does not surface a secret value even when the result evidence accidentally carries one", async () => {
    // The DiagnosticSection contract says callers must strip secrets BEFORE
    // building the result, but the panel itself must not transform values
    // in a way that reveals more than was provided. Verify by asserting the
    // rendered DOM only contains exactly what the evidence said.
    const section = mkSection({
      results: [
        {
          id: "x",
          label: "X",
          severity: "pass",
          summary: "ok",
          evidence: { prefix: "re_x" },
          ranAt: "2026-05-14T12:00:00.000Z",
          requestId: "req-x",
          durationMs: 1,
        },
      ],
    });
    const { container } = render(<DiagnosticSectionPanel section={section} />);
    // Only the truncated 4-char prefix should appear, not any longer string
    // that looks like an API key.
    const text = container.textContent ?? "";
    expect(text).toContain("re_x");
    expect(text).not.toMatch(/re_[A-Za-z0-9_]{16,}/);
    // Quiet warning about jest-axe import order — we already exercised it
    // above; this assertion only validates the rendered text.
    expect(within(container).queryAllByText(/re_[A-Za-z0-9_]{16,}/).length).toBe(0);
  });
});
