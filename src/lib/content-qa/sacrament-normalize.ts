/**
 * Sacrament normalization. The seven canonical sacrament keys are the
 * only valid sacrament identifiers in the public catalog. Aliases
 * (Confession, Penance, Sacrament of Reconciliation, Marriage, Last
 * Rites, Communion) map onto the canonical key; non-sacrament content
 * is rejected.
 *
 * Confession is NOT a separate threshold outside the seven sacraments.
 * It collapses into Reconciliation.
 */

export const SACRAMENT_KEYS = [
  "baptism",
  "eucharist",
  "confirmation",
  "reconciliation",
  "anointing_of_the_sick",
  "holy_orders",
  "matrimony",
] as const;

export type SacramentKey = (typeof SACRAMENT_KEYS)[number];

export const SACRAMENT_LABELS: Record<SacramentKey, string> = {
  baptism: "Baptism",
  eucharist: "Eucharist",
  confirmation: "Confirmation",
  reconciliation: "Reconciliation",
  anointing_of_the_sick: "Anointing of the Sick",
  holy_orders: "Holy Orders",
  matrimony: "Matrimony",
};

export const SACRAMENT_GROUPS = ["Initiation", "Healing", "Service"] as const;
export type SacramentGroup = (typeof SACRAMENT_GROUPS)[number];

export const SACRAMENT_GROUP_BY_KEY: Record<SacramentKey, SacramentGroup> = {
  baptism: "Initiation",
  eucharist: "Initiation",
  confirmation: "Initiation",
  reconciliation: "Healing",
  anointing_of_the_sick: "Healing",
  holy_orders: "Service",
  matrimony: "Service",
};

/**
 * Aliases that must collapse to a canonical sacrament key. Caller must
 * verify the source content is actually about the sacrament (some
 * aliases like "Last Rites" and "Communion" can refer to non-
 * sacramental things).
 */
const ALIASES: ReadonlyArray<readonly [RegExp, SacramentKey, "always" | "context"]> = [
  // ── Baptism ──
  [/\bsacrament\s+of\s+baptism\b/i, "baptism", "always"],
  [/\bbaptism\b/i, "baptism", "always"],
  [/\bchristen(?:ing|ed)\b/i, "baptism", "context"],

  // ── Eucharist ──
  [/\bsacrament\s+of\s+the\s+eucharist\b/i, "eucharist", "always"],
  [/\beucharist\b/i, "eucharist", "always"],
  [/\b(?:holy|first|sacred)\s+communion\b/i, "eucharist", "context"],
  // "Communion" alone can refer to the Communion of Saints or general
  // fellowship — only treat as Eucharist when context confirms it.
  [/\bcommunion\b/i, "eucharist", "context"],

  // ── Confirmation ──
  [/\bsacrament\s+of\s+confirmation\b/i, "confirmation", "always"],
  [/\bconfirmation\b/i, "confirmation", "always"],
  [/\bchrismation\b/i, "confirmation", "always"],

  // ── Reconciliation (Confession, Penance) ──
  [/\bsacrament\s+of\s+reconciliation\b/i, "reconciliation", "always"],
  [/\breconciliation\b/i, "reconciliation", "always"],
  [/\bsacrament\s+of\s+penance\b/i, "reconciliation", "always"],
  [/\bpenance\b/i, "reconciliation", "always"],
  [/\bsacrament\s+of\s+confession\b/i, "reconciliation", "always"],
  [/\bconfession\b/i, "reconciliation", "always"],

  // ── Anointing of the Sick (Last Rites — only when about the sacrament) ──
  [/\banointing\s+of\s+the\s+sick\b/i, "anointing_of_the_sick", "always"],
  [/\bextreme\s+unction\b/i, "anointing_of_the_sick", "always"],
  [/\blast\s+rites\b/i, "anointing_of_the_sick", "context"],
  [/\bviaticum\b/i, "anointing_of_the_sick", "context"],

  // ── Holy Orders ──
  [/\bholy\s+orders\b/i, "holy_orders", "always"],
  [/\bsacrament\s+of\s+holy\s+orders\b/i, "holy_orders", "always"],
  [/\bordination\b/i, "holy_orders", "context"],

  // ── Matrimony / Marriage ──
  [/\bsacrament\s+of\s+matrimony\b/i, "matrimony", "always"],
  [/\bmatrimony\b/i, "matrimony", "always"],
  [/\bsacrament\s+of\s+marriage\b/i, "matrimony", "always"],
  [/\bcatholic\s+marriage\b/i, "matrimony", "always"],
  [/\bmarriage\b/i, "matrimony", "context"],
];

/**
 * Context markers that confirm the candidate is *actually* about the
 * sacrament, not a generic mention. Used when the alias is matched in
 * "context" mode (Communion, Marriage, Last Rites, Christening, etc.).
 */
const SACRAMENT_CONTEXT_RE =
  /\b(?:sacrament(?:al)?|grace|outward\s+sign|matter|form|minister|recipient|catechism\s+of\s+the\s+catholic\s+church|ccc\s+\d+|effects?\s+of\s+the\s+sacrament|institut(?:ed|ion)\s+by\s+christ|seven\s+sacraments|biblical\s+foundation|preparation\s+(?:for|to\s+receive))\b/i;

export type SacramentNormalizationResult = {
  key: SacramentKey | null;
  group: SacramentGroup | null;
  label: string | null;
  reason: string;
};

/**
 * Determine whether a candidate's title + body normalize onto one of
 * the seven canonical sacraments. Returns null when the content is
 * clearly not about a sacrament, or the source aliases don't survive
 * context checking.
 */
export function normalizeSacrament(args: {
  title: string | null | undefined;
  body: string | null | undefined;
}): SacramentNormalizationResult {
  const title = (args.title ?? "").trim();
  const body = (args.body ?? "").trim();
  const blob = `${title}\n${body}`;
  if (blob.trim().length === 0) {
    return { key: null, group: null, label: null, reason: "empty candidate" };
  }
  for (const [pattern, key, mode] of ALIASES) {
    if (!pattern.test(blob)) continue;
    if (mode === "context" && !SACRAMENT_CONTEXT_RE.test(blob)) {
      // The alias matched but there's no sacramental-context vocabulary;
      // keep looking — another alias may match unambiguously.
      continue;
    }
    return {
      key,
      group: SACRAMENT_GROUP_BY_KEY[key],
      label: SACRAMENT_LABELS[key],
      reason: `Matched ${pattern.source} (${mode})`,
    };
  }
  return { key: null, group: null, label: null, reason: "no sacrament alias matched" };
}

export function isCanonicalSacramentKey(value: string | null | undefined): value is SacramentKey {
  if (!value) return false;
  return (SACRAMENT_KEYS as ReadonlyArray<string>).includes(value);
}
