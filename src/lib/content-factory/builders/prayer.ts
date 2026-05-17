/**
 * PrayerBuilder.
 *
 * Builds actual prayer packages — not articles, not livestreams, not
 * event listings. Rejects pages that lack a recognizable prayer body.
 */

import { extractPrayer } from "../../content-qa/extractors/prayer";
import { normalizePrayerType } from "../normalize";
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
import type { Builder, BuildResult, PackageProvenance } from "../types";

const BUILDER_NAME = "PrayerBuilder";
const BUILDER_VERSION = "1.0.0";

const PRAYER_LANGUAGE_RE =
  /\b(amen|o\s+lord|o\s+god|o\s+jesus|hail\s+mary|glory\s+be|lord\s+have\s+mercy|we\s+beseech|grant\s+(?:us|me|that)|pray\s+for\s+us|in\s+the\s+name\s+of\s+the\s+father|hallowed|forgive\s+us|deliver\s+us|come\s+holy\s+spirit|let\s+us\s+pray)\b/i;

export const PrayerBuilder: Builder = {
  contentType: "Prayer",
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
      contentType: "Prayer",
      purposeFlag: "canIngestPrayers",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (!PRAYER_LANGUAGE_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "No recognizable prayer language (Amen, O Lord, Hail Mary, …)",
        candidateTitle: title,
      });
    }

    const result = extractPrayer({
      title,
      body,
      sourceUrl: ctx.document.sourceUrl,
      language: ctx.document.language ?? "en",
    });
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
      field: "prayerName",
      method: "title-heuristic",
      snippet: result.payload.prayerName,
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "prayerText",
      method: "body-strip-nav",
      snippet: result.payload.prayerText,
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "prayerType",
      method: "regex-classifier",
      confidence: 0.75,
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "category",
      method: "derived-from-prayer-type",
    });
    attachSlugProvenance({ ctx: internal, prov });

    const prayerType = normalizePrayerType(
      result.payload.prayerType ?? "Traditional Catholic prayer",
    );
    const slug = slugFromTitle(result.payload.prayerName ?? title);

    return makeSuccess({
      ctx: internal,
      contentType: "Prayer",
      slug,
      title: result.payload.prayerName ?? title,
      payload: {
        prayerName: result.payload.prayerName,
        prayerText: result.payload.prayerText,
        prayerType,
        category: result.payload.category ?? prayerType,
      },
      provenanceMap: prov,
      language: result.payload.language ?? "en",
    });
  },
};

export type { BuildResult };
