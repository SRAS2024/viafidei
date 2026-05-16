/**
 * SaintPackage contract.
 *
 * A Saint must be the actual saint profile — not a parish named after
 * a saint, not a school named after a saint, not a livestream from a
 * church named after a saint, not a news article that mentions a saint.
 *
 * Required:
 *   - contentType = Saint
 *   - saintType   — one of Saint / Blessed / Venerable / etc.
 *   - saintName   — the saint's canonical name
 *   - feastDay    — feast day string (when known)
 *   - feastMonth  — numeric month (1-12)
 *   - feastDayOfMonth — numeric day (1-31)
 *   - background  — biography or life summary
 *   - patronage   — array of patronage labels
 *   - sourceUrl, sourceHost, contentChecksum, publicRenderReady
 *
 * Institution-confusion detection rejects saint candidates whose body
 * is overwhelmingly about a parish, church, school, hospital, shrine
 * event, staff directory, ministry page, livestream, bulletin, or
 * Mass schedule.
 */

import { detectWrongContent, contentTypeMarkers } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "SaintPackage";
const CONTRACT_VERSION = "1.0.0";

export const VALID_SAINT_TYPES = [
  "Saint",
  "Blessed",
  "Venerable",
  "Servant of God",
  "Martyr",
  "Doctor of the Church",
  "Apostle",
  "Evangelist",
  "Church Father",
  "Pope saint",
] as const;

export type SaintType = (typeof VALID_SAINT_TYPES)[number];

const SAINT_TYPE_LOOKUP = new Map<string, SaintType>(
  VALID_SAINT_TYPES.map((t) => [t.toLowerCase(), t]),
);

const DAYS_PER_MONTH: ReadonlyArray<number> = [
  31, // Jan
  29, // Feb (allow 29 to permit leap-year saints)
  31, // Mar
  30, // Apr
  31, // May
  30, // Jun
  31, // Jul
  31, // Aug
  30, // Sep
  31, // Oct
  30, // Nov
  31, // Dec
];

const INSTITUTION_CONFUSION_RE =
  /\b(?:parish|church\s+of|school|academy|university|hospital|shrine\s+event|staff\s+directory|ministry\s+page|livestream|bulletin|mass\s+schedule|office\s+hours|K-?12|K\s*through\s*12)\b/i;

/**
 * When the saint name itself reads like a parish, school, or institution
 * (e.g. "Saint Mary Parish", "Saint Paul Academy", "Saint Joseph
 * Hospital"), the candidate is the institution, NOT the saint. Delete.
 */
const NAME_IS_INSTITUTION_RE =
  /\bsaint\s+\w+(?:\s+\w+)*\s+(?:parish|church|cathedral|basilica|school|academy|university|college|hospital|institute|center|seminary|shrine)\b/i;

const NEWS_ARTICLE_RE =
  /\b(?:news\s+(?:article|release|report)|press\s+release|breaking\s+news|published\s+\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i;

export type SaintPackagePayload = {
  saintType?: string | null;
  saintName?: string | null;
  feastDay?: string | null;
  feastMonth?: number | null;
  feastDayOfMonth?: number | null;
  background?: string | null;
  patronage?: string[] | null;
  sourceProvidesFeastDay?: boolean;
};

export function validateSaintPackage(
  candidate: CandidatePackage & { payload: SaintPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  // ── Source-purpose gate ──
  if (!isSourceApprovedFor(options.sourcePurposes, "Saint")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Saint",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest saints (canIngestSaints=false)`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const saintType = candidate.payload.saintType?.trim();
  const saintName = (candidate.payload.saintName ?? candidate.title ?? "").trim();
  const background = (candidate.payload.background ?? "").trim();
  const patronage = candidate.payload.patronage ?? [];
  const feastMonth = candidate.payload.feastMonth ?? null;
  const feastDayOfMonth = candidate.payload.feastDayOfMonth ?? null;
  const sourceProvidesFeastDay = candidate.payload.sourceProvidesFeastDay !== false;

  // ── Required fields ──
  if (!saintName) failedFields.push("saintName");
  if (!saintType) failedFields.push("saintType");
  else if (!SAINT_TYPE_LOOKUP.has(saintType.toLowerCase())) {
    failedFields.push("saintType");
    reasons.push(`saintType '${saintType}' is not a recognised canonical title`);
  }
  if (!background) failedFields.push("background");
  else if (background.length < 80) {
    failedFields.push("background");
    reasons.push("Saint background is too short to be a real biography");
  } else if (!contentTypeMarkers.saint.test(background)) {
    failedFields.push("background");
    reasons.push(
      "Saint background lacks biographical vocabulary (born, died, feast, patron, etc.)",
    );
  }

  // ── Feast day validation ──
  if (feastMonth != null && (feastMonth < 1 || feastMonth > 12)) {
    failedFields.push("feastMonth");
    reasons.push(`feastMonth '${feastMonth}' is out of range 1..12`);
  }
  if (feastMonth != null && feastMonth >= 1 && feastMonth <= 12 && feastDayOfMonth != null) {
    const cap = DAYS_PER_MONTH[feastMonth - 1] ?? 31;
    if (feastDayOfMonth < 1 || feastDayOfMonth > cap) {
      failedFields.push("feastDayOfMonth");
      reasons.push(`feastDayOfMonth '${feastDayOfMonth}' is invalid for month ${feastMonth}`);
    }
  }
  if (sourceProvidesFeastDay && feastMonth == null && feastDayOfMonth == null) {
    failedFields.push("feastDay");
    reasons.push("Saint source normally provides a feast day, but none was extracted");
  }

  // ── Patronage validation ──
  if (Array.isArray(patronage) && patronage.length > 0) {
    for (const entry of patronage) {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        failedFields.push("patronage");
        reasons.push("patronage contains empty / non-string entries");
        break;
      }
      if (/\b(?:home|about|donate|register|click\s+here|read\s+more|skip\s+to)\b/i.test(entry)) {
        failedFields.push("patronage");
        reasons.push(`patronage entry '${entry}' looks like navigation text`);
        break;
      }
      if (
        /\b(?:ministry|committee|council)\b/i.test(entry) &&
        !/\b(?:patron|patroness)\b/i.test(entry)
      ) {
        failedFields.push("patronage");
        reasons.push(`patronage entry '${entry}' looks like a parish ministry, not patronage`);
        break;
      }
    }
  }

  // ── Institution-confusion detection ──
  const blob = `${saintName}\n${background}`;
  // First: if the NAME itself is an institution ("Saint X Parish", "Saint Y
  // Academy", etc.), the candidate is the institution — delete regardless
  // of biography vocabulary.
  if (NAME_IS_INSTITUTION_RE.test(saintName)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Saint",
      failedFields: ["saintName"],
      reason:
        "Saint candidate name is an institution (parish / school / hospital / academy named after a saint)",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }
  if (INSTITUTION_CONFUSION_RE.test(blob) && !contentTypeMarkers.saint.test(background)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Saint",
      failedFields: ["background"],
      reason:
        "Saint candidate is an institution (parish / school / shrine event) named after a saint, not a saint profile",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }
  if (NEWS_ARTICLE_RE.test(blob)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Saint",
      failedFields: ["background"],
      reason: "Saint candidate is a news article that mentions a saint, not a saint profile",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  // ── Wrong-content detector ──
  const wrong = detectWrongContent({ contentType: "Saint", title: saintName, body: background });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Saint",
      failedFields: ["background", ...failedFields].filter((v, i, a) => a.indexOf(v) === i),
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
      contentType: "Saint",
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
    contentType: "Saint",
    failedFields: [],
    reason: "All Saint contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export function isSaintRenderReady(row: {
  saintType?: string | null;
  canonicalName: string;
  feastDay?: string | null;
  feastMonth?: number | null;
  feastDayOfMonth?: number | null;
  biography: string;
  patronages: string[];
}): boolean {
  if (!row.saintType || !SAINT_TYPE_LOOKUP.has(row.saintType.toLowerCase())) return false;
  if (!row.canonicalName || row.canonicalName.trim().length < 2) return false;
  if (!row.biography || row.biography.trim().length < 80) return false;
  if (!contentTypeMarkers.saint.test(row.biography)) return false;
  return true;
}

export const saintContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Saint" as const,
  allowedTypes: VALID_SAINT_TYPES,
};
