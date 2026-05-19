import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  PRODUCTION_SOURCE_REGISTRY,
  groupSourcesByContentType,
} from "@/lib/ingestion/sources/production-source-registry";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Admin "Source groups by content type" page (spec §1).
 *
 * Renders the curated PRODUCTION_SOURCE_REGISTRY grouped by the
 * spec-listed content type buckets: Prayer sources, Saint sources,
 * Marian Apparition sources, Devotion sources, Novena sources,
 * Sacrament sources, Rosary sources, Consecration sources, Liturgy
 * sources, History sources, Parish sources, Scripture reference
 * sources.
 *
 * The page is read-only — operators modify sources from the
 * existing /admin/sources page; this view is purely diagnostic.
 */

const GROUP_LABELS: Record<string, string> = {
  Prayer: "Prayer sources",
  Saint: "Saint sources",
  MarianApparition: "Marian Apparition sources",
  Devotion: "Devotion sources",
  Novena: "Novena sources",
  Sacrament: "Sacrament sources",
  Rosary: "Rosary sources",
  Consecration: "Consecration sources",
  Liturgy: "Liturgy sources",
  History: "History sources",
  Parish: "Parish sources",
  ScriptureText: "Scripture reference sources",
};

const GROUP_ORDER = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Devotion",
  "Novena",
  "Sacrament",
  "Rosary",
  "Consecration",
  "Liturgy",
  "History",
  "Parish",
  "ScriptureText",
];

export default async function SourceGroupsPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const groups = groupSourcesByContentType();

  return (
    <AdminSection
      titleKey="admin.sourceGroups.title"
      subtitle={`${PRODUCTION_SOURCE_REGISTRY.length} curated sources across ${GROUP_ORDER.length} content groups`}
    >
      <div className="mx-auto max-w-6xl space-y-6" data-testid="source-groups">
        {GROUP_ORDER.map((key) => {
          const entries = groups[key] ?? [];
          return (
            <section
              key={key}
              className="rounded-2xl border border-ink/10 bg-paper px-5 py-4"
              data-testid={`source-group-${key}`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-lg font-semibold">{GROUP_LABELS[key] ?? key}</h2>
                <span className="font-mono text-xs text-ink-soft">
                  {entries.length} source{entries.length === 1 ? "" : "s"}
                </span>
              </div>
              {entries.length === 0 ? (
                <p className="mt-2 font-serif text-sm text-amber-800">
                  No curated source for this content type yet — add one to the production source
                  registry.
                </p>
              ) : (
                <table className="mt-3 w-full font-mono text-xs">
                  <thead className="text-ink-soft">
                    <tr className="text-left">
                      <th className="py-1">Name</th>
                      <th className="py-1">Host</th>
                      <th className="py-1">Tier</th>
                      <th className="py-1">Role</th>
                      <th className="py-1">Discovery</th>
                      <th className="py-1">License</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.host} className="border-t border-ink/5">
                        <td className="py-1 font-semibold text-ink">{e.name}</td>
                        <td className="py-1">{e.host}</td>
                        <td className="py-1">tier {e.tier}</td>
                        <td className="py-1">{e.role.replace(/_/g, " ")}</td>
                        <td className="py-1">{e.discoveryMethod}</td>
                        <td className="py-1">{e.licenseStatus.replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </AdminSection>
  );
}
