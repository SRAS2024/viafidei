/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PublishedList } from "@/components/ui/PublishedList";
import { compareSaintsChronologically, saintEyebrow } from "@/lib/content-shared/saints";
import type { PublishedItem } from "@/lib/data/published";

afterEach(() => cleanup());

function saint(id: string, title: string, payload: Record<string, unknown>): PublishedItem {
  return {
    id,
    checklistItemId: id,
    contentType: "SAINT",
    slug: id,
    title,
    payload,
    authorityLevel: "VATICAN",
    version: 1,
    publishedAt: new Date(),
  };
}

describe("PublishedList with saint ordering + computed eyebrow", () => {
  const items = [
    saint("therese", "St. Thérèse of Lisieux", {
      saintType: "virgin",
      deathDate: "1897",
      feastDay: "10-01",
    }),
    saint("peter", "St. Peter the Apostle", {
      saintType: "apostle",
      deathDate: "67 AD",
      feastDay: "06-29",
    }),
  ];

  it("renders saints chronologically with their strict title eyebrow", () => {
    render(
      <PublishedList
        items={items}
        baseHref="/saints"
        sortItems={compareSaintsChronologically}
        eyebrowFor={(item) => saintEyebrow(item.payload)}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["St. Peter the Apostle", "St. Thérèse of Lisieux"]);

    expect(screen.getByText("Apostle · Feast June 29")).toBeInTheDocument();
    expect(screen.getByText("Virgin · Feast October 1")).toBeInTheDocument();
  });
});
