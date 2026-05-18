import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getContentGrowthDashboard } from "@/lib/data/content-growth-dashboard";
import { getGlobalGrowthHealth } from "@/lib/data/growth-health-score";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Content growth command center.
 *
 * One pipeline row per content type with the 14 spec-listed metrics:
 *   discovered → fetched → built → QA passed → persisted → public
 *   → threshold eligible → deleted, plus stall reason + automatic
 *   next action + growth health score.
 */
export default async function ContentGrowthPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const [rows, health] = await Promise.all([
    getContentGrowthDashboard().catch(() => []),
    getGlobalGrowthHealth().catch(() => null),
  ]);
  return (
    <AdminSection
      titleKey="admin.contentGrowth.title"
      subtitle={
        health
          ? `Global growth health score: ${health.globalScore}/100  ·  generated ${health.generatedAt.toISOString()}`
          : "Growth health unavailable"
      }
    >
      <div
        className="mx-auto max-w-6xl overflow-x-auto rounded-2xl border border-ink/10 bg-paper p-4"
        data-testid="content-growth-table-wrap"
      >
        <table
          className="w-full border-collapse font-mono text-xs"
          data-testid="content-growth-table"
        >
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink-faint">
              <th className="py-2 pr-2">Content type</th>
              <th className="py-2 pr-2">Docs</th>
              <th className="py-2 pr-2">Builds</th>
              <th className="py-2 pr-2">Complete</th>
              <th className="py-2 pr-2">QA pass</th>
              <th className="py-2 pr-2">Public</th>
              <th className="py-2 pr-2">Threshold</th>
              <th className="py-2 pr-2">24h</th>
              <th className="py-2 pr-2">Stall reason</th>
              <th className="py-2 pr-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const matchingHealth = health?.perType.find((p) => p.contentType === r.contentType);
              return (
                <tr
                  key={r.contentType}
                  className="border-b border-ink/5"
                  data-testid={`content-growth-row-${r.contentType}`}
                >
                  <td className="py-1 pr-2">
                    {r.contentType}
                    {matchingHealth && (
                      <span
                        className="ml-2 text-ink-soft"
                        data-testid={`content-growth-score-${r.contentType}`}
                      >
                        ({matchingHealth.score}/100)
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-2">{r.sourceDocumentsFetched ?? "—"}</td>
                  <td className="py-1 pr-2">{r.buildAttempts ?? "—"}</td>
                  <td className="py-1 pr-2">{r.completePackagesBuilt ?? "—"}</td>
                  <td className="py-1 pr-2">{r.qaPassCount ?? "—"}</td>
                  <td className="py-1 pr-2">{r.publicPackageCount ?? "—"}</td>
                  <td className="py-1 pr-2">{r.thresholdEligibleCount ?? "—"}</td>
                  <td className="py-1 pr-2">{r.growthRate24h ?? "—"}</td>
                  <td className="py-1 pr-2">{r.currentStallReason || "ok"}</td>
                  <td className="py-1 pr-2 text-ink-faint">{r.lastUpdatedAt.toISOString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
