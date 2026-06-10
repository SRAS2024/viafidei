/**
 * Capability coverage matrix — the honest answer to "what can the worker
 * actually do right now?". Derived from the certified-skill registry + the
 * content catalog + recent ledger stats. Types backed by a certified extractor
 * are CERTIFIED; the rest are MISSING (and a developer request is filed). The
 * dashboard and Developer Audit read this; nothing here claims a capability the
 * registry cannot back.
 */

import type { PrismaClient } from "@prisma/client";

import { CONTENT_TYPE_CATALOG } from "./catalog";
import { getSkill, listSkills } from "./registry";
import { ensureSkillsRegistered } from "./bootstrap";
import type { CertifiedSkill, CoverageStatus, SkillContext, SkillRunResult } from "./types";

export interface CapabilityRow {
  capability: string;
  category: string;
  contentType: string | null;
  contentSubtype: string | null;
  coverageStatus: CoverageStatus;
  certifiedSkillName: string | null;
  rollbackAvailable: boolean;
  humanReviewRequired: boolean;
  missingReason: string | null;
}

/** Build the intended capability rows from the registry + catalog (pure). */
export function buildCapabilityRows(): CapabilityRow[] {
  ensureSkillsRegistered();
  const rows: CapabilityRow[] = [];

  // Per content type: end-to-end build capability, anchored on extraction.
  for (const c of CONTENT_TYPE_CATALOG) {
    const extractSkill = getSkill(`extract_${c.type.toLowerCase()}`);
    let status: CoverageStatus;
    let missingReason: string | null = null;
    if (c.extractable == null || !extractSkill) {
      status = "MISSING";
      missingReason = `no certified extractor for ${c.type}`;
    } else if (c.sensitive) {
      // Sensitive types can be built but publishing is proof-gated + may need review.
      status = "REQUIRES_HUMAN_REVIEW";
    } else {
      status = "CERTIFIED";
    }
    rows.push({
      capability: `build:${c.type}`,
      category: "EXTRACTION",
      contentType: c.type,
      contentSubtype: null,
      coverageStatus: status,
      certifiedSkillName: extractSkill?.name ?? null,
      rollbackAvailable: extractSkill?.rollback != null,
      humanReviewRequired: c.sensitive,
      missingReason,
    });

    // Each declared subtype is covered when its parent extractor declares it.
    for (const sub of c.subtypes) {
      const covered = extractSkill?.contentSubtypes.includes(sub) ?? false;
      rows.push({
        capability: `build:${c.type}:${sub}`,
        category: "EXTRACTION",
        contentType: c.type,
        contentSubtype: sub,
        coverageStatus: covered ? (c.sensitive ? "REQUIRES_HUMAN_REVIEW" : "CERTIFIED") : "MISSING",
        certifiedSkillName: covered ? (extractSkill?.name ?? null) : null,
        rollbackAvailable: false,
        humanReviewRequired: c.sensitive,
        missingReason: covered ? null : `subtype ${sub} not declared by any certified skill`,
      });
    }
  }

  // One row per registered skill (operational capabilities beyond content).
  for (const s of listSkills()) {
    rows.push({
      capability: `skill:${s.name}`,
      category: s.category,
      contentType: s.contentTypes.includes("*") ? null : (s.contentTypes[0] ?? null),
      contentSubtype: null,
      coverageStatus: s.humanReviewRequired ? "REQUIRES_HUMAN_REVIEW" : "CERTIFIED",
      certifiedSkillName: s.name,
      rollbackAvailable: s.rollback != null,
      humanReviewRequired: s.humanReviewRequired,
      missingReason: null,
    });
  }

  return rows;
}

/** Persist the capability matrix; file a developer request for every MISSING. */
export async function refreshCapabilityMatrix(prisma: PrismaClient): Promise<{
  certified: number;
  missing: number;
  total: number;
}> {
  const rows = buildCapabilityRows();
  let certified = 0;
  let missing = 0;

  for (const r of rows) {
    if (r.coverageStatus === "CERTIFIED" || r.coverageStatus === "REQUIRES_HUMAN_REVIEW")
      certified += 1;
    if (r.coverageStatus === "MISSING") missing += 1;

    await prisma.adminWorkerSkillCapability
      .upsert({
        where: { capability: r.capability },
        create: {
          capability: r.capability,
          category: r.category,
          contentType: r.contentType,
          contentSubtype: r.contentSubtype,
          coverageStatus: r.coverageStatus,
          certifiedSkillName: r.certifiedSkillName,
          rollbackAvailable: r.rollbackAvailable,
          humanReviewRequired: r.humanReviewRequired,
          missingReason: r.missingReason,
        },
        update: {
          coverageStatus: r.coverageStatus,
          certifiedSkillName: r.certifiedSkillName,
          rollbackAvailable: r.rollbackAvailable,
          humanReviewRequired: r.humanReviewRequired,
          missingReason: r.missingReason,
        },
      })
      .catch(() => undefined);

    // File a developer request for every genuinely-missing capability.
    if (r.coverageStatus === "MISSING" && r.contentSubtype == null) {
      const fingerprint = `missing-capability:${r.capability}`;
      await prisma.adminWorkerDeveloperRequest
        .upsert({
          where: { fingerprint },
          create: {
            kind: "capability",
            title: `Missing certified skill for ${r.capability}`,
            detail:
              r.missingReason ??
              `No certified skill backs ${r.capability}; the worker cannot do this autonomously yet.`,
            severity: "high",
            status: "OPEN",
            source: "skill-runtime",
            fingerprint,
            metadata: { capability: r.capability, contentType: r.contentType },
          },
          update: { occurrences: { increment: 1 } },
        })
        .catch(() => undefined);
    }
  }

  return { certified, missing, total: rows.length };
}

/** Update one capability row's success/verification stats after a skill run. */
export async function upsertCapabilityFromRun(
  prisma: PrismaClient,
  skill: CertifiedSkill,
  _ctx: SkillContext,
  run: SkillRunResult,
): Promise<void> {
  const capability = `skill:${skill.name}`;
  const succeeded = run.outcome === "SUCCEEDED";
  const existing = await prisma.adminWorkerSkillCapability
    .findUnique({ where: { capability }, select: { successRate: true, verificationRate: true } })
    .catch(() => null);
  // EWMA so the rate reflects recent reliability.
  const alpha = 0.3;
  const prevS = existing?.successRate ?? 0;
  const prevV = existing?.verificationRate ?? 0;
  const verified = run.verification?.decision === "PROCEED" ? 1 : 0;
  await prisma.adminWorkerSkillCapability
    .upsert({
      where: { capability },
      create: {
        capability,
        category: skill.category,
        contentType: skill.contentTypes.includes("*") ? null : (skill.contentTypes[0] ?? null),
        coverageStatus: skill.humanReviewRequired ? "REQUIRES_HUMAN_REVIEW" : "CERTIFIED",
        certifiedSkillName: skill.name,
        rollbackAvailable: skill.rollback != null,
        humanReviewRequired: skill.humanReviewRequired,
        successRate: succeeded ? 1 : 0,
        verificationRate: verified,
        lastSuccessfulAt: succeeded ? new Date() : null,
        lastFailedAt: succeeded ? null : new Date(),
      },
      update: {
        successRate: prevS * (1 - alpha) + (succeeded ? 1 : 0) * alpha,
        verificationRate: prevV * (1 - alpha) + verified * alpha,
        ...(succeeded ? { lastSuccessfulAt: new Date() } : { lastFailedAt: new Date() }),
      },
    })
    .catch(() => undefined);
}

export interface SkillCapabilityData {
  rows: Array<{
    capability: string;
    category: string;
    contentType: string | null;
    coverageStatus: string;
    certifiedSkillName: string | null;
    successRate: number;
  }>;
  certified: number;
  missing: number;
  blocked: number;
  recentExecutions: Array<{
    skillName: string;
    executionStatus: string;
    verificationStatus: string;
    contentType: string | null;
    createdAt: Date;
  }>;
  totalExecutions: number;
}

export function emptySkillCapabilityData(): SkillCapabilityData {
  return {
    rows: [],
    certified: 0,
    missing: 0,
    blocked: 0,
    recentExecutions: [],
    totalExecutions: 0,
  };
}

/** Read the capability matrix + recent executions for the dashboard / audit. */
export async function collectSkillCapabilityData(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<SkillCapabilityData> {
  const probe = prisma as unknown as {
    adminWorkerSkillCapability?: { findMany?: unknown };
  };
  if (typeof probe.adminWorkerSkillCapability?.findMany !== "function") {
    return emptySkillCapabilityData();
  }
  const limit = opts.limit ?? 20;
  const [rows, recent, total, certified, missing, blocked] = await Promise.all([
    prisma.adminWorkerSkillCapability
      .findMany({ orderBy: { capability: "asc" }, take: 500 })
      .catch(() => []),
    prisma.adminWorkerSkillExecution
      .findMany({ orderBy: { createdAt: "desc" }, take: limit })
      .catch(() => []),
    prisma.adminWorkerSkillExecution.count().catch(() => 0),
    prisma.adminWorkerSkillCapability
      .count({ where: { coverageStatus: "CERTIFIED" } })
      .catch(() => 0),
    prisma.adminWorkerSkillCapability
      .count({ where: { coverageStatus: "MISSING" } })
      .catch(() => 0),
    prisma.adminWorkerSkillCapability
      .count({ where: { coverageStatus: "BLOCKED" } })
      .catch(() => 0),
  ]);

  return {
    rows: rows.map((r) => ({
      capability: r.capability,
      category: r.category,
      contentType: r.contentType,
      coverageStatus: r.coverageStatus,
      certifiedSkillName: r.certifiedSkillName,
      successRate: r.successRate,
    })),
    certified,
    missing,
    blocked,
    recentExecutions: recent.map((e) => ({
      skillName: e.skillName,
      executionStatus: e.executionStatus,
      verificationStatus: e.verificationStatus,
      contentType: e.contentType,
      createdAt: e.createdAt,
    })),
    totalExecutions: total,
  };
}
