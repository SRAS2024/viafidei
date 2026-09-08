/**
 * @vitest-environment jsdom
 */
/**
 * The parish card (PARISH-CARD).
 *
 * Parish cards carried designation, phone, mass times, confession times,
 * background, summary and a row per place field. The owner asked for four
 * things and nothing else — name, "Diocese", address + directions, website —
 * and asked for it as a RENDERING change so all 9,731 published parishes
 * change at once, with no worker pass over the rows. These tests pin the
 * shape, and in particular the missing-place case: only about a third of
 * published parishes have a city, so "no Diocese line" is the common path and
 * must never render an empty labelled row.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ParishCard } from "@/components/ui/ParishCard";
import { parishDioceseLine, parishStreetAddress, parishWebsite } from "@/lib/content-shared/parish";

describe("ParishCard", () => {
  it("shows name, Diocese, address with directions, and website — in that order", () => {
    render(
      <ParishCard
        variant="detail"
        name="Cathedral Basilica of the Immaculate Conception"
        address="1530 Logan St"
        city="Denver"
        state="Colorado"
        country="United States"
        website="https://denvercathedral.org/"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Cathedral Basilica of the Immaculate Conception" }),
    ).toBeInTheDocument();

    // One line, one label — never separate City / State / Country rows.
    const diocese = screen.getByText("Diocese").closest("p")!;
    expect(diocese).toHaveTextContent("Diocese Denver, Colorado, United States");
    expect(screen.queryByText("City")).not.toBeInTheDocument();
    expect(screen.queryByText("State")).not.toBeInTheDocument();
    expect(screen.queryByText("Country")).not.toBeInTheDocument();

    expect(screen.getByText("1530 Logan St")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get directions/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "denvercathedral.org" })).toHaveAttribute(
      "href",
      "https://denvercathedral.org/",
    );

    const order = Array.from(document.querySelectorAll("h1, p")).map((el) => el.textContent ?? "");
    expect(order.findIndex((t) => t.includes("Cathedral Basilica"))).toBeLessThan(
      order.findIndex((t) => t.includes("Diocese")),
    );
    expect(order.findIndex((t) => t.includes("Diocese"))).toBeLessThan(
      order.findIndex((t) => t.includes("1530 Logan St")),
    );
    expect(order.findIndex((t) => t.includes("1530 Logan St"))).toBeLessThan(
      order.findIndex((t) => t.includes("denvercathedral.org")),
    );
  });

  it("renders none of the fields the card used to carry", () => {
    render(
      <ParishCard
        variant="detail"
        name="St Mary"
        address="1 Main St"
        city="Austin"
        state="Texas"
        country="United States"
        website="stmarys.org"
      />,
    );
    for (const gone of [
      /designation/i,
      /parish$/i,
      /phone/i,
      /mass times/i,
      /confession/i,
      /background/i,
      /summary/i,
    ]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("omits the Diocese line entirely when the record has no city, state or country", () => {
    // The COMMON case: ~6,500 of 9,731 parishes have no city.
    render(<ParishCard name="St Anne" address="12 Chapel Rd" />);
    expect(screen.queryByText("Diocese")).not.toBeInTheDocument();
    expect(screen.getByText("12 Chapel Rd")).toBeInTheDocument();
  });

  it("keeps the Diocese line when only some parts exist", () => {
    render(<ParishCard name="St Anne" state="Bavaria" country="Germany" />);
    expect(screen.getByText("Diocese").closest("p")).toHaveTextContent("Diocese Bavaria, Germany");
  });

  it("omits the website line when there is no website, and the address line when there is no address", () => {
    render(<ParishCard name="St Jude" city="Lima" country="Peru" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /get directions/i })).not.toBeInTheDocument();
  });

  it("sends Maps the coordinates when the record has them, and the full address otherwise", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);

    const { unmount } = render(
      <ParishCard
        name="St Mary"
        address="1 Main St"
        city="Austin"
        state="Texas"
        country="United States"
        latitude={30.27}
        longitude={-97.74}
      />,
    );
    screen.getByRole("button", { name: /get directions/i }).click();
    expect(String(open.mock.calls[0]![0])).toContain(encodeURIComponent("30.27,-97.74"));
    unmount();

    render(<ParishCard name="St Mary" address="1 Main St" city="Austin" state="Texas" />);
    screen.getByRole("button", { name: /get directions/i }).click();
    expect(String(open.mock.calls[1]![0])).toContain(
      encodeURIComponent("1 Main St, Austin, Texas"),
    );
    vi.unstubAllGlobals();
  });

  it("renders the distance slot directly under the name on a list card", () => {
    render(
      <ParishCard
        name="St Anne"
        href="/parishes/st-anne"
        city="Denver"
        state="Colorado"
        distanceSlot={<span>0.4 mi</span>}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "St Anne" });
    expect(within(heading).getByRole("link")).toHaveAttribute("href", "/parishes/st-anne");
    // The slot sits between the name and the Diocese line.
    const texts = Array.from(document.querySelectorAll("h2, span, p")).map((e) => e.textContent);
    expect(texts.indexOf("0.4 mi")).toBeGreaterThan(-1);
    expect(texts.findIndex((t) => t === "0.4 mi")).toBeLessThan(
      texts.findIndex((t) => (t ?? "").includes("Denver, Colorado")),
    );
  });

  it("has no distance line at all when no slot is passed", () => {
    render(<ParishCard name="St Anne" href="/parishes/st-anne" />);
    expect(screen.queryByText(/mi\b/)).not.toBeInTheDocument();
  });
});

describe("parish card helpers", () => {
  it("joins the place parts with ', ' and returns null when there are none", () => {
    expect(parishDioceseLine({ city: "Denver", state: "Colorado", country: "United States" })).toBe(
      "Denver, Colorado, United States",
    );
    expect(parishDioceseLine({ city: " ", state: null, country: "Italy" })).toBe("Italy");
    expect(parishDioceseLine({ city: null, state: null, country: null })).toBeNull();
    expect(parishDioceseLine({})).toBeNull();
  });

  it("strips the place parts a directory row already joined into `location`", () => {
    // ParishListItem.location is "address, city, state".
    expect(
      parishStreetAddress({
        location: "1530 Logan St, Denver, Colorado",
        city: "Denver",
        state: "Colorado",
      }),
    ).toBe("1530 Logan St");
    // Nothing but the place: there is no postal address to show.
    expect(
      parishStreetAddress({ location: "Denver, Colorado", city: "Denver", state: "Colorado" }),
    ).toBeNull();
    expect(parishStreetAddress({ location: "" })).toBeNull();
    expect(parishStreetAddress({ location: "12 Chapel Rd" })).toBe("12 Chapel Rd");
  });

  it("makes a scheme-less website usable and labels it without the scheme", () => {
    expect(parishWebsite("stmarys.org")).toEqual({
      href: "https://stmarys.org",
      label: "stmarys.org",
    });
    expect(parishWebsite("http://x.org/")).toEqual({ href: "http://x.org/", label: "x.org" });
    expect(parishWebsite("  ")).toBeNull();
    expect(parishWebsite(null)).toBeNull();
  });
});
