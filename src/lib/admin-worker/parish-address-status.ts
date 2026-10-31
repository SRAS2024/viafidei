/**
 * Address completeness for a published parish, and the research state the
 * address-research lane keeps per row in `payload._meta.addressResearch`.
 *
 * "Complete" was never defined, so nothing could tell "this parish has no
 * public address" from "nobody has looked yet". Now a parish address is
 * complete when it has a street line, a locality, a country code, and — where
 * the country uses them — a postal code. Each research attempt records what is
 * still missing and when to look again:
 *
 *   complete        nothing missing (re-checked after a year)
 *   partial         something still missing → retry after 7 days, then 30
 *   needs_research  still missing after 3 attempts, or the source no longer
 *                   returns the object → retried every 90 days
 *
 * `_meta` is provenance, not content, so this state never counts as a content
 * change in the protection gate. Pure and deterministic.
 */

import { countryUsesPostalCodes } from "./parish-address-format";

export type AddressField = "address" | "city" | "postalCode" | "countryCode";
export type AddressResearchStatus = "complete" | "partial" | "needs_research";
export type AddressPrecision = "rooftop" | "street" | "locality";

export interface AddressResearchMeta {
  status: AddressResearchStatus;
  missing: AddressField[];
  /** rooftop = street + house number; street = street only; else locality. */
  precision: AddressPrecision;
  /** Where the address fields came from ("osm" tags, the "nominatim" lookup). */
  sources: string[];
  attempts: number;
  lastAttemptAt: number;
  nextDueAt: number;
  /** The stored country code a lookup replaced, when it disagreed. */
  countryCorrectedFrom?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Retry cadence: after the 1st partial attempt, the 2nd, then for good. */
export const ADDRESS_RETRY_FIRST_MS = 7 * DAY_MS;
export const ADDRESS_RETRY_SECOND_MS = 30 * DAY_MS;
export const ADDRESS_RETRY_LATE_MS = 90 * DAY_MS;
const COMPLETE_RECHECK_MS = 365 * DAY_MS;
/** Partial attempts before a parish is marked needs_research. */
export const MAX_PARTIAL_ATTEMPTS = 3;

function filled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** The address fields a payload still lacks, in a stable order. */
export function missingAddressFields(payload: Record<string, unknown>): AddressField[] {
  const missing: AddressField[] = [];
  if (!filled(payload.address)) missing.push("address");
  if (!filled(payload.city)) missing.push("city");
  const cc = typeof payload.countryCode === "string" ? payload.countryCode : "";
  if (!filled(payload.postalCode) && countryUsesPostalCodes(cc)) missing.push("postalCode");
  if (!filled(payload.countryCode)) missing.push("countryCode");
  return missing;
}

/** The stored research state, or null when the row was never researched. */
export function addressResearchMetaOf(
  payload: Record<string, unknown>,
): Partial<AddressResearchMeta> | null {
  const meta = payload._meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const v = (meta as Record<string, unknown>).addressResearch;
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Partial<AddressResearchMeta>)
    : null;
}

/** Precision of the stored street line (a number token reads as a house number). */
export function addressPrecisionOf(
  streetLine: unknown,
  knownHouseNumber?: boolean,
): AddressPrecision {
  if (!filled(streetLine)) return "locality";
  if (knownHouseNumber != null) return knownHouseNumber ? "rooftop" : "street";
  return /\b\d+[a-z]?\b/i.test(String(streetLine)) ? "rooftop" : "street";
}

/**
 * The research state after one attempt. `payload` is the row AFTER the
 * attempt's fills; `returned` is false when the source answered but no longer
 * knows the object (it then needs research by other means).
 */
export function nextAddressResearchMeta(input: {
  previous: Partial<AddressResearchMeta> | null;
  payload: Record<string, unknown>;
  returned: boolean;
  precision: AddressPrecision;
  sources: readonly string[];
  now: number;
  countryCorrectedFrom?: string;
}): AddressResearchMeta {
  const prev = input.previous ?? {};
  const attempts = (typeof prev.attempts === "number" && prev.attempts > 0 ? prev.attempts : 0) + 1;
  const missing = missingAddressFields(input.payload);
  const status: AddressResearchStatus =
    missing.length === 0
      ? "complete"
      : !input.returned || attempts >= MAX_PARTIAL_ATTEMPTS
        ? "needs_research"
        : "partial";
  const wait =
    status === "complete"
      ? COMPLETE_RECHECK_MS
      : status === "needs_research"
        ? ADDRESS_RETRY_LATE_MS
        : attempts === 1
          ? ADDRESS_RETRY_FIRST_MS
          : ADDRESS_RETRY_SECOND_MS;
  const sources = [
    ...new Set([...(Array.isArray(prev.sources) ? prev.sources : []), ...input.sources]),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  const corrected = input.countryCorrectedFrom ?? prev.countryCorrectedFrom;
  return {
    status,
    missing,
    precision: input.precision,
    sources,
    attempts,
    lastAttemptAt: input.now,
    nextDueAt: input.now + wait,
    ...(corrected ? { countryCorrectedFrom: corrected } : {}),
  };
}
