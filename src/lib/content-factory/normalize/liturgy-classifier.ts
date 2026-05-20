/**
 * Liturgy classifier (spec §14).
 *
 * Build only *liturgical formation* content. Reject:
 *   - Mass schedules
 *   - parish bulletins
 *   - parish event pages
 *   - livestreams
 *
 * Liturgical formation = content that explains the Mass, the
 * liturgical year, sacramentals, ritual symbolism, the structure of
 * the marriage / funeral / ordination rites, councils, etc.
 */

export const APPROVED_LITURGY_TYPES = [
  "mass_structure",
  "liturgical_year",
  "symbolism",
  "marriage_rite",
  "funeral_rite",
  "ordination_rite",
  "council_timeline",
  "glossary",
  "general",
] as const;

export type ApprovedLiturgyType = (typeof APPROVED_LITURGY_TYPES)[number];

const REJECT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bmass\s+schedule(s|d)?\b/i,
    reason: "Page is a Mass schedule",
  },
  {
    pattern: /\bweekly\s+bulletin\b/i,
    reason: "Page is a parish bulletin",
  },
  {
    pattern: /\bparish\s+events?\s+calendar\b/i,
    reason: "Page is a parish event calendar",
  },
  {
    pattern: /\bwatch\s+(live|mass)\b|\blivestream\b/i,
    reason: "Page is a livestream / live Mass",
  },
  {
    pattern: /\bregister\s+for\s+\w+(?:\s+\w+)?(?:\s+event|\s+retreat)\b/i,
    reason: "Page is event / retreat registration",
  },
];

const FORMATION_CUES: ReadonlyArray<RegExp> = [
  /\bliturgy\s+of\s+(the\s+)?(word|eucharist)\b/i,
  /\bintroductory\s+rites\b/i,
  /\bconcluding\s+rites?\b/i,
  /\bliturgical\s+(year|calendar|season|colors?)\b/i,
  /\bordinary\s+time\b/i,
  /\b(advent|lent|christmas|easter)\s+season\b/i,
  /\bcouncil\s+of\s+\w+\b/i,
  /\bsacramentals?\b/i,
];

export type LiturgyClassification = {
  approved: boolean;
  reason: string;
  detectedType?: string | null;
};

export function classifyLiturgyPage(opts: {
  title?: string | null;
  body?: string | null;
  type?: string | null;
}): LiturgyClassification {
  const combined = `${opts.title ?? ""}\n${opts.body ?? ""}`;
  for (const r of REJECT_PATTERNS) {
    if (r.pattern.test(combined)) {
      return { approved: false, reason: r.reason };
    }
  }
  const declaredType = opts.type?.trim().toLowerCase() ?? "";
  if (declaredType && !(APPROVED_LITURGY_TYPES as ReadonlyArray<string>).includes(declaredType)) {
    return {
      approved: false,
      reason: `Declared type '${declaredType}' is not an approved liturgy type`,
      detectedType: declaredType,
    };
  }
  const formationHits = FORMATION_CUES.filter((p) => p.test(combined)).length;
  if (formationHits === 0) {
    return {
      approved: false,
      reason: "No liturgical-formation cues detected",
    };
  }
  return {
    approved: true,
    reason: `Liturgy page accepted (${formationHits} formation cues)`,
    detectedType: declaredType || null,
  };
}
