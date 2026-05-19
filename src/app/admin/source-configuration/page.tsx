import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  listSourceConfigurationCards,
  listSourcesNotFactoryNative,
} from "@/lib/data/source-configuration-card";
import { SOURCE_ROLES } from "@/lib/ingestion/sources/roles";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

const ROLE_STYLES: Record<string, string> = {
  primary_content_source: "bg-emerald-100 text-emerald-900",
  validation_source: "bg-sky-100 text-sky-900",
  enrichment_source: "bg-violet-100 text-violet-900",
  discovery_only_source: "bg-amber-100 text-amber-900",
  rejected_source: "bg-red-100 text-red-900",
};

/**
 * Admin source configuration page.
 *
 * Shows one card per active IngestionSource with the spec-listed
 * fields: name, host, tier, role, purpose flags, discovery method,
 * supported content types, last discovery / fetch / build / valid
 * package, configuration status, reason if not configured. A banner
 * at the top warns when any source cannot enter the factory-native
 * pipeline. Role filters at the top let an admin focus on
 * primary / validation / enrichment / discovery-only / rejected
 * sources without scrolling.
 */
export default async function SourceConfigurationPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const params = (await searchParams) ?? {};
  const requestedRole =
    params.role && SOURCE_ROLES.includes(params.role as never) ? params.role : null;
  const [cards, notFactoryNative] = await Promise.all([
    listSourceConfigurationCards().catch(() => []),
    listSourcesNotFactoryNative().catch(() => []),
  ]);
  const visibleCards = requestedRole ? cards.filter((c) => c.role === requestedRole) : cards;

  // Counts per role for the filter chip strip.
  const roleCounts: Record<string, number> = {};
  for (const r of SOURCE_ROLES) roleCounts[r] = 0;
  for (const c of cards) {
    roleCounts[c.role] = (roleCounts[c.role] ?? 0) + 1;
  }

  return (
    <AdminSection
      titleKey="admin.sourceConfiguration.title"
      subtitle={`${cards.length} active sources · ${notFactoryNative.length} not factory-native`}
    >
      {notFactoryNative.length > 0 && (
        <div
          className="mx-auto mb-6 max-w-6xl rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4"
          data-testid="source-configuration-warning"
        >
          <h2 className="font-serif text-base font-semibold text-amber-900">
            {notFactoryNative.length} source{notFactoryNative.length === 1 ? "" : "s"} cannot enter
            the factory-native pipeline
          </h2>
          <ul className="mt-2 list-disc pl-5 font-serif text-sm text-amber-950">
            {notFactoryNative.map((s) => (
              <li key={s.sourceId}>
                <strong>{s.name}</strong> ({s.host}) — {s.reason ?? "no reason recorded"}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        className="mx-auto mb-4 flex max-w-6xl flex-wrap gap-2 font-mono text-xs"
        data-testid="source-role-filters"
      >
        <a
          href="/admin/source-configuration"
          className={`rounded-full border px-3 py-1 ${
            !requestedRole ? "border-ink/40 bg-ink/5" : "border-ink/15"
          }`}
        >
          all ({cards.length})
        </a>
        {SOURCE_ROLES.map((role) => (
          <a
            key={role}
            href={`/admin/source-configuration?role=${role}`}
            className={`rounded-full border px-3 py-1 ${
              requestedRole === role ? "border-ink/40 bg-ink/5" : "border-ink/15"
            }`}
            data-testid={`source-role-filter-${role}`}
          >
            {role.replace(/_/g, " ")} ({roleCounts[role] ?? 0})
          </a>
        ))}
      </div>
      <div className="mx-auto max-w-6xl space-y-4" data-testid="source-configuration-cards">
        {visibleCards.map((card) => (
          <div
            key={card.sourceId}
            className="rounded-2xl border border-ink/10 bg-paper px-5 py-4"
            data-testid={`source-configuration-card-${card.sourceId}`}
            data-source-role={card.role}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">
                {card.name} <span className="font-mono text-xs text-ink-soft">({card.host})</span>
              </h3>
              <span
                className={`font-mono text-xs uppercase tracking-wider ${
                  card.configurationStatus === "factory_native"
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                tier {card.tier} · {card.configurationStatus ?? "unknown"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
                  ROLE_STYLES[card.role] ?? "bg-ink/10 text-ink"
                }`}
                data-testid={`source-role-badge-${card.sourceId}`}
              >
                {card.role.replace(/_/g, " ")}
              </span>
              {card.roleLastChangedAt && (
                <span className="font-mono text-[11px] text-ink-soft">
                  role changed {card.roleLastChangedAt.toISOString()}
                  {card.roleLastReason ? ` — ${card.roleLastReason}` : ""}
                </span>
              )}
            </div>
            {card.configurationStatusReason && (
              <p className="mt-1 font-serif text-sm text-amber-900">
                {card.configurationStatusReason}
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs text-ink-soft md:grid-cols-3">
              <div>
                <span className="text-ink-faint">discovery method:</span>{" "}
                {card.discoveryMethod ?? "—"}
              </div>
              <div>
                <span className="text-ink-faint">supported types:</span>{" "}
                {card.supportedContentTypes.join(", ") || "—"}
              </div>
              <div>
                <span className="text-ink-faint">last discovery:</span>{" "}
                {card.lastDiscoveryAt?.toISOString() ?? "—"}
              </div>
              <div>
                <span className="text-ink-faint">last fetch:</span>{" "}
                {card.lastFetchAt?.toISOString() ?? "—"}
              </div>
              <div>
                <span className="text-ink-faint">last build:</span>{" "}
                {card.lastBuildAt?.toISOString() ?? "—"}
              </div>
              <div>
                <span className="text-ink-faint">last valid package:</span>{" "}
                {card.lastValidPackageAt?.toISOString() ?? "—"}
              </div>
            </div>
            {card.errors.length > 0 && (
              <p className="mt-2 font-mono text-xs text-red-900">
                {card.errors.length} per-source error(s) loading data
              </p>
            )}
          </div>
        ))}
        {visibleCards.length === 0 && (
          <p className="font-serif text-sm text-ink-soft" data-testid="source-role-filter-empty">
            No sources match the selected role.
          </p>
        )}
      </div>
    </AdminSection>
  );
}
