/**
 * SaintBuilder.
 *
 * Builds a valid saint-profile package — { title, payload:
 * { saintName, feastDay, patronages, biography, saintType,
 * officialPrayer } }. It isolates the biographical prose from
 * surrounding page noise before judging the page, and only rejects
 * candidates that are clearly NOT saint profiles: institutions,
 * staff pages, parishes, schools, hospitals, or livestreams.
 */

import { extractSaint } from "../../content-qa/extractors/saint";
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

    // Entry guards — source approval, empty body, and a title that
    // names an institution ("St. X Parish / School / Hospital") is the
    // institution, not the saint.
    const guard = runEntryGuards({
      ctx: internal,
      contentType: "Saint",
      purposeFlag: "canIngestSaints",
      candidateTitle: title,
      titleReject: {
        pattern: INSTITUTION_RE,
        reason: "Candidate looks like an institution named after a saint, not a saint profile",
      },
    });
    if (guard) return guard;

    // Candidate extraction before rejection: isolate the biographical
    // prose from livestream / event / donation / navigation noise.
    const candidate = isolateContentCandidate({
      body: bodyOf(ctx.document),
      positiveMarker: contentTypeMarkers.saint,
    });

    // Wrong-content is judged against the isolated biography, so a
    // shrine-event mention inside a real profile no longer rejects it.
    const wrong = guardWrongContent({
      ctx: internal,
      contentType: "Saint",
      candidateTitle: title,
      candidateBody: candidate.text,
    });
    if (wrong) return wrong;

    const result = extractSaint({ title, body: candidate.text, sourceUrl: ctx.document.sourceUrl });
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
