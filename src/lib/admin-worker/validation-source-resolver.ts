/**
 * Validation source resolver (spec §5 / §11).
 *
 * Picks the right validation sources for a given content type +
 * sensitive field. Inputs:
 *   - content type
 *   - the field being verified
 *   - the candidate's primary source authority + reputation
 *   - past validation success on each candidate validation source
 *
 * Outputs: a ranked list of (host, authority level) pairs the
 * verifier should consult. A higher-authority validation source
 * wins on a conflict; if the verifier sees a conflict and only
 * lower-authority sources are available, the resolver returns an
 * empty array so the caller can route to rare human review.
 */

import type { PrismaClient, SourceAuthorityLevel } from "@prisma/client";

/**
 * Per-(content type, sensitive field) preferred validation sources.
 * Sourced from the spec's "validation sources" list: official
 * Church documents, USCCB, Vatican calendar, diocesan registries.
 */
const VALIDATION_PREFERENCES: Record<
  string,
  Record<string, Array<{ host: string; authority: SourceAuthorityLevel; reason: string }>>
> = {
  SAINT: {
    feastDay: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican calendar" },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB liturgical calendar" },
      { host: "catholicsaints.info", authority: "TRUSTED_PUBLISHER", reason: "fallback" },
    ],
    feastMonth: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican calendar" },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB liturgical calendar" },
    ],
    feastDayNumber: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican calendar" },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB liturgical calendar" },
    ],
    canonizationYear: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican canonization records" },
    ],
  },
  APPARITION: {
    approvalStatus: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican apparition registry" },
      {
        host: "www.usccb.org",
        authority: "USCCB",
        reason: "USCCB approved Marian devotions",
      },
    ],
    apparitionDate: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican apparition registry" },
    ],
  },
  CHURCH_DOCUMENT: {
    dateOrEra: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican archives" },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB document library" },
    ],
    historyType: [{ host: "www.vatican.va", authority: "VATICAN", reason: "Vatican archives" }],
  },
  SACRAMENT: {
    sacramentKey: [
      {
        host: "www.vatican.va",
        authority: "CATECHISM",
        reason: "Catechism of the Catholic Church",
      },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB sacrament resources" },
    ],
  },
  NOVENA: {
    duration: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Vatican liturgical resources" },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB novena resources" },
    ],
  },
  ROSARY: {
    mysterySets: [
      { host: "www.vatican.va", authority: "VATICAN", reason: "Rosarium Virginis Mariae" },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB rosary resources" },
    ],
  },
  LITURGICAL: {
    liturgyType: [
      { host: "www.vatican.va", authority: "LITURGICAL_BOOK", reason: "Roman Missal / GIRM" },
      { host: "www.usccb.org", authority: "USCCB", reason: "USCCB liturgical resources" },
    ],
  },
};

/**
 * One resolved candidate validation source.
 */
export interface ResolvedValidationSource {
  host: string;
  authority: SourceAuthorityLevel;
  reason: string;
  pastSuccessRate: number;
  reputationTier: string | null;
  rank: number;
}

export interface ResolverInput {
  contentType: string;
  field: string;
  /** The source the primary content came from — never resolve to it. */
  primarySourceHost?: string | null;
}

/**
 * Authority weights (mirrors source-strategy.ts so the resolver
 * ranks the same way the brain ranks).
 */
const AUTHORITY_WEIGHT: Record<SourceAuthorityLevel, number> = {
  VATICAN: 1.0,
  CATECHISM: 0.95,
  LITURGICAL_BOOK: 0.9,
  USCCB: 0.85,
  DIOCESAN: 0.7,
  RELIGIOUS_ORDER: 0.65,
  TRUSTED_PUBLISHER: 0.55,
  ACADEMIC: 0.5,
  COMMUNITY: 0.35,
};

/**
 * Pick the best validation sources for (content type, field).
 * Returns up to `limit` ranked candidates, excluding the primary
 * source (we never validate a fact against itself).
 *
 * Best-effort: missing tables or hosts degrade gracefully and the
 * resolver returns whatever ranked subset is available.
 */
/**
 * Local-verification-only validation hosts. When
 * `ADMIN_WORKER_DEV_VALIDATION_HOSTS` is set AND `NODE_ENV !==
 * "production"`, the listed hosts are offered as COMMUNITY-authority
 * validation sources for every content type/field so a developer can run
 * a LOCAL validation mirror and prove the worker really fetches +
 * compares cross-source evidence offline. Never fires in production.
 */
function devValidationHosts(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  const raw = process.env.ADMIN_WORKER_DEV_VALIDATION_HOSTS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export async function resolveValidationSources(
  prisma: PrismaClient,
  input: ResolverInput,
  opts: { limit?: number } = {},
): Promise<ResolvedValidationSource[]> {
  const candidates = VALIDATION_PREFERENCES[input.contentType]?.[input.field] ?? [];

  // Pull reputation rows for the candidate hosts in one query.
  const hosts = candidates.map((c) => c.host);
  const reputations = await prisma.adminWorkerSourceReputation
    .findMany({ where: { sourceHost: { in: hosts } } })
    .catch(
      () =>
        [] as Array<{
          sourceHost: string;
          reputationTier: string;
          validationEvidenceSuccessRate: number;
        }>,
    );
  const repByHost = new Map(reputations.map((r) => [r.sourceHost, r]));

  const resolved: ResolvedValidationSource[] = candidates
    .filter((c) => c.host !== input.primarySourceHost)
    .map((c) => {
      const rep = repByHost.get(c.host);
      const pastSuccessRate = rep?.validationEvidenceSuccessRate ?? 0;
      const authorityScore = AUTHORITY_WEIGHT[c.authority] ?? 0.4;
      // Rank: authority weight + reputation bonus.
      const rank =
        authorityScore * 0.7 +
        pastSuccessRate * 0.2 +
        (rep?.reputationTier === "TRUSTED" ? 0.1 : rep?.reputationTier === "GOOD" ? 0.05 : 0);
      return {
        host: c.host,
        authority: c.authority,
        reason: c.reason,
        pastSuccessRate,
        reputationTier: rep?.reputationTier ?? null,
        rank,
      };
    });

  // Local-verification hook: offer dev validation hosts (non-production)
  // ahead of the registry so an offline local mirror is actually used.
  for (const host of devValidationHosts()) {
    if (input.primarySourceHost && host === input.primarySourceHost.toLowerCase()) continue;
    resolved.unshift({
      host,
      authority: "COMMUNITY",
      reason: "Local validation mirror (dev verification)",
      pastSuccessRate: 0,
      reputationTier: null,
      rank: 1.5,
    });
  }

  resolved.sort((a, b) => b.rank - a.rank);
  return resolved.slice(0, opts.limit ?? 5);
}

/**
 * Higher-authority lookup. When a verifier sees a conflict between
 * two validation sources, this returns any candidate whose
 * authority strictly outranks the highest-authority source it has
 * already consulted.
 */
export async function findHigherAuthority(
  prisma: PrismaClient,
  input: ResolverInput & { excludeAuthorities: SourceAuthorityLevel[] },
): Promise<ResolvedValidationSource | null> {
  const all = await resolveValidationSources(prisma, input, { limit: 10 });
  const excludeSet = new Set(input.excludeAuthorities);
  const next = all.find((r) => !excludeSet.has(r.authority));
  return next ?? null;
}
