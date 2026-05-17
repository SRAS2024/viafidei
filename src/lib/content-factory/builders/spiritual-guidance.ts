/**
 * SpiritualGuidanceBuilder.
 *
 * Builds practical Catholic guides — not vague motivational posts,
 * not event pages, not guides without steps.
 */

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

const BUILDER_NAME = "SpiritualGuidanceBuilder";
const BUILDER_VERSION = "1.0.0";

const MOTIVATIONAL_RE =
  /\b(?:five\s+ways\s+to\s+(?:feel|be)|10\s+tips\s+for\s+a\s+better\s+life|inspirational\s+quotes?)\b/i;

const STEP_RE = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:step\s+(\d+)|(\d+)\.)\s+(.{5,200})/gi;

export const SpiritualGuidanceBuilder: Builder = {
  contentType: "SpiritualGuidance",
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
      contentType: "SpiritualGuidance",
      purposeFlag: "canIngestSpiritualGuides",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (MOTIVATIONAL_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate looks like a generic motivational post, not a practical guide",
        candidateTitle: title,
      });
    }

    const steps: Array<{ order: number; title: string; body: string }> = [];
    let m: RegExpExecArray | null;
    STEP_RE.lastIndex = 0;
    let order = 1;
    while ((m = STEP_RE.exec(body)) !== null) {
      const stepNum = parseInt(m[1] ?? m[2] ?? String(order), 10);
      steps.push({
        order: Number.isFinite(stepNum) ? stepNum : order,
        title: m[3].trim(),
        body: m[3].trim(),
      });
      order += 1;
    }
    if (steps.length < 2) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason: "Guide has fewer than two recognizable ordered steps",
        missingFields: ["steps"],
        candidateTitle: title,
      });
    }

    const background = body.split(/\n\n/)[0]?.trim() ?? "";
    if (background.length < 30) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason: "Background paragraph too short",
        missingFields: ["background"],
        candidateTitle: title,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({ ctx: internal, prov, field: "guideName", method: "title-heuristic" });
    attachFieldProvenance({ ctx: internal, prov, field: "background", method: "first-paragraph" });
    attachFieldProvenance({ ctx: internal, prov, field: "steps", method: "step-regex" });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(title);
    return makeSuccess({
      ctx: internal,
      contentType: "SpiritualGuidance",
      slug,
      title,
      payload: {
        guideName: title,
        background,
        practicalPurpose: background,
        steps,
        guideType: "Prayer routine",
        subtype: "spiritual-guide",
      },
      provenanceMap: prov,
      packageMetadata: { steps },
    });
  },
};
