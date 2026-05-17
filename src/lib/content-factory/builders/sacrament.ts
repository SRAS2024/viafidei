/**
 * SacramentBuilder.
 *
 * Builds only the seven canonical sacraments. Aliases (Confession,
 * Penance, Marriage) collapse to the canonical key.
 */

import { extractSacrament } from "../../content-qa/extractors/sacrament";
import { isCanonicalSacramentKey } from "../../content-qa/sacrament-normalize";
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
import { deterministicProvenance } from "../provenance";
import type { Builder, PackageProvenance } from "../types";

const BUILDER_NAME = "SacramentBuilder";
const BUILDER_VERSION = "1.0.0";

const SCHEDULE_RE =
  /\b(?:confession\s+(?:schedule|times?|hours)|sacrament\s+registration|registration\s+(?:for|open))\b/i;

export const SacramentBuilder: Builder = {
  contentType: "Sacrament",
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
      contentType: "Sacrament",
      purposeFlag: "canIngestSacraments",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    if (SCHEDULE_RE.test(`${title}\n${body}`)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Candidate looks like a sacrament schedule / registration page",
        candidateTitle: title,
      });
    }

    const result = extractSacrament({ title, body, sourceUrl: ctx.document.sourceUrl });
    if (!result.complete || !result.payload.sacramentKey) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason: !result.payload.sacramentKey
          ? "Could not identify one of the seven canonical sacraments"
          : `Missing required fields: ${result.missingFields.join(", ")}`,
        missingFields: result.missingFields,
        candidateTitle: title,
        partialPayload: result.payload as Record<string, unknown>,
      });
    }
    if (!isCanonicalSacramentKey(result.payload.sacramentKey)) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: "Sacrament key did not normalize to one of the seven canonical keys",
        candidateTitle: title,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "sacramentName",
      method: "canonical-name-map",
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "catholicExplanation",
      method: "labeled-section",
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "preparationGuide",
      method: "labeled-section",
    });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "participationGuide",
      method: "labeled-section",
    });
    if (result.payload.biblicalFoundation)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "biblicalFoundation",
        method: "labeled-section",
      });
    if (result.payload.catechismReferences?.length)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "catechismReferences",
        method: "ccc-regex",
      });
    // Sacrament key + group come from the canonical map — deterministic.
    prov.sacramentKey = deterministicProvenance({
      document: ctx.document,
      method: "sacrament-alias-normalize",
      builderVersion: BUILDER_VERSION,
      rule: "deterministic-sacrament-key",
    });
    prov.sacramentGroup = deterministicProvenance({
      document: ctx.document,
      method: "sacrament-group-map",
      builderVersion: BUILDER_VERSION,
      rule: "deterministic-sacrament-group",
    });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(result.payload.sacramentName ?? title);
    const packageMetadata = {
      sacramentKey: result.payload.sacramentKey,
      sacramentGroup: result.payload.sacramentGroup,
    };

    return makeSuccess({
      ctx: internal,
      contentType: "Sacrament",
      slug,
      title: result.payload.sacramentName ?? title,
      payload: { ...result.payload, subtype: "sacrament" },
      provenanceMap: prov,
      packageMetadata,
    });
  },
};
