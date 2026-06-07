/**
 * Our Lady section filter resolution.
 *
 * The Our Lady page is filtered (not split into separate top-level tabs):
 *   - "titles"      → only Marian title content fills the page
 *   - "apparitions" → only Marian apparition content fills the page
 *   - "all"         → both, clearly sectioned (the ONLY view that mixes them)
 *
 * The default is a single category ("titles"), so the page never mixes
 * titles and apparitions unless the user explicitly selects "All".
 */

export type OurLadyFilter = "titles" | "apparitions" | "all";

export interface OurLadyView {
  active: OurLadyFilter;
  showTitles: boolean;
  showApparitions: boolean;
}

export const OUR_LADY_FILTERS: ReadonlyArray<{ key: OurLadyFilter; label: string }> = [
  { key: "titles", label: "Marian Titles" },
  { key: "apparitions", label: "Apparitions" },
  { key: "all", label: "All" },
];

/** Resolve a raw `?filter=` value into the view to render. Defaults to a
 *  single (un-mixed) category so the page never mixes unless "All". */
export function resolveOurLadyFilter(param: string | null | undefined): OurLadyView {
  const active: OurLadyFilter =
    param === "apparitions" ? "apparitions" : param === "all" ? "all" : "titles";
  return {
    active,
    showTitles: active === "titles" || active === "all",
    showApparitions: active === "apparitions" || active === "all",
  };
}
