/**
 * PrayerBuilder.
 *
 * Builds a simple, valid prayer package — { title, payload:
 * { prayerName, prayerText, prayerType, category } } — whenever the
 * source page contains a real prayer. It isolates the actual prayer
 * text from surrounding article / livestream / event / donation /
 * navigation noise before judging the page, so a real prayer is no
 * longer rejected just because the page carries chrome around it.
 */

import { extractPrayer } from "../../content-qa/extractors/prayer";
import { normalizePrayerType } from "../normalize";
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

    // Entry guards — source approval, non-content title, empty body.
    const guard = runEntryGuards({
      ctx: internal,
      contentType: "Prayer",
      purposeFlag: "canIngestPrayers",
      candidateTitle: title,
    });
    if (guard) return guard;

    // Candidate extraction before rejection: isolate the prayer body
    // from surrounding livestream / event / donation / nav noise.
    const candidate = isolateContentCandidate({
      body: bodyOf(ctx.document),
      positiveMarker: PRAYER_LANGUAGE_RE,
    });

    // Wrong-content is judged against the isolated candidate, so page
    // noise around a real prayer no longer rejects the page.
    const wrong = guardWrongContent({
      ctx: internal,
      contentType: "Prayer",
      candidateTitle: title,
      candidateBody: candidate.text,
    });
    if (wrong) return wrong;

    // The isolated candidate must read like an actual prayer — an
    // article about prayer is wrong content, not a prayer.
    if (!PRAYER_LANGUAGE_RE.test(`${title}\n${candidate.text}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "No recognizable prayer language (Amen, O Lord, Hail Mary, …)",
        candidateTitle: title,
      });
    }

    const result = extractPrayer({
      title,
      body: candidate.text,
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
