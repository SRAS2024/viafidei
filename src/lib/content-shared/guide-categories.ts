/**
 * Guide categories for the /guides tab.
 *
 * Chips are derived from three payload fields together — `kind` (the closed
 * enum), `sacramentKey`, and the optional `category` — so a 100-guide catalogue
 * splits into browsable groups instead of one giant "General" bucket:
 * Rosary & Chaplets, Confession, Eucharist & Adoration, Mass & Liturgy,
 * Sacraments, Consecrations & Devotions, Seasons, Becoming Catholic,
 * Discernment & Vocation, Family & Life Events, and General.
 *
 * `GUIDE_KIND_LABELS` is the human label for each `kind` enum value (the list
 * page's eyebrow), so raw enum values such as `lent_preparation` never render.
 */
import { fieldIn, titleMatches, type PayloadFilter } from "./payload-filter";

/** Human label for every `kind` value of the guide schema (`GUIDE_KINDS`). */
export const GUIDE_KIND_LABELS: Readonly<Record<string, string>> = {
  rosary: "Rosary",
  chaplet: "Chaplet",
  confession: "Confession",
  adoration: "Adoration",
  consecration: "Consecration",
  discernment: "Discernment",
  vocation: "Vocation",
  lent_preparation: "Lent",
  advent_preparation: "Advent",
  rcia: "OCIA",
  ocia: "OCIA",
  mass: "Mass",
  liturgy_of_the_hours: "Liturgy of the Hours",
  sacramental_preparation: "Sacraments",
  funeral: "Funerals",
  marriage: "Marriage",
  family: "Family",
  season: "Seasons",
  pilgrimage: "Pilgrimage",
  devotion: "Devotion",
  sacramental: "Sacramentals",
  scripture: "Scripture",
  general: "Guide",
};

/**
 * The eyebrow shown on a guide card: the kind's label, else "Sacraments" for a
 * guide that only carries a sacramentKey, else "Guide".
 */
export function guideEyebrow(payload: Record<string, unknown>): string {
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const label = kind && kind !== "general" ? GUIDE_KIND_LABELS[kind] : undefined;
  if (label) return label;
  if (typeof payload.category === "string") {
    const byCategory = GUIDE_CATEGORY_LABELS[payload.category];
    if (byCategory) return byCategory;
  }
  return typeof payload.sacramentKey === "string" ? "Sacraments" : "Guide";
}

/** Labels for the optional `category` field (used when `kind` is `general`). */
export const GUIDE_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  liturgy: "Mass & Liturgy",
  devotion: "Devotion",
  family: "Family",
  funeral: "Funerals",
  season: "Seasons",
  prayer: "Prayer",
};

const category = (p: Record<string, unknown>, values: readonly string[]): boolean =>
  fieldIn(p, "category", values);

export const GUIDE_FILTERS: readonly PayloadFilter[] = [
  { key: "all", label: "All", matches: () => true },
  {
    key: "rosary-chaplets",
    label: "Rosary & Chaplets",
    matches: (p) =>
      fieldIn(p, "kind", ["rosary", "chaplet"]) || titleMatches(p, /\b(rosary|chaplet)\b/i),
  },
  {
    key: "confession",
    label: "Confession",
    matches: (p) =>
      fieldIn(p, "kind", ["confession"]) || fieldIn(p, "sacramentKey", ["reconciliation"]),
  },
  {
    key: "eucharist",
    label: "Eucharist & Adoration",
    matches: (p) => fieldIn(p, "kind", ["adoration"]) || fieldIn(p, "sacramentKey", ["eucharist"]),
  },
  {
    key: "liturgy",
    label: "Mass & Liturgy",
    matches: (p) =>
      fieldIn(p, "kind", ["mass", "liturgy_of_the_hours"]) || category(p, ["liturgy"]),
  },
  {
    key: "sacraments",
    label: "Sacraments",
    // Any other sacrament: Confession and the Eucharist have their own chips.
    matches: (p) =>
      (typeof p.sacramentKey === "string" &&
        !fieldIn(p, "sacramentKey", ["reconciliation", "eucharist"]) &&
        !fieldIn(p, "kind", ["confession", "adoration"])) ||
      fieldIn(p, "kind", ["sacramental_preparation"]),
  },
  {
    key: "devotions",
    label: "Consecrations & Devotions",
    matches: (p) =>
      fieldIn(p, "kind", ["consecration", "devotion", "sacramental"]) || category(p, ["devotion"]),
  },
  {
    key: "seasons",
    label: "Seasons",
    matches: (p) =>
      fieldIn(p, "kind", ["lent_preparation", "advent_preparation", "season"]) ||
      category(p, ["season"]),
  },
  {
    key: "becoming-catholic",
    label: "Becoming Catholic",
    matches: (p) => fieldIn(p, "kind", ["rcia", "ocia"]),
  },
  {
    key: "discernment",
    label: "Discernment & Vocation",
    matches: (p) => fieldIn(p, "kind", ["discernment", "vocation"]),
  },
  {
    key: "family",
    label: "Family & Life Events",
    matches: (p) =>
      fieldIn(p, "kind", ["family", "marriage", "funeral"]) || category(p, ["family", "funeral"]),
  },
  {
    key: "general",
    label: "General",
    matches: (p) =>
      fieldIn(p, "kind", ["general", "pilgrimage", "scripture"]) &&
      typeof p.sacramentKey !== "string" &&
      !category(p, ["liturgy", "devotion", "season", "family", "funeral"]) &&
      !titleMatches(p, /\b(rosary|chaplet)\b/i),
  },
];
