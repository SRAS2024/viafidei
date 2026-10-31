/**
 * @vitest-environment jsdom
 */
/**
 * The parish card (PARISH-CARD).
 *
 * Parish cards carried designation, phone, mass times, confession times,
 * background, summary and a row per place field. The card shows the name, the
 * diocese (only when the record names one — the place line was mislabelled
 * "Diocese" before), the full address with postal code and directions, and the
 * website, as a RENDERING change so every published parish changes at once,
 * with no worker pass over the rows. These tests pin the shape, the missing-
 * place case (no empty labelled rows), and directions from coordinates for the
 * majority of parishes that have no street.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ParishCard } from "@/components/ui/ParishCard";
import { parishPlaceLine, parishStreetAddress, parishWebsite } from "@/lib/content-shared/parish";

describe("ParishCard", () => {
  it("shows name, diocese, full address with directions, and website — in that order", () => {
    render(
      <ParishCard
        variant="detail"
        name="Cathedral Basilica of the Immaculate Conception"
        address="1530 Logan St"
        city="Denver"
        state="Colorado"
        country="United States"
        postalCode="80203"
        countryCode="US"
        diocese="Archdiocese of Denver"
        website="https://denvercathedral.org/"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Cathedral Basilica of the Immaculate Conception" }),
    ).toBeInTheDocument();

    // Only the record's own diocese is labelled "Diocese".
    const diocese = screen.getByText("Diocese").closest("p")!;
    expect(diocese).toHaveTextContent("Diocese Archdiocese of Denver");
    expect(diocese).not.toHaveTextContent("Colorado");
    expect(screen.queryByText("City")).not.toBeInTheDocument();
    expect(screen.queryByText("State")).not.toBeInTheDocument();
    expect(screen.queryByText("Country")).not.toBeInTheDocument();

    expect(screen.getByText("1530 Logan St")).toBeInTheDocument();
    // The place line carries the postal code in the country's order.
    expect(screen.getByText("Denver, Colorado 80203, United States")).toBeInTheDocument();
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

  it("never labels the city, state or country as the diocese", () => {
    render(<ParishCard name="St Anne" city="Denver" state="Colorado" country="United States" />);
    expect(screen.queryByText("Diocese")).not.toBeInTheDocument();
    expect(screen.getByText("Denver, Colorado, United States")).toBeInTheDocument();
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

  it("omits the place line entirely when the record has no city, state or country", () => {
    render(<ParishCard name="St Anne" address="12 Chapel Rd" />);
    expect(screen.queryByText("Diocese")).not.toBeInTheDocument();
    expect(screen.getByText("12 Chapel Rd")).toBeInTheDocument();
    expect(screen.getByText("12 Chapel Rd").closest("p")).toHaveTextContent(/^12 Chapel Rd$/);
  });

  it("keeps the place line when only some parts exist", () => {
    render(<ParishCard name="St Anne" state="Bavaria" country="Germany" />);
    expect(screen.getByText("Bavaria, Germany")).toBeInTheDocument();
  });

  it("puts the postal code before the city where the country does", () => {
    render(
      <ParishCard
        name="Sant'Eligio dei Ferrari"
        address="Via del Velabro"
        postalCode="00153"
        city="Roma"
        state="Lazio"
        country="Italy"
        countryCode="IT"
      />,
    );
    expect(screen.getByText("00153 Roma, Lazio, Italy")).toBeInTheDocument();
  });

  it("offers directions from the coordinates when there is no street", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(
      <ParishCard name="Chiesa" city="Roma" country="Italy" latitude={41.89} longitude={12.48} />,
    );
    screen.getByRole("button", { name: /get directions/i }).click();
    expect(String(open.mock.calls[0]![0])).toContain(encodeURIComponent("41.89,12.48"));
    vi.unstubAllGlobals();

    // Even with nothing but coordinates, the parish can still be reached.
    render(<ParishCard name="Kapelle" latitude={46.7} longitude={9.1} />);
    expect(screen.getAllByRole("button", { name: /get directions/i })).toHaveLength(2);
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
    // The slot sits between the name and the place line.
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
    expect(parishPlaceLine({ city: "Denver", state: "Colorado", country: "United States" })).toBe(
      "Denver, Colorado, United States",
    );
    expect(parishPlaceLine({ city: " ", state: null, country: "Italy" })).toBe("Italy");
    expect(parishPlaceLine({ city: null, state: null, country: null })).toBeNull();
    expect(parishPlaceLine({})).toBeNull();
  });

  it("places the postal code in the country's order", () => {
    expect(
      parishPlaceLine({
        postalCode: "00153",
        city: "Roma",
        state: "Lazio",
        country: "Italy",
        countryCode: "IT",
      }),
    ).toBe("00153 Roma, Lazio, Italy");
    expect(
      parishPlaceLine({
        postalCode: "62701",
        city: "Springfield",
        state: "Illinois",
        country: "United States",
        countryCode: "US",
      }),
    ).toBe("Springfield, Illinois 62701, United States");
    expect(
      parishPlaceLine({
        postalCode: "SW1A 1AA",
        city: "London",
        country: "United Kingdom",
        countryCode: "GB",
      }),
    ).toBe("London SW1A 1AA, United Kingdom");
    // Unknown country: code first, the common European order.
    expect(parishPlaceLine({ postalCode: "1210", city: "Wien" })).toBe("1210 Wien");
    expect(parishPlaceLine({ postalCode: "1210" })).toBe("1210");
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
