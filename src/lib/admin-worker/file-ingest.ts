/**
 * Operator file ingestion (spec §13).
 *
 * The operator can drop a file onto the Admin Worker command center in the
 * native application. That file is processed **locally on the MacBook** and
 * then enters exactly the same intellectual and quality framework as anything
 * the worker discovers on the internet — it does not get a shortcut into
 * published content because a human supplied it.
 *
 * The flow, reusing the existing pipeline end to end:
 *
 *   1. identify the file type (magic bytes, then extension)
 *   2. extract text + structure locally (`file-extractors.ts`)
 *   3. record provenance: OPERATOR_FILE, with the operator, filename, sha256
 *   4. run the real source reader → structured blocks, classification,
 *      per-type extraction and an `AdminWorkerSourceRead` row, which is what
 *      places the material on the normal pipeline (`AdminWorkerPipelineStage`)
 *   5. compare against existing Via Fidei content: exact + near duplicates
 *   6. detect contradictions against what is already published, and adjudicate
 *      them through the conflict resolver (authority → recency → corroboration)
 *   7. decide whether external corroboration is required before publishing
 *   8. hand the material to the same classification → package → strict QA →
 *      publish orchestrator chain the autonomous worker uses; uncertain
 *      material goes to review instead of being invented into shape
 *   9. record exactly what was extracted, transformed, rejected and published
 *
 * SECURITY: the file is untrusted data. Nothing inside it is executed — no
 * macros, no scripts, no embedded programs, no shell commands. Text inside a
 * document that tries to instruct the Admin Worker is source material, not
 * authority: `detectInstructionInjection` flags it, records it, and the content
 * still has to pass every normal gate.
 */

import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { normalize, similarity } from "@/lib/data/fuzzy";

import { adjudicateAndRecord, type ClaimCandidate } from "./conflict-resolution";
import { assertWorkerExecutionAllowed } from "./execution-context";
import { classifyDetailed, toChecklistContentType } from "./classifier";
import { extractFile, type FileExtraction } from "./file-extractors";
import { fileHumanReview } from "./human-review";
import { writeAdminWorkerLog } from "./logs";
import { makeProvenance, type FieldProvenance } from "./provenance";
import { readSource, type ReadSourceOutcome } from "./source-reader";

/** Synthetic host used for operator-supplied material, so provenance is honest. */
export const OPERATOR_FILE_HOST = "operator-file.local";

export interface FileIngestInput {
  filename: string;
  buffer: Buffer;
  /** Admin username / operator label recorded in provenance. */
  operator: string;
  /** Optional note the operator typed alongside the file. */
  note?: string | null;
  passId?: string;
}

export interface DuplicateMatch {
  publishedContentId: string;
  contentType: string;
  title: string;
  score: number;
  kind: "exact" | "near";
}

export interface FileIngestResult {
  ok: boolean;
  filename: string;
  sha256: string;
  sourceUrl: string;
  byteSize: number;
  fileKind: FileExtraction["kind"];
  /** True when this exact file was ingested before. */
  alreadyIngested: boolean;
  extraction: {
    ok: boolean;
    title: string | null;
    headings: string[];
    textChars: number;
    note: string | null;
    safetyNotes: string[];
  };
  classification: {
    contentType: string | null;
    confidence: number;
    reasons: string[];
  } | null;
  sourceReadId: string | null;
  pipelineStageId: string | null;
  duplicates: DuplicateMatch[];
  conflicts: Array<{ field: string; resolution: string; rationale: string; needsReview: boolean }>;
  /** True when the material needs external corroboration before publishing. */
  requiresExternalVerification: boolean;
  provenance: FieldProvenance[];
  /** Terminal disposition of this ingestion. */
  disposition:
    | "queued-for-pipeline"
    | "duplicate-skipped"
    | "review-required"
    | "rejected"
    | "unsupported";
  reason: string;
  /** Instruction-injection attempts found in the document (recorded, never obeyed). */
  injectionFlags: string[];
}

/* ------------------------------------------------------------------ */
/* untrusted-content safety                                            */
/* ------------------------------------------------------------------ */

const INJECTION_PATTERNS: Array<{ name: string; re: RegExp }> = [
  {
    name: "ignore-previous-instructions",
    re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  },
  {
    name: "system-prompt-override",
    re: /you\s+are\s+now\s+(an?\s+)?(admin|system|root|developer)/i,
  },
  {
    name: "publish-command",
    re: /\b(publish|approve|deploy)\s+(this|the following)\s+(immediately|without review)/i,
  },
  { name: "credential-request", re: /\b(api[_\s-]?key|password|secret|token)\s*[:=]/i },
  {
    name: "shell-command",
    re: /\b(rm\s+-rf|curl\s+http|wget\s+http|bash\s+-c|powershell\s+-enc)/i,
  },
  { name: "gate-bypass", re: /\b(skip|bypass|disable)\s+(qa|quality|verification|review|safety)/i },
];

/**
 * Flag text inside a document that tries to give the Admin Worker orders.
 * Reported and logged; never acted upon. The document is still ingested as
 * source material — a hostile sentence does not by itself make a document
 * useless, it just never becomes an instruction.
 */
export function detectInstructionInjection(text: string): string[] {
  const sample = text.slice(0, 200_000);
  return INJECTION_PATTERNS.filter((p) => p.re.test(sample)).map((p) => p.name);
}

/* ------------------------------------------------------------------ */
/* duplicate + contradiction detection                                 */
/* ------------------------------------------------------------------ */

/**
 * Compare the incoming material against live published content: exact title
 * match first, then near-duplicate by normalised title similarity.
 */
export async function findDuplicates(
  prisma: PrismaClient,
  input: { title: string | null; contentType: string | null; text: string },
): Promise<DuplicateMatch[]> {
  const title = input.title?.trim();
  if (!title) return [];

  const scopedType = toChecklistContentType(
    input.contentType as Parameters<typeof toChecklistContentType>[0],
  );
  const rows = await prisma.publishedContent
    .findMany({
      where: { isPublished: true, ...(scopedType ? { contentType: scopedType } : {}) },
      select: { id: true, contentType: true, title: true },
      take: 5_000,
    })
    .catch(() => [] as Array<{ id: string; contentType: string; title: string }>);

  const target = normalize(title);
  const out: DuplicateMatch[] = [];
  for (const row of rows) {
    const score = similarity(target, normalize(row.title));
    if (score >= 0.97) {
      out.push({
        publishedContentId: row.id,
        contentType: row.contentType,
        title: row.title,
        score,
        kind: "exact",
      });
    } else if (score >= 0.82) {
      out.push({
        publishedContentId: row.id,
        contentType: row.contentType,
        title: row.title,
        score,
        kind: "near",
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 10);
}

/**
 * Look for direct contradictions between a claim extracted from the file and
 * the corresponding field on already-published content of the same title.
 * Only fields both sides actually assert are compared.
 */
export async function detectContradictions(
  prisma: PrismaClient,
  input: {
    title: string;
    contentType: string;
    claims: Record<string, string>;
    sourceUrl: string;
    operator: string;
    passId?: string;
  },
): Promise<FileIngestResult["conflicts"]> {
  const scopedType = toChecklistContentType(
    input.contentType as Parameters<typeof toChecklistContentType>[0],
  );
  if (!scopedType) return [];
  const existing = await prisma.publishedContent
    .findFirst({
      where: { isPublished: true, contentType: scopedType, title: input.title },
      select: { payload: true, updatedAt: true, authorityLevel: true },
    })
    .catch(() => null);
  if (!existing) return [];

  const payload = (existing.payload ?? {}) as Record<string, unknown>;
  const conflicts: FileIngestResult["conflicts"] = [];

  for (const [field, incoming] of Object.entries(input.claims)) {
    const current = payload[field];
    if (typeof current !== "string" || !current.trim() || !incoming.trim()) continue;
    if (normalize(current) === normalize(incoming)) continue;

    const candidates: ClaimCandidate[] = [
      {
        value: current,
        sourceUrl: "viafidei://published",
        sourceHost: "etviafidei.com",
        // The live row was published under a verified authority level; that is
        // the authority the incoming operator claim has to beat.
        authorityLevel: existing.authorityLevel,
        statedAt: existing.updatedAt,
        corroborations: 1,
      },
      {
        value: incoming,
        sourceUrl: input.sourceUrl,
        sourceHost: OPERATOR_FILE_HOST,
        // An operator-supplied file carries no external authority of its own.
        authorityLevel: null,
        statedAt: null,
        observedAt: new Date(),
        corroborations: 1,
      },
    ];

    const { verdict } = await adjudicateAndRecord(prisma, {
      field: `${input.contentType}.${field}`,
      contentType: input.contentType,
      contentTitle: input.title,
      candidates,
      passId: input.passId,
    });

    conflicts.push({
      field,
      resolution: verdict.resolution,
      rationale: verdict.rationale,
      needsReview: verdict.needsReview,
    });
  }
  return conflicts;
}

/* ------------------------------------------------------------------ */
/* ingestion                                                           */
/* ------------------------------------------------------------------ */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Present the extracted text to the existing source reader in the shape it
 * already understands.
 *
 * The structured block parser and the classifier were built for web documents:
 * they read titles, headings, paragraphs and lists. A PDF or a Markdown file
 * carries exactly those structures, so the extracted title/headings/paragraphs
 * are re-expressed as simple markup before handing them over. This reuses the
 * one parser, one classifier and one extractor set — no second reading path —
 * and nothing from the file is executed: every value is escaped as text.
 */
export function toStructuredBody(extraction: FileExtraction): string {
  const parts: string[] = [];
  if (extraction.title) parts.push(`<h1>${escapeHtml(extraction.title)}</h1>`);

  const headings = new Set(extraction.headings.map((h) => h.trim()).filter(Boolean));
  for (const block of extraction.text.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Markdown headings survive extraction as "## Origin" — render them as
    // headings so the classifier sees the document's real structure.
    const md = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (md) {
      parts.push(
        `<h${Math.min(6, md[1].length + 1)}>${escapeHtml(md[2].trim())}</h${Math.min(6, md[1].length + 1)}>`,
      );
      continue;
    }
    if (headings.has(trimmed)) {
      parts.push(`<h2>${escapeHtml(trimmed)}</h2>`);
      continue;
    }
    const lines = trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const isList = lines.length > 1 && lines.every((l) => /^([-*•]|\d+[.)])\s+/.test(l));
    if (isList) {
      parts.push(
        `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^([-*•]|\d+[.)])\s+/, ""))}</li>`).join("")}</ul>`,
      );
      continue;
    }
    parts.push(`<p>${escapeHtml(lines.join(" "))}</p>`);
  }

  return `<html><head><title>${escapeHtml(extraction.title ?? "")}</title></head><body>${parts.join("\n")}</body></html>`;
}

function claimsFromExtraction(outcome: ReadSourceOutcome): Record<string, string> {
  const fields = outcome.extraction?.fields;
  if (!fields || typeof fields !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() && v.length < 2_000) out[k] = v;
  }
  return out;
}

/**
 * Ingest one operator-supplied file locally. Runs on the MacBook only.
 */
export async function ingestOperatorFile(
  prisma: PrismaClient,
  input: FileIngestInput,
): Promise<FileIngestResult> {
  assertWorkerExecutionAllowed("ingest an operator-supplied file");

  const sha256 = createHash("sha256").update(input.buffer).digest("hex");
  const sourceUrl = `operator-file://${sha256.slice(0, 16)}/${encodeURIComponent(input.filename)}`;

  const base: FileIngestResult = {
    ok: false,
    filename: input.filename,
    sha256,
    sourceUrl,
    byteSize: input.buffer.length,
    fileKind: "unsupported",
    alreadyIngested: false,
    extraction: {
      ok: false,
      title: null,
      headings: [],
      textChars: 0,
      note: null,
      safetyNotes: [],
    },
    classification: null,
    sourceReadId: null,
    pipelineStageId: null,
    duplicates: [],
    conflicts: [],
    requiresExternalVerification: true,
    provenance: [],
    disposition: "rejected",
    reason: "",
    injectionFlags: [],
  };

  // 1 + 2. Identify and extract — locally, with hard resource ceilings.
  const extraction = extractFile(input.filename, input.buffer);
  base.fileKind = extraction.kind;
  base.extraction = {
    ok: extraction.ok,
    title: extraction.title,
    headings: extraction.headings,
    textChars: extraction.text.length,
    note: extraction.note,
    safetyNotes: extraction.safetyNotes,
  };

  if (!extraction.ok) {
    await writeAdminWorkerLog(prisma, {
      passId: input.passId,
      category: "SOURCE_READING",
      severity: "WARN",
      eventName: "operator_file_unreadable",
      message: `Operator file "${input.filename}" could not be read: ${extraction.note ?? "no usable text"}.`,
      sourceHost: OPERATOR_FILE_HOST,
      sourceUrl,
      safeMetadata: { sha256, kind: extraction.kind, byteSize: input.buffer.length },
    }).catch(() => undefined);
    return {
      ...base,
      disposition: extraction.kind === "unsupported" ? "unsupported" : "rejected",
      reason: extraction.note ?? "no usable text could be extracted",
    };
  }

  // Untrusted-content check (recorded, never obeyed).
  const injectionFlags = detectInstructionInjection(extraction.text);
  base.injectionFlags = injectionFlags;
  if (injectionFlags.length > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: input.passId,
      category: "SECURITY",
      severity: "WARN",
      eventName: "operator_file_instruction_text",
      message:
        `Operator file "${input.filename}" contains text that attempts to instruct the Admin Worker ` +
        `(${injectionFlags.join(", ")}). Treated as source material only — no instruction was followed.`,
      sourceHost: OPERATOR_FILE_HOST,
      sourceUrl,
      safeMetadata: { sha256, flags: injectionFlags },
    }).catch(() => undefined);
  }

  // Already-ingested check (same bytes → same checksum).
  const priorRead = await prisma.adminWorkerSourceRead
    .findFirst({ where: { sourceUrl }, select: { id: true } })
    .catch(() => null);
  base.alreadyIngested = priorRead != null;

  // 3. Provenance for the whole document.
  const provenance: FieldProvenance[] = [
    makeProvenance({
      fieldName: "document",
      sourceUrl,
      sourceHost: OPERATOR_FILE_HOST,
      snippet: extraction.text.slice(0, 240),
      method: "OPERATOR",
      confidence: 0.6,
      checksum: sha256,
    }),
  ];
  base.provenance = provenance;

  await writeAdminWorkerLog(prisma, {
    passId: input.passId,
    category: "SOURCE_READING",
    severity: "INFO",
    eventName: "operator_file_received",
    message:
      `Operator ${input.operator} supplied "${input.filename}" (${extraction.kind}, ` +
      `${Math.round(input.buffer.length / 1024)} KB, ${extraction.text.length} chars extracted).`,
    sourceHost: OPERATOR_FILE_HOST,
    sourceUrl,
    safeMetadata: {
      sha256,
      kind: extraction.kind,
      operator: input.operator,
      note: input.note ?? null,
      safetyNotes: extraction.safetyNotes,
      headings: extraction.headings.slice(0, 12),
    },
  }).catch(() => undefined);

  // 4. The real source reader: structured blocks + classification + extraction
  //    + the pipeline-stage row that puts this on the normal chain.
  const structuredBody = toStructuredBody(extraction);
  const readOutcome = await readSource(prisma, {
    sourceUrl,
    sourceHost: OPERATOR_FILE_HOST,
    rawBody: structuredBody,
    title: extraction.title,
    headings: extraction.headings,
    // Operator files carry no external reputation; treat as probationary so
    // they must earn publication through the normal gates.
    sourceReputationTier: "PROBATION",
  }).catch((err: unknown) => {
    return { error: err instanceof Error ? err.message : String(err) } as const;
  });

  if ("error" in readOutcome) {
    return {
      ...base,
      disposition: "rejected",
      reason: `source reader failed: ${readOutcome.error}`,
    };
  }

  base.sourceReadId = readOutcome.sourceReadId;
  base.pipelineStageId = readOutcome.pipelineStageId;
  base.classification = {
    contentType: readOutcome.classifierContentType,
    confidence: readOutcome.classifierConfidence,
    reasons: readOutcome.classifierReasons,
  };

  if (readOutcome.rejected) {
    // The classifier could not place the document with enough confidence to
    // enter the pipeline automatically. That is not the same as "worthless":
    // an operator supplied it deliberately, so if a content type is plausibly
    // indicated the material goes to REVIEW with the evidence attached, rather
    // than being silently dropped or having a type invented for it (spec §13.16).
    const detailed = classifyDetailed({
      url: sourceUrl,
      title: extraction.title,
      headings: extraction.headings,
      bodyText: structuredBody,
      sourceReputationTier: "PROBATION",
    });
    const [suggestedType, suggestedScore] = Object.entries(detailed.perTypeScores)
      .filter(([type]) => type !== "WRONG" && type !== "UNUSABLE")
      .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

    const plausible = suggestedType != null && suggestedScore >= 0.35;
    if (plausible) {
      await fileHumanReview(prisma, {
        contentType: suggestedType,
        contentTitle: extraction.title ?? input.filename,
        proposedAction: `Confirm the content type of operator-supplied "${input.filename}"`,
        reason:
          `The Admin Worker read the file and found ${suggestedType} signals ` +
          `(${suggestedScore.toFixed(2)}), below the ${0.55} automatic-classification threshold. ` +
          `It will not guess the type or invent missing fields.`,
        confidence: suggestedScore,
        blockingGate: "classification",
        neededAction: "Confirm the content type, or supply a fuller source document.",
        sourceEvidence: {
          sourceUrl,
          sha256,
          operator: input.operator,
          headings: extraction.headings.slice(0, 12),
          perTypeScores: detailed.perTypeScores,
        } as never,
      }).catch(() => null);
    }

    await writeAdminWorkerLog(prisma, {
      passId: input.passId,
      category: "CONTENT_CLASSIFICATION",
      severity: "INFO",
      eventName: plausible ? "operator_file_needs_review" : "operator_file_rejected",
      message: plausible
        ? `Operator file "${input.filename}" read successfully but classified below threshold ` +
          `(best guess ${suggestedType} ${suggestedScore.toFixed(2)}) — routed to review.`
        : `Operator file "${input.filename}" rejected by the source reader: ${readOutcome.rejectionReason}.`,
      sourceHost: OPERATOR_FILE_HOST,
      sourceUrl,
      relatedEntityId: readOutcome.sourceReadId,
      safeMetadata: { suggestedType, suggestedScore, sha256 },
    }).catch(() => undefined);

    return {
      ...base,
      ok: plausible,
      classification: {
        contentType: plausible ? suggestedType : readOutcome.classifierContentType,
        confidence: plausible ? suggestedScore : readOutcome.classifierConfidence,
        reasons: readOutcome.classifierReasons,
      },
      disposition: plausible ? "review-required" : "rejected",
      reason: plausible
        ? `read and preserved, but classification confidence ${suggestedScore.toFixed(2)} is below the automatic threshold — sent to review as a possible ${suggestedType}`
        : (readOutcome.rejectionReason ?? "source reader rejected the material"),
    };
  }

  // 5. Duplicate + near-duplicate detection against live content.
  const duplicates = await findDuplicates(prisma, {
    title: extraction.title,
    contentType: readOutcome.classifierContentType,
    text: extraction.text,
  });
  base.duplicates = duplicates;

  const exact = duplicates.find((d) => d.kind === "exact");
  if (exact) {
    await writeAdminWorkerLog(prisma, {
      passId: input.passId,
      category: "CONTENT_CLASSIFICATION",
      severity: "INFO",
      eventName: "operator_file_duplicate",
      message:
        `Operator file "${input.filename}" duplicates published ${exact.contentType} ` +
        `"${exact.title}" (score ${exact.score.toFixed(2)}). Not queued for publishing.`,
      sourceHost: OPERATOR_FILE_HOST,
      sourceUrl,
      safeMetadata: { publishedContentId: exact.publishedContentId, score: exact.score },
    }).catch(() => undefined);
    return {
      ...base,
      ok: true,
      requiresExternalVerification: false,
      disposition: "duplicate-skipped",
      reason: `already published as "${exact.title}"`,
    };
  }

  // 6. Contradictions against what is already published.
  const claims = claimsFromExtraction(readOutcome);
  const conflicts = extraction.title
    ? await detectContradictions(prisma, {
        title: extraction.title,
        contentType: readOutcome.classifierContentType,
        claims,
        sourceUrl,
        operator: input.operator,
        passId: input.passId,
      }).catch(() => [])
    : [];
  base.conflicts = conflicts;

  // 7. Does this need external corroboration before it can be published?
  //    Operator-supplied material has no external authority of its own, so
  //    anything doctrinal, contradictory, or thinly classified must be
  //    corroborated by an approved authority source through the normal
  //    cross-source verification stage.
  const unresolvedConflict = conflicts.some((c) => c.needsReview);
  const lowConfidence = readOutcome.classifierConfidence < 0.6;
  const requiresExternalVerification = true; // always — provenance is OPERATOR
  base.requiresExternalVerification = requiresExternalVerification;

  const disposition: FileIngestResult["disposition"] =
    unresolvedConflict || lowConfidence ? "review-required" : "queued-for-pipeline";

  await writeAdminWorkerLog(prisma, {
    passId: input.passId,
    category: "CONTENT_CLASSIFICATION",
    severity: "INFO",
    eventName: "operator_file_ingested",
    message:
      `Operator file "${input.filename}" classified as ${readOutcome.classifierContentType} ` +
      `(confidence ${readOutcome.classifierConfidence.toFixed(2)}); ${disposition.replace("-", " ")}. ` +
      `${duplicates.length} near-duplicate(s), ${conflicts.length} contradiction(s). ` +
      `External corroboration required before publishing.`,
    contentType: readOutcome.classifierContentType,
    sourceHost: OPERATOR_FILE_HOST,
    sourceUrl,
    relatedEntityId: readOutcome.sourceReadId,
    safeMetadata: {
      sha256,
      operator: input.operator,
      disposition,
      duplicates: duplicates.map((d) => ({ id: d.publishedContentId, score: d.score })),
      conflicts,
      acceptedBlocks: readOutcome.acceptedBlocks,
      rejectedBlocks: readOutcome.rejectedBlocks,
      injectionFlags,
    },
  }).catch(() => undefined);

  return {
    ...base,
    ok: true,
    disposition,
    reason:
      disposition === "review-required"
        ? unresolvedConflict
          ? "contradicts published content in a way the worker will not settle on its own"
          : `classification confidence ${readOutcome.classifierConfidence.toFixed(2)} is below the automatic threshold`
        : "queued on the normal pipeline — classification → package → strict QA → publish gate",
  };
}
