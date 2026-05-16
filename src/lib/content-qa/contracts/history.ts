/**
 * HistoryPackage contract.
 *
 * History must be narrow and strict. The History tab contains ONLY:
 *   - Councils
 *   - Major Church events
 *   - Encyclicals
 *   - Papal consecrations
 *   - Schisms
 *   - Religious order foundings
 *   - Catechisms of the Catholic Church
 *   - Code of Canon Law
 *   - Major papal acts tied directly to Church history
 *   - Major doctrinal definitions
 *   - Major ecumenical events
 *   - Major liturgical reforms when historically significant
 *
 * No news articles. No random internet postings. No modern parish
 * events. No generic Catholic blog articles.
 */

import { detectWrongContent, contentTypeMarkers } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "HistoryPackage";
const CONTRACT_VERSION = "1.0.0";

export const VALID_HISTORY_TYPES = [
  "Council",
  "Major Church event",
  "Encyclical",
  "Papal consecration",
  "Schism",
  "Religious order founding",
  "Catechism",
  "Code of Canon Law",
  "Major papal act",
  "Major doctrinal definition",
  "Major ecumenical event",
  "Major liturgical reform",
] as const;

export type HistoryType = (typeof VALID_HISTORY_TYPES)[number];

const HISTORY_TYPE_LOOKUP = new Map<string, HistoryType>(
  VALID_HISTORY_TYPES.map((t) => [t.toLowerCase(), t]),
);

const LOCAL_PARISH_HISTORY_RE =
  /\b(?:parish\s+council|finance\s+council|pastoral\s+council|school\s+council|parish\s+event|fundraiser|gala\s+night|conference\s+registration)\b/i;

const NEWS_ARTICLE_RE =
  /\b(?:breaking\s+news|news\s+(?:article|report|story)|press\s+release|published\s+(?:yesterday|today|on)|©\s+\d{4}\s+(?:reuters|ap|news))\b/i;

export type HistoryPackagePayload = {
  historyType?: string | null;
  title?: string | null;
  dateOrEra?: string | null;
  authorityOrInstitution?: string | null;
  summary?: string | null;
  body?: string | null;
  timelineOrder?: number | null;
  /** Per-history-type structured data (council members, encyclical text, etc.) */
  details?: Record<string, unknown>;
};

export function validateHistoryPackage(
  candidate: CandidatePackage & { payload: HistoryPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "History")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "History",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest history`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const historyType = candidate.payload.historyType?.trim();
  const title = (candidate.payload.title ?? candidate.title ?? "").trim();
  const dateOrEra = (candidate.payload.dateOrEra ?? "").trim();
  const summary = (candidate.payload.summary ?? "").trim();
  const body = (candidate.payload.body ?? "").trim();

  if (!title) failedFields.push("title");
  if (!dateOrEra) failedFields.push("dateOrEra");
  if (!summary) failedFields.push("summary");
  if (!body) failedFields.push("body");
  if (!candidate.sourceUrl) failedFields.push("sourceUrl");
  if (!historyType) failedFields.push("historyType");
  else if (!HISTORY_TYPE_LOOKUP.has(historyType.toLowerCase())) {
    failedFields.push("historyType");
    reasons.push(`historyType '${historyType}' is not in the allowed set`);
  }

  const blob = `${title}\n${summary}\n${body}`;

  // ── Local-parish history is rejected ──
  if (LOCAL_PARISH_HISTORY_RE.test(blob)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "History",
      failedFields: ["body"],
      reason:
        "History candidate is local-parish content (parish council / finance / pastoral council / event)",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }
  // ── News article is rejected ──
  if (NEWS_ARTICLE_RE.test(blob)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "History",
      failedFields: ["body"],
      reason: "History candidate is a news article / press release, not a historical package",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }
  // ── Body must read like historical narrative ──
  if (body && !contentTypeMarkers.historyNarrative.test(blob)) {
    failedFields.push("body");
    reasons.push(
      "History body lacks historical / doctrinal narrative (council, encyclical, schism, etc.)",
    );
  }

  const wrong = detectWrongContent({ contentType: "History", title, body: `${summary}\n${body}` });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "History",
      failedFields: ["body", ...failedFields].filter((v, i, a) => a.indexOf(v) === i),
      reason: wrong.reasons.join("; "),
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  if (failedFields.length > 0) {
    const decision: ContractDecision = "reject";
    return {
      decision,
      contractName: CONTRACT_NAME,
      contentType: "History",
      failedFields: Array.from(new Set(failedFields)),
      reason:
        reasons.length > 0
          ? reasons.join("; ")
          : `Missing required fields: ${failedFields.join(", ")}`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  return {
    decision: "publish",
    contractName: CONTRACT_NAME,
    contentType: "History",
    failedFields: [],
    reason: "All History contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export const historyContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "History" as const,
  allowedTypes: VALID_HISTORY_TYPES,
};
