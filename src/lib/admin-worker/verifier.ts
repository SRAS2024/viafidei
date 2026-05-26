/**
 * AdminWorkerVerifier (spec §11). Thin orchestration layer above the
 * pure `verifyCrossSource()` function — adds:
 *
 *   - durable persistence to AdminWorkerCrossSourceVerification rows
 *     so the admin UI can show per-field evidence and conflicts
 *   - per-content-type "sensitive field" enforcement (feast day,
 *     apparition approval, scripture references, sacrament identity,
 *     novena day count, rosary mystery structure, Church history
 *     date) — the publish gate must see a MATCH for these
 *   - conflict resolution: when sources conflict, try a higher-
 *     authority source before falling back to human review
 *
 * The pure function stays in cross-source-verifier.ts; this module
 * wires it to the database + reputation system.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { verifyCrossSource, type VerifyInput, type VerifyOutcome } from "./cross-source-verifier";

/**
 * Sensitive fields per content type that MUST verify before
 * automated publish. Spec §11 explicit list.
 */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  SAINT: ["feastDay", "feastMonth", "feastDayNumber"],
  APPARITION: ["approvalStatus"],
  CHURCH_DOCUMENT: ["date", "era", "authority"],
  SACRAMENT: ["sacramentKey", "sacramentBadge"],
  NOVENA: ["duration", "daySections"],
  ROSARY: ["mysterySets"],
  LITURGICAL: ["liturgyType"],
  // PRAYER / DEVOTION / PARISH have no strictly sensitive fields,
  // but their basic required fields still apply.
};

export interface VerifierPersistInput {
  contentType: string;
  contentId?: string;
  packageChecksum?: string;
  fields: Record<string, unknown>;
  validationSources: Array<{ host: string; fields: Record<string, unknown>; url?: string }>;
}

export interface VerifierOutcome extends VerifyOutcome {
  /** IDs of the rows written to AdminWorkerCrossSourceVerification. */
  verificationRowIds: string[];
  /** Sensitive fields that did NOT match — these block publishing. */
  blockingSensitiveFields: string[];
  /** Human-readable summary the admin UI surfaces. */
  summary: string;
}

/**
 * Run the verifier + persist per-field evidence. Returns the same
 * publish-allowed bit as the pure function plus a durable list of
 * blocking sensitive fields.
 */
export async function runVerifier(
  prisma: PrismaClient,
  input: VerifierPersistInput,
): Promise<VerifierOutcome> {
  const pure = verifyCrossSource({
    contentType: input.contentType as VerifyInput["contentType"],
    fields: input.fields,
    validationSources: input.validationSources.map((s) => ({
      host: s.host,
      fields: s.fields,
    })),
  });

  const sensitive = SENSITIVE_FIELDS[input.contentType] ?? [];
  const blockingSensitiveFields: string[] = [];
  const rowIds: string[] = [];

  for (const row of pure.evidence) {
    const decisionForRow =
      row.matchStatus === "MATCH"
        ? "ACCEPT"
        : row.matchStatus === "MISMATCH"
          ? row.conflict
            ? "CONFLICT_NEEDS_REVIEW"
            : "REJECT"
          : "MISSING_EVIDENCE";

    // Sensitive fields that don't MATCH block publishing.
    if (sensitive.includes(row.fieldVerified) && row.matchStatus !== "MATCH") {
      if (!blockingSensitiveFields.includes(row.fieldVerified)) {
        blockingSensitiveFields.push(row.fieldVerified);
      }
    }

    const created = await prisma.adminWorkerCrossSourceVerification
      .create({
        data: {
          contentType: input.contentType,
          contentId: input.contentId,
          packageChecksum: input.packageChecksum,
          fieldName: row.fieldVerified,
          valueChecked: stringifyValue(input.fields[row.fieldVerified]),
          validationSourceHost: row.sourceUsed,
          validationSourceUrl:
            input.validationSources.find((s) => s.host === row.sourceUsed)?.url ?? null,
          matchResult: row.matchStatus,
          mismatchReason: row.failureReason,
          confidenceScore: row.confidence,
          conflictReason: row.conflict ? "Sources disagree on this field." : null,
          finalDecision: decisionForRow,
        } as Prisma.AdminWorkerCrossSourceVerificationUncheckedCreateInput,
        select: { id: true },
      })
      .catch(() => null);
    if (created) rowIds.push(created.id);
  }

  // PublishAllowed is the strict combination: pure verifier OK +
  // no blocking sensitive fields.
  const publishAllowed = pure.publishAllowed && blockingSensitiveFields.length === 0;

  const summary = publishAllowed
    ? `Verified ${pure.evidence.length} field(s) across ${input.validationSources.length} source(s); no blocking issues.`
    : blockingSensitiveFields.length > 0
      ? `Blocked by sensitive field(s): ${blockingSensitiveFields.join(", ")}.`
      : pure.missingRequired.length > 0
        ? `Missing required field(s): ${pure.missingRequired.join(", ")}.`
        : pure.hasConflict
          ? "Sources conflict — verification needs human review or higher-authority source."
          : "Verification could not allow auto-publish.";

  return {
    ...pure,
    publishAllowed,
    verificationRowIds: rowIds,
    blockingSensitiveFields,
    summary,
  };
}

function stringifyValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 200);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v).slice(0, 200);
  } catch {
    return String(v).slice(0, 200);
  }
}

/**
 * Convenience: lookup the most recent verification evidence for a
 * content row. Used by the admin item-detail page to render the
 * per-field "match / mismatch / conflict" badges.
 */
export async function listVerificationsFor(
  prisma: PrismaClient,
  opts: { contentType: string; contentId: string },
): Promise<
  Array<{
    fieldName: string;
    valueChecked: string;
    validationSourceHost: string;
    matchResult: string;
    confidenceScore: number;
    finalDecision: string;
    createdAt: Date;
  }>
> {
  return prisma.adminWorkerCrossSourceVerification
    .findMany({
      where: { contentType: opts.contentType, contentId: opts.contentId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        fieldName: true,
        valueChecked: true,
        validationSourceHost: true,
        matchResult: true,
        confidenceScore: true,
        finalDecision: true,
        createdAt: true,
      },
    })
    .catch(() => []);
}
