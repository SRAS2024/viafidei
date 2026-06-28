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
  extractStructuredData,
  hasStructuredFacts,
  structuredFactsToText,
} from "./structured-data-extractors";
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
 * against the block-derived body. Memory is updated so later passes
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

  // 1b. Lift machine-readable structured data (schema.org JSON-LD, OpenGraph,
  //     microdata, Dublin Core meta). Keyless + deterministic; a no-op on pages
  //     with no structured data (so existing behaviour is unchanged), and a
  //     source of clean titles, dates, and names where a page marks them up.
  const structuredData = extractStructuredData(input.rawBody);
  const title = input.title ?? structured.title ?? structuredData.facts.title ?? null;

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

  // 5b. Catholic document-type enrichment (intelligence brain). On a NEW read,
  //     the brain identifies the document type and extracts structured Catholic
  //     references (canon law, Catechism, papal / council metadata) from the
  //     source text — so the unified Catholic-extraction capability genuinely
  //     runs on the live source-reading path. Recorded to the audit trail
  //     (dashboard op-mix). Advisory + fail-open; new reads only, brain-gated.
  if (!sourceRead.reused) {
    const { isBrainEnabled } = await import("./intelligence");
    const enrichText = (blockBody || input.rawBody).trim();
    if (isBrainEnabled() && enrichText.length > 0) {
      try {
        const { identifyDocumentType, extractStructuredCatholicDocument } =
          await import("./intelligence");
        const { recordBrainCall } = await import("./intelligence/store");
        const text = enrichText.slice(0, 6000);
        const ctx = { contentType: classification.contentType, entityId: sourceRead.id };
        const [docEnv, structEnv] = await Promise.all([
          identifyDocumentType(text),
          extractStructuredCatholicDocument(text),
        ]);
        await Promise.all([
          recordBrainCall(prisma, "identify_document_type", docEnv, ctx),
          recordBrainCall(prisma, "extract_structured_catholic_document", structEnv, ctx),
        ]);
      } catch {
        // Catholic-extraction enrichment is advisory — never break a read.
      }
    }
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

  // Fold the structured-data facts into the extractor body as labelled signal.
  // structuredFactsToText() returns "" when the page has no structured data, so
  // this is a strict no-op there and only enriches pages that mark facts up.
  const factsText = structuredFactsToText(structuredData.facts);
  const extractionBody = factsText ? `${classifierBody}\n\n${factsText}` : classifierBody;

  const extractorInput: ExtractorInput = {
    url: input.sourceUrl,
    host: input.sourceHost,
    title,
    headings,
    bodyText: extractionBody,
    blocks: structured.blocks,
    scriptureReferences: structured.scriptureReferences,
    checksum: sourceRead.checksum,
    language: input.language,
    structuredData: hasStructuredFacts(structuredData.facts) ? structuredData.facts : undefined,
  };

  // GUIDE and MARIAN_TITLE skip extraction (the checklist already builds
  // those); every other extractor-backed type runs here.
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
    extractorType === "PARISH" ||
    extractorType === "POPE" ||
    extractorType === "DOCTOR" ||
    extractorType === "RITE"
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

  // 9. Update memory with extractor outcome so later passes can rank
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
