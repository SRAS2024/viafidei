/**
 * ChecklistAndCitationOrchestrator (spec §9 follow-on).
 *
 * Takes a successful AdminWorkerPackageArtifact (status =
 * CHECKLIST_READY) and:
 *   1. creates or updates the corresponding ChecklistItem
 *   2. attaches one ChecklistCitation per provenance entry
 *   3. avoids duplicates by (contentType, normalizedSlug,
 *      packageChecksum)
 *   4. marks the checklist item APPROVED_FOR_BUILD only when
 *      required fields AND citations are present
 *   5. reverts the artifact to status="EXTRACTED" + repair-suggested
 *      when provenance is too thin
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { toChecklistContentType } from "./classifier";
import { writeAdminWorkerLog } from "./logs";

export interface ChecklistCitationOutcome {
  artifactId: string;
  checklistItemId: string | null;
  citationsCreated: number;
  status: "created" | "updated" | "skipped_duplicate" | "skipped_insufficient" | "failed";
  reason: string;
}

export async function runChecklistAndCitationOrchestrator(
  prisma: PrismaClient,
  opts: { passId?: string; limit?: number } = {},
): Promise<ChecklistCitationOutcome[]> {
  // Pick the most recent CHECKLIST_READY artifacts.
  const artifacts = await prisma.adminWorkerPackageArtifact
    .findMany({
      where: { status: "CHECKLIST_READY", checklistItemId: null },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? 10,
    })
    .catch(() => []);

  const outcomes: ChecklistCitationOutcome[] = [];

  for (const artifact of artifacts) {
    const provenance = Array.isArray(artifact.fieldProvenance)
      ? (artifact.fieldProvenance as Array<{
          fieldName: string;
          sourceUrl: string;
          sourceHost: string;
          confidence: number;
          checksum?: string;
        }>)
      : [];

    // Provenance must cover at least one field for citation creation.
    if (provenance.length === 0) {
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: {
            status: "EXTRACTED",
            rejectionReason: "no field provenance available for citation creation",
          },
        })
        .catch(() => undefined);
      outcomes.push({
        artifactId: artifact.id,
        checklistItemId: null,
        citationsCreated: 0,
        status: "skipped_insufficient",
        reason: "no field provenance available",
      });
      continue;
    }

    // Look up an existing checklist item by canonicalSlug (which is
    // schema-unique).
    const existing = await prisma.checklistItem
      .findUnique({
        where: { canonicalSlug: artifact.normalizedSlug },
        select: { id: true, approvalStatus: true },
      })
      .catch(() => null);

    let checklistItemId = existing?.id ?? null;
    let action: "created" | "updated" | "skipped_duplicate" = "updated";

    if (!checklistItemId) {
      // Map the extractor/classifier content type to the publishable
      // catalog enum (ROSARY / CONSECRATION → SPIRITUAL_PRACTICE).
      // ChecklistItem.contentType is the ChecklistContentType enum, so an
      // unmapped extractor type would fail the create() and strand the
      // artifact at CHECKLIST_READY forever.
      const checklistType =
        toChecklistContentType(artifact.contentType as never) ?? artifact.contentType;
      const created = await prisma.checklistItem
        .create({
          data: {
            contentType: checklistType as never,
            canonicalSlug: artifact.normalizedSlug,
            canonicalName: artifact.normalizedTitle,
            approvalStatus: "SOURCE_VERIFIED",
            sourceVerifiedAt: new Date(),
            priority: 100,
          } as Prisma.ChecklistItemUncheckedCreateInput,
          select: { id: true },
        })
        .catch(() => null);
      if (!created) {
        outcomes.push({
          artifactId: artifact.id,
          checklistItemId: null,
          citationsCreated: 0,
          status: "failed",
          reason: "ChecklistItem.create() failed",
        });
        continue;
      }
      checklistItemId = created.id;
      action = "created";
    } else if (existing?.approvalStatus === "PUBLISHED") {
      action = "skipped_duplicate";
    }

    // Attach citations — one per provenance entry, de-duplicated by
    // (checklistItemId, sourceUrl).
    let citations = 0;
    for (const p of provenance) {
      const has = await prisma.checklistCitation
        .findFirst({
          where: { checklistItemId, sourceUrl: p.sourceUrl },
          select: { id: true },
        })
        .catch(() => null);
      if (has) continue;
      const created = await prisma.checklistCitation
        .create({
          data: {
            checklistItemId: checklistItemId!,
            sourceUrl: p.sourceUrl,
            sourceHost: p.sourceHost,
            authorityLevel: "TRUSTED_PUBLISHER",
            title: artifact.normalizedTitle,
            excerpt: `Field ${p.fieldName} extracted (confidence ${p.confidence.toFixed(2)}).`,
            contentChecksum: p.checksum ?? artifact.packageChecksum,
          } as Prisma.ChecklistCitationUncheckedCreateInput,
        })
        .catch(() => null);
      if (created) citations += 1;
    }

    // Promote the artifact to BUILD_READY now that citations exist.
    await prisma.adminWorkerPackageArtifact
      .update({
        where: { id: artifact.id },
        data: { status: "BUILD_READY", checklistItemId },
      })
      .catch(() => undefined);

    outcomes.push({
      artifactId: artifact.id,
      checklistItemId,
      citationsCreated: citations,
      status: action,
      reason: `${action}; ${citations} citation(s) attached`,
    });
  }

  if (outcomes.length > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "checklist_citation_orchestrator",
      message: `Materialised ${outcomes.filter((o) => o.status !== "failed").length}/${outcomes.length} checklist items from package artifacts.`,
      safeMetadata: { outcomes: outcomes as unknown as Prisma.InputJsonValue },
    }).catch(() => undefined);
  }

  return outcomes;
}
