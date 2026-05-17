/**
 * NovenaBuilder.
 *
 * Builds complete Novenas. A Novena must not be built from a generic
 * devotional summary or an event announcement.
 */

import { extractNovena } from "../../content-qa/extractors/novena";
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

const BUILDER_NAME = "NovenaBuilder";
const BUILDER_VERSION = "1.0.0";

const ADVERT_RE =
  /\b(join\s+us\s+for\s+(?:our\s+)?novena|attend\s+(?:the|our)\s+novena|novena\s+(?:begins|starts)\s+on)\b/i;

export const NovenaBuilder: Builder = {
  contentType: "Novena",
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
      contentType: "Novena",
      purposeFlag: "canIngestNovenas",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (ADVERT_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate advertises a novena event, not the actual novena content",
        candidateTitle: title,
      });
    }

    const result = extractNovena({ title, body, sourceUrl: ctx.document.sourceUrl });
    if (!result.complete || result.missingDays.length > 0) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason:
          result.missingDays.length > 0
            ? `Incomplete novena: missing day(s) ${result.missingDays.join(", ")}`
            : "Incomplete novena",
        missingFields: result.missingDays.map((d) => `day_${d}`),
        candidateTitle: title,
        partialPayload: result.payload as unknown as Record<string, unknown>,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({ ctx: internal, prov, field: "novenaName", method: "title-heuristic" });
    attachFieldProvenance({ ctx: internal, prov, field: "background", method: "first-paragraph" });
    attachFieldProvenance({ ctx: internal, prov, field: "purpose", method: "purpose-regex" });
    attachFieldProvenance({ ctx: internal, prov, field: "days", method: "day-header-regex" });
    attachSlugProvenance({ ctx: internal, prov });

    const payload = result.payload as unknown as Record<string, unknown>;
    const slug = slugFromTitle(String(payload.novenaName ?? title));
    const packageMetadata = {
      days: payload.days,
      durationDays: payload.durationDays ?? 9,
      closingPrayer: payload.closingPrayer,
    };

    return makeSuccess({
      ctx: internal,
      contentType: "Novena",
      slug,
      title: String(payload.novenaName ?? title),
      payload: { ...payload, subtype: "novena" },
      provenanceMap: prov,
      packageMetadata,
    });
  },
};
