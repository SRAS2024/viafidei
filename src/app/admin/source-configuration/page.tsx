import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  listSourceConfigurationCards,
  listSourcesNotFactoryNative,
} from "@/lib/data/source-configuration-card";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Admin source configuration page.
 *
 * Shows one card per active IngestionSource with the 12 spec-listed
 * fields: name, host, tier, purpose flags, discovery method,
 * supported content types, last discovery / fetch / build / valid
 * package, configuration status, reason if not configured. A banner
 * at the top warns when any source cannot enter the factory-native
 * pipeline.
 */
export default async function SourceConfigurationPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const [cards, notFactoryNative] = await Promise.all([
    listSourceConfigurationCards().catch(() => []),
    listSourcesNotFactoryNative().catch(() => []),
  ]);
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
      <div className="mx-auto max-w-6xl space-y-4" data-testid="source-configuration-cards">
        {cards.map((card) => (
          <div
            key={card.sourceId}
            className="rounded-2xl border border-ink/10 bg-paper px-5 py-4"
            data-testid={`source-configuration-card-${card.sourceId}`}
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
      </div>
    </AdminSection>
  );
}
