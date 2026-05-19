/**
 * ParishBuilder.
 *
 * Builds actual parish directory records — not bulletins, not
 * livestream pages, not staff pages, not donation pages, not school
 * pages, not Mass schedules.
 */

import { extractParish } from "../../content-qa/extractors/parish";
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

const BUILDER_NAME = "ParishBuilder";
const BUILDER_VERSION = "1.0.0";

/**
 * Spec #13: reject bulletins, livestreams, staff pages, donation
 * pages, school pages, and Mass schedule pages — these don't carry
 * enough parish identity data even if they belong to a parish host.
 */
const BULLETIN_RE =
  /\b(?:bulletin|weekly\s+update|parish\s+staff|donate\s+now|livestream|catholic\s+school|mass\s+(?:schedule|times)|school\s+page)\b/i;

export const ParishBuilder: Builder = {
  contentType: "Parish",
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
      contentType: "Parish",
      purposeFlag: "canIngestParishes",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (BULLETIN_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason:
          "Candidate looks like a bulletin / staff / donation page, not a parish profile",
        candidateTitle: title,
      });
    }

    const result = extractParish({ title, body, sourceUrl: ctx.document.sourceUrl });
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
    attachFieldProvenance({ ctx: internal, prov, field: "parishName", method: "title-heuristic" });
    if (result.payload.address)
      attachFieldProvenance({ ctx: internal, prov, field: "address", method: "address-regex" });
    if (result.payload.city)
      attachFieldProvenance({ ctx: internal, prov, field: "city", method: "city-heuristic" });
    if (result.payload.region)
      attachFieldProvenance({ ctx: internal, prov, field: "region", method: "us-state-regex" });
    if (result.payload.country)
      attachFieldProvenance({ ctx: internal, prov, field: "country", method: "country-regex" });
    if (result.payload.diocese)
      attachFieldProvenance({ ctx: internal, prov, field: "diocese", method: "diocese-regex" });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(result.payload.parishName ?? title);
    return makeSuccess({
      ctx: internal,
      contentType: "Parish",
      slug,
      title: result.payload.parishName ?? title,
      payload: { ...result.payload },
      provenanceMap: prov,
    });
  },
};
