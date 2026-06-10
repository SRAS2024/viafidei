/**
 * Google Maps parish discovery runner: discover → verify communion → publish.
 *
 * Pipeline per pass (all gated on GOOGLE_PLACES_API_KEY being configured):
 *   1. Build a small set of locality queries — from PARISH_DISCOVERY_LOCATIONS
 *      if the operator set it, otherwise derived from the cities/states of the
 *      parishes already in the catalog (so the directory grows around what it
 *      already covers). Capped per pass to bound API usage.
 *   2. Text-search Google Maps for Catholic churches in each locality.
 *   3. For each new candidate, read its own website and assess whether it is a
 *      Roman Catholic parish in communion with Rome (communion-verifier):
 *        - in-communion  → publish through the real orchestrator (brain active),
 *          or route to review when the brain is degraded.
 *        - not-in-communion → rejected, never published (Old Catholic, PNCC,
 *          sedevacantist, Orthodox/Anglican, women's ordination, …).
 *        - unknown → routed to human review with the signals found.
 *
 * Candidates with no website, no address, or no city can't be verified or
 * rendered, so they are routed to review rather than published on a guess.
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import { isDoctrinallySensitive } from "./content-type-profiles";
import { runPublishOrchestrator } from "./publish-orchestrator";
import { placesEnabled, searchCatholicParishes, type PlaceParish } from "./parish-places";
import { verifyParishCommunion, type CommunionVerdict } from "./communion-verifier";
import { writeAdminWorkerLog } from "./logs";

export interface MapsParishDiscoveryResult {
  enabled: boolean;
  queriesRun: number;
  candidates: number;
  published: number;
  routedToReview: number;
  rejected: number;
  detail: string;
}

interface RunOptions {
  brainActive: boolean;
  /** Max locality queries per pass (bounds Places API cost). Default 3. */
  maxQueries?: number;
  /** Max parishes published per pass. Default 10. */
  maxPublishPerPass?: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function designationFor(name: string): "parish" | "shrine" | "cathedral" | "minor-basilica" {
  if (/\bbasilica\b/i.test(name)) return "minor-basilica";
  if (/\bcathedral\b/i.test(name)) return "cathedral";
  if (/\bshrine\b/i.test(name)) return "shrine";
  return "parish";
}

/** Build the locality queries for this pass. */
async function buildQueries(prisma: PrismaClient, maxQueries: number): Promise<string[]> {
  const configured = (process.env.PARISH_DISCOVERY_LOCATIONS ?? "")
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length > 0) {
    return configured.slice(0, maxQueries).map((loc) => `Catholic churches in ${loc}`);
  }

  // Derive seeds from the localities already in the catalog.
  const rows = await prisma.publishedContent
    .findMany({
      where: { contentType: "PARISH" as never, isPublished: true },
      select: { payload: true },
      take: 500,
    })
    .catch(() => [] as Array<{ payload: unknown }>);
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const city = typeof p.city === "string" ? p.city : "";
    const state = typeof p.state === "string" ? p.state : "";
    const country = typeof p.country === "string" ? p.country : "";
    const loc = [city, state || country].filter(Boolean).join(", ");
    if (!loc || seen.has(loc.toLowerCase())) continue;
    seen.add(loc.toLowerCase());
    queries.push(`Catholic churches in ${loc}`);
    if (queries.length >= maxQueries) break;
  }
  return queries;
}

async function fileReview(
  prisma: PrismaClient,
  candidate: PlaceParish,
  slug: string,
  verdict: CommunionVerdict,
  note: string,
): Promise<boolean> {
  const existing = await prisma.humanReviewQueue
    .findFirst({
      where: { status: "PENDING", proposedAction: "PUBLISH_PARISH", contentTitle: slug },
      select: { id: true },
    })
    .catch(() => null);
  if (existing) return false;
  await prisma.humanReviewQueue
    .create({
      data: {
        contentType: "PARISH",
        contentTitle: slug,
        proposedAction: "PUBLISH_PARISH",
        reason: `${note} — "${candidate.name}" (${candidate.formattedAddress || "address unknown"}). ${verdict.reason}`,
        confidence: verdict.confidence,
        sourceEvidence: {
          name: candidate.name,
          address: candidate.formattedAddress,
          website: candidate.website ?? null,
          placeId: candidate.placeId,
          mapsUri: candidate.mapsUri ?? null,
          communion: {
            status: verdict.status,
            positive: verdict.signals.positive,
            negative: verdict.signals.negative,
            review: verdict.signals.review,
          },
        } as never,
        status: "PENDING",
      },
    })
    .catch(() => undefined);
  return true;
}

async function publishParish(
  prisma: PrismaClient,
  candidate: PlaceParish,
  slug: string,
  verdict: CommunionVerdict,
): Promise<boolean> {
  const city = candidate.city ?? "";
  const citations = [candidate.mapsUri, candidate.website].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  const payload: Record<string, unknown> = {
    slug,
    title: candidate.name,
    designation: designationFor(candidate.name),
    address: candidate.formattedAddress,
    city,
    summary: `${candidate.name} is a Roman Catholic ${designationFor(candidate.name).replace("-", " ")} in ${city}, in communion with the Holy See (verified from the parish website).`,
    citations,
  };
  if (candidate.state) payload.state = candidate.state;
  if (candidate.country) payload.country = candidate.country;
  if (candidate.website) payload.website = candidate.website;
  if (typeof candidate.latitude === "number") payload.latitude = candidate.latitude;
  if (typeof candidate.longitude === "number") payload.longitude = candidate.longitude;

  // Must satisfy the strict parish schema before we touch the orchestrator.
  if (!validatePayload("PARISH", payload).ok) return false;

  const item = await prisma.checklistItem
    .findFirst({
      where: { contentType: "PARISH" as never, canonicalSlug: slug },
      select: { id: true },
    })
    .catch(() => null);
  const checklistItem =
    item ??
    (await prisma.checklistItem
      .create({
        data: {
          contentType: "PARISH" as never,
          canonicalName: candidate.name,
          canonicalSlug: slug,
          approvalStatus: "APPROVED_FOR_BUILD",
        },
        select: { id: true },
      })
      .catch(() => null));
  if (!checklistItem) return false;

  const result = await runPublishOrchestrator(prisma, {
    contentType: "PARISH",
    contentId: checklistItem.id,
    title: candidate.name,
    slug,
    payload: payload as never,
    authorityLevel: "TRUSTED_PUBLISHER",
    finalScore: 0.9,
    qaPassed: true,
    hasSourceEvidence: citations.length > 0,
    isDoctrinallySensitive: isDoctrinallySensitive("PARISH"),
    confidence: verdict.confidence,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: [],
      evidence: [],
      hasConflict: false,
      summary: `Found via Google Maps; communion with Rome verified from the parish website (${verdict.reason}).`,
    },
  }).catch(() => null);

  return result?.kind === "published";
}

export async function runMapsParishDiscovery(
  prisma: PrismaClient,
  opts: RunOptions,
): Promise<MapsParishDiscoveryResult> {
  const base: MapsParishDiscoveryResult = {
    enabled: placesEnabled(),
    queriesRun: 0,
    candidates: 0,
    published: 0,
    routedToReview: 0,
    rejected: 0,
    detail: "",
  };
  if (!base.enabled) {
    base.detail = "Google Maps parish discovery is not configured (set GOOGLE_PLACES_API_KEY).";
    return base;
  }

  const maxQueries = opts.maxQueries ?? 3;
  const maxPublish = opts.maxPublishPerPass ?? 10;
  const queries = await buildQueries(prisma, maxQueries);

  for (const query of queries) {
    const candidates = await searchCatholicParishes(query);
    base.queriesRun += 1;
    for (const candidate of candidates) {
      base.candidates += 1;
      const city = candidate.city ?? "";
      const slug = slugify(`${candidate.name} ${city}`);
      if (!slug) continue;

      // De-dupe against the catalog.
      const exists = await prisma.publishedContent
        .findFirst({
          where: { contentType: "PARISH" as never, slug },
          select: { id: true },
        })
        .catch(() => null);
      if (exists) continue;

      // Can't render or can't verify → human review, never a blind publish.
      if (!candidate.website || !candidate.formattedAddress || !city) {
        const verdict: CommunionVerdict = {
          status: "unknown",
          confidence: 0,
          signals: { positive: [], negative: [], review: [] },
          reason: !candidate.website
            ? "No website to verify communion with Rome."
            : "Missing address or city.",
        };
        if (await fileReview(prisma, candidate, slug, verdict, "Verify parish before publishing"))
          base.routedToReview += 1;
        continue;
      }

      const verdict = await verifyParishCommunion(candidate.website);
      if (verdict.status === "not-in-communion") {
        base.rejected += 1;
        await writeAdminWorkerLog(prisma, {
          category: "PUBLISHING",
          severity: "INFO",
          eventName: "parish_rejected_not_in_communion",
          message: `Rejected "${candidate.name}" (${city}): ${verdict.reason}`,
          contentType: "PARISH",
        }).catch(() => undefined);
        continue;
      }

      if (verdict.status === "in-communion" && opts.brainActive && base.published < maxPublish) {
        if (await publishParish(prisma, candidate, slug, verdict)) {
          base.published += 1;
          continue;
        }
        // Publish failed (schema/orchestrator) → fall through to review.
      }

      if (
        await fileReview(
          prisma,
          candidate,
          slug,
          verdict,
          verdict.status === "in-communion"
            ? "Confirm and publish parish (in communion with Rome)"
            : "Verify parish communion with Rome before publishing",
        )
      )
        base.routedToReview += 1;
    }
  }

  base.detail = `${base.candidates} candidate(s) over ${base.queriesRun} query(ies): published ${base.published}, ${base.routedToReview} to review, ${base.rejected} rejected (not in communion with Rome)`;
  return base;
}
