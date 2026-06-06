import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import {
  applyHomepageDraft,
  discardHomepageDraft,
  getHomepageDraft,
  readSnapshotBlocks,
  saveHomepageDraftEdits,
  writeAdminWorkerLog,
} from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Homepage Makeover draft review endpoint.
 *
 *   GET   → draft details (status + proposed featured blocks).
 *   PATCH → save small admin edits to the proposed featured blocks.
 *   POST  → { action: "publish" | "discard" } applies or rejects it.
 *
 * Every mutation is admin-guarded and audited. Publishing applies the
 * proposed featured rails to the live HomePage record; discarding marks
 * the draft REJECTED. Terminal drafts (already published / rejected)
 * are rejected with 409 so a stale tab can't double-apply.
 */

const blockSchema = z.object({
  blockKey: z.string().min(1),
  blockType: z.string().min(1),
  sortOrder: z.number().int().optional(),
  configJson: z.unknown().optional(),
});

const patchSchema = z.object({
  proposedSnapshot: z.array(blockSchema).max(50),
});

const postSchema = z.object({
  action: z.enum(["publish", "discard"]),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const draft = await getHomepageDraft(prisma, id);
  if (!draft) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({
    id: draft.id,
    status: draft.status,
    mode: draft.mode,
    reasonSummary: draft.reasonSummary,
    sectionsChanged: draft.sectionsChanged,
    confidence: draft.confidence,
    proposedSnapshot: readSnapshotBlocks(draft.proposedSnapshot),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await saveHomepageDraftEdits(prisma, id, parsed.data.proposedSnapshot);
  if (!result.saved) {
    return NextResponse.json(
      { error: result.reason ?? "not_saved", status: result.status },
      { status: result.reason === "not_found" ? 404 : 409 },
    );
  }

  await writeAudit({
    action: "admin_worker.homepage_draft.edit",
    entityType: "HomepageWorkerDraft",
    entityId: id,
    actorUsername: admin.username,
  });

  return NextResponse.json({ saved: true, status: result.status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.action === "publish") {
    const result = await applyHomepageDraft(prisma, id);
    if (!result.applied) {
      return NextResponse.json(
        { error: result.reason ?? "not_applied", status: result.status },
        { status: result.reason === "not_found" ? 404 : 409 },
      );
    }
    await writeAudit({
      action: "admin_worker.homepage_draft.publish",
      entityType: "HomepageWorkerDraft",
      entityId: id,
      actorUsername: admin.username,
      newValue: { blocksWritten: result.blocksWritten },
    });
    await writeAdminWorkerLog(prisma, {
      category: "HOMEPAGE",
      severity: "INFO",
      eventName: "homepage_draft_published",
      message: `Homepage draft ${id} published by ${admin.username} (${result.blocksWritten} featured rail(s)).`,
      relatedEntityId: id,
      safeMetadata: { blocksWritten: result.blocksWritten },
    }).catch(() => {});
    return NextResponse.json({
      published: true,
      status: result.status,
      blocksWritten: result.blocksWritten,
    });
  }

  // discard
  const result = await discardHomepageDraft(prisma, id);
  if (!result.discarded) {
    return NextResponse.json(
      { error: result.reason ?? "not_discarded", status: result.status },
      { status: result.reason === "not_found" ? 404 : 409 },
    );
  }
  await writeAudit({
    action: "admin_worker.homepage_draft.discard",
    entityType: "HomepageWorkerDraft",
    entityId: id,
    actorUsername: admin.username,
  });
  await writeAdminWorkerLog(prisma, {
    category: "HOMEPAGE",
    severity: "INFO",
    eventName: "homepage_draft_discarded",
    message: `Homepage draft ${id} discarded by ${admin.username}.`,
    relatedEntityId: id,
  }).catch(() => {});
  return NextResponse.json({ discarded: true, status: result.status });
}
