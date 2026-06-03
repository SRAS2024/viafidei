/**
 * The seven sacraments, in the order the Sacraments tab displays them. These
 * are the ONLY entries on that tab — each is a fixed card (icon + title) that
 * links to the Admin-Worker-published content for that sacrament when it
 * exists.
 *
 * `key` matches the extractor's `sacramentKey` (see the SACRAMENT extractor);
 * `tokens` are a slug/title fallback used to pair a card with its published
 * row when the payload key is absent. `iconKey` selects the badge component.
 */
export type SacramentIconKey =
  | "baptism"
  | "eucharist"
  | "confirmation"
  | "confession"
  | "anointing"
  | "matrimony"
  | "holy-orders";

export interface CanonicalSacrament {
  key: string;
  title: string;
  iconKey: SacramentIconKey;
  tokens: string[];
}

export const SEVEN_SACRAMENTS: readonly CanonicalSacrament[] = [
  { key: "BAPTISM", title: "Baptism", iconKey: "baptism", tokens: ["baptism"] },
  {
    key: "EUCHARIST",
    title: "Holy Communion",
    iconKey: "eucharist",
    tokens: ["holy-communion", "communion", "eucharist"],
  },
  { key: "CONFIRMATION", title: "Confirmation", iconKey: "confirmation", tokens: ["confirmation"] },
  {
    key: "RECONCILIATION",
    title: "Confession",
    iconKey: "confession",
    tokens: ["confession", "reconciliation", "penance"],
  },
  {
    key: "ANOINTING",
    title: "Anointing of the Sick",
    iconKey: "anointing",
    tokens: ["anointing"],
  },
  {
    key: "MATRIMONY",
    title: "Matrimony",
    iconKey: "matrimony",
    tokens: ["matrimony", "marriage"],
  },
  {
    key: "HOLY_ORDERS",
    title: "Holy Orders",
    iconKey: "holy-orders",
    tokens: ["holy-orders", "holy orders", "ordination"],
  },
] as const;

/** Find the canonical sacrament a published (slug, payload) row belongs to. */
export function matchSacrament(
  slug: string,
  title: string,
  sacramentKey?: string | null,
): CanonicalSacrament | null {
  const key = (sacramentKey ?? "").toUpperCase();
  if (key) {
    const byKey = SEVEN_SACRAMENTS.find((s) => s.key === key);
    if (byKey) return byKey;
  }
  const hay = `${slug} ${title}`.toLowerCase();
  return SEVEN_SACRAMENTS.find((s) => s.tokens.some((tok) => hay.includes(tok))) ?? null;
}
