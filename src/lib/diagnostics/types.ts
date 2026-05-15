import { generateRequestId } from "@/lib/observability";

/**
 * Diagnostic severity. Admin diagnostics surface should colour-code these
 * consistently across email, data-management, sitemap, and account
 * sections.
 *
 *   - `pass`    — check ran and produced the expected result.
 *   - `warn`    — check ran, result is suboptimal but not breaking (e.g.
 *                 RESEND_API_KEY missing; account flows still succeed but
 *                 email is skipped).
 *   - `fail`    — check ran and produced a result that indicates a real
 *                 production problem (missing required table, sitemap
 *                 returned non-XML, etc.).
 *   - `skipped` — check could not run (e.g. dependent service not
 *                 configured); not a failure on its own.
 */
export type DiagnosticSeverity = "pass" | "warn" | "fail" | "skipped";

/**
 * A single diagnostic check result. Designed so the admin UI can render
 * the same shape regardless of which diagnostic section produced it.
 *
 * Sensitive values (secrets, full API keys, database URLs, raw tokens,
 * private headers) MUST NEVER appear in `summary`, `detail`, `evidence`
 * or `explanation`. The admin diagnostic surface is operator-only but
 * the request still rides over a browser; treat the response body as
 * leaving the trust boundary.
 */
export type DiagnosticResult = {
  /** Stable identifier across runs (e.g. "email.api_key_configured"). */
  id: string;
  /** Short human label ("Resend API key configured"). */
  label: string;
  severity: DiagnosticSeverity;
  /** One-line summary safe for the admin browser surface. */
  summary: string;
  /** Optional friendly explanation: what likely broke + where to look. */
  explanation?: string;
  /** Optional small structured payload — counts, names, prefixes. */
  evidence?: Record<string, string | number | boolean | null | undefined>;
  /** ISO timestamp of when this check finished running. */
  ranAt: string;
  /** Request id that ties this result to the structured log line. */
  requestId: string;
  /** Wall-clock duration of the check in milliseconds. */
  durationMs?: number;
};

/**
 * Container for a section of diagnostics (email, data-management,
 * sitemap, accounts). Lets the admin UI render four panels off a single
 * `/api/admin/diagnostics` response shape if the routes are later
 * consolidated.
 */
export type DiagnosticSection = {
  id: "email" | "data_management" | "sitemap" | "accounts";
  label: string;
  /** Overall severity for the section (worst of its results). */
  severity: DiagnosticSeverity;
  results: DiagnosticResult[];
  /** ISO timestamp of when the section run finished. */
  ranAt: string;
  /** Request id shared by every result emitted in this run. */
  requestId: string;
};

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  pass: 0,
  skipped: 1,
  warn: 2,
  fail: 3,
};

/**
 * Roll the worst severity of a list of results up to the section level.
 * Empty list maps to `pass` so an unconfigured section reads as benign.
 */
export function severityOf(results: DiagnosticResult[]): DiagnosticSeverity {
  let worst: DiagnosticSeverity = "pass";
  for (const r of results) {
    if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[worst]) worst = r.severity;
  }
  return worst;
}

/**
 * Helper that runs a single diagnostic check function and wraps the
 * outcome in a uniform `DiagnosticResult` — including duration timing,
 * timestamp, and a request id derived from the surrounding section.
 *
 * Any thrown error is captured as a `fail` result so the admin surface
 * never falls over because one check threw. The error message is included
 * verbatim — callers are responsible for not throwing with sensitive
 * values in the message.
 */
export async function runDiagnostic(
  id: string,
  label: string,
  requestId: string,
  run: () => Promise<Omit<DiagnosticResult, "id" | "label" | "ranAt" | "requestId" | "durationMs">>,
): Promise<DiagnosticResult> {
  const startedAt = Date.now();
  try {
    const partial = await run();
    return {
      ...partial,
      id,
      label,
      ranAt: new Date().toISOString(),
      requestId,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return {
      id,
      label,
      severity: "fail",
      summary: `Diagnostic threw: ${message}`,
      explanation: "The check function itself raised — inspect logs for the matching requestId.",
      ranAt: new Date().toISOString(),
      requestId,
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * Build an empty section shell with a fresh request id and timestamp.
 * Section builders should call this once at the start of a run, pass
 * `requestId` into each `runDiagnostic` call, then call `finalize`
 * to attach the result list and compute the overall severity.
 */
export function startSection(
  id: DiagnosticSection["id"],
  label: string,
): { id: DiagnosticSection["id"]; label: string; requestId: string; startedAt: number } {
  return {
    id,
    label,
    requestId: generateRequestId(),
    startedAt: Date.now(),
  };
}

export function finalizeSection(
  shell: { id: DiagnosticSection["id"]; label: string; requestId: string; startedAt: number },
  results: DiagnosticResult[],
): DiagnosticSection {
  return {
    id: shell.id,
    label: shell.label,
    severity: severityOf(results),
    results,
    ranAt: new Date().toISOString(),
    requestId: shell.requestId,
  };
}
