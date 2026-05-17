/**
 * LiturgyBuilder.
 *
 * Builds liturgical formation content — not Mass schedules, not
 * livestreams, not bulletins, not parish event pages, not news.
 */

import { extractLiturgy } from "../../content-qa/extractors/liturgy";
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

const BUILDER_NAME = "LiturgyBuilder";
const BUILDER_VERSION = "1.0.0";

const MASS_SCHEDULE_RE =
  /\b(?:mass\s+(?:schedule|times?|hours)|sunday\s+mass\s+at|daily\s+mass\s+(?:at|times?))\b/i;

export const LiturgyBuilder: Builder = {
  contentType: "Liturgy",
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
      contentType: "Liturgy",
      purposeFlag: "canIngestLiturgy",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (MASS_SCHEDULE_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate looks like a Mass schedule, not liturgical formation",
        candidateTitle: title,
      });
    }

    const result = extractLiturgy({ title, body, sourceUrl: ctx.document.sourceUrl });
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
    attachFieldProvenance({ ctx: internal, prov, field: "title", method: "title-heuristic" });
    attachFieldProvenance({ ctx: internal, prov, field: "summary", method: "first-paragraph" });
    attachFieldProvenance({ ctx: internal, prov, field: "body", method: "body-paragraphs" });
    attachFieldProvenance({ ctx: internal, prov, field: "liturgyKind", method: "regex-classifier" });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(title);
    return makeSuccess({
      ctx: internal,
      contentType: "Liturgy",
      slug,
      title,
      payload: { ...result.payload },
      provenanceMap: prov,
    });
  },
};
