import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { listPendingReview } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";

import { ReviewQueueClient, type ReviewItem } from "./ReviewQueueClient";

export const dynamic = "force-dynamic";

/**
 * Human-review queue page — the accessible place a human actually approves or
 * denies the worker's review items. Approving applies the change to live content
 * (e.g. writes a confirmed Latin/Greek translation onto the prayer). The worker
 * already auto-resolves what it safely can each pass; only the items that genuinely
 * need a human eye land here.
 */
export default async function ReviewQueuePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const raw = await listPendingReview(prisma, { limit: 200 });
  const items: ReviewItem[] = raw.map((r) => {
    const ev = (r.sourceEvidence ?? {}) as { text?: string };
    return {
      id: r.id,
      contentType: r.contentType,
      contentTitle: r.contentTitle,
      proposedAction: r.proposedAction,
      reason: r.reason,
      confidence: r.confidence,
      proposedText: typeof ev.text === "string" ? ev.text : null,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Human review queue</h1>
        <Link href="/admin/admin-worker" className="text-sm text-indigo-600 underline">
          ← Admin Worker
        </Link>
      </div>
      <p className="mb-5 text-sm text-ink-soft">
        {items.length} item{items.length === 1 ? "" : "s"} pending. The worker auto-resolves what it
        can decide safely on its own each pass (a redundant translation, or one the canonical engine
        can confirm authentically); only the items that genuinely need a human eye against an
        authoritative source are listed here.{" "}
        <strong>Approving applies the change to the live content; denying discards it.</strong>
      </p>
      <ReviewQueueClient items={items} />
    </main>
  );
}
