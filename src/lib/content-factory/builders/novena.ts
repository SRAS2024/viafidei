/**
 * NovenaBuilder.
 *
 * Builds complete Novenas. It isolates the novena day structure from
 * surrounding article / livestream / event noise and extracts the
 * nine days when they are present. A Novena is rejected only when its
 * TITLE announces an event/advert, or when the day structure is
 * genuinely incomplete after a real extraction attempt.
 */

import { extractNovena } from "../../content-qa/extractors/novena";
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

const BUILDER_NAME = "NovenaBuilder";
const BUILDER_VERSION = "1.0.0";

const ADVERT_TITLE_RE =
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
    const guard = runEntryGuards({
      ctx: internal,
      contentType: "Novena",
      purposeFlag: "canIngestNovenas",
      candidateTitle: title,
      titleReject: {
        pattern: ADVERT_TITLE_RE,
        reason: "Candidate advertises a novena event, not the actual novena content",
      },
    });
    if (guard) return guard;

    // Candidate extraction before rejection: isolate the novena day
    // structure from livestream / event / donation / nav noise.
    const candidate = isolateContentCandidate({
      body: bodyOf(ctx.document),
      positiveMarker: contentTypeMarkers.devotionPractice,
    });

    const wrong = guardWrongContent({
      ctx: internal,
      contentType: "Novena",
      candidateTitle: title,
      candidateBody: candidate.text,
    });
    if (wrong) return wrong;

    const result = extractNovena({
      title,
      body: candidate.text,
      sourceUrl: ctx.document.sourceUrl,
    });
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
