import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getPipelineBrokenHereReport } from "@/lib/diagnostics/pipeline-broken-here";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Pipeline-broken-here admin page.
 *
 * Shows one row per broken stage of the queue chain:
 *   - source_document_waiting_for_build
 *   - build_succeeded_but_no_qa
 *   - qa_passed_but_no_persistence
 *   - persisted_but_public_gate_failed
 *
 * Each row carries an automatic-next-action label so the admin
 * knows precisely what to enqueue (and the auto-repair worker
 * acts on the same labels).
 */
export default async function PipelineBrokenHerePage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getPipelineBrokenHereReport();
  return (
    <AdminSection
      titleKey="admin.pipelineBrokenHere.title"
      subtitle={`Generated ${report.generatedAt.toISOString()} · ${report.totalBroken} broken rows total`}
    >
      <div className="mx-auto max-w-6xl space-y-4" data-testid="pipeline-broken-here-entries">
        {report.entries.map((entry) => {
          const severityClass =
            entry.count > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";
          return (
            <div
              key={entry.stage}
              className={`rounded-2xl border px-5 py-4 ${severityClass}`}
              data-testid={`pipeline-broken-here-entry-${entry.stage}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-serif text-lg font-semibold">{entry.label}</h3>
                <span className="font-mono text-xs uppercase tracking-wider">
                  count: {entry.count}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs">
                automatic next action: <strong>{entry.automaticNextAction}</strong>
              </p>
              {entry.samples.length > 0 && (
                <div className="mt-3 space-y-1 font-mono text-xs">
                  {entry.samples.slice(0, 5).map((s, i) => (
                    <div key={i} className="text-ink-soft">
                      {s.contentType ? `${s.contentType} · ` : ""}
                      {s.slug ? `${s.slug} · ` : ""}
                      {s.sourceUrl ? <span className="break-all">{s.sourceUrl}</span> : ""}
                      {s.detail ? ` — ${s.detail}` : ""}
                    </div>
                  ))}
                  {entry.samples.length > 5 && (
                    <div className="text-ink-faint">…and {entry.samples.length - 5} more</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <form
        method="POST"
        action="/api/admin/diagnostics/auto-repair"
        className="mx-auto mt-6 max-w-3xl rounded-2xl border border-ink/10 bg-paper px-5 py-4 text-center"
      >
        <p className="font-serif text-sm text-ink-soft">
          Trigger one auto-repair pass — runs the matching{" "}
          <code className="font-mono">automaticNextAction</code> for every broken entry above.
        </p>
        <button type="submit" className="vf-button-primary mt-3">
          Run auto-repair pass
        </button>
      </form>
    </AdminSection>
  );
}
