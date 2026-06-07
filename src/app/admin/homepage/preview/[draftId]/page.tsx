import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { getHomepageDraft, isReviewableDraftStatus, readSnapshotBlocks } from "@/lib/admin-worker";
import { parseFeaturedBlock } from "@/lib/data/homepage";
import { getTranslator } from "@/lib/i18n/server";
import {
  HomeHero,
  HomeMission,
  HomeNewcomer,
  HomeQuickLinks,
  LiturgicalToday,
} from "@/app/_sections";
import { HomepagePreviewShell, type PreviewBlock } from "./HomepagePreviewShell";

export const dynamic = "force-dynamic";

/**
 * Editable preview screen for a Homepage Makeover draft. Admin-guarded.
 * Renders the proposed homepage (static sections + the worker's
 * featured rails) and lets the admin tweak it, then go Back, Discard,
 * or Publish — all wired through the draft review API.
 */
export default async function HomepagePreviewPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { draftId } = await params;
  const draft = await getHomepageDraft(prisma, draftId);

  if (!draft) {
    return <PreviewNotice title="Draft not found" body="This homepage draft no longer exists." />;
  }

  if (!isReviewableDraftStatus(draft.status)) {
    return (
      <PreviewNotice
        title={`Draft is ${draft.status.toLowerCase().replace(/_/g, " ")}`}
        body="This draft has already been resolved and can no longer be edited. You can view the live homepage or return to the admin worker."
        showHomeLink
      />
    );
  }

  const { t } = await getTranslator();

  const featured: PreviewBlock[] = readSnapshotBlocks(draft.proposedSnapshot)
    .filter((b) => b.blockType.startsWith("featured-"))
    .map((b) => {
      const view = parseFeaturedBlock(b);
      return {
        blockKey: view.blockKey,
        blockType: view.blockType,
        heading: view.heading,
        items: view.items,
      };
    });

  return (
    <HomepagePreviewShell
      draftId={draft.id}
      initialBlocks={featured}
      topSlot={
        <>
          <HomeHero t={t} />
          <HomeMission t={t} />
          <HomeQuickLinks t={t} />
        </>
      }
      bottomSlot={
        <>
          <HomeNewcomer t={t} />
          <LiturgicalToday />
        </>
      }
    />
  );
}

function PreviewNotice({
  title,
  body,
  showHomeLink = false,
}: {
  title: string;
  body: string;
  showHomeLink?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--paper)] px-6">
      <div className="vf-card max-w-lg rounded-sm p-10 text-center">
        <p className="vf-eyebrow">Homepage Makeover</p>
        <h1 className="mt-3 font-display text-3xl text-ink">{title}</h1>
        <p className="mt-4 font-serif text-ink-soft">{body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/admin/admin-worker" className="vf-btn vf-btn-primary">
            ← Back to Admin Worker
          </Link>
          {showHomeLink && (
            <Link href="/" className="vf-btn vf-btn-ghost">
              View live homepage
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
