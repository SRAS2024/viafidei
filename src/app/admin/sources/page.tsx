import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSection } from "../_sections/AdminSection";
import { listApprovedHosts } from "@/lib/ingestion/sources/vatican-allowlist";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const approvedHosts = listApprovedHosts();
  type RegisteredSource = Awaited<
    ReturnType<
      typeof prisma.ingestionSource.findMany<{
        include: { jobs: { include: { runs: { orderBy: { startedAt: "desc" }; take: 3 } } } };
      }>
    >
  >[number];
  let registered: RegisteredSource[] = [];
  try {
    registered = await prisma.ingestionSource.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        jobs: { include: { runs: { orderBy: { startedAt: "desc" }, take: 3 } } },
      },
    });
  } catch {
    registered = [];
  }

  const registeredByHost = new Map<string, RegisteredSource>(
    registered.map((r) => [r.host, r] as const),
  );

  return (
    <AdminSection
      titleKey="admin.card.sources"
      subtitle="The complete allowlist of approved Catholic sources used by the content injection system. Anything not on this list is refused at fetch time."
    >
      <section className="mb-10">
        <h2 className="mb-3 font-display text-2xl">Source allowlist</h2>
        <p className="mb-4 font-serif text-sm text-ink-faint">
          {approvedHosts.length} approved hosts. Tier 1: the Holy See and Vatican press; Tier 2:
          conferences of bishops; Tier 3: pontifical institutes, liturgical reference, and approved
          Catholic encyclopaedias.
        </p>
        <div className="vf-card rounded-sm p-4 sm:p-6">
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {approvedHosts.map((host) => {
              const reg = registeredByHost.get(host);
              return (
                <li
                  key={host}
                  className="flex items-baseline justify-between gap-3 font-serif text-sm"
                >
                  <span className="truncate text-ink">{host}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {reg ? (reg.isActive ? "active" : "paused") : "not registered"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">Last ingestion runs</h2>
        {registered.length === 0 ? (
          <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
            No ingestion sources have been registered yet. They are seeded automatically the first
            time the in-process ingestion scheduler runs (when CRON_SECRET is set), or you can
            trigger one manually from the Ingestion admin page.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {registered.map((s) => {
              const totalRuns = s.jobs.reduce((acc, j) => acc + j.runs.length, 0);
              const lastSync = s.lastSuccessfulSync ?? s.lastFailedSync;
              return (
                <div key={s.id} className="vf-card rounded-sm p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="vf-eyebrow">{s.isOfficial ? "Official" : "Source"}</p>
                      <h3 className="mt-1 font-display text-xl">{s.name}</h3>
                      <p className="font-serif text-sm text-ink-faint">{s.host}</p>
                    </div>
                    <div className="text-right font-serif text-xs text-ink-faint">
                      {s.jobs.length} job{s.jobs.length === 1 ? "" : "s"} · {totalRuns} run
                      {totalRuns === 1 ? "" : "s"}
                      {lastSync ? (
                        <div className="mt-1">last sync {lastSync.toISOString().slice(0, 10)}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminSection>
  );
}
