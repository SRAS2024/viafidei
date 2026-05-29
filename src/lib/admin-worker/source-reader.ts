/**
 * AdminWorkerSourceReader (spec §6 + §1 follow-up). Orchestrator that
 * turns a raw source page into:
 *
 *   1. an `AdminWorkerSourceRead` row (deduped by sha256)
 *   2. `AdminWorkerSourceBlock` rows produced by the structured HTML
 *      parser (title, heading, paragraph, list, table, prayer,
 *      day-section, scripture, location, metadata, rejected)
 *   3. a classification + extraction that consumes structured blocks
 *      first, raw text only as fallback
 *
 * `rawBody.slice(0, 20_000)` is no longer the main extraction input;
 * extractors and the classifier receive a body string built from
 * accepted structured blocks. The raw text is kept on the source-read
 * row as forensic reference.
 */

import type { PrismaClient } from "@prisma/client";

import { classify, toChecklistContentType } from "./classifier";
import { extractByType, type ExtractorInput, type ExtractorOutput } from "./extractors";
import { writeAdminWorkerLog } from "./logs";
import { rememberOutcome } from "./memory";
import { recordStage } from "./pipeline-stages";
import { upsertSourceRead } from "./source-reads";
import {
  parseStructuredBlocks,
  persistStructuredBlocks,
  type StructuredBlock,
} from "./structured-source-reader";

export interface ReadSourceInput {
  sourceUrl: string;
  sourceHost: string;
  rawBody: string;
  title?: string | null;
  headings?: string[];
  language?: string;
  sourceReputationTier?: "TRUSTED" | "PROBATION" | "PAUSED" | null;
}

export interface ReadSourceOutcome {
  sourceReadId: string;
  reused: boolean;
  checksum: string;
  classifierContentType: string;
  classifierConfidence: number;
  classifierReasons: string[];
  extraction: ExtractorOutput | null;
  pipelineStageId: string | null;
  rejected: boolean;
  rejectionReason: string | null;
  /** Spec §1: block stats so the operator can see what was parsed. */
  totalBlocks: number;
  acceptedBlocks: number;
  rejectedBlocks: number;
}

/**
 * Block types whose text is concatenated into the classifier /
 * extractor body. PRAYER + DAY_SECTION + SCRIPTURE + LOCATION are
 * included so per-type extractors can find their material.
 */
const BODY_BLOCK_TYPES: ReadonlySet<string> = new Set([
  "TITLE",
  "HEADING",
  "PARAGRAPH",
  "PRAYER",
  "DAY_SECTION",
  "SCRIPTURE",
  "LOCATION",
  "LIST_ITEM",
]);

function blocksToBody(blocks: StructuredBlock[]): string {
  return blocks
    .filter((b) => !b.isRejected && BODY_BLOCK_TYPES.has(b.blockType))
    .map((b) => b.text)
    .join("\n\n");
}

function blocksToHeadings(blocks: StructuredBlock[]): string[] {
  return blocks
    .filter((b) => !b.isRejected && b.blockType === "HEADING")
    .map((b) => b.text)
    .filter(Boolean);
}

/**
 * Read + parse blocks + classify + extract a source page. Always
 * writes an `AdminWorkerSourceRead` row (deduped on sha256), persists
 * the structured blocks the page produced, then classifies + extracts
 * against the block-derived body. Memory is updated so future passes
 * can rank sources.
 */
export async function readSource(
  prisma: PrismaClient,
  input: ReadSourceInput,
): Promise<ReadSourceOutcome> {
  // 1. Parse the page into structured blocks (spec §1, §7).
  const structured = parseStructuredBlocks(input.rawBody);
  const blockBody = blocksToBody(structured.blocks);
  const headings =
    input.headings && input.headings.length > 0
      ? input.headings
      : blocksToHeadings(structured.blocks);
  const title = input.title ?? structured.title ?? null;

  // 2. Persist the raw read. Cleaned extracted text comes from the
  //    structured-block body (forensic raw text is on rawBody).
  const extractedText = (blockBody || input.rawBody).slice(0, 20_000);
  const sourceRead = await upsertSourceRead(prisma, {
    sourceUrl: input.sourceUrl,
    sourceHost: input.sourceHost,
    rawBody: input.rawBody,
    extractedTitle: title,
    extractedText,
    detectedContentType: null,
  });

  // 3. Persist structured blocks for new reads (skip when reused —
  //    blocks already exist for that checksum).
  if (!sourceRead.reused) {
    await persistStructuredBlocks(prisma, sourceRead.id, structured).catch(() => undefined);
  }

  // 4. Classify using block-derived body.
  const classifierBody = blockBody || input.rawBody;
  const classification = classify({
    url: input.sourceUrl,
    title,
    headings,
    bodyText: classifierBody,
    sourceReputationTier: input.sourceReputationTier,
  });

  // 5. Update the read row with the detected content type + confidence.
  if (!sourceRead.reused) {
    await prisma.adminWorkerSourceRead
      .update({
        where: { id: sourceRead.id },
        data: {
          detectedContentType: classification.contentType,
          confidenceScore: classification.confidence,
        },
      })
      .catch(() => undefined);
  }

  const totalBlocks = structured.blocks.length + structured.rejectedBlocks.length;
  const acceptedBlocks = structured.blocks.length;
  const rejectedBlockCount = structured.rejectedBlocks.length;

  // 6. Bail when classifier rejected the page.
  if (classification.contentType === "WRONG" || classification.contentType === "UNUSABLE") {
    await rememberOutcome(prisma, {
      memoryType: "SOURCE_PRIORITY",
      memoryKey: input.sourceHost,
      memoryValue: {
        url: input.sourceUrl,
        rejectedAs: classification.contentType,
        reason: classification.reasons[0] ?? "",
      },
      outcome: "failure",
    });
    await writeAdminWorkerLog(prisma, {
      category: "SOURCE_READING",
      severity: "WARN",
      eventName: "source_read_rejected",
      message: `${input.sourceUrl} → ${classification.contentType} (conf=${classification.confidence.toFixed(2)}; ${acceptedBlocks}/${totalBlocks} blocks accepted).`,
      safeMetadata: {
        sourceReadId: sourceRead.id,
        host: input.sourceHost,
        totalBlocks,
        acceptedBlocks,
        rejectedBlocks: rejectedBlockCount,
        contentType: classification.contentType,
        confidence: classification.confidence,
        reason: classification.reasons[0] ?? "",
      },
    }).catch(() => undefined);
    return {
      sourceReadId: sourceRead.id,
      reused: sourceRead.reused,
      checksum: sourceRead.checksum,
      classifierContentType: classification.contentType,
      classifierConfidence: classification.confidence,
      classifierReasons: classification.reasons,
      extraction: null,
      pipelineStageId: null,
      rejected: true,
      rejectionReason: classification.reasons[0] ?? "Classifier rejected the page.",
      totalBlocks,
      acceptedBlocks,
      rejectedBlocks: rejectedBlockCount,
    };
  }

  // 7. Run the extractor matching the chosen content type. Map ROSARY /
  //    CONSECRATION onto SPIRITUAL_PRACTICE for the checklist surface,
  //    but use the precise type for extraction.
  const extractorType = classification.contentType as
    | "PRAYER"
    | "SAINT"
    | "APPARITION"
    | "DEVOTION"
    | "NOVENA"
    | "ROSARY"
    | "CONSECRATION"
    | "SACRAMENT"
    | "CHURCH_DOCUMENT"
    | "LITURGICAL"
    | "PARISH";

  const extractorInput: ExtractorInput = {
    url: input.sourceUrl,
    host: input.sourceHost,
    title,
    headings,
    bodyText: classifierBody,
    blocks: structured.blocks,
    scriptureReferences: structured.scriptureReferences,
    checksum: sourceRead.checksum,
    language: input.language,
  };

  // The extractor dispatcher only knows the 11 spec types — GUIDE and
  // MARIAN_TITLE skip extraction (the checklist already builds those).
  let extraction: ExtractorOutput | null = null;
  if (
    extractorType === "PRAYER" ||
    extractorType === "SAINT" ||
    extractorType === "APPARITION" ||
    extractorType === "DEVOTION" ||
    extractorType === "NOVENA" ||
    extractorType === "ROSARY" ||
    extractorType === "CONSECRATION" ||
    extractorType === "SACRAMENT" ||
    extractorType === "CHURCH_DOCUMENT" ||
    extractorType === "LITURGICAL" ||
    extractorType === "PARISH"
  ) {
    extraction = extractByType(extractorType, extractorInput);
  }

  // 8. Pipeline-stage row so the dashboard can see where this item sits.
  const stageStatus = extraction && extraction.fatalReasons.length === 0 ? "SUCCEEDED" : "FAILED";
  const stage = await recordStage(prisma, {
    stageName: "CLASSIFY",
    status: stageStatus,
    contentType: toChecklistContentType(classification.contentType) ?? undefined,
    inputId: sourceRead.id,
    confidenceScore: classification.confidence,
    failureReason: extraction?.fatalReasons[0],
    repairRecommendation:
      extraction && extraction.fatalReasons.length > 0
        ? `Re-fetch ${input.sourceUrl} or route to rare human review.`
        : undefined,
    metadata: {
      classifierContentType: classification.contentType,
      missingFields: extraction?.missingFields ?? [],
      warnings: extraction?.warnings ?? [],
      totalBlocks,
      acceptedBlocks,
      rejectedBlocks: rejectedBlockCount,
    },
  });

  // 9. Update memory with extractor outcome so future passes can rank
  //    this host.
  await rememberOutcome(prisma, {
    memoryType: "SOURCE_PRIORITY",
    memoryKey: input.sourceHost,
    memoryValue: {
      lastContentType: classification.contentType,
      lastConfidence: classification.confidence,
      lastChecksum: sourceRead.checksum,
    },
    outcome: stageStatus === "SUCCEEDED" ? "success" : "failure",
  });

  // 9b. Spec §19: source reputation updates after the source-read
  //     stage too — a host that reads cleanly is more trustworthy.
  const { pushReputation } = await import("./source-reputation-hooks");
  await pushReputation(prisma, {
    sourceHost: input.sourceHost,
    contentType: toChecklistContentType(classification.contentType) ?? undefined,
    stage: "source_read",
    ok: stageStatus === "SUCCEEDED",
    usefulness: classification.confidence,
  }).catch(() => undefined);

  // 10. Operator-visible log with the block counts (spec §1 ask:
  //     "Add source reader logs showing total/accepted/rejected
  //     blocks, content type, confidence, source read id").
  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_READING",
    severity: stageStatus === "SUCCEEDED" ? "INFO" : "WARN",
    eventName: "source_read_complete",
    message: `${input.sourceUrl} → ${classification.contentType} (conf=${classification.confidence.toFixed(2)}; ${acceptedBlocks}/${totalBlocks} blocks accepted, ${rejectedBlockCount} rejected).`,
    contentType: toChecklistContentType(classification.contentType) ?? undefined,
    relatedEntityId: sourceRead.id,
    safeMetadata: {
      sourceReadId: sourceRead.id,
      host: input.sourceHost,
      totalBlocks,
      acceptedBlocks,
      rejectedBlocks: rejectedBlockCount,
      contentType: classification.contentType,
      confidence: classification.confidence,
      missingFields: extraction?.missingFields ?? [],
      pipelineStageId: stage.id,
    },
  }).catch(() => undefined);

  return {
    sourceReadId: sourceRead.id,
    reused: sourceRead.reused,
    checksum: sourceRead.checksum,
    classifierContentType: classification.contentType,
    classifierConfidence: classification.confidence,
    classifierReasons: classification.reasons,
    extraction,
    pipelineStageId: stage.id,
    rejected: false,
    rejectionReason: null,
    totalBlocks,
    acceptedBlocks,
    rejectedBlocks: rejectedBlockCount,
  };
}
