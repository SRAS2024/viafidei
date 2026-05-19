/**
 * ConsecrationBuilder.
 *
 * Builds complete consecration guides — not articles, not retreat
 * adverts, not event pages.
 */

import { extractConsecration } from "../../content-qa/extractors/consecration";
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

const BUILDER_NAME = "ConsecrationBuilder";
const BUILDER_VERSION = "1.0.0";

/**
 * Spec #11: reject consecration articles, livestreams, retreats,
 * advertisements, and event pages that don't contain an actual
 * consecration structure.
 */
const RETREAT_RE =
  /\b(retreat\s+(?:registration|signup|details)|consecration\s+event|livestream|article\s+about\s+consecration|advertis(?:ement|ing)|register\s+for)\b/i;

export const ConsecrationBuilder: Builder = {
  contentType: "Consecration",
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
      contentType: "Consecration",
      purposeFlag: "canIngestConsecrations",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (RETREAT_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate looks like a retreat / event page, not a consecration guide",
        candidateTitle: title,
      });
    }

    const result = extractConsecration({ title, body, sourceUrl: ctx.document.sourceUrl });
    if (!result.complete) {
      const missing = result.missingDays.map((d) => `day_${d}`);
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason:
          missing.length > 0
            ? `Incomplete consecration: missing day(s) ${result.missingDays.join(", ")}`
            : "Incomplete consecration guide",
        missingFields: missing,
        candidateTitle: title,
        partialPayload: result.payload as unknown as Record<string, unknown>,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "consecrationName",
      method: "title-heuristic",
    });
    attachFieldProvenance({ ctx: internal, prov, field: "background", method: "first-paragraph" });
    attachFieldProvenance({ ctx: internal, prov, field: "durationDays", method: "duration-regex" });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "dailyPrayers",
      method: "labeled-section",
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "finalConsecrationPrayer",
      method: "labeled-section",
    });
    attachSlugProvenance({ ctx: internal, prov });

    const payload = result.payload as unknown as Record<string, unknown>;
    const slug = slugFromTitle(String(payload.consecrationName ?? title));
    return makeSuccess({
      ctx: internal,
      contentType: "Consecration",
      slug,
      title: String(payload.consecrationName ?? title),
      payload: { ...payload, subtype: "consecration" },
      provenanceMap: prov,
      packageMetadata: {
        dailyStructure: payload.dailyStructure,
        durationDays: payload.durationDays,
        finalConsecrationPrayer: payload.finalConsecrationPrayer,
      },
    });
  },
};
