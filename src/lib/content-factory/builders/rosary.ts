/**
 * RosaryBuilder.
 *
 * Builds the full Rosary structure including the four mystery sets,
 * core prayers, and the optional Fatima prayer / Luminous mysteries
 * (controlled by app policy). It isolates the Rosary structure from
 * surrounding article / livestream / event noise, and rejects only a
 * page whose TITLE is a Rosary article / livestream / event.
 */

import { extractRosary } from "../../content-qa/extractors/rosary";
import { contentTypeMarkers } from "../../content-qa/wrong-content-detector";
import {
  attachFieldProvenance,
  attachSlugProvenance,
  bodyOf,
  guardWrongContent,
  isolateContentCandidate,
  makeFailure,
  makeSuccess,
  runEntryGuards,
  slugFromTitle,
  titleOf,
  type BuilderInternalContext,
} from "./shared";
import type { Builder, PackageProvenance } from "../types";

const BUILDER_NAME = "RosaryBuilder";
const BUILDER_VERSION = "1.0.0";

/**
 * A TITLE that announces a Rosary article / listicle / livestream /
 * event — not the Rosary structure itself. The body is not matched
 * here; the actual prayer order is extracted from the candidate.
 */
const ROSARY_ARTICLE_TITLE_RE =
  /\b(?:why\s+(?:we\s+)?pray\s+the\s+rosary|history\s+of\s+the\s+rosary|five\s+(?:facts|things)\s+about|rosary\s+livestream|rosary\s+event|live\s+rosary)\b/i;

export const RosaryBuilder: Builder = {
  contentType: "Rosary",
  builderName: BUILDER_NAME,
  builderVersion: BUILDER_VERSION,
  build(ctx) {
    const internal: BuilderInternalContext = {
      ...ctx,
      builderName: BUILDER_NAME,
      builderVersion: BUILDER_VERSION,
    };
    const title = titleOf(ctx.document);
    const guard = runEntryGuards({
      ctx: internal,
      contentType: "Rosary",
      purposeFlag: "canIngestRosaryGuides",
      candidateTitle: title,
      titleReject: {
        pattern: ROSARY_ARTICLE_TITLE_RE,
        reason: "Candidate looks like a Rosary article, not the Rosary structure",
      },
    });
    if (guard) return guard;

    // Candidate extraction before rejection: isolate the Rosary
    // structure from livestream / event / donation / nav noise.
    const candidate = isolateContentCandidate({
      body: bodyOf(ctx.document),
      positiveMarker: contentTypeMarkers.devotionPractice,
    });

    const wrong = guardWrongContent({
      ctx: internal,
      contentType: "Rosary",
      candidateTitle: title,
      candidateBody: candidate.text,
    });
    if (wrong) return wrong;

    const result = extractRosary({
      title,
      body: candidate.text,
      sourceUrl: ctx.document.sourceUrl,
    });
    const missingFields = [
      ...result.missingPrayers.map((p) => `prayer:${p}`),
      ...result.missingMysterySets.map((m) => `mysteries:${m}`),
    ];
    if (!result.complete) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields,
        candidateTitle: title,
        partialPayload: result.payload as unknown as Record<string, unknown>,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({ ctx: internal, prov, field: "background", method: "first-paragraph" });
    attachFieldProvenance({ ctx: internal, prov, field: "mysterySets", method: "mystery-headers" });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "openingPrayers",
      method: "labeled-prayer-blocks",
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "closingPrayers",
      method: "labeled-prayer-blocks",
    });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(title);
    const payload = result.payload as unknown as Record<string, unknown>;
    return makeSuccess({
      ctx: internal,
      contentType: "Rosary",
      slug,
      title,
      payload: { ...payload, subtype: "rosary" },
      provenanceMap: prov,
      packageMetadata: {
        mysterySets: payload.mysterySets,
        openingPrayers: payload.openingPrayers,
        closingPrayers: payload.closingPrayers,
      },
    });
  },
};
