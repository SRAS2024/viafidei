/**
 * Canonical list of Catholic rites recognised within the universal Church.
 *
 * The Latin (Roman) Rite is the default for content. Eastern Catholic rites
 * are surfaced in user-facing settings so people can read Mass / liturgical
 * explanations relevant to their tradition.
 *
 * Rite-specific copy is opt-in: pages where rite makes no doctrinal or
 * liturgical difference must continue to render the same content regardless
 * of the user's selection.
 */
export const CATHOLIC_RITES = [
  "roman",
  "byzantine",
  "maronite",
  "chaldean",
  "coptic",
  "syroMalabar",
  "syroMalankara",
  "armenian",
  "ethiopic",
  "melkite",
  "ukrainian",
  "ruthenian",
] as const;

export type CatholicRite = (typeof CATHOLIC_RITES)[number];

export const DEFAULT_RITE: CatholicRite = "roman";

export const RITE_LABEL_KEYS: Record<CatholicRite, string> = {
  roman: "rite.roman",
  byzantine: "rite.byzantine",
  maronite: "rite.maronite",
  chaldean: "rite.chaldean",
  coptic: "rite.coptic",
  syroMalabar: "rite.syroMalabar",
  syroMalankara: "rite.syroMalankara",
  armenian: "rite.armenian",
  ethiopic: "rite.ethiopic",
  melkite: "rite.melkite",
  ukrainian: "rite.ukrainian",
  ruthenian: "rite.ruthenian",
};

export function isCatholicRite(input: string | null | undefined): input is CatholicRite {
  if (!input) return false;
  return (CATHOLIC_RITES as readonly string[]).includes(input);
}

export function normalizeRite(input: string | null | undefined): CatholicRite {
  return isCatholicRite(input) ? input : DEFAULT_RITE;
}

/**
 * Determine whether a piece of content is "rite-aware" — i.e. whether it is
 * specific to a particular Catholic rite. Slugs like `mass-byzantine-...` or
 * entries whose canonical metadata names a rite are filtered out for users
 * who have selected a different rite. Content with no rite marker is shown
 * to everyone regardless of selection.
 */
const RITE_SLUG_MARKERS: Record<CatholicRite, string[]> = {
  roman: ["roman", "latin"],
  byzantine: ["byzantine"],
  maronite: ["maronite"],
  chaldean: ["chaldean"],
  coptic: ["coptic"],
  syroMalabar: ["syro-malabar", "syromalabar"],
  syroMalankara: ["syro-malankara", "syromalankara"],
  armenian: ["armenian"],
  ethiopic: ["ethiopic", "geez", "ge-ez"],
  melkite: ["melkite"],
  ukrainian: ["ukrainian"],
  ruthenian: ["ruthenian"],
};

export function getContentRite(slug: string | null | undefined): CatholicRite | null {
  if (!slug) return null;
  const lowered = slug.toLowerCase();
  for (const rite of CATHOLIC_RITES) {
    for (const marker of RITE_SLUG_MARKERS[rite]) {
      if (lowered.includes(marker)) return rite;
    }
  }
  return null;
}

/**
 * Returns `true` if a given content slug should be shown for the chosen rite.
 *
 * Rite-neutral content (no rite marker in the slug) is always returned. Only
 * rite-tagged content is filtered out when the user's selection differs.
 */
export function matchesRite(slug: string | null | undefined, selected: CatholicRite): boolean {
  const contentRite = getContentRite(slug);
  if (!contentRite) return true;
  return contentRite === selected;
}
