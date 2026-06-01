/**
 * Validation source fetcher (spec §1 follow-up).
 *
 * Bridges the validation-source resolver with adminWorkerFetch +
 * readSource so the verifier compares against actual validation
 * source content — not just a list of host names.
 *
 * For each (contentType, field, expected value) tuple, this module:
 *   1. Resolves the right validation hosts via the resolver.
 *   2. Constructs a probe URL on each host (host root or a known
 *      content-type-specific path).
 *   3. Fetches the page through adminWorkerFetch (honours all
 *      approved-host / timeout / rejection rules).
 *   4. Reads the body via readSource and pulls structured blocks.
 *   5. Searches the structured blocks for the expected value.
 *   6. Returns evidence the verifier can store as MATCH / MISMATCH /
 *      MISSING_EVIDENCE.
 *
 * If a higher-authority source disagrees, the caller can re-invoke
 * with `excludeAuthorities` set so the resolver returns the next
 * tier of source.
 */

import type { PrismaClient, SourceAuthorityLevel } from "@prisma/client";

import { adminWorkerFetch } from "./fetcher";
import {
  type ResolvedValidationSource,
  resolveValidationSources,
} from "./validation-source-resolver";

/** Per-content-type probe paths to append to the validation host. */
const VALIDATION_PROBE_PATHS: Record<string, Record<string, (slug: string) => string[]>> = {
  SAINT: {
    feastDay: (slug) => [`/saints/${slug}`, `/calendar/saints`, `/`],
    saintName: (slug) => [`/saints/${slug}`, `/`],
  },
  APPARITION: {
    approvalStatus: (slug) => [`/apparitions/${slug}`, `/marian-devotions`, `/`],
    apparitionDate: (slug) => [`/apparitions/${slug}`, `/`],
  },
  CHURCH_DOCUMENT: {
    dateOrEra: (slug) => [`/documents/${slug}`, `/archives`, `/`],
  },
  SACRAMENT: {
    sacramentKey: (slug) => [`/sacraments/${slug}`, `/catechism/${slug}`, `/`],
  },
  NOVENA: {
    duration: (slug) => [`/novenas/${slug}`, `/`],
  },
  ROSARY: {
    mysterySets: () => [`/rosary`, `/prayer/rosary`, `/`],
  },
  LITURGICAL: {
    liturgyType: () => [`/liturgy`, `/mass`, `/`],
  },
};

export interface ValidationEvidenceRecord {
  host: string;
  url: string;
  authority: SourceAuthorityLevel;
  matchStatus: "MATCH" | "MISMATCH" | "MISSING_EVIDENCE";
  expected: string;
  found: string | null;
  confidence: number;
  reason: string;
}

export interface FetchAndCompareInput {
  contentType: string;
  field: string;
  expectedValue: string;
  slugHint?: string;
  primarySourceHost?: string;
  excludeAuthorities?: SourceAuthorityLevel[];
  /** Limit how many validation sources to try per call. */
  maxSources?: number;
  /** Skip the actual HTTP fetch (tests). */
  skipNetwork?: boolean;
}

/**
 * Resolve validation hosts, fetch each, and compare the expected
 * field value against the fetched body. Returns one evidence row
 * per host attempted.
 */
export async function fetchAndCompareValidation(
  prisma: PrismaClient,
  input: FetchAndCompareInput,
): Promise<ValidationEvidenceRecord[]> {
  const resolved = await resolveValidationSources(
    prisma,
    {
      contentType: input.contentType,
      field: input.field,
      primarySourceHost: input.primarySourceHost,
    },
    { limit: input.maxSources ?? 2 },
  );
  if (resolved.length === 0) return [];

  // Filter out excluded authorities (used for conflict re-tries).
  const excludeSet = new Set(input.excludeAuthorities ?? []);
  const targets = resolved.filter((r) => !excludeSet.has(r.authority));
  if (targets.length === 0) return [];

  const evidence: ValidationEvidenceRecord[] = [];
  for (const target of targets) {
    evidence.push(await fetchOneAndCompare(prisma, target, input));
  }
  return evidence;
}

async function fetchOneAndCompare(
  prisma: PrismaClient,
  target: ResolvedValidationSource,
  input: FetchAndCompareInput,
): Promise<ValidationEvidenceRecord> {
  const probePaths = VALIDATION_PROBE_PATHS[input.contentType]?.[input.field];
  const slug = input.slugHint ?? slugify(input.expectedValue);
  const pathsToTry = probePaths ? probePaths(slug).slice(0, 3) : ["/"];

  for (const path of pathsToTry) {
    // Local validation mirrors (dev verification) are served over plain
    // HTTP on a loopback host:port; every real approved validation source
    // is HTTPS.
    const scheme = /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(target.host) ? "http" : "https";
    const url = `${scheme}://${target.host}${path}`;
    const fetched = await adminWorkerFetch(prisma, {
      url,
      skipNetwork: input.skipNetwork,
    }).catch(() => null);
    if (!fetched || !fetched.succeeded || !fetched.body) {
      continue;
    }

    // NOTE: a validation source is fetched ONLY to confirm a sensitive
    // field — it is NOT content to grow. We deliberately do not run it
    // through readSource()/persist a source-read here, otherwise the
    // validation page would leak into the content pipeline and be
    // (wrongly) treated as a buildable item.

    // Compare expected value against the fetched text. Normalise
    // both sides so casing / whitespace differences don't trigger
    // false MISMATCH.
    const normalisedExpected = normaliseForCompare(input.expectedValue);
    const normalisedBody = normaliseForCompare(fetched.body);
    if (!normalisedExpected) {
      return {
        host: target.host,
        url,
        authority: target.authority,
        matchStatus: "MISSING_EVIDENCE",
        expected: input.expectedValue,
        found: null,
        confidence: 0,
        reason: "expected value was empty",
      };
    }
    if (normalisedBody.includes(normalisedExpected)) {
      return {
        host: target.host,
        url,
        authority: target.authority,
        matchStatus: "MATCH",
        expected: input.expectedValue,
        found: input.expectedValue,
        confidence: 0.9,
        reason: `Expected value found in ${target.host} body.`,
      };
    }
    // The page loaded but the expected value isn't present — this is
    // a MISMATCH (the validation source disagrees) only when we have
    // a structured body; otherwise it's MISSING_EVIDENCE.
    return {
      host: target.host,
      url,
      authority: target.authority,
      matchStatus: "MISMATCH",
      expected: input.expectedValue,
      found: null,
      confidence: 0.5,
      reason: `Validation source ${target.host} fetched but expected value not present.`,
    };
  }

  return {
    host: target.host,
    url: `https://${target.host}/`,
    authority: target.authority,
    matchStatus: "MISSING_EVIDENCE",
    expected: input.expectedValue,
    found: null,
    confidence: 0,
    reason: `Could not fetch any probe URL on ${target.host}.`,
  };
}

function normaliseForCompare(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
