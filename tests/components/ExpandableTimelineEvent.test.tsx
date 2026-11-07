/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { ExpandableTimelineEvent } from "@/components/ui/ExpandableTimelineEvent";

afterEach(() => cleanup());

describe("ExpandableTimelineEvent", () => {
  const nicaea = (
    <ExpandableTimelineEvent
      id="history-event-nicaea"
      title="First Council of Nicaea"
      date="20 May 325"
      eyebrow="Council"
      location="Nicaea"
      context="Convened by Constantine."
      issues="Arianism."
      significance="Defined the Son as consubstantial with the Father."
      body="An excerpt."
      links={[
        { href: "/liturgy-history/first-council-of-nicaea", label: "Read the document" },
        { href: "https://www.vatican.va/x", label: "Official text", external: true },
        { href: "/popes/pope-saint-sylvester-i", label: "Pope Saint Sylvester I" },
      ]}
    />
  );

  it("is a native disclosure, closed, its summary the date, title and kind", () => {
    const { container } = render(nicaea);
    const details = container.querySelector("details")!;
    expect(details.id).toBe("history-event-nicaea");
    expect(details.open).toBe(false);
    const summary = details.querySelector("summary")!;
    expect(summary).toHaveTextContent(/20 May 325.*First Council of Nicaea.*Council/);
    expect(summary.querySelectorAll("button")).toHaveLength(0);
  });

  it("holds its full details whether open or closed, in their existing order", () => {
    const { container } = render(nicaea);
    const body = container.querySelector(".vf-timeline-body")!;
    expect(Array.from(body.querySelectorAll("h4")).map((h) => h.textContent)).toEqual([
      "Historical context",
      "Major issues addressed",
      "Significance",
      "Related",
    ]);
    const text = body.textContent ?? "";
    const order = [
      "Location",
      "Nicaea",
      "Convened by Constantine.",
      "Arianism.",
      "Defined the Son as consubstantial with the Father.",
      "An excerpt.",
      "Read the document",
    ].map((part) => text.indexOf(part));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order).not.toContain(-1);
  });

  it("makes each related page a real link", () => {
    const { container } = render(nicaea);
    (container.querySelector("details") as HTMLDetailsElement).open = true;
    const related = screen.getByRole("heading", { name: "Related" }).nextElementSibling;
    expect(related?.tagName).toBe("UL");
    const anchors = within(related as HTMLElement).getAllByRole("link");
    expect(anchors).toHaveLength(3);
    expect(anchors[0]).toHaveAttribute("href", "/liturgy-history/first-council-of-nicaea");
    expect(anchors[1]).toHaveAttribute("href", "https://www.vatican.va/x");
    expect(anchors[1]).toHaveAttribute("target", "_blank");
    expect(anchors[1]).toHaveAttribute("rel", "noopener noreferrer");
    expect(anchors[1]).toHaveAccessibleName(/Official text.*opens in a new tab/);
    expect(anchors[2]).toHaveAttribute("href", "/popes/pope-saint-sylvester-i");
  });

  it("shows no source: a reader's page shows no sources", () => {
    const { container } = render(nicaea);
    expect(container).not.toHaveTextContent("Source:");
    expect(container).not.toHaveTextContent("wikipedia");
  });

  it("opens on the server when asked to, and marks the row it landed on", () => {
    const { container } = render(
      <ExpandableTimelineEvent title="Pentecost" date="c. 33" context="x" initiallyOpen current />,
    );
    expect(container.querySelector("details")!.open).toBe(true);
    expect(container.querySelector("summary")).toHaveAttribute("aria-current", "true");
  });

  it("omits the Related row when there are none", () => {
    render(<ExpandableTimelineEvent title="Pentecost" date="c. 33" initiallyOpen />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
