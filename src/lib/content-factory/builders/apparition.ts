/**
 * MarianApparitionBuilder.
 *
 * Builds actual apparition profiles — not travel pages, not tourism
 * pages, not parishes named after Our Lady, not articles that merely
 * mention an apparition.
 */

import { extractApparition } from "../../content-qa/extractors/apparition";
import {
  attachFieldProvenance,
  attachSlugProvenance,
  bodyOf,
  makeFailure,
  makeSuccess,
  runStandardGuards,
  slugFromTitle,
  titleOf,
  type BuilderInternalContext,
} from "./shared";
import type { Builder, PackageProvenance } from "../types";

const BUILDER_NAME = "MarianApparitionBuilder";
const BUILDER_VERSION = "1.0.0";

const TRAVEL_RE =
  /\b(travel\s+guide|things\s+to\s+do|tourist\s+(?:guide|information)|book\s+your\s+(?:trip|stay)|tour\s+package)\b/i;

export const MarianApparitionBuilder: Builder = {
  contentType: "MarianApparition",
  builderName: BUILDER_NAME,
  builderVersion: BUILDER_VERSION,
  build(ctx) {
    const internal: BuilderInternalContext = {
      ...ctx,
      builderName: BUILDER_NAME,
      builderVersion: BUILDER_VERSION,
    };
    const title = titleOf(ctx.document);
    const guard = runStandardGuards({
      ctx: internal,
      contentType: "MarianApparition",
      purposeFlag: "canIngestApparitions",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (TRAVEL_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate looks like a travel/tourism page, not an apparition profile",
        candidateTitle: title,
      });
    }

    const result = extractApparition({ title, body, sourceUrl: ctx.document.sourceUrl });
    if (!result.complete) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason: `Missing required fields: ${result.missingFields.join(", ")}`,
        missingFields: result.missingFields,
        candidateTitle: title,
        partialPayload: result.payload as Record<string, unknown>,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({ ctx: internal, prov, field: "apparitionName", method: "title-heuristic", snippet: result.payload.apparitionName ?? undefined });
    attachFieldProvenance({ ctx: internal, prov, field: "summary", method: "first-two-paragraphs", snippet: result.payload.summary ?? undefined });
    attachFieldProvenance({ ctx: internal, prov, field: "background", method: "first-paragraph", snippet: result.payload.background ?? undefined });
    if (result.payload.location)
      attachFieldProvenance({ ctx: internal, prov, field: "location", method: "known-place-lookup", snippet: result.payload.location });
    if (result.payload.country)
      attachFieldProvenance({ ctx: internal, prov, field: "country", method: "known-place-lookup", snippet: result.payload.country });
    attachFieldProvenance({ ctx: internal, prov, field: "approvalStatus", method: "regex-classifier" });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(result.payload.apparitionName ?? title);

    return makeSuccess({
      ctx: internal,
      contentType: "MarianApparition",
      slug,
      title: result.payload.apparitionName ?? title,
      payload: { ...result.payload },
      provenanceMap: prov,
    });
  },
};
