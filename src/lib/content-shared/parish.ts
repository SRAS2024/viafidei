/**
 * Parish classification filters.
 *
 * Parish records carry a single `designation` (parish / shrine / cathedral /
 * major-basilica / minor-basilica). The directory groups these into the
 * classifications the user can filter by — Parish, Cathedral, Basilica,
 * Shrine — so cathedrals, basilicas, and shrines are clearly distinct from
 * ordinary parishes. A church that is also a basilica, cathedral, or shrine
 * surfaces under that classification (its specific designation label is still
 * shown on the card).
 */

export type ParishClassification = "parish" | "cathedral" | "basilica" | "shrine";
export type ParishFilter = ParishClassification | "all";

export const PARISH_FILTERS: ReadonlyArray<{ key: ParishFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "parish", label: "Parishes" },
  { key: "cathedral", label: "Cathedrals" },
  { key: "basilica", label: "Basilicas" },
  { key: "shrine", label: "Shrines" },
];

/** Group a raw designation into one of the filterable classifications. */
export function classifyParish(designation: unknown): ParishClassification {
  const d = typeof designation === "string" ? designation.toLowerCase() : "";
  if (d === "cathedral") return "cathedral";
  if (d.includes("basilica")) return "basilica";
  if (d === "shrine") return "shrine";
  return "parish";
}

/** Resolve a `?class=` value into the active filter (defaults to "all"). */
export function resolveParishFilter(param: string | null | undefined): ParishFilter {
  return param === "parish" || param === "cathedral" || param === "basilica" || param === "shrine"
    ? param
    : "all";
}

/** Whether a record with the given designation matches the active filter. */
export function parishMatchesFilter(designation: unknown, filter: ParishFilter): boolean {
  return filter === "all" || classifyParish(designation) === filter;
}
