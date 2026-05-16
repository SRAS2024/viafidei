import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { sanitizePayload } from "@/lib/ingestion/queue/job-kinds";
import { AdminSection } from "../../../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Detail page for a single queue row. Renders the full lifecycle
 * (lease history, audit events) and the SANITIZED payload —
 * `sanitizePayload()` redacts any token / secret / cookie /
 * authorization / api_key keys before the payload reaches the
 * browser so a misconfigured adapter that crammed credentials into
 * a queue row can never leak them to an admin viewer.
 */
export default async function QueueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const { id } = await params;
  const row = await prisma.ingestionJobQueue.findUnique({ where: { id } });
  if (!row) notFound();

  const audit = await prisma.queueAuditLog.findMany({
    where: { jobQueueId: id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const sanitized = sanitizePayload(row.payload);

  return (
    <AdminSection
      titleKey="admin.card.ingestion"
      subtitle="Queue row detail — sanitized payload + full lifecycle audit."
    >
      <section className="mb-6 vf-card rounded-sm p-5">
        <h2 className="font-display text-xl">{row.jobName}</h2>
        <p className="mt-1 font-serif text-sm text-ink-faint">
          {row.jobKind} · {row.contentType ?? "—"} · priority {row.priority}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 font-serif text-xs text-ink-soft sm:grid-cols-4">
          <span>status: {row.status}</span>
          <span>
            attempts: {row.attempts} / {row.maxAttempts}
          </span>
          <span>runAt: {row.runAt.toISOString().slice(0, 16)}</span>
          <span>finishedAt: {row.finishedAt?.toISOString().slice(0, 16) ?? "—"}</span>
          {row.durationMs != null ? <span>durationMs: {row.durationMs}</span> : null}
          {row.cancelRequestedAt ? (
            <span className="text-red-700">
              cancel requested: {row.cancelRequestedAt.toISOString().slice(0, 16)}
            </span>
          ) : null}
          {row.dedupeKey ? <span className="col-span-2">dedupe: {row.dedupeKey}</span> : null}
        </div>
        {row.errorMessage ? (
          <p className="mt-2 font-serif text-xs text-red-700">{row.errorMessage}</p>
        ) : null}
      </section>

      <section className="mb-6">
        <h3 className="mb-2 font-display text-lg">Payload (sanitized)</h3>
        <pre className="overflow-x-auto rounded-sm bg-ink/5 p-3 font-mono text-xs">
          {sanitized == null ? "(no payload)" : JSON.stringify(sanitized, null, 2)}
        </pre>
        <p className="mt-1 font-serif text-xs text-ink-faint">
          Tokens, secrets, cookies, and auth headers are redacted before this view renders.
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-display text-lg">Audit timeline</h3>
        {audit.length === 0 ? (
          <p className="font-serif text-xs text-ink-faint">No audit events recorded.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {audit.map((a) => (
              <li key={a.id} className="vf-card rounded-sm p-3 font-serif text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium">
                    {a.event}
                    {a.fromStatus && a.toStatus ? ` (${a.fromStatus} → ${a.toStatus})` : ""}
                  </span>
                  <span className="text-ink-faint">{a.createdAt.toISOString().slice(0, 19)}</span>
                </div>
                {a.reason ? <p className="mt-1 text-ink-soft">{a.reason}</p> : null}
                {a.actorUsername ? (
                  <p className="text-ink-faint">actor: {a.actorUsername}</p>
                ) : null}
                {a.workerId ? <p className="text-ink-faint">worker: {a.workerId}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </AdminSection>
  );
}
