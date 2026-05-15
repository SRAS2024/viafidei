import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { runSaintsFeastDiagnostics } from "@/lib/diagnostics";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

function statusColor(status: string) {
  switch (status) {
    case "pass":
      return "#185c2a";
    case "warn":
      return "#9b6b00";
    case "fail":
      return "#8b1a1a";
    default:
      return "#3b3f4a";
  }
}

function statusGlyph(status: string) {
  switch (status) {
    case "pass":
      return "✓";
    case "warn":
      return "!";
    case "fail":
      return "✗";
    default:
      return "·";
  }
}

/**
 * /admin/diagnostics/saints — verify the homepage "Today's Feast Day
 * Saints" pipeline end-to-end. Reads the saint catalog directly via
 * `runSaintsFeastDiagnostics` so an admin can see whether today's
 * saints exist, are PUBLISHED, and whether the structured feast
 * columns are populated.
 */
export default async function SaintsFeastDiagnosticsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const section = await runSaintsFeastDiagnostics();
  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Homepage saints — verify today's feast-day list. Reads from the Saint catalog using both structured (feastMonth / feastDayOfMonth) and legacy freeform feast text."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/diagnostics" className="vf-nav-link">
          ← Diagnostics
        </Link>
        <Link href="/saints/today" className="vf-nav-link">
          Open public list →
        </Link>
        <Link href="/admin/saints" className="vf-nav-link">
          Saints catalog →
        </Link>
      </div>

      <header className="mb-6 vf-card rounded-sm p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl">{section.label}</h2>
          <span
            className="inline-flex items-center gap-2 font-serif text-sm"
            style={{ color: statusColor(section.severity) }}
          >
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs text-white"
              style={{ backgroundColor: statusColor(section.severity) }}
            >
              {statusGlyph(section.severity)}
            </span>
            Overall: <span className="font-medium uppercase">{section.severity}</span>
          </span>
        </div>
        <p className="mt-1 font-serif text-xs text-ink-faint">
          Run at {new Date(section.ranAt).toISOString().replace("T", " ").slice(0, 19)} · request id{" "}
          <span className="font-mono">{section.requestId}</span>
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {section.results.map((r) => (
          <li key={r.id} className="vf-card rounded-sm p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
                style={{ backgroundColor: statusColor(r.severity) }}
              >
                {statusGlyph(r.severity)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-display text-base text-ink">{r.label}</p>
                <p className="mt-1 break-words font-serif text-sm text-ink-soft">{r.summary}</p>
                {r.explanation ? (
                  <p className="mt-2 break-words font-serif text-xs text-ink-faint">
                    {r.explanation}
                  </p>
                ) : null}
                {r.evidence ? (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-sm bg-paper-soft px-2 py-1 font-mono text-xs text-ink-faint">
                    {Object.entries(r.evidence)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join("\n")}
                  </pre>
                ) : null}
                <p className="mt-2 font-serif text-xs text-ink-faint">
                  Ran at {new Date(r.ranAt).toISOString().replace("T", " ").slice(0, 19)}
                  {typeof r.durationMs === "number" ? ` · ${r.durationMs}ms` : null}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </AdminSection>
  );
}
