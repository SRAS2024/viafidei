/**
 * DevotionBuilder.
 *
 * Builds actual devotions — not articles about devotions, not
 * livestreams, not event pages, not reflections without practice
 * structure.
 */

import { extractDevotion } from "../../content-qa/extractors/devotion";
import { normalizeDevotionType } from "../normalize";
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

const BUILDER_NAME = "DevotionBuilder";
const BUILDER_VERSION = "1.0.0";

const ARTICLE_RE = /\b(?:article\s+about|reflection\s+on|opinion\s+piece|column)\b/i;

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
    const guard = runStandardGuards({
      ctx: internal,
      contentType: "Devotion",
      purposeFlag: "canIngestDevotions",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (ARTICLE_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate looks like an article about a devotion, not the devotion itself",
        candidateTitle: title,
      });
    }

    const result = extractDevotion({ title, body, sourceUrl: ctx.document.sourceUrl });
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
