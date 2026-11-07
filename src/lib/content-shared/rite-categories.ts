/**
 * Rite families for the /rites tab. Splits published RITE items into the Latin
 * (Western) rites and the Eastern Catholic rites and Churches, all in full
 * communion with Rome. Every item belongs to exactly one family.
 */
import type { PayloadFilter } from "./payload-filter";

/**
 * The Latin Church's own rite and its uses, by `riteKey`: the canonical keys of
 * content-shared/rites.ts name mostly Eastern rites, so a key alone says nothing.
 */
const LATIN_RITE_KEYS: ReadonlySet<string> = new Set([
  "roman",
  "latin",
  "ambrosian",
  "anglicanUse",
  "bragan",
  "carthusian",
  "dominican",
  "mozarabic",
  "zaire",
]);

/**
 * Whether an item is one of the Latin Church's. A stored `family` settles it, then
 * the key. An item with neither is an older Latin use (the Beneventan Rite): every
 * Eastern rite and Church in the catalogue carries its key.
 */
export function isLatinRite(payload: Record<string, unknown>): boolean {
  const family = typeof payload.family === "string" ? payload.family.trim() : "";
  if (family) return family === "latin";
  const key = typeof payload.riteKey === "string" ? payload.riteKey.trim() : "";
  return !key || LATIN_RITE_KEYS.has(key);
}

export const RITE_FILTERS: readonly PayloadFilter[] = [
  { key: "all", label: "All", matches: () => true },
  { key: "latin", label: "Latin (Western)", matches: (p) => isLatinRite(p) },
  { key: "eastern", label: "Eastern Catholic", matches: (p) => !isLatinRite(p) },
];
