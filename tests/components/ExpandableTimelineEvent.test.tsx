/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ExpandableTimelineEvent } from "@/components/ui/ExpandableTimelineEvent";

afterEach(() => cleanup());

describe("ExpandableTimelineEvent", () => {
  it("shows the formatted date and kind badge collapsed, and the details when opened", () => {
    render(
      <ExpandableTimelineEvent
        id="history-event-nicaea"
        title="First Council of Nicaea"
        date="20 May 325"
        eyebrow="Council"
        location="Nicaea"
        context="Convened by Constantine."
        significance="Defined the Son as consubstantial with the Father."
        citation="https://en.wikipedia.org/wiki/First_Council_of_Nicaea"
        links={[
          { href: "/liturgy-history/first-council-of-nicaea", label: "Read the document" },
          { href: "https://www.vatican.va/x", label: "Official text", external: true },
          { href: "/popes/pope-saint-sylvester-i", label: "Pope Saint Sylvester I" },
        ]}
      />,
    );
    expect(screen.getByText("20 May 325")).toBeInTheDocument();
    expect(screen.getByText("Council")).toBeInTheDocument();
    expect(screen.queryByText("Nicaea")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /First Council of Nicaea/ }));
    const region = screen.getByRole("region", { name: "First Council of Nicaea" });
    expect(region).toHaveTextContent("Nicaea");
    expect(region).toHaveTextContent("Convened by Constantine.");
    expect(region).toHaveTextContent("Defined the Son as consubstantial with the Father.");

    const related = screen.getByRole("list", { name: "Related to First Council of Nicaea" });
    const anchors = related.querySelectorAll("a");
    expect(anchors).toHaveLength(3);
    expect(anchors[0]).toHaveAttribute("href", "/liturgy-history/first-council-of-nicaea");
    expect(anchors[1]).toHaveAttribute("href", "https://www.vatican.va/x");
    expect(anchors[1]).toHaveAttribute("target", "_blank");
    expect(anchors[1]).toHaveAttribute("rel", "noopener noreferrer");
    expect(anchors[2]).toHaveAttribute("href", "/popes/pope-saint-sylvester-i");

    const source = screen.getByRole("link", { name: "en.wikipedia.org" });
    expect(source).toHaveAttribute("href", "https://en.wikipedia.org/wiki/First_Council_of_Nicaea");
    expect(document.getElementById("history-event-nicaea")).not.toBeNull();
  });

  it("omits the Related row and source when there are none", () => {
    render(<ExpandableTimelineEvent title="Pentecost" date="c. 33" initiallyOpen />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
  });
});
