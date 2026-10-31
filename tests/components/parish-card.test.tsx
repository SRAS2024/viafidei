/**
 * @vitest-environment jsdom
 */
/**
 * The church card (PARISH-CARD) — parish, cathedral, basilica, shrine, chapel.
 *
 * The owner asked for three things and nothing else: the name, what the church
 * is (a basilica always minor or major), and its address. The September card
 * carried a "Diocese" line (really the town) and the website; both are gone.
 * It is a RENDERING change, so every published parish changes at once with no
 * worker pass over the rows, and every address part is optional: only about a
 * third of published parishes have a street, and none has a postal code until
 * the address backfill writes one.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ParishCard } from "@/components/ui/ParishCard";
import {
  parishAddressLines,
  parishDesignationLabel,
  parishDioceseLine,
  parishStreetAddress,
  parishWebsite,
} from "@/lib/content-shared/parish";

/** The address block's lines, in order. */
const addressLines = () =>
  Array.from(document.querySelectorAll("address span")).map((el) => el.textContent);

describe("ParishCard", () => {
  it("shows the name, then what the church is, then its address — in that order", () => {
    render(
      <ParishCard
        variant="detail"
        name="Basilica di Santo Stefano Rotondo"
        designation="minor-basilica"
        address="7 Via Santo Stefano Rotondo"
        postalCode="00184"
        city="Roma"
        state="Lazio"
        country="Italy"
        countryCode="IT"
      />,
    );
    const order = Array.from(document.querySelectorAll("h1, p, address")).map(
      (el) => el.textContent ?? "",
    );
    expect(order).toEqual([
      "Basilica di Santo Stefano Rotondo",
      "Minor Basilica",
      "7 Via Santo Stefano Rotondo00184 Roma, LazioItaly",
    ]);
    expect(addressLines()).toEqual(["7 Via Santo Stefano Rotondo", "00184 Roma, Lazio", "Italy"]);
    expect(screen.getByRole("button", { name: /get directions/i })).toBeInTheDocument();
  });

  it("says minor or major for every basilica, and names chapels", () => {
    for (const [stored, label] of [
      ["parish", "Parish"],
      ["cathedral", "Cathedral"],
      ["shrine", "Shrine"],
      ["chapel", "Chapel"],
      ["minor-basilica", "Minor Basilica"],
      ["major-basilica", "Major Basilica"],
    ]) {
      const { unmount } = render(<ParishCard name="X" designation={stored} />);
      expect(screen.getByText(label!)).toBeInTheDocument();
      unmount();
    }
  });

  it("writes a US address the American way", () => {
    render(
      <ParishCard
        name="Saint Symphorosa"
        designation="parish"
        address="6135 South Austin Avenue"
        postalCode="60638"
        city="Chicago"
        state="IL"
        country="United States"
      />,
    );
    expect(addressLines()).toEqual([
      "6135 South Austin Avenue",
      "Chicago, IL 60638",
      "United States",
    ]);
  });

  it("shows no website, no Diocese label and none of the other stored fields", () => {
    render(
      <ParishCard
        variant="detail"
        name="St Mary"
        designation="parish"
        address="1 Main St"
        city="Austin"
        state="Texas"
        country="United States"
      />,
    );
    expect(screen.queryByText("Diocese")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    for (const gone of [/phone/i, /mass times/i, /confession/i, /background/i, /summary/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("degrades gracefully: no postal code, no street, no designation, no address at all", () => {
    const { unmount } = render(<ParishCard name="St Anne" city="Denver" state="Colorado" />);
    expect(addressLines()).toEqual(["Denver, Colorado"]);
    // Directions need a street to aim at.
    expect(screen.queryByRole("button", { name: /get directions/i })).not.toBeInTheDocument();
    unmount();

    render(<ParishCard name="St Jude" designation="oratory-of-unknown-kind" />);
    expect(document.querySelector("address")).toBeNull();
    expect(document.querySelectorAll("p")).toHaveLength(0);
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

    render(
      <ParishCard
        name="St Mary"
        address="1 Main St"
        postalCode="78701"
        city="Austin"
        state="Texas"
        countryCode="US"
      />,
    );
    screen.getByRole("button", { name: /get directions/i }).click();
    expect(String(open.mock.calls[1]![0])).toContain(
      encodeURIComponent("1 Main St, Austin, Texas 78701"),
    );
    vi.unstubAllGlobals();
  });

  it("renders the distance slot under the name and designation on a list card", () => {
    render(
      <ParishCard
        name="St Anne"
        href="/parishes/st-anne"
        designation="parish"
        city="Denver"
        state="Colorado"
        distanceSlot={<span>0.4 mi</span>}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "St Anne" });
    expect(within(heading).getByRole("link")).toHaveAttribute("href", "/parishes/st-anne");
    const texts = Array.from(document.querySelectorAll("h2, p, span")).map((e) => e.textContent);
    expect(texts.indexOf("Parish")).toBeLessThan(texts.indexOf("0.4 mi"));
    expect(texts.indexOf("0.4 mi")).toBeLessThan(texts.indexOf("Denver, Colorado"));
  });

  it("has no distance line at all when no slot is passed", () => {
    render(<ParishCard name="St Anne" href="/parishes/st-anne" />);
    expect(screen.queryByText(/ mi$/)).not.toBeInTheDocument();
  });
});

describe("church address and designation helpers", () => {
  it("places the postal code by country, and drops what the record lacks", () => {
    expect(
      parishAddressLines({
        address: "Hörsteler Straße 7",
        postalCode: "48431",
        city: "Rheine",
        country: "Germany",
        countryCode: "DE",
      }),
    ).toEqual(["Hörsteler Straße 7", "48431 Rheine", "Germany"]);
    expect(
      parishAddressLines({
        postalCode: "2060",
        city: "North Sydney",
        state: "NSW",
        countryCode: "AU",
      }),
    ).toEqual(["North Sydney, NSW 2060"]);
    // No code, but the country name says where the postal code goes.
    expect(
      parishAddressLines({ city: "Chicago", state: "IL", postalCode: "60629", country: "USA" }),
    ).toEqual(["Chicago, IL 60629", "USA"]);
    expect(parishAddressLines({ postalCode: "00184", countryCode: "IT" })).toEqual(["00184"]);
    expect(parishAddressLines({ city: " ", country: null })).toEqual([]);
  });

  it("labels only the designations it knows — never a raw token", () => {
    expect(parishDesignationLabel("minor-basilica")).toBe("Minor Basilica");
    expect(parishDesignationLabel("Major Basilica")).toBe("Major Basilica");
    expect(parishDesignationLabel("major_basilica")).toBe("Major Basilica");
    expect(parishDesignationLabel("chapel")).toBe("Chapel");
    expect(parishDesignationLabel("basilica")).toBe("Basilica");
    expect(parishDesignationLabel("wayside_cross")).toBeNull();
    expect(parishDesignationLabel(undefined)).toBeNull();
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
