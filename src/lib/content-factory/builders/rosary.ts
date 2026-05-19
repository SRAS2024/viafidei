/**
 * RosaryBuilder.
 *
 * Builds the full Rosary structure including the four mystery sets,
 * core prayers, and the optional Fatima prayer / Luminous mysteries
 * (controlled by app policy).
 */

import { extractRosary } from "../../content-qa/extractors/rosary";
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

const BUILDER_NAME = "RosaryBuilder";
const BUILDER_VERSION = "1.0.0";

/**
 * Spec #9: reject Rosary articles, livestreams, and event pages.
 * Only the actual Rosary structure (prayers + mystery sets) builds.
 */
const ROSARY_ARTICLE_RE =
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
    const guard = runStandardGuards({
      ctx: internal,
      contentType: "Rosary",
      purposeFlag: "canIngestRosaryGuides",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (ROSARY_ARTICLE_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate looks like a Rosary article, not the Rosary structure",
        candidateTitle: title,
      });
    }

    const result = extractRosary({ title, body, sourceUrl: ctx.document.sourceUrl });
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
