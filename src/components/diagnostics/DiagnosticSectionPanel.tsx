import type { DiagnosticResult, DiagnosticSection, DiagnosticSeverity } from "@/lib/diagnostics";

const SEVERITY_BADGE_CLASS: Record<DiagnosticSeverity, string> = {
  pass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  fail: "bg-red-50 text-red-800 border-red-200",
  skipped: "bg-ink/5 text-ink-faint border-ink/15",
};

const SEVERITY_LABEL: Record<DiagnosticSeverity, string> = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
  skipped: "Skipped",
};

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "—";
  if (ms < 1) return "< 1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function EvidenceList({ evidence }: { evidence: DiagnosticResult["evidence"] }) {
  if (!evidence) return null;
  const entries = Object.entries(evidence).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 font-mono text-xs text-ink-faint">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd className="text-ink-soft">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResultRow({ result }: { result: DiagnosticResult }) {
  return (
    <li className="vf-card rounded-sm p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-base text-ink">{result.label}</h3>
        <span
          className={`inline-block rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-liturgical ${SEVERITY_BADGE_CLASS[result.severity]}`}
          aria-label={`Severity: ${SEVERITY_LABEL[result.severity]}`}
        >
          {SEVERITY_LABEL[result.severity]}
        </span>
      </div>
      <p className="mt-1 font-serif text-sm text-ink-soft">{result.summary}</p>
      {result.explanation ? (
        <p className="mt-2 rounded-sm border border-ink/10 bg-ink/[0.02] p-3 font-serif text-xs text-ink-faint">
          {result.explanation}
        </p>
      ) : null}
      <EvidenceList evidence={result.evidence} />
      <p className="mt-3 text-[11px] text-ink-faint">
        <span className="font-mono">id={result.id}</span>
        {" · "}
        <span>ran {formatTimestamp(result.ranAt)}</span>
        {" · "}
        <span>took {formatDuration(result.durationMs)}</span>
        {" · "}
        <span className="font-mono">req={result.requestId}</span>
      </p>
    </li>
  );
}

/**
 * Renders a single DiagnosticSection — a heading with the section severity,
 * a result list with badges, and the per-result evidence / timestamp /
 * request id stamps. Designed to be reused across every diagnostic page so
 * the four sections (email / data-management / sitemap / accounts) share
 * one visual shape. The component is intentionally a server component —
 * it accepts the resolved section as a prop, so the parent page can fetch
 * the data however it wants (a typed module import, a route, a unit test).
 */
export function DiagnosticSectionPanel({ section }: { section: DiagnosticSection }) {
  return (
    <section className="mt-6" aria-labelledby={`diag-${section.id}-heading`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`diag-${section.id}-heading`} className="font-display text-2xl text-ink">
          {section.label}
        </h2>
        <span
          className={`inline-block rounded-sm border px-2 py-0.5 text-[11px] uppercase tracking-liturgical ${SEVERITY_BADGE_CLASS[section.severity]}`}
          aria-label={`Section severity: ${SEVERITY_LABEL[section.severity]}`}
        >
          {SEVERITY_LABEL[section.severity]}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">
        <span>section ran {formatTimestamp(section.ranAt)}</span>
        {" · "}
        <span className="font-mono">req={section.requestId}</span>
      </p>
      {section.results.length === 0 ? (
        <p className="mt-4 font-serif text-sm text-ink-faint">No checks ran for this section.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {section.results.map((r) => (
            <ResultRow key={r.id} result={r} />
          ))}
        </ul>
      )}
    </section>
  );
}
