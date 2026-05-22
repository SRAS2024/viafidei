import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_ACTION, writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { loadIngestionLiveSnapshot } from "@/lib/diagnostics";
import { writeDiagnosticSnapshots } from "@/lib/diagnostics/diagnostic-snapshot";
import { listAvailableReportMonths } from "@/lib/diagnostics/developer-report";
import { DeveloperReportButton } from "@/components/diagnostics/DeveloperReportButton";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";
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
  {
    href: "/admin/fixture-quality",
    eyebrow: "XII.",
    title: "Fixture Quality Diagnostics",
    description:
      "Runs every bundled builder fixture through its real builder: fixture counts, valid-fixture pass count, invalid-fixture rejection count, false positives, false negatives, and missing fixture-coverage areas.",
  },
  {
    href: "/admin/production-runbook",
    eyebrow: "XIII.",
    title: "Production Growth Runbook",
    description:
      "The single operator page for content-growth operations: which content types are stalled and why, the automatic next action, paused and promoted sources, weak builders, missing validation evidence, and failing public display checks.",
  },
  {
    href: "/admin/worker-diagnostics",
    eyebrow: "XIV.",
    title: "Worker & Pipeline Diagnostics",
    description:
      "Worker health (heartbeat, process type, processed / failed counts), the current pipeline blocker, the pending job queue, and one-click repair / recovery actions: run worker once, repair queue, repair source jobs, recover content growth, audit raw rows, convert raw rows, and run strict cleanup.",
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
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const [snapshot, reportMonths] = await Promise.all([
    loadIngestionLiveSnapshot().catch(() => null),
    listAvailableReportMonths().catch(() => []),
    // Loading the Diagnostics panel runs diagnostics: record a
    // diagnostic snapshot so the Developer Audit report can reproduce
    // this point in time...
    writeDiagnosticSnapshots(),
    // ...and log the visit as an important admin action (Diagnostics
    // is a sensitive admin page). A valid authenticated admin — this
    // is recorded without raising any suspicious-activity alert, and
    // collapsed by the action log's rate window so a refresh storm
    // cannot spam it.
    writeAdminActionLog({
      adminUsername: admin.username,
      actionType: ADMIN_ACTION.diagnosticsRun,
      route: "/admin/diagnostics",
      method: "GET",
      result: "success",
      deviceCredential: cookieStore.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
      ipAddress:
        requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        requestHeaders.get("x-real-ip"),
      userAgent: requestHeaders.get("user-agent"),
    }),
  ]);
  const badge = snapshot ? statusBadgeStyle(snapshot.status) : null;

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="One hub for every diagnostic the Via Fidei admin can run. Each area opens its own dedicated page with results, last-run timestamps, request ids, and useful failure detail when something breaks."
    >
      {/* relative z-30: each .vf-card is its own stacking context (backdrop-filter), so the dropdown's z-index can't escape — lift the whole panel above the cards below. */}
      <div
        className="relative z-30 mb-6 flex flex-wrap items-start justify-between gap-3 vf-card rounded-sm p-4 sm:p-5"
        data-testid="developer-report-panel"
      >
        <div className="max-w-reading">
          <h2 className="font-display text-lg">Developer Report</h2>
          <p className="mt-1 font-serif text-sm text-ink-soft">
            Generate a downloadable Developer Audit PDF — every diagnostic result and system log for
            a chosen period, in one document, so a system issue can be debugged without searching
            across the whole admin console.
          </p>
        </div>
        <DeveloperReportButton availableMonths={reportMonths} />
      </div>
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
