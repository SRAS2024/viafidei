/**
 * Shared helpers used by every package builder.
 *
 * Builders consume a SourceDocumentSnapshot, run extraction heuristics
 * against the cleaned body, and return a BuildResult. None of them
 * mutate the snapshot.
 */

import { createHash } from "node:crypto";
import { detectWrongContent } from "../../content-qa/wrong-content-detector";
import { normalizeSlug } from "../normalize";
import { provenance, deterministicProvenance } from "../provenance";
import type {
  BuildResult,
  Builder,
  BuilderContext,
  ContentPackage,
  ContentTypeKey,
  FieldProvenance,
  PackageProvenance,
  SourceDocumentSnapshot,
} from "../types";

export type BuilderInternalContext = BuilderContext & {
  builderName: string;
  builderVersion: string;
};

export function bodyOf(doc: SourceDocumentSnapshot): string {
  return doc.cleanedBody ?? doc.rawBody ?? doc.paragraphs?.join("\n\n") ?? "";
}

export function titleOf(doc: SourceDocumentSnapshot): string {
  return doc.sourceTitle ?? doc.headings?.[0]?.text ?? doc.sourceUrl;
}

export function checksumOf(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function ensureWrongContentClear(args: {
  contentType: ContentTypeKey;
  title: string;
  body: string;
}): { ok: true } | { ok: false; reason: string } {
  const result = detectWrongContent({
    contentType: args.contentType,
    title: args.title,
    body: args.body,
  });
  if (result.delete) {
    return { ok: false, reason: result.reasons.join("; ") };
  }
  return { ok: true };
}

export function sourceAllowedFor(args: {
  doc: SourceDocumentSnapshot;
  purposeFlag: string;
}): boolean {
  const purposes = args.doc.sourcePurposes ?? {};
  return Boolean(purposes[args.purposeFlag]);
}

export function makeFailure(args: {
  ctx: BuilderInternalContext;
  outcome: Exclude<BuildResult["outcome"], "built_complete_package">;
  failureReason: string;
  missingFields?: ReadonlyArray<string>;
  candidateSlug?: string;
  candidateTitle?: string;
  partialPayload?: Record<string, unknown>;
}): BuildResult {
  return {
    outcome: args.outcome,
    contentType: contentTypeFromBuilder(args.ctx.builderName),
    builderName: args.ctx.builderName,
    builderVersion: args.ctx.builderVersion,
    failureReason: args.failureReason,
    missingFields: args.missingFields ?? [],
    candidateSlug: args.candidateSlug,
    candidateTitle: args.candidateTitle,
    partialPayload: args.partialPayload,
  };
}

export function makeSuccess(args: {
  ctx: BuilderInternalContext;
  contentType: ContentTypeKey;
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  provenanceMap: PackageProvenance;
  language?: string;
  contentChecksum?: string | null;
  packageMetadata?: Record<string, unknown>;
}): BuildResult {
  const pkg: ContentPackage = {
    contentType: args.contentType,
    slug: args.slug,
    title: args.title,
    language: args.language ?? args.ctx.document.language ?? "en",
    sourceUrl: args.ctx.document.sourceUrl,
    sourceHost: args.ctx.document.sourceHost,
    sourceTier: args.ctx.document.sourceTier ?? null,
    contentChecksum: args.contentChecksum ?? checksumOf(JSON.stringify(args.payload)),
    payload: args.payload,
    provenance: args.provenanceMap,
    packageMetadata: args.packageMetadata,
    approvedSourcePurposes: enabledPurposes(args.ctx.document),
  };
  return {
    outcome: "built_complete_package",
    contentType: args.contentType,
    package: pkg,
    builderName: args.ctx.builderName,
    builderVersion: args.ctx.builderVersion,
    missingFields: [],
  };
}

export function enabledPurposes(doc: SourceDocumentSnapshot): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(doc.sourcePurposes ?? {})) {
    if (value === true) out.push(key);
  }
  return out;
}

/**
 * Compute a stable slug from the candidate title. Slug normalization
 * is a deterministic internal rule.
 */
export function slugFromTitle(title: string): string {
  return normalizeSlug(title);
}

/**
 * Attach a deterministic provenance entry for the slug to the
 * provenance map. Slug normalization is a deterministic internal
 * rule, so it doesn't need a snippet hash.
 */
export function attachSlugProvenance(args: {
  ctx: BuilderInternalContext;
  prov: PackageProvenance;
}): void {
  args.prov.slug = deterministicProvenance({
    document: args.ctx.document,
    method: "slug-normalize",
    builderVersion: args.ctx.builderVersion,
    rule: "deterministic-slug-normalize",
  });
}

/**
 * Attach a provenance entry for a regex-extracted field.
 */
export function attachFieldProvenance(args: {
  ctx: BuilderInternalContext;
  prov: PackageProvenance;
  field: string;
  method: string;
  snippet?: string;
  heading?: string;
  confidence?: number;
}): FieldProvenance {
  const entry = provenance({
    document: args.ctx.document,
    method: args.method,
    builderVersion: args.ctx.builderVersion,
    snippet: args.snippet,
    heading: args.heading,
    confidence: args.confidence,
  });
  args.prov[args.field] = entry;
  return entry;
}

/**
 * Identify the content type from the builder name (used in failure
 * paths where the success path isn't taken).
 */
export function contentTypeFromBuilder(builderName: string): ContentTypeKey {
  if (builderName.startsWith("PrayerBuilder")) return "Prayer";
  if (builderName.startsWith("SaintBuilder")) return "Saint";
  if (builderName.startsWith("MarianApparitionBuilder")) return "MarianApparition";
  if (builderName.startsWith("ParishBuilder")) return "Parish";
  if (builderName.startsWith("DevotionBuilder")) return "Devotion";
  if (builderName.startsWith("NovenaBuilder")) return "Novena";
  if (builderName.startsWith("SacramentBuilder")) return "Sacrament";
  if (builderName.startsWith("RosaryBuilder")) return "Rosary";
  if (builderName.startsWith("ConsecrationBuilder")) return "Consecration";
  if (builderName.startsWith("SpiritualGuidanceBuilder")) return "SpiritualGuidance";
  if (builderName.startsWith("LiturgyBuilder")) return "Liturgy";
  if (builderName.startsWith("HistoryBuilder")) return "History";
  return "Prayer";
}

/**
 * Standard guards every builder runs at the start of `.build()`:
 *
 *   1. Source not approved        → `source_not_allowed`
 *   2. Source returned no body    → `not_supported_by_source`
 *   3. Wrong content detector     → `wrong_content`
 *
 * Returns the early failure when one of the guards trips, or `null`
 * when the document is suitable for further extraction.
 */
export function runStandardGuards(args: {
  ctx: BuilderInternalContext;
  contentType: ContentTypeKey;
  purposeFlag: string;
  candidateTitle: string;
}): BuildResult | null {
  if (!sourceAllowedFor({ doc: args.ctx.document, purposeFlag: args.purposeFlag })) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "source_not_allowed",
      failureReason: `Source not approved for ${args.contentType}`,
      candidateTitle: args.candidateTitle,
    });
  }
  const body = bodyOf(args.ctx.document);
  if (!body || body.trim().length === 0) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "not_supported_by_source",
      failureReason: "Source document has no body content",
      candidateTitle: args.candidateTitle,
    });
  }
  const wrong = ensureWrongContentClear({
    contentType: args.contentType,
    title: args.candidateTitle,
    body,
  });
  if (!wrong.ok) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "wrong_content",
      failureReason: wrong.reason,
      candidateTitle: args.candidateTitle,
    });
  }
  return null;
}

export type { Builder };
