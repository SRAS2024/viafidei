/**
 * Extraction skill pack — one certified skill per supported content type,
 * each wrapping the real `extractByType` extractor. A skill is named for the
 * canonical content type (extract_prayer, extract_papal_document, …) and
 * declares the subtypes it supports; types without a certified extractor
 * (diocese, religious order, creed, homepage block) get no skill here, so the
 * capability matrix reports them MISSING and files a developer request.
 *
 * Real work, real verification: execute runs the deterministic extractor and
 * fails on fatal reasons; verify confirms fields were produced and routes
 * missing required fields to the repair pack rather than reporting false
 * success.
 */

import { extractByType, type ExtractorInput, type ExtractorOutput } from "../extractors";
import { CONTENT_TYPE_CATALOG } from "./catalog";
import { check, decideFromChecks } from "./verification";
import type { CertifiedSkill, FailureClass, SkillContext } from "./types";

function extractionFailureClass(error: unknown): FailureClass {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (/timeout|network|fetch/i.test(msg)) return "RETRYABLE";
  // Extraction is deterministic over already-read text: a hard failure means the
  // package is incomplete and needs repair (fill missing fields) not a blind retry.
  return "NEEDS_REPAIR";
}

function asExtractorInput(ctx: SkillContext): ExtractorInput {
  const i = ctx.input as Record<string, unknown>;
  return {
    url: String(i.url ?? ""),
    host: String(i.host ?? ""),
    title: (i.title as string | null) ?? null,
    headings: (i.headings as string[]) ?? [],
    bodyText: (i.bodyText as string) ?? "",
    blocks: (i.blocks as ExtractorInput["blocks"]) ?? [],
    scriptureReferences: (i.scriptureReferences as string[]) ?? [],
    checksum: (i.checksum as string) ?? undefined,
    language: (i.language as string) ?? undefined,
  };
}

function makeExtractionSkill(
  canonicalType: string,
  extractable: NonNullable<(typeof CONTENT_TYPE_CATALOG)[number]["extractable"]>,
  subtypes: readonly string[],
): CertifiedSkill<ExtractorOutput> {
  return {
    name: `extract_${canonicalType.toLowerCase()}`,
    purpose: `Extract a complete ${canonicalType} content package from a read source page.`,
    category: "EXTRACTION",
    version: "1",
    contentTypes: [canonicalType],
    contentSubtypes: subtypes,
    inputs: ["url", "host", "title", "bodyText", "blocks", "scriptureReferences"],
    outputs: [
      "fields",
      "missingFields",
      "confidenceScore",
      "sourceEvidence",
      "fatalReasons",
      "contentSubtype",
    ],
    preconditions: ["the source page has been fetched and read into blocks/body text"],
    requiredPermissions: ["read_source"],
    riskLevel: "low",
    idempotencyKey: (ctx) =>
      `extract_${canonicalType}:${String((ctx.input as Record<string, unknown>).checksum ?? (ctx.input as Record<string, unknown>).url ?? "")}`,
    brainOps: ["extract_knowledge", "extract_structured_catholic_document"],
    safetyGates: ["required_fields", "field_provenance"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    failureClassifier: (err) => extractionFailureClass(err),
    retryPolicy: {
      maxAttempts: 2,
      backoff: "none",
      retryableClasses: ["RETRYABLE"],
      routeToRepairAfter: 2,
      developerRequestAfter: 4,
    },
    successMetrics: ["confidence_score", "required_fields_present"],
    testsRequired: [`extraction covers ${canonicalType}`],
    execute: async (ctx) => {
      const out = extractByType(extractable, asExtractorInput(ctx));
      if (out.fatalReasons.length > 0) {
        return {
          status: "FAILED",
          failureReason: out.fatalReasons.join("; "),
          evidence: { confidence: out.confidenceScore, fatal: out.fatalReasons },
        };
      }
      return {
        status: "SUCCEEDED",
        output: out,
        outputEntityType: "AdminWorkerPackageArtifact",
        evidence: { confidence: out.confidenceScore, missing: out.missingFields },
      };
    },
    verify: async (_ctx, result) => {
      const out = result.output;
      const checks = [
        check("produced_fields", !!out && Object.keys(out.fields).length > 0),
        check("no_fatal_reasons", !!out && out.fatalReasons.length === 0),
        check(
          "confidence_ok",
          !!out && out.confidenceScore >= 0.4,
          `confidence ${out?.confidenceScore ?? 0}`,
        ),
      ];
      // Missing required fields → repair pack fills them; not a false success.
      if (out && out.missingFields.length > 0) {
        return {
          ok: false,
          decision: "REPAIR",
          checks,
          reason: `missing required fields: ${out.missingFields.join(", ")}`,
        };
      }
      return decideFromChecks(checks, "REPAIR");
    },
  };
}

/** Certified extraction skills for every content type backed by a real extractor. */
export const extractionSkills: readonly CertifiedSkill<ExtractorOutput>[] =
  CONTENT_TYPE_CATALOG.filter((c) => c.extractable != null).map((c) =>
    makeExtractionSkill(c.type, c.extractable as NonNullable<typeof c.extractable>, c.subtypes),
  );
