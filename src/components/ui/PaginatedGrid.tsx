import type { ReactNode } from "react";

/**
 * Responsive content grid.
 *
 * Purely presentational: it lays cards out and nothing else. Pagination is
 * done on the SERVER now — each list page asks the database for one page of
 * rows and renders crawlable `?page=` links with `<Pagination>` beneath this
 * grid. The old client-side version received every published row as props,
 * sliced them in the browser, and kept the page number in component state,
 * which meant (a) the whole table was serialised into the RSC payload, (b) a
 * crawler only ever saw page 1, and (c) the first paint showed 10 cards and
 * then re-flowed to 25 once the resize effect ran.
 *
 * Five columns on desktop, three on tablet, one on mobile — unchanged, so the
 * page looks exactly as it did.
 */
export function PaginatedGrid({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((node, i) => (
        <li key={i}>{node}</li>
      ))}
    </ul>
  );
}
