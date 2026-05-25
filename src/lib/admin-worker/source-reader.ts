/**
 * AdminWorkerSourceReader (spec §6). Orchestrator that turns a raw
 * source page into a structured `AdminWorkerSourceRead` row plus a
 * candidate extraction. Wires together:
 *
 *   stripJunk (inside extractors)
 *   → classify (classifier.ts)
 *   → extractByType (extractors.ts)
 *   → upsertSourceRead (source-reads.ts)
 *   → recordStage (pipeline-stages.ts)
 *   → rememberOutcome (memory.ts)
 *
 * This is the missing link that lets the Admin Worker actually advance
 * an item from "candidate URL" to "classified + extracted source-read"
 * in one call.
 */

import type { PrismaClient } from "@prisma/client";

import { classify, toChecklistContentType } from "./classifier";
import { extractByType, type ExtractorInput, type ExtractorOutput } from "./extractors";
import { rememberOutcome } from "./memory";
import { recordStage } from "./pipeline-stages";
import { upsertSourceRead } from "./source-reads";

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
}

/**
 * Read + classify + extract a source page. Always writes an
 * `AdminWorkerSourceRead` row (deduped by sha256). When the classifier
 * picks an extractable content type, runs the matching extractor and
 * records a CLASSIFY pipeline-stage row. Memory is updated with the
 * outcome so future passes can rank sources.
 */
export async function readSource(
  prisma: PrismaClient,
  input: ReadSourceInput,
): Promise<ReadSourceOutcome> {
  // 1. Persist the raw read first — deduped on sha256(rawBody).
  const sourceRead = await upsertSourceRead(prisma, {
    sourceUrl: input.sourceUrl,
    sourceHost: input.sourceHost,
    rawBody: input.rawBody,
    extractedTitle: input.title ?? null,
    extractedText: input.rawBody.slice(0, 20_000),
    detectedContentType: null,
  });

  // 2. Classify.
  const classification = classify({
    url: input.sourceUrl,
    title: input.title,
    headings: input.headings,
    bodyText: input.rawBody,
    sourceReputationTier: input.sourceReputationTier,
  });

  // 3. Update the read row with the detected content type + confidence.
  if (!sourceRead.reused) {
    await prisma.adminWorkerSourceRead.update({
      where: { id: sourceRead.id },
      data: {
        detectedContentType: classification.contentType,
        confidenceScore: classification.confidence,
      },
    });
  }

  // 4. Bail when classifier rejected the page.
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
    };
  }

  // 5. Run the extractor matching the chosen content type. Map ROSARY /
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
    title: input.title,
    headings: input.headings,
    bodyText: input.rawBody,
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

  // 6. Pipeline-stage row so the dashboard can see where this item sits.
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
    },
  });

  // 7. Update memory with extractor outcome so future passes can rank
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
  };
}
