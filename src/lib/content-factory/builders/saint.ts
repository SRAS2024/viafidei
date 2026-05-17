/**
 * SaintBuilder.
 *
 * Builds actual saint profiles — not parishes / schools / hospitals
 * named after saints, not staff pages, not livestreams.
 */

import { extractSaint } from "../../content-qa/extractors/saint";
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

const BUILDER_NAME = "SaintBuilder";
const BUILDER_VERSION = "1.0.0";

const INSTITUTION_RE = /\b(parish|school|hospital|church|university|college|cathedral|seminary)\b/i;

export const SaintBuilder: Builder = {
  contentType: "Saint",
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
      contentType: "Saint",
      purposeFlag: "canIngestSaints",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (INSTITUTION_RE.test(title)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason:
          "Candidate looks like an institution named after a saint, not a saint profile",
        candidateTitle: title,
      });
    }

    const result = extractSaint({ title, body, sourceUrl: ctx.document.sourceUrl });
    if (!result.complete) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason: `Missing required fields: ${result.missingFields.join(", ")}`,
        missingFields: result.missingFields,
        candidateTitle: title,
        partialPayload: result.payload,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "saintName",
      method: "title-heuristic",
      snippet: result.payload.saintName,
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "biography",
      method: "body-paragraphs",
      snippet: result.payload.biography,
    });
    attachFieldProvenance({ ctx: internal, prov, field: "saintType", method: "regex-classifier" });
    if (result.payload.feastDay)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "feastDay",
        method: "feast-day-regex",
        snippet: result.payload.feastDay,
      });
    if (result.payload.feastMonth != null)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "feastMonth",
        method: "feast-day-regex",
      });
    if (result.payload.feastDayOfMonth != null)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "feastDayOfMonth",
        method: "feast-day-regex",
      });
    if (result.payload.patronages && result.payload.patronages.length > 0)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "patronages",
        method: "patronage-regex",
      });
    if (result.payload.officialPrayer)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "officialPrayer",
        method: "official-prayer-regex",
        snippet: result.payload.officialPrayer,
      });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(result.payload.saintName ?? title);

    return makeSuccess({
      ctx: internal,
      contentType: "Saint",
      slug,
      title: result.payload.saintName ?? title,
      payload: { ...result.payload },
      provenanceMap: prov,
    });
  },
};
