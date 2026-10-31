/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PublishedList } from "@/components/ui/PublishedList";
import { compareSaintsChronologically, saintEyebrow } from "@/lib/content-shared/saints";
import type { PublishedItem, PublishedListItem } from "@/lib/data/published";

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

    // Peter (an Apostle) carries the permitted title; Thérèse (a virgin) shows none.
    expect(screen.getByText("Apostle and Disciple of Jesus · Feast June 29")).toBeInTheDocument();
    expect(screen.getByText("Feast October 1")).toBeInTheDocument();
  });
});

describe("PublishedList detail lines beneath the title", () => {
  const peter: PublishedListItem = {
    id: "peter",
    contentType: "SAINT",
    slug: "peter",
    title: "St. Peter",
    subtitle: "A saint of the Catholic Church",
    subtype: "apostle",
    href: "/saints/peter",
  };

  it("renders each line directly under the name, in the order given", () => {
    render(
      <PublishedList
        items={[peter]}
        baseHref="/saints"
        eyebrowFor={() => "Apostle and Disciple of Jesus"}
        detailLinesFor={() => ["Patron of the papacy, fishermen, Rome", "Feast day: June 29"]}
      />,
    );

    const card = screen.getByRole("heading", { level: 2, name: "St. Peter" }).closest("article")!;
    expect([...card.querySelectorAll("h2, p")].map((el) => el.textContent)).toEqual([
      "Apostle and Disciple of Jesus",
      "St. Peter",
      "Patron of the papacy, fishermen, Rome",
      "Feast day: June 29",
    ]);
  });

  it("adds nothing beneath the name when there are no lines", () => {
    render(<PublishedList items={[peter]} baseHref="/saints" detailLinesFor={() => [" "]} />);

    const card = screen.getByRole("heading", { level: 2, name: "St. Peter" }).closest("article")!;
    expect([...card.querySelectorAll("p")]).toHaveLength(0);
  });
});
