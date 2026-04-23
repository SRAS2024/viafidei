import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminIngestion() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const sources = await prisma.ingestionSource.findMany({
    include: { jobs: { include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } } } },
  });
  return (
    <AdminSection titleKey="admin.card.ingestion">
      {sources.length === 0 ? (
        <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
          No ingestion sources registered. Configure official Catholic sources in seed or admin tooling.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sources.map((s) => (
            <div key={s.id} className="vf-card rounded-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="vf-eyebrow">{s.isOfficial ? "Official" : "Source"}</p>
                  <h2 className="mt-1 font-display text-2xl">{s.name}</h2>
                  <p className="font-serif text-sm text-ink-faint">{s.host}</p>
                </div>
                <div className="text-right font-serif text-sm text-ink-soft">
                  {s.jobs.length} job{s.jobs.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
