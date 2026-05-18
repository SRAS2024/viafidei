import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSeedAuditReport } from "@/lib/data/seed-audit";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Seed audit page. Shows, per content type, how many seeded rows
 * exist and how many pass the strict public gate. A healthy seed
 * passes 100% — anything below that means seeded content is
 * present in the database but invisible to the public site.
 */
export default async function SeedAuditPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getSeedAuditReport();
  return (
    <AdminSection
      titleKey="admin.seedAudit.title"
      subtitle={`Generated ${report.generatedAt.toISOString()} · seed factory health: ${
        report.healthy ? "healthy" : "unhealthy"
      }`}
    >
      <div className="mx-auto max-w-3xl space-y-3" data-testid="seed-audit-rows">
        {report.rows.map((row) => {
          const fullyValid = row.total === 0 || row.publicAndValid === row.total;
          return (
            <div
              key={row.contentType}
              className={`rounded-2xl border px-5 py-4 ${
                fullyValid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
              }`}
              data-testid={`seed-audit-row-${row.contentType}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-serif text-lg font-semibold">{row.contentType}</h3>
                <span className="font-mono text-xs uppercase tracking-wider">
                  {row.publicAndValid}/{row.total} pass · {Math.round(row.passRate * 100)}%
                </span>
              </div>
              {row.errors.length > 0 && (
                <p className="mt-2 font-mono text-xs text-red-900">
                  {row.errors.length} error(s): {row.errors.join("; ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </AdminSection>
  );
}
