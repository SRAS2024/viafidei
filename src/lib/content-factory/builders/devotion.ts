/**
 * DevotionBuilder.
 *
 * Builds actual devotions — the devotional practice and how to follow
 * it. It isolates the devotion content from surrounding article /
 * livestream / event / navigation noise and extracts the practice
 * when it is present, instead of treating every page with noise
 * around it as wrong content. Only a page whose TITLE announces an
 * article / livestream / event, or whose content carries no devotion
 * practice at all, is rejected.
 */

import { extractDevotion } from "../../content-qa/extractors/devotion";
import { contentTypeMarkers } from "../../content-qa/wrong-content-detector";
import { normalizeDevotionType } from "../normalize";
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

const BUILDER_NAME = "DevotionBuilder";
const BUILDER_VERSION = "1.0.0";

/**
 * A TITLE that announces an article / opinion piece / retreat
 * registration / event — the page is about a devotion, not the
 * devotion itself. The body is NOT matched here; surrounding article
 * prose around a real devotion must not sink the page.
 */
const ARTICLE_TITLE_RE =
  /\b(?:article\s+about|reflection\s+on|opinion\s+piece|column|retreat\s+(?:registration|details|signup)|advertis(?:ement|ing)|event\s+(?:registration|details|signup))\b/i;

export const DevotionBuilder: Builder = {
  contentType: "Devotion",
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
      contentType: "Devotion",
      purposeFlag: "canIngestDevotions",
      candidateTitle: title,
      titleReject: {
        pattern: ARTICLE_TITLE_RE,
        reason: "Candidate looks like an article about a devotion, not the devotion itself",
      },
    });
    if (guard) return guard;

    // Candidate extraction before rejection: isolate the devotion
    // content from livestream / event / donation / nav noise.
    const candidate = isolateContentCandidate({
      body: bodyOf(ctx.document),
      positiveMarker: contentTypeMarkers.devotionPractice,
    });

    const wrong = guardWrongContent({
      ctx: internal,
      contentType: "Devotion",
      candidateTitle: title,
      candidateBody: candidate.text,
    });
    if (wrong) return wrong;

    const result = extractDevotion({ title, body: candidate.text, sourceUrl: ctx.document.sourceUrl });
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
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "devotionName",
      method: "title-heuristic",
    });
    attachFieldProvenance({ ctx: internal, prov, field: "background", method: "first-paragraph" });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "devotionType",
      method: "regex-classifier",
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "practiceInstructions",
      method: "practice-regex",
    });
    attachSlugProvenance({ ctx: internal, prov });

    const payload = result.payload as Record<string, unknown>;
    payload.devotionType = normalizeDevotionType(String(payload.devotionType ?? "General"));
    const slug = slugFromTitle(String(payload.devotionName ?? title));

    return makeSuccess({
      ctx: internal,
      contentType: "Devotion",
      slug,
      title: String(payload.devotionName ?? title),
      payload,
      provenanceMap: prov,
    });
  },
};
