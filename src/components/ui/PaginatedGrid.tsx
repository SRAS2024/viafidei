import type { ReactNode } from "react";

/**
 * How wide a collection's cards should be. "3" is the default, for items with
 * long titles or descriptions; "4" is for short entries that fit it comfortably;
 * "2" is for the homepage's balanced pairs. Each names a minimum card width, not
 * a fixed count: a phone gets one column, a tablet two, and enlarged text simply
 * earns fewer columns.
 */
export type GridColumns = 2 | 3 | 4;

// Written out whole: Tailwind only keeps classes it can find as literal text.
const GRID_CLASSES: Readonly<Record<GridColumns, string>> = {
  2: "vf-grid vf-grid--2",
  3: "vf-grid vf-grid--3",
  4: "vf-grid vf-grid--4",
};

/** The class of a collection grid; loading placeholders use the same one. */
export function gridClass(columns: GridColumns = 3): string {
  return GRID_CLASSES[columns];
}

/**
 * Responsive content grid.
 *
 * Purely presentational: it lays cards out and nothing else. Pagination is
 * done on the SERVER — each list page asks the database for one page of rows
 * and renders crawlable `?page=` links with `<Pagination>` beneath this grid.
 */
export function PaginatedGrid({
  items,
  columns = 3,
}: {
  items: ReactNode[];
  columns?: GridColumns;
}) {
  return (
    // role="list": Safari drops a list's role where its markers are removed, and with
    // it VoiceOver's "list, 36 items" and its list navigation.
    <ul role="list" className={gridClass(columns)}>
      {items.map((node, i) => (
        <li key={i}>{node}</li>
      ))}
    </ul>
  );
}
