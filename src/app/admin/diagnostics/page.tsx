import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadIngestionLiveSnapshot } from "@/lib/diagnostics";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

const DIAGNOSTIC_AREAS = [
  {
    href: "/admin/diagnostics/email",
    eyebrow: "I.",
    title: "Email",
    description:
      "Test welcome, verification, resend-verification, forgot-password, and reset-password flows. Inspect provider config and run the end-to-end self-test.",
  },
  {
    href: "/admin/diagnostics/ingestion",
    eyebrow: "II.",
    title: "Ingestion & Data Management",
    description:
      "Live status, last successful and failed runs, 24h run counts, content totals, review queue size, and per-action data-management activity.",
  },
  {
    href: "/admin/diagnostics/sitemap",
    eyebrow: "III.",
    title: "Sitemap & Link Paths",
    description:
      "Check internal site links, navigation paths, dynamic content routes, profile flows, admin flows, and major button targets.",
  },
  {
    href: "/admin/diagnostics/accounts",
    eyebrow: "IV.",
    title: "Accounts",
    description:
      "Verify sign-up, sign-in, sign-out, verification, saved items, badges, journaling, language persistence, device-date / timezone, and parish-location lookups.",
  },
  {
    href: "/admin/diagnostics/saints",
    eyebrow: "V.",
    title: "Homepage — Today's Feast Day Saints",
    description:
      "Verify that today's saints exist, are PUBLISHED, have structured feast fields, and are returned by /api/saints/today.",
  },
  {
    href: "/admin/diagnostics/data-management-health",
    eyebrow: "VI.",
    title: "Data Management Health",
    description:
      "Ten-row health panel: queue, worker, ingestion, source, strict QA, cleanup, threshold, report, admin email, and database. Each row carries a 0-100 score, status badge, and live signals.",
  },
  {
    href: "/admin/diagnostics/system-health",
    eyebrow: "VII.",
    title: "System Health (14 cards)",
    description:
      "Single-page dashboard with one card per pipeline stage — queue, worker, source discovery / fetch / document, content factory, builders, strict QA, persistence, cleanup, growth, security, admin email, and database. Each card shows its data source, last-updated timestamp, and an error state (never a false zero) when its underlying query fails.",
  },
  {
    href: "/admin/content-growth",
    eyebrow: "VIII.",
    title: "Content Growth (seven-day production report)",
    description:
      "Per content type, the source → public pipeline over a rolling seven days: documents fetched, builds, complete packages, cross-source validation, strict QA, persistence, public / search / sitemap visibility, deletions, duplicates, and net public growth. Includes daily growth targets, 24h / 7d growth warnings, a production growth score, and daily-trend charts.",
  },
  {
    href: "/admin/builder-quality",
    eyebrow: "IX.",
    title: "Builder Quality",
    description:
      "One row per builder over a rolling 14-day window: build attempts, complete packages, QA pass / failure rate, public render / search / sitemap visibility pass rate, duplicate rate, wrong-content rate, top missing fields, and top rejected source hosts.",
  },
  {
    href: "/admin/source-onboarding",
    eyebrow: "X.",
    title: "Source Onboarding Diagnostics",
    description:
      "One row per configured ingestion source: discovery method, role, tier, supported content types, allowed fields, license status, fetch / build / daily caps, validation + enrichment role, and source health — plus per-content-type source-coverage warnings.",
  },
  {
    href: "/admin/baseline-audit",
    eyebrow: "XI.",
    title: "Baseline Content Audit",
    description:
      "Traces every baseline fixture from its source URL to the public catalog: source documents created, build attempts, complete builds, public packages, failures, and failure reasons.",
  },
] as const;

function statusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "running":
    case "active":
    case "maintenance":
      return { bg: "bg-emerald-100", text: "text-emerald-800" };
    case "stale":
    case "disabled":
      return { bg: "bg-amber-100", text: "text-amber-800" };
    case "failing":
    case "blocked":
      return { bg: "bg-red-100", text: "text-red-800" };
    default:
      return { bg: "bg-stone-100", text: "text-stone-700" };
  }
}

export default async function AdminDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const snapshot = await loadIngestionLiveSnapshot().catch(() => null);
  const badge = snapshot ? statusBadgeStyle(snapshot.status) : null;

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="One hub for every diagnostic the Via Fidei admin can run. Each area opens its own dedicated page with results, last-run timestamps, request ids, and useful failure detail when something breaks."
    >
      {snapshot ? (
        <div className="mb-6 vf-card rounded-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg">Ingestion at a glance</h2>
            {badge ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs uppercase ${badge.bg} ${badge.text}`}
              >
                {snapshot.status}
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-serif text-sm text-ink-soft">{snapshot.detail}</p>
          <div className="mt-3 grid gap-2 font-serif text-xs text-ink-faint sm:grid-cols-3">
            <span>24h runs: {snapshot.totalRuns24h}</span>
            <span>24h failures: {snapshot.failedRuns24h}</span>
            <span>
              Last success:{" "}
              {snapshot.lastSuccessAt
                ? snapshot.lastSuccessAt.slice(0, 16).replace("T", " ")
                : "never"}
            </span>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {DIAGNOSTIC_AREAS.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:border-ink/30 hover:-translate-y-0.5"
          >
            <p className="vf-eyebrow">{area.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl">{area.title}</h2>
            <p className="mt-3 font-serif text-sm leading-relaxed text-ink-soft">
              {area.description}
            </p>
            <p className="vf-nav-link mt-4 text-sm">Open →</p>
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}
