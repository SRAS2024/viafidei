/**
 * "Why is this content not visible?" diagnostics.
 *
 * Joins every non-public content row to the latest
 * ContentPackageBuildLog entry for the same source URL plus the last
 * RejectedContentLog row (when one exists) and surfaces:
 *
 *   - Content type / title / source URL / source host
 *   - Status / publicRenderReady / isThresholdEligible
 *   - packageValidationStatus / packageValidationErrors
 *   - Failed contract / missing fields (from build log)
 *   - Last build attempt + outcome (build log)
 *   - Last QA run / rejection reason (rejected log)
 *   - Source purpose permissions (from IngestionSource flags)
 *   - Suggested automatic next action
 *
 * Supports filtering by:
 *   missing_source / missing_required_fields / source_not_approved /
 *   build_failed / qa_failed / deleted / duplicate /
 *   waiting_for_worker / waiting_for_cleanup
 */

import { prisma } from "../db/client";

export type WhyNotVisibleFilter =
  | "missing_source"
  | "missing_required_fields"
  | "source_not_approved"
  | "build_failed"
  | "qa_failed"
  | "deleted"
  | "duplicate"
  | "waiting_for_worker"
  | "waiting_for_cleanup"
  | "all";

export type WhyNotVisibleRow = {
  contentType: string;
  contentId: string;
  slug: string;
  title: string;
  sourceUrl: string | null;
  sourceHost: string | null;
  status: string;
  publicRenderReady: boolean;
  isThresholdEligible: boolean;
  packageValidationStatus: string | null;
  packageValidationErrors: string[];
  failedContract: string | null;
  missingFields: string[];
  lastBuildAttempt: Date | null;
  lastBuildOutcome: string | null;
  lastQaRun: Date | null;
  lastQaReason: string | null;
  sourcePurposes: Record<string, boolean> | null;
  suggestedNextAction: string;
};

const TYPE_QUERIES: Array<{ contentType: string; model: string }> = [
  { contentType: "Prayer", model: "prayer" },
  { contentType: "Saint", model: "saint" },
  { contentType: "MarianApparition", model: "marianApparition" },
  { contentType: "Parish", model: "parish" },
  { contentType: "Devotion", model: "devotion" },
  { contentType: "LiturgyEntry", model: "liturgyEntry" },
  { contentType: "SpiritualLifeGuide", model: "spiritualLifeGuide" },
];

export async function listNonPublicRows(args: {
  filter?: WhyNotVisibleFilter;
  limit?: number;
}): Promise<WhyNotVisibleRow[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  const filter = args.filter ?? "all";

  const baseWhere: Record<string, unknown> =
    filter === "deleted"
      ? { NOT: { archivedAt: null } }
      : {
          OR: [
            { status: { not: "PUBLISHED" } },
            { publicRenderReady: false },
            { isThresholdEligible: false },
          ],
        };

  const rows: Array<{
    contentType: string;
    id: string;
    slug: string;
    title: string;
    sourceUrl: string | null;
    sourceHost: string | null;
    status: string;
    publicRenderReady: boolean;
    isThresholdEligible: boolean;
    packageValidationStatus: string | null;
    packageValidationErrors: string[];
    archivedAt: Date | null;
    updatedAt: Date;
  }> = [];

  for (const q of TYPE_QUERIES) {
    const model = (prisma as unknown as Record<string, { findMany: Function }>)[q.model];
    if (!model) continue;
    const matches = await model.findMany({
      where: baseWhere,
      take: limit,
      orderBy: { updatedAt: "desc" },
    });
    for (const m of matches as Array<{
      id: string;
      slug: string;
      defaultTitle?: string;
      canonicalName?: string;
      title?: string;
      name?: string;
      sourceUrl: string | null;
      sourceHost: string | null;
      status: string;
      publicRenderReady: boolean;
      isThresholdEligible: boolean;
      packageValidationStatus: string | null;
      packageValidationErrors: string[];
      archivedAt: Date | null;
      updatedAt: Date;
    }>) {
      rows.push({
        contentType: q.contentType,
        id: m.id,
        slug: m.slug,
        title: m.defaultTitle ?? m.canonicalName ?? m.title ?? m.name ?? m.slug,
        sourceUrl: m.sourceUrl,
        sourceHost: m.sourceHost,
        status: m.status,
        publicRenderReady: m.publicRenderReady,
        isThresholdEligible: m.isThresholdEligible,
        packageValidationStatus: m.packageValidationStatus,
        packageValidationErrors: m.packageValidationErrors,
        archivedAt: m.archivedAt,
        updatedAt: m.updatedAt,
      });
    }
  }

  // Join with build logs + rejected logs + source purposes by sourceUrl/host.
  const sourceUrls = Array.from(new Set(rows.map((r) => r.sourceUrl).filter(Boolean) as string[]));
  const sourceHosts = Array.from(
    new Set(rows.map((r) => r.sourceHost).filter(Boolean) as string[]),
  );

  const [buildLogs, rejectedLogs, sources] = await Promise.all([
    sourceUrls.length > 0
      ? prisma.contentPackageBuildLog.findMany({
          where: { sourceUrl: { in: sourceUrls } },
          orderBy: { createdAt: "desc" },
          take: 1000,
        })
      : Promise.resolve([]),
    sourceUrls.length > 0
      ? prisma.rejectedContentLog.findMany({
          where: { sourceUrl: { in: sourceUrls } },
          orderBy: { deletedAt: "desc" },
          take: 1000,
        })
      : Promise.resolve([]),
    sourceHosts.length > 0
      ? prisma.ingestionSource.findMany({ where: { host: { in: sourceHosts } } })
      : Promise.resolve([]),
  ]);
  const latestBuildLogByUrl = new Map<string, (typeof buildLogs)[number]>();
  for (const b of buildLogs) {
    if (!latestBuildLogByUrl.has(b.sourceUrl)) latestBuildLogByUrl.set(b.sourceUrl, b);
  }
  const latestRejectByUrl = new Map<string, (typeof rejectedLogs)[number]>();
  for (const r of rejectedLogs) {
    if (r.sourceUrl && !latestRejectByUrl.has(r.sourceUrl)) latestRejectByUrl.set(r.sourceUrl, r);
  }
  const sourcePurposesByHost = new Map<string, Record<string, boolean>>();
  for (const s of sources) {
    sourcePurposesByHost.set(s.host, {
      canIngestPrayers: s.canIngestPrayers,
      canIngestSaints: s.canIngestSaints,
      canIngestApparitions: s.canIngestApparitions,
      canIngestParishes: s.canIngestParishes,
      canIngestDevotions: s.canIngestDevotions,
      canIngestNovenas: s.canIngestNovenas,
      canIngestSacraments: s.canIngestSacraments,
      canIngestRosaryGuides: s.canIngestRosaryGuides,
      canIngestConsecrations: s.canIngestConsecrations,
      canIngestSpiritualGuides: s.canIngestSpiritualGuides,
      canIngestLiturgy: s.canIngestLiturgy,
      canIngestHistory: s.canIngestHistory,
      canProvideScriptureText: s.canProvideScriptureText,
    });
  }

  const out: WhyNotVisibleRow[] = rows.map((r) => {
    const build = r.sourceUrl ? latestBuildLogByUrl.get(r.sourceUrl) : undefined;
    const rejection = r.sourceUrl ? latestRejectByUrl.get(r.sourceUrl) : undefined;
    const purposes = r.sourceHost ? (sourcePurposesByHost.get(r.sourceHost) ?? null) : null;
    const missingFields = Array.isArray(build?.missingFieldsJson)
      ? (build!.missingFieldsJson as string[])
      : r.packageValidationErrors;
    const failedContract = rejection?.failedContractName ?? null;
    const suggestedNextAction = suggestNextAction({
      status: r.status,
      publicRenderReady: r.publicRenderReady,
      isThresholdEligible: r.isThresholdEligible,
      packageValidationStatus: r.packageValidationStatus,
      buildOutcome: build?.buildStatus,
      missingFields,
      hasSource: Boolean(r.sourceUrl),
      sourceApproved: r.sourceHost ? Object.values(purposes ?? {}).some((v) => v === true) : false,
      archivedAt: r.archivedAt,
    });
    return {
      contentType: r.contentType,
      contentId: r.id,
      slug: r.slug,
      title: r.title,
      sourceUrl: r.sourceUrl,
      sourceHost: r.sourceHost,
      status: r.status,
      publicRenderReady: r.publicRenderReady,
      isThresholdEligible: r.isThresholdEligible,
      packageValidationStatus: r.packageValidationStatus,
      packageValidationErrors: r.packageValidationErrors,
      failedContract,
      missingFields,
      lastBuildAttempt: build?.createdAt ?? null,
      lastBuildOutcome: build?.buildStatus ?? null,
      lastQaRun: rejection?.deletedAt ?? null,
      lastQaReason: rejection?.rejectionReason ?? null,
      sourcePurposes: purposes,
      suggestedNextAction,
    };
  });

  return applyFilter(out, filter).slice(0, limit);
}

function applyFilter(rows: WhyNotVisibleRow[], filter: WhyNotVisibleFilter): WhyNotVisibleRow[] {
  if (filter === "all") return rows;
  return rows.filter((r) => {
    switch (filter) {
      case "missing_source":
        return !r.sourceUrl;
      case "missing_required_fields":
        return r.missingFields.length > 0;
      case "source_not_approved":
        return r.sourcePurposes ? !Object.values(r.sourcePurposes).some((v) => v === true) : false;
      case "build_failed":
        return (
          r.lastBuildOutcome !== null &&
          r.lastBuildOutcome !== "built_complete_package" &&
          r.lastBuildOutcome !== "duplicate"
        );
      case "qa_failed":
        return r.lastQaReason !== null;
      case "deleted":
        return r.status === "ARCHIVED";
      case "duplicate":
        return r.lastBuildOutcome === "duplicate";
      case "waiting_for_worker":
        return r.lastBuildAttempt === null && Boolean(r.sourceUrl);
      case "waiting_for_cleanup":
        return r.packageValidationStatus !== null && r.packageValidationStatus !== "valid";
      default:
        return true;
    }
  });
}

function suggestNextAction(args: {
  status: string;
  publicRenderReady: boolean;
  isThresholdEligible: boolean;
  packageValidationStatus: string | null;
  buildOutcome: string | undefined;
  missingFields: string[];
  hasSource: boolean;
  sourceApproved: boolean;
  archivedAt: Date | null;
}): string {
  if (args.archivedAt) return "Archived — schedule archive-cleanup or restore via admin";
  if (!args.hasSource) return "Manually add source URL or remove the row";
  if (!args.sourceApproved) return "Approve a source-purpose flag for the host or change source";
  if (args.buildOutcome && args.buildOutcome !== "built_complete_package") {
    if (args.missingFields.length > 0)
      return `Refetch source — builder missed: ${args.missingFields.slice(0, 5).join(", ")}`;
    return `Investigate builder failure (${args.buildOutcome})`;
  }
  if (args.packageValidationStatus && args.packageValidationStatus !== "valid") {
    return "Re-run strict QA — last validation failed";
  }
  if (!args.publicRenderReady) return "Re-run render gate — publicRenderReady=false";
  if (!args.isThresholdEligible) return "Re-run threshold gate — isThresholdEligible=false";
  if (args.status !== "PUBLISHED")
    return `Promote row from ${args.status} to PUBLISHED via factory rebuild`;
  return "No automatic action — admin review needed";
}
