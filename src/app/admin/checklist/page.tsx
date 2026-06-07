import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { bulkActionCounts } from "@/lib/checklist";
import { BulkActions } from "./BulkActions";

export const dynamic = "force-dynamic";

interface ChecklistStats {
  byStatus: Record<string, number>;
  byContentType: Record<string, number>;
  queue: { pending: number; running: number; retrying: number; failed: number };
  qa: { passed: number; failed: number; needsReview: number };
  published: number;
  failedBuilds: number;
}

async function fetchStats(): Promise<ChecklistStats> {
  const [items, queueCounts, qaCounts, publishedCount, failedBuilds] = await Promise.all([
    prisma.checklistItem.groupBy({
      by: ["approvalStatus", "contentType"],
      _count: true,
    }),
    prisma.workerBuildJob.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.checklistQAReport.groupBy({
      by: ["passed", "needsHumanReview"],
      _count: true,
    }),
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.workerBuildJob.count({ where: { status: "failed" } }),
  ]);

  const byStatus: Record<string, number> = {};
  const byContentType: Record<string, number> = {};
  for (const row of items) {
    byStatus[row.approvalStatus] = (byStatus[row.approvalStatus] ?? 0) + row._count;
    byContentType[row.contentType] = (byContentType[row.contentType] ?? 0) + row._count;
  }
  const queue = { pending: 0, running: 0, retrying: 0, failed: 0 };
  for (const q of queueCounts) {
    if (q.status === "pending") queue.pending = q._count;
    else if (q.status === "running") queue.running = q._count;
    else if (q.status === "retrying") queue.retrying = q._count;
    else if (q.status === "failed") queue.failed = q._count;
  }
  const qa = { passed: 0, failed: 0, needsReview: 0 };
  for (const r of qaCounts) {
    if (r.needsHumanReview) qa.needsReview += r._count;
    else if (r.passed) qa.passed += r._count;
    else qa.failed += r._count;
  }
  return {
    byStatus,
    byContentType,
    queue,
    qa,
    published: publishedCount,
    failedBuilds,
  };
}

export default async function ChecklistDashboard() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [stats, bulkCounts] = await Promise.all([fetchStats(), bulkActionCounts(prisma)]);

  const cards: Array<{ label: string; value: number; href: string; tone: string }> = [
    {
      label: "Discovered",
      value: stats.byStatus.DISCOVERED ?? 0,
      href: "/admin/checklist/discovered",
      tone: "border-slate-300",
    },
    {
      label: "Source verified",
      value: stats.byStatus.SOURCE_VERIFIED ?? 0,
      href: "/admin/checklist/discovered?status=SOURCE_VERIFIED",
      tone: "border-blue-300",
    },
    {
      label: "Approved for build",
      value: stats.byStatus.APPROVED_FOR_BUILD ?? 0,
      href: "/admin/checklist/approved",
      tone: "border-indigo-300",
    },
    {
      label: "Worker queue (pending)",
      value: stats.queue.pending,
      href: "/admin/checklist/queue",
      tone: "border-emerald-300",
    },
    {
      label: "QA pending",
      value: stats.byStatus.QA_PENDING ?? 0,
      href: "/admin/checklist/qa",
      tone: "border-amber-300",
    },
    {
      label: "Published",
      value: stats.published,
      href: "/admin/checklist/published",
      tone: "border-green-400",
    },
    {
      label: "Failed builds",
      value: stats.failedBuilds,
      href: "/admin/checklist/failed",
      tone: "border-rose-300",
    },
    {
      label: "Needs human review",
      value: stats.qa.needsReview,
      href: "/admin/checklist/qa?filter=review",
      tone: "border-purple-300",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-ink">Checklist dashboard</h1>
        <p className="mt-2 font-serif text-ink-soft">
          The checklist-first content pipeline. Every published item came from a curated checklist,
          verified Catholic sources, and a QA-passed worker build.
        </p>
      </header>

      <BulkActions verifyCount={bulkCounts.discoveredReadyToVerify} />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`block rounded-lg border-2 ${card.tone} bg-white px-5 py-4 hover:shadow-md transition`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              {card.label}
            </p>
            <p className="mt-1 text-3xl font-semibold text-ink">{card.value}</p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">By content type</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {Object.entries(stats.byContentType).map(([type, count]) => (
            <div
              key={type}
              className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span className="text-ink-soft">{type}</span>
              <span className="font-semibold text-ink">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Quick links</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink">
          <li>
            <Link className="text-indigo-600 underline" href="/admin/checklist/sources">
              Authority source registry
            </Link>
          </li>
          <li>
            <Link className="text-indigo-600 underline" href="/admin/checklist/queue">
              Worker build queue
            </Link>
          </li>
          <li>
            <Link className="text-indigo-600 underline" href="/admin/checklist/qa">
              QA reports
            </Link>
          </li>
          <li>
            <Link className="text-indigo-600 underline" href="/admin/checklist/published">
              Published content
            </Link>
          </li>
          <li>
            <Link className="text-indigo-600 underline" href="/admin/checklist/janitor/edits">
              Janitor: edits
            </Link>
          </li>
          <li>
            <Link className="text-indigo-600 underline" href="/admin/checklist/janitor/deletes">
              Janitor: deletes
            </Link>
          </li>
          <li>
            <Link className="text-indigo-600 underline" href="/admin/diagnostics">
              System diagnostics
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
