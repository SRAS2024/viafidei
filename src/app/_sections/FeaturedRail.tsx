import type { ReactNode } from "react";

import { PaginatedGrid, type GridColumns } from "@/components/ui/PaginatedGrid";

/**
 * How many columns a rail of this many cards should use, so a row never strands
 * a card: two or four cards pair up, three or six fill rows of three. A count
 * with a remainder takes three, and the last row's cards then share its width.
 */
export function railColumns(count: number): GridColumns {
  return count % 2 === 0 && count % 3 !== 0 ? 2 : 3;
}

/** A featured rail's cards in the columns their number calls for. */
export function FeaturedCards({ cards }: { cards: ReactNode[] }) {
  return (
    <div className="vf-home-rail">
      <PaginatedGrid items={cards} columns={railColumns(cards.length)} />
    </div>
  );
}
