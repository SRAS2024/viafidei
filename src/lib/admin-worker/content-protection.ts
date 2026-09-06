/**
 * Published-content protection (adaptive-worker Phase E).
 *
 * The worker enriches and repairs already-published content. That is good —
 * but an autonomous system must never quietly destroy good published content.
 * This module makes every automated edit to a live PublishedContent row:
 *
 *   - CONSERVATIVE  — a change that would SHRINK or REPLACE existing non-empty
 *     content is treated as destructive and is NOT applied automatically; it is
 *     blocked and routed to a repair plan / review unless it is explicitly
 *     allowed AND backed by quality + evidence above threshold. Additive
 *     "enrich" changes (fill an empty field, extend an existing one) apply
 *     freely.
 *   - VERSIONED     — before any change, the CURRENT row is snapshotted to
 *     PublishedContentVersion and PublishedContent.version is incremented.
 *   - REVERSIBLE    — because the prior payload/title/subtitle/checksum are
 *     preserved in the snapshot, any edit can be rolled back
 *     (restorePublishedContentVersion) — the piece that the unpublish-only
 *     rollback path was missing.
 *   - EVIDENCE-BACKED — a destructive change is gated on qualityScore +
 *     evidenceCount, and the reason/quality/evidence are recorded on the
 *     version row.
 *
 * The default is enrich / repair / version — never delete or overwrite good
 * content.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

import { derivedColumnsFor } from "@/lib/content-shared/derived-columns";

import { computeContentChecksum } from "./cache-freshness";
import { writeAdminWorkerLog } from "./logs";

/** Meta keys that are not user-facing content — changes to them never count as
 * destructive (they carry provenance, e.g. which fields were machine-filled). */
const META_FIELDS = new Set(["machineTranslated", "_meta", "provenance"]);

/** Thresholds for allowing a DESTRUCTIVE (replace/shrink) automated change. */
const REPLACE_QUALITY_FLOOR = 0.8;
const REPLACE_EVIDENCE_FLOOR = 1;

export type ContentChangeKind = "noop" | "enrich" | "replace";

export interface ContentChangeAssessment {
  kind: ContentChangeKind;
  /** Fields present+non-empty before, gone/empty/shortened after (destructive). */
  shrunkFields: string[];
  /** Fields empty/absent before, non-empty after (additive). */
  addedFields: string[];
  /** Fields non-empty both, value changed but not a strict extension (destructive). */
  changedFields: string[];
  /** Fields non-empty both, after strictly extends before (additive). */
  extendedFields: string[];
  summary: string;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** True when `after` strictly contains everything in `before` (an extension). */
function isExtension(before: unknown, after: unknown): boolean {
  if (typeof before === "string" && typeof after === "string") {
    return after.length > before.length && after.includes(before);
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    if (after.length < before.length) return false;
    const afterSet = new Set(after.map((x) => JSON.stringify(x)));
    return before.every((x) => afterSet.has(JSON.stringify(x)));
  }
  return false;
}

function equalValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Pure classification of a proposed payload change relative to the current one.
 * No DB access — deterministic + unit-tested. `enrich` = only additive changes
 * (fill empties, extend fields); `replace` = at least one existing non-empty
 * content field would be removed, shortened, or replaced; `noop` = no change.
 */
export function evaluateContentChange(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
): ContentChangeAssessment {
  const shrunkFields: string[] = [];
  const addedFields: string[] = [];
  const changedFields: string[] = [];
  const extendedFields: string[] = [];

  const keys = new Set([...Object.keys(current), ...Object.keys(proposed)]);
  for (const key of keys) {
    if (META_FIELDS.has(key)) continue;
    const before = current[key];
    const after = proposed[key];
    const beforeEmpty = isEmpty(before);
    const afterEmpty = isEmpty(after);

    if (beforeEmpty && afterEmpty) continue;
    if (equalValue(before, after)) continue;

    if (beforeEmpty && !afterEmpty) {
      addedFields.push(key);
    } else if (!beforeEmpty && afterEmpty) {
      shrunkFields.push(key); // content removed → destructive
    } else if (isExtension(before, after)) {
      extendedFields.push(key);
    } else {
      changedFields.push(key); // replaced with different non-empty content
    }
  }

  const destructive = shrunkFields.length > 0 || changedFields.length > 0;
  const additive = addedFields.length > 0 || extendedFields.length > 0;
  const kind: ContentChangeKind = destructive ? "replace" : additive ? "enrich" : "noop";

  const parts: string[] = [];
  if (addedFields.length) parts.push(`+${addedFields.join(",")}`);
  if (extendedFields.length) parts.push(`extend:${extendedFields.join(",")}`);
  if (changedFields.length) parts.push(`change:${changedFields.join(",")}`);
  if (shrunkFields.length) parts.push(`shrink:${shrunkFields.join(",")}`);
  const summary = `${kind}${parts.length ? ` (${parts.join(" ")})` : ""}`;

  return { kind, shrunkFields, addedFields, changedFields, extendedFields, summary };
}

export interface SnapshotInput {
  changeSummary?: string;
  reason?: string;
  changeKind?: string;
  qualityScore?: number | null;
  evidenceCount?: number;
}

/**
 * Snapshot the CURRENT state of a published row to PublishedContentVersion and
 * bump PublishedContent.version. Call this immediately before mutating a live
 * row so the edit is reversible. Returns the created version row id (or null if
 * the row is missing / on error — fail-open).
 */
export async function snapshotPublishedContent(
  prisma: PrismaClient,
  contentId: string,
  input: SnapshotInput = {},
): Promise<string | null> {
  try {
    const row = await prisma.publishedContent.findUnique({ where: { id: contentId } });
    if (!row) return null;
    const version = await prisma.publishedContentVersion.create({
      data: {
        publishedContentId: row.id,
        contentType: row.contentType,
        slug: row.slug,
        version: row.version,
        title: row.title,
        subtitle: row.subtitle,
        payload: row.payload as Prisma.InputJsonValue,
        contentChecksum: row.contentChecksum,
        changeSummary: input.changeSummary ?? null,
        reason: input.reason ?? null,
        changeKind: input.changeKind ?? null,
        qualityScore: input.qualityScore ?? null,
        evidenceCount: input.evidenceCount ?? 0,
      },
    });
    await prisma.publishedContent
      .update({ where: { id: row.id }, data: { version: { increment: 1 } } })
      .catch(() => undefined);
    return version.id;
  } catch {
    return null;
  }
}

export interface ProtectedUpdateInput {
  contentId: string;
  proposedPayload: Record<string, unknown>;
  proposedTitle?: string;
  proposedSubtitle?: string | null;
  reason?: string;
  /** Explicitly allow a destructive (replace/shrink) change (still gated on
   * quality + evidence). Default false → destructive changes are blocked. */
  allowReplace?: boolean;
  qualityScore?: number | null;
  evidenceCount?: number;
  passId?: string;
}

export interface ProtectedUpdateResult {
  applied: boolean;
  kind: ContentChangeKind;
  /** Set when a destructive change was refused (routed to review/repair). */
  blocked?: boolean;
  reason: string;
  versionId?: string | null;
  assessment: ContentChangeAssessment;
}

/**
 * Apply a proposed change to a live published row THROUGH the protection gate:
 *   - noop     → nothing to do.
 *   - enrich   → snapshot (reversible) + apply + version bump.
 *   - replace  → only applied when explicitly allowed AND quality/evidence
 *     clear the floor; otherwise NOT applied — the good content is preserved and
 *     the attempt is logged for review/repair.
 * Never throws — a persistence blip leaves the live row untouched.
 */
export async function applyProtectedContentUpdate(
  prisma: PrismaClient,
  input: ProtectedUpdateInput,
): Promise<ProtectedUpdateResult> {
  const empty: ContentChangeAssessment = {
    kind: "noop",
    shrunkFields: [],
    addedFields: [],
    changedFields: [],
    extendedFields: [],
    summary: "noop",
  };
  let row: Awaited<ReturnType<typeof prisma.publishedContent.findUnique>> = null;
  try {
    row = await prisma.publishedContent.findUnique({ where: { id: input.contentId } });
  } catch {
    return { applied: false, kind: "noop", reason: "lookup failed", assessment: empty };
  }
  if (!row) {
    return { applied: false, kind: "noop", reason: "content not found", assessment: empty };
  }

  const current = (row.payload ?? {}) as Record<string, unknown>;
  const assessment = evaluateContentChange(current, input.proposedPayload);

  if (assessment.kind === "noop" && (input.proposedTitle ?? row.title) === row.title) {
    return { applied: false, kind: "noop", reason: "no change", assessment };
  }

  const quality = input.qualityScore ?? null;
  const evidence = input.evidenceCount ?? 0;

  if (assessment.kind === "replace") {
    const backed =
      input.allowReplace === true &&
      (quality ?? 0) >= REPLACE_QUALITY_FLOOR &&
      evidence >= REPLACE_EVIDENCE_FLOOR;
    if (!backed) {
      // Preserve the good content. Log the refused overwrite so a repair/review
      // path can pick it up rather than silently losing the change.
      await writeAdminWorkerLog(prisma, {
        passId: input.passId,
        category: "PUBLISHING",
        severity: "WARN",
        eventName: "protected_update_blocked",
        contentType: row.contentType,
        message: `Refused destructive edit to published ${row.contentType} "${row.slug}": ${assessment.summary}. Preserved current content (quality ${quality ?? "?"}, evidence ${evidence}).`,
        safeMetadata: {
          contentId: row.id,
          slug: row.slug,
          shrunkFields: assessment.shrunkFields,
          changedFields: assessment.changedFields,
          qualityScore: quality,
          evidenceCount: evidence,
          allowReplace: input.allowReplace === true,
        },
      }).catch(() => undefined);
      return {
        applied: false,
        kind: "replace",
        blocked: true,
        reason: `destructive change (${assessment.summary}) not backed by quality/evidence — content preserved`,
        assessment,
      };
    }
  }

  // Snapshot BEFORE mutating so the change is reversible, then apply.
  const versionId = await snapshotPublishedContent(prisma, row.id, {
    changeSummary: assessment.summary,
    reason: input.reason,
    changeKind: assessment.kind,
    qualityScore: quality,
    evidenceCount: evidence,
  });

  const newTitle = input.proposedTitle ?? row.title;
  try {
    await prisma.publishedContent.update({
      where: { id: row.id },
      data: {
        payload: input.proposedPayload as Prisma.InputJsonValue,
        title: newTitle,
        ...(input.proposedSubtitle !== undefined ? { subtitle: input.proposedSubtitle } : {}),
        contentChecksum: computeContentChecksum(newTitle, input.proposedPayload),
        ...derivedColumnsFor(String(row.contentType), input.proposedPayload),
      },
    });
  } catch {
    return {
      applied: false,
      kind: assessment.kind,
      reason: "update failed after snapshot",
      versionId,
      assessment,
    };
  }

  return {
    applied: true,
    kind: assessment.kind,
    reason: `applied ${assessment.summary}`,
    versionId,
    assessment,
  };
}

/**
 * Restore a prior snapshot's payload/title/subtitle onto the live row. The
 * CURRENT state is snapshotted first (as a "restore" version), so a restore is
 * itself reversible. Returns true on success.
 */
export async function restorePublishedContentVersion(
  prisma: PrismaClient,
  versionId: string,
  opts: { reason?: string; passId?: string } = {},
): Promise<boolean> {
  try {
    const version = await prisma.publishedContentVersion.findUnique({ where: { id: versionId } });
    if (!version) return false;
    // Snapshot the current state before overwriting it with the restore.
    await snapshotPublishedContent(prisma, version.publishedContentId, {
      changeSummary: `pre-restore of v${version.version}`,
      reason: opts.reason ?? "rollback",
      changeKind: "restore",
    });
    await prisma.publishedContent.update({
      where: { id: version.publishedContentId },
      data: {
        title: version.title,
        subtitle: version.subtitle,
        payload: version.payload as Prisma.InputJsonValue,
        contentChecksum:
          version.contentChecksum ?? computeContentChecksum(version.title, version.payload),
        ...derivedColumnsFor(
          String(version.contentType),
          (version.payload && typeof version.payload === "object" && !Array.isArray(version.payload)
            ? (version.payload as Record<string, unknown>)
            : null) ?? null,
        ),
      },
    });
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "content_version_restored",
      contentType: version.contentType,
      message: `Restored published ${version.contentType} "${version.slug}" to version ${version.version}.`,
      safeMetadata: { contentId: version.publishedContentId, versionId, version: version.version },
    }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** List the version history for a published item (newest first). */
export async function listContentVersions(prisma: PrismaClient, contentId: string) {
  return prisma.publishedContentVersion
    .findMany({
      where: { publishedContentId: contentId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    .catch(() => []);
}
