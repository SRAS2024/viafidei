/**
 * HistoryBuilder.
 *
 * Builds approved Church history categories only — councils,
 * encyclicals, schisms, religious order foundings, catechisms,
 * Code of Canon Law, major papal acts, doctrinal definitions,
 * ecumenical events, liturgical reforms.
 *
 * Rejects news articles, random internet posts, local parish events,
 * local council meetings, and generic blog posts.
 */

import { extractHistory } from "../../content-qa/extractors/history";
import { normalizeHistoryType } from "../normalize";
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

const BUILDER_NAME = "HistoryBuilder";
const BUILDER_VERSION = "1.0.0";

export const HistoryBuilder: Builder = {
  contentType: "History",
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
      contentType: "History",
      purposeFlag: "canIngestHistory",
      candidateTitle: title,
    });
    if (guard) return guard;

    const body = bodyOf(ctx.document);
    const result = extractHistory({ title, body, sourceUrl: ctx.document.sourceUrl });
    if (result.wrongContentReason) {
      return makeFailure({
        ctx: internal,
        outcome: "wrong_content",
        failureReason: result.wrongContentReason,
        candidateTitle: title,
      });
    }
    if (!result.complete || !result.payload.historyType) {
      return makeFailure({
        ctx: internal,
        outcome: "build_failed_missing_required_fields",
        failureReason: !result.payload.historyType
          ? "Could not identify an approved Church history category"
          : `Missing required fields: ${result.missingFields.join(", ")}`,
        missingFields: result.missingFields,
        candidateTitle: title,
        partialPayload: result.payload as Record<string, unknown>,
      });
    }

    const prov: PackageProvenance = {};
    attachFieldProvenance({ ctx: internal, prov, field: "title", method: "title-heuristic" });
    attachFieldProvenance({ ctx: internal, prov, field: "summary", method: "first-paragraph" });
    attachFieldProvenance({ ctx: internal, prov, field: "body", method: "body-paragraphs" });
    attachFieldProvenance({
      ctx: internal,
      prov,
      field: "historyType",
      method: "regex-classifier",
    });
    if (result.payload.dateOrEra)
      attachFieldProvenance({
        ctx: internal,
        prov,
        field: "dateOrEra",
        method: "year-regex",
        snippet: result.payload.dateOrEra,
      });
    attachSlugProvenance({ ctx: internal, prov });

    const slug = slugFromTitle(title);
    const normalizedType =
      normalizeHistoryType(result.payload.historyType) ?? result.payload.historyType;

    return makeSuccess({
      ctx: internal,
      contentType: "History",
      slug,
      title,
      payload: { ...result.payload, historyType: normalizedType },
      provenanceMap: prov,
      packageMetadata: {
        historyType: normalizedType,
        dateOrEra: result.payload.dateOrEra,
      },
    });
  },
};
