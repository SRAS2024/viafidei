/**
 * Shared helpers used by every package builder.
 *
 * Builders consume a SourceDocumentSnapshot, run extraction heuristics
 * against the cleaned body, and return a BuildResult. None of them
 * mutate the snapshot.
 */

import { createHash } from "node:crypto";
import {
  detectWrongContent,
  hasStrongWrongContentSignal,
} from "../../content-qa/wrong-content-detector";
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
 * Entry guards every builder runs before any extraction:
 *
 *   1. Source not approved          → `source_not_allowed`
 *   2. Title is itself a non-content
 *      page (livestream / event /
 *      bulletin / news)              → `wrong_content`
 *   3. Title matches the builder's
 *      own reject pattern (e.g. an
 *      institution named after a
 *      saint, an article about a
 *      devotion)                     → `wrong_content`
 *   4. No body after cleanup         → `not_supported_by_source`
 *
 * Only the TITLE is judged for wrong-content here — the title is the
 * page's identity, never "surrounding noise". The noisy body is left
 * alone: a page that holds a real prayer / saint biography / devotion
 * practice often also carries livestream / event / donation noise, so
 * judging the whole raw page would reject valid content. Builders
 * extract the candidate first (`isolateContentCandidate`) and then
 * call `guardWrongContent` on that candidate.
 */
export function runEntryGuards(args: {
  ctx: BuilderInternalContext;
  contentType: ContentTypeKey;
  purposeFlag: string;
  candidateTitle: string;
  /**
   * Optional builder-specific title pattern. When the title matches,
   * the page IS the wrong kind of page (an institution named after a
   * saint, an article about a devotion, an event advertisement) — the
   * builder rejects it with the supplied reason before extraction.
   */
  titleReject?: { pattern: RegExp; reason: string };
}): BuildResult | null {
  if (!sourceAllowedFor({ doc: args.ctx.document, purposeFlag: args.purposeFlag })) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "source_not_allowed",
      failureReason: `Source not approved for ${args.contentType}`,
      candidateTitle: args.candidateTitle,
    });
  }
  if (hasStrongWrongContentSignal(args.candidateTitle)) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "wrong_content",
      failureReason: `Page title is a livestream / event / bulletin / news page, not ${args.contentType} content`,
      candidateTitle: args.candidateTitle,
    });
  }
  if (args.titleReject && args.titleReject.pattern.test(args.candidateTitle)) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "wrong_content",
      failureReason: args.titleReject.reason,
      candidateTitle: args.candidateTitle,
    });
  }
  const cleaned = bodyOf(args.ctx.document);
  if (!cleaned || cleaned.trim().length === 0) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "not_supported_by_source",
      failureReason: "Source document has no body content after cleanup",
      candidateTitle: args.candidateTitle,
    });
  }
  return null;
}

/**
 * Wrong-content guard. Runs the wrong-content detector against an
 * EXTRACTED candidate (title + isolated body) — never the raw page —
 * so livestream / event / donation / navigation noise around the real
 * content cannot trigger a false `wrong_content`. Returns the
 * `wrong_content` failure when the candidate itself is a livestream /
 * event / bulletin page, or `null` when it is clear.
 */
export function guardWrongContent(args: {
  ctx: BuilderInternalContext;
  contentType: ContentTypeKey;
  candidateTitle: string;
  candidateBody: string;
}): BuildResult | null {
  const wrong = detectWrongContent({
    contentType: args.contentType,
    title: args.candidateTitle,
    body: args.candidateBody,
  });
  if (wrong.delete) {
    return makeFailure({
      ctx: args.ctx,
      outcome: "wrong_content",
      failureReason: wrong.reasons.join("; "),
      candidateTitle: args.candidateTitle,
    });
  }
  return null;
}

/**
 * Candidate extraction before rejection.
 *
 * Splits a (possibly noisy) source body into paragraphs and drops the
 * paragraphs that are standalone page noise — livestream callouts,
 * event blurbs, donation appeals, newsletter sign-ups, navigation —
 * leaving the paragraphs that form the actual content body.
 *
 * A paragraph is dropped ONLY when it carries a strong wrong-content
 * signal AND no positive content marker, so a real prayer line that
 * mentions "register" or a saint biography that mentions a shrine
 * event is never discarded. When every paragraph looks like noise the
 * original body is returned unchanged so the wrong-content guard and
 * the extractor still get to judge it.
 */
export function isolateContentCandidate(args: {
  body: string;
  positiveMarker: RegExp;
}): { text: string; droppedNoiseCount: number } {
  const body = args.body ?? "";
  const segments = body
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length <= 1) {
    return { text: body.trim(), droppedNoiseCount: 0 };
  }
  const kept: string[] = [];
  let dropped = 0;
  for (const segment of segments) {
    const isNoise = hasStrongWrongContentSignal(segment) && !args.positiveMarker.test(segment);
    if (isNoise) {
      dropped += 1;
      continue;
    }
    kept.push(segment);
  }
  if (kept.length === 0) {
    return { text: body.trim(), droppedNoiseCount: 0 };
  }
  return { text: kept.join("\n\n"), droppedNoiseCount: dropped };
}

/**
 * Backwards-compatible standard guards: entry guards followed by a
 * wrong-content check against the cleaned (de-noised) body. Builders
 * that perform their own candidate extraction call `runEntryGuards`
 * and `guardWrongContent` directly so the wrong-content check runs
 * against the isolated candidate instead of the whole page.
 */
export function runStandardGuards(args: {
  ctx: BuilderInternalContext;
  contentType: ContentTypeKey;
  purposeFlag: string;
  candidateTitle: string;
}): BuildResult | null {
  const entry = runEntryGuards(args);
  if (entry) return entry;
  return guardWrongContent({
    ctx: args.ctx,
    contentType: args.contentType,
    candidateTitle: args.candidateTitle,
    candidateBody: bodyOf(args.ctx.document),
  });
}

export type { Builder };
