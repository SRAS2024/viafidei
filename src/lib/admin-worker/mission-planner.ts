/**
 * AdminWorkerMissionPlanner (spec §3, §4). Converts site goals into
 * concrete work along the full content chain. When the queue is empty
 * the planner still emits a task — for source discovery, source
 * reading, classification, package building, etc. — so the worker
 * never stalls.
 *
 * Pipeline (spec §4):
 *   Discovery → Candidate → Fetch → Read → Classify → Checklist
 *   → Citation → Build → Package → Validate → QA → Publish
 *   → Post-publish → Search → Sitemap → Cache
 *
 * The mission planner inspects which stage is the choke point for the
 * largest content gap and emits the corresponding task. Items are
 * advanced by writing AdminWorkerPipelineStage rows that the loop can
 * audit and resume.
 */

import type { AdminWorkerTaskType, ChecklistContentType, PrismaClient } from "@prisma/client";

import { nextPriorityContentType, refreshContentGoals } from "./content-goals";

export type MissionStage =
  | "DISCOVERY"
  | "FETCH_READ"
  | "CLASSIFY"
  | "CHECKLIST"
  | "CITATION"
  | "BUILD"
  | "VALIDATE_QA"
  | "PUBLISH"
  | "POST_PUBLISH"
  | "MAINTENANCE";

export interface MissionPlan {
  stage: MissionStage;
  contentType: ChecklistContentType | null;
  taskType: AdminWorkerTaskType;
  reason: string;
  expectedResult: string;
  confidence: number;
  /** Concrete next step description for the audit view. */
  nextStep: string;
}

/**
 * Walk the pipeline from left (discovery) to right (cache) and stop
 * at the first stage that needs work for the highest-priority content
 * gap. Returns a MAINTENANCE plan when every stage is already at
 * target.
 */
export async function planMission(prisma: PrismaClient): Promise<MissionPlan> {
  await refreshContentGoals(prisma);
  const nextGoal = await nextPriorityContentType(prisma);
  const contentType = (nextGoal?.contentType as ChecklistContentType | undefined) ?? null;

  if (!nextGoal || nextGoal.gap <= 0) {
    return {
      stage: "MAINTENANCE",
      contentType: null,
      taskType: "CLEANUP",
      reason: "All content goals met.",
      expectedResult: "Cleanup pass; no growth work needed.",
      confidence: 0.5,
      nextStep: "Run cleanup pass; goals satisfied.",
    };
  }

  // 1. DISCOVERY: no candidate URLs at all for this type.
  const candidateCount = await prisma.candidateSourceUrl.count({
    where: {
      OR: [{ predictedContentType: contentType ?? undefined }, { predictedContentType: null }],
      status: { in: ["DISCOVERED", "PRIORITIZED"] },
    },
  });
  if (candidateCount === 0) {
    return {
      stage: "DISCOVERY",
      contentType,
      taskType: "DISCOVER_SOURCE",
      reason: `No candidate URLs available for ${contentType ?? "any content type"}.`,
      expectedResult: "Sitemap / RSS / configured-URL discovery surfaces fresh candidates.",
      confidence: 0.75,
      nextStep:
        "Run web-navigator: sitemap + RSS + configured + internal-link + directory discovery.",
    };
  }

  // 2. FETCH/READ: candidates exist but no source-reads recorded.
  const sourceReadCount = await prisma.adminWorkerSourceRead.count();
  if (sourceReadCount === 0) {
    return {
      stage: "FETCH_READ",
      contentType,
      taskType: "READ_SOURCE",
      reason: `${candidateCount} candidates exist but no source-reads recorded yet.`,
      expectedResult: "Source reader fetches + extracts text; writes AdminWorkerSourceRead rows.",
      confidence: 0.8,
      nextStep: "Lease the highest-priority candidate, fetch its body, run stripJunk + extract.",
    };
  }

  // 3. CLASSIFY: source reads exist but no detected content type set.
  const unclassifiedReads = await prisma.adminWorkerSourceRead.count({
    where: { detectedContentType: null },
  });
  if (unclassifiedReads > 0) {
    return {
      stage: "CLASSIFY",
      contentType,
      taskType: "READ_SOURCE",
      reason: `${unclassifiedReads} source-reads have no detected content type.`,
      expectedResult: "Classifier assigns a content type + confidence to each unread row.",
      confidence: 0.8,
      nextStep: "Run classifier on each unclassified read; update detectedContentType.",
    };
  }

  // 4. CHECKLIST: classified reads exist but no checklist items for this type.
  const itemsForType = contentType
    ? await prisma.checklistItem.count({ where: { contentType } })
    : 0;
  if (contentType && itemsForType === 0) {
    return {
      stage: "CHECKLIST",
      contentType,
      taskType: "DISCOVER_SOURCE",
      reason: `No ChecklistItem rows exist for ${contentType}.`,
      expectedResult: "Promote classified reads into checklist items.",
      confidence: 0.7,
      nextStep: "Create checklist items from high-confidence classified reads.",
    };
  }

  // 5. CITATION: checklist items exist but lack citations.
  const itemsWithoutCitations = contentType
    ? await prisma.checklistItem.count({
        where: { contentType, citations: { none: {} } },
      })
    : 0;
  if (itemsWithoutCitations > 0) {
    return {
      stage: "CITATION",
      contentType,
      taskType: "DISCOVER_SOURCE",
      reason: `${itemsWithoutCitations} ${contentType} items have no citations.`,
      expectedResult: "Attach approved-source citations to bare checklist items.",
      confidence: 0.7,
      nextStep:
        "Map each ChecklistItem to its strongest source-read; create ChecklistCitation rows.",
    };
  }

  // 6. BUILD: ready items without a pending build job.
  const readyForBuild = contentType
    ? await prisma.checklistItem.count({
        where: {
          contentType,
          approvalStatus: { in: ["SOURCE_VERIFIED", "APPROVED_FOR_BUILD"] },
          buildJobs: { none: { status: { in: ["pending", "running"] } } },
        },
      })
    : 0;
  if (readyForBuild > 0) {
    return {
      stage: "BUILD",
      contentType,
      taskType: "BUILD_CONTENT",
      reason: `${readyForBuild} ${contentType} items ready to build.`,
      expectedResult: "Enqueue build jobs and run them through the existing build engine.",
      confidence: 0.9,
      nextStep: "Enqueue build jobs (planAndEnqueue) and call runOneBuildCycle.",
    };
  }

  // 7. VALIDATE/QA: builds done but unreviewed QA reports waiting.
  const pendingQA = await prisma.checklistQAReport.count({
    where: { needsHumanReview: true, reviewedAt: null },
  });
  if (pendingQA > 0) {
    return {
      stage: "VALIDATE_QA",
      contentType,
      taskType: "VALIDATE_CONTENT",
      reason: `${pendingQA} QA reports waiting on review.`,
      expectedResult: "Run cross-source verification + strict QA; promote passing items.",
      confidence: 0.75,
      nextStep:
        "Re-run packaging validators + verify scripture / feast day / approval / Rosary / Novena structure.",
    };
  }

  // 8. POST_PUBLISH: published items without recent verification.
  const publishedCount = await prisma.publishedContent.count({ where: { isPublished: true } });
  const verifiedContentIds = await prisma.postPublishVerification.findMany({
    select: { contentId: true },
    distinct: ["contentId"],
  });
  const unverified = publishedCount - verifiedContentIds.length;
  if (unverified > 0) {
    return {
      stage: "POST_PUBLISH",
      contentType,
      taskType: "POST_PUBLISH_VERIFY",
      reason: `${unverified} published items missing post-publish verification.`,
      expectedResult: "Probe public URL + check title, body, search, sitemap, cache.",
      confidence: 0.8,
      nextStep: "Run post-publish probe + write PostPublishVerification rows.",
    };
  }

  // 9. Otherwise: build is in motion + post-publish covered → maintenance.
  return {
    stage: "MAINTENANCE",
    contentType,
    taskType: "CLEANUP",
    reason: "Pipeline is in motion; running maintenance pass.",
    expectedResult: "Cleanup stale candidates + closed reviews.",
    confidence: 0.5,
    nextStep: "Run cleanup pass; recheck on next loop.",
  };
}
