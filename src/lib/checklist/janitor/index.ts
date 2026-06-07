/**
 * Janitor — the worker's custodial review pass.
 *
 * Walks published and built content looking for items that should be:
 *   - **edited** by the worker (low QA score, formatting drift, content
 *     shorter than expected, stale source content)
 *   - **deleted** entirely (rejected by admin, source no longer approved,
 *     duplicate of another item, schema validation broken after a schema
 *     change)
 *
 * The janitor never acts on its own — it surfaces recommendations to the
 * admin via two dashboard pages. An admin can accept a recommendation
 * (which kicks off a rebuild or an unpublish) or dismiss it.
 */

import type { PrismaClient } from "@prisma/client";

import { isApprovedAuthorityHost } from "../sources/authority-registry";
import { validatePayload } from "../schemas";
import { canonicalizeSlug, normalizeForComparison } from "../slugs";

export type JanitorAction = "edit" | "delete";

export interface JanitorFinding {
  checklistItemId: string;
  contentType: string;
  slug: string;
  title: string;
  action: JanitorAction;
  severity: "low" | "medium" | "high";
  reason: string;
  details: string[];
  recommendation: string;
  /** Last build's overall QA score, if any. */
  lastQaScore?: number;
  /** Last published version, if any. */
  publishedVersion?: number;
  /** When the published row was last updated. */
  publishedUpdatedAt?: Date;
}

const EDIT_QA_THRESHOLD = 0.7;
const STALE_DAYS = 90;

export async function scanForJanitorFindings(prisma: PrismaClient): Promise<JanitorFinding[]> {
  const findings: JanitorFinding[] = [];

  // 1. Items REJECTED by admin but still PUBLISHED → janitor recommends DELETE.
  //    (publishedContent is looked up per item below — it is not a relation on
  //    ChecklistItem, so it cannot be included here.)
  const rejectedButPublished = await prisma.checklistItem.findMany({
    where: { approvalStatus: "REJECTED" },
  });
  for (const item of rejectedButPublished) {
    const pub = await prisma.publishedContent.findUnique({
      where: { checklistItemId: item.id },
    });
    if (pub?.isPublished) {
      findings.push({
        checklistItemId: item.id,
        contentType: item.contentType,
        slug: item.canonicalSlug,
        title: item.canonicalName,
        action: "delete",
        severity: "high",
        reason: "Item is marked REJECTED but still appears on the public site.",
        details: [item.rejectedReason ?? "no reason recorded"],
        recommendation: "Unpublish this item.",
        publishedVersion: pub.version,
        publishedUpdatedAt: pub.updatedAt,
      });
    }
  }

  // 2. Published content whose latest QA score is below threshold → EDIT
  const qaWeakItems = await prisma.checklistQAReport.findMany({
    where: { overallScore: { lt: EDIT_QA_THRESHOLD } },
    orderBy: { createdAt: "desc" },
    take: 200,
    distinct: ["checklistItemId"],
    include: { checklistItem: true },
  });
  for (const report of qaWeakItems) {
    const pub = await prisma.publishedContent.findUnique({
      where: { checklistItemId: report.checklistItemId },
    });
    if (!pub?.isPublished) continue;
    findings.push({
      checklistItemId: report.checklistItemId,
      contentType: report.checklistItem.contentType,
      slug: report.checklistItem.canonicalSlug,
      title: report.checklistItem.canonicalName,
      action: "edit",
      severity: report.overallScore < 0.5 ? "high" : "medium",
      reason: `QA score ${report.overallScore.toFixed(2)} is below threshold ${EDIT_QA_THRESHOLD}.`,
      details: report.issues.slice(0, 4),
      recommendation: "Rebuild this item to improve its QA score.",
      lastQaScore: report.overallScore,
      publishedVersion: pub.version,
      publishedUpdatedAt: pub.updatedAt,
    });
  }

  // 3. Published content whose payload no longer validates against the
  //    current schema (schema drifted under an existing publication) → EDIT
  //    (checklistItem is fetched per row below — PublishedContent has only a
  //    checklistItemId scalar, not a checklistItem relation to include.)
  const allPublished = await prisma.publishedContent.findMany({
    where: { isPublished: true },
  });
  for (const pub of allPublished) {
    const validation = validatePayload(pub.contentType, pub.payload);
    if (!validation.ok) {
      const ci = await prisma.checklistItem.findUnique({
        where: { id: pub.checklistItemId },
      });
      if (!ci) continue;
      findings.push({
        checklistItemId: pub.checklistItemId,
        contentType: pub.contentType,
        slug: pub.slug,
        title: pub.title,
        action: "edit",
        severity: "high",
        reason: "Published payload no longer validates against the current schema.",
        details: validation.errors.slice(0, 4),
        recommendation: "Rebuild against the current schema.",
        publishedVersion: pub.version,
        publishedUpdatedAt: pub.updatedAt,
      });
    }
  }

  // 4. Published items with no approved citations remaining → DELETE
  for (const pub of allPublished) {
    const cits = await prisma.checklistCitation.findMany({
      where: { checklistItemId: pub.checklistItemId },
    });
    if (cits.length === 0) continue;
    const stillApproved = cits.filter((c) => isApprovedAuthorityHost(c.sourceHost));
    if (stillApproved.length === 0) {
      findings.push({
        checklistItemId: pub.checklistItemId,
        contentType: pub.contentType,
        slug: pub.slug,
        title: pub.title,
        action: "delete",
        severity: "high",
        reason: "Every citation now points to a non-approved host.",
        details: cits.map((c) => `${c.sourceHost} (no longer approved)`),
        recommendation: "Unpublish or attach a new approved citation.",
        publishedVersion: pub.version,
        publishedUpdatedAt: pub.updatedAt,
      });
    }
  }

  // 5. Stale: published more than STALE_DAYS ago and never re-built → EDIT
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  for (const pub of allPublished) {
    if (pub.updatedAt > cutoff) continue;
    if (findings.some((f) => f.checklistItemId === pub.checklistItemId && f.action === "edit"))
      continue;
    findings.push({
      checklistItemId: pub.checklistItemId,
      contentType: pub.contentType,
      slug: pub.slug,
      title: pub.title,
      action: "edit",
      severity: "low",
      reason: `Last rebuilt more than ${STALE_DAYS} days ago.`,
      details: [`updatedAt: ${pub.updatedAt.toISOString()}`],
      recommendation: "Schedule a refresh build to pick up upstream changes.",
      publishedVersion: pub.version,
      publishedUpdatedAt: pub.updatedAt,
    });
  }

  // 6. Duplicate detection across published rows → DELETE the lower-quality
  //    duplicate. Compares normalized names within the same content type.
  const seenByType: Record<string, { name: string; id: string; ts: number }[]> = {};
  for (const pub of allPublished) {
    seenByType[pub.contentType] = seenByType[pub.contentType] ?? [];
    seenByType[pub.contentType].push({
      name: normalizeForComparison(pub.title),
      id: pub.checklistItemId,
      ts: pub.updatedAt.getTime(),
    });
  }
  for (const [type, rows] of Object.entries(seenByType)) {
    const byName: Record<string, typeof rows> = {};
    for (const row of rows) {
      byName[row.name] = byName[row.name] ?? [];
      byName[row.name].push(row);
    }
    for (const dupes of Object.values(byName)) {
      if (dupes.length < 2) continue;
      const sorted = [...dupes].sort((a, b) => b.ts - a.ts);
      for (let i = 1; i < sorted.length; i++) {
        const dup = sorted[i];
        const pub = allPublished.find((p) => p.checklistItemId === dup.id);
        if (!pub) continue;
        findings.push({
          checklistItemId: dup.id,
          contentType: type,
          slug: pub.slug,
          title: pub.title,
          action: "delete",
          severity: "medium",
          reason: "Duplicate of another published item with the same normalized name.",
          details: [`Newer canonical: ${sorted[0].id}`],
          recommendation: "Unpublish this duplicate.",
          publishedVersion: pub.version,
          publishedUpdatedAt: pub.updatedAt,
        });
      }
    }
  }

  // Stable order: action then severity then slug.
  const sevOrder = { high: 0, medium: 1, low: 2 } as const;
  return findings.sort((a, b) => {
    if (a.action !== b.action) return a.action === "delete" ? -1 : 1;
    if (sevOrder[a.severity] !== sevOrder[b.severity])
      return sevOrder[a.severity] - sevOrder[b.severity];
    return canonicalizeSlug(a.slug).localeCompare(canonicalizeSlug(b.slug));
  });
}

export function filterByAction(
  findings: JanitorFinding[],
  action: JanitorAction,
): JanitorFinding[] {
  return findings.filter((f) => f.action === action);
}
