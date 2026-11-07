/**
 * @vitest-environment jsdom
 */
/**
 * The church card (PARISH-CARD) — parish, cathedral, basilica, shrine, chapel,
 * oratory.
 *
 * The owner asked for three things and nothing else: the name, what the church
 * is (a basilica always minor or major), and its address. The September card
 * carried a "Diocese" line (really the town) and the website; both are gone.
 * It is a RENDERING change, so every published parish changes at once with no
 * worker pass over the rows, and every address part is optional: only about a
 * third of published parishes have a street, and none has a postal code until
 * the address backfill writes one. Every parish has coordinates, so directions
 * are offered from them when there is no street.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ParishCard } from "@/components/ui/ParishCard";
import {
  parishAddressLines,
  parishDesignationLabel,
  parishStreetAddress,
  parishTextLanguage,
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

  it("says minor or major for every basilica, and names chapels and oratories", () => {
    for (const [stored, label] of [
      ["parish", "Parish"],
      ["cathedral", "Cathedral"],
      ["shrine", "Shrine"],
      ["chapel", "Chapel"],
      ["oratory", "Oratory"],
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
    // A town alone is no destination: no street and no coordinates, no directions.
    expect(screen.queryByRole("button", { name: /get directions/i })).not.toBeInTheDocument();
    unmount();

    render(<ParishCard name="St Jude" designation="oratory-of-unknown-kind" />);
    expect(document.querySelector("address")).toBeNull();
    expect(document.querySelectorAll("p")).toHaveLength(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers directions from the coordinates when there is no street", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);

    // The common case: a town and coordinates, no street.
    const { unmount } = render(
      <ParishCard name="Chiesa" city="Roma" country="Italy" latitude={41.89} longitude={12.48} />,
    );
    expect(addressLines()).toEqual(["Roma", "Italy"]);
    screen.getByRole("button", { name: /get directions/i }).click();
    expect(String(open.mock.calls[0]![0])).toContain(encodeURIComponent("41.89,12.48"));
    unmount();

    // Nothing but coordinates: no address block, and the church can still be reached.
    render(<ParishCard name="Kapelle" designation="chapel" latitude={46.7} longitude={9.1} />);
    expect(document.querySelector("address")).toBeNull();
    screen.getByRole("button", { name: /get directions/i }).click();
    expect(String(open.mock.calls[1]![0])).toContain(encodeURIComponent("46.7,9.1"));
    vi.unstubAllGlobals();
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

describe("the directory card", () => {
  const seoul = {
    name: "Myeongdong Daeseongdang (명동대성당)",
    href: "/parishes/myeongdong",
    designation: "cathedral",
    address: "명동길 74",
    postalCode: "04537",
    city: "서울특별시",
    country: "South Korea",
    countryCode: "KR",
    latitude: 37.5633,
    longitude: 126.9873,
  };

  it("is the shared card: a stretched title link, then meta lines, then the address", () => {
    render(<ParishCard {...seoul} distanceSlot="0.4 mi away" />);
    const card = screen.getByRole("article");
    expect(card).toHaveClass("vf-entry");
    const link = within(card).getByRole("link");
    expect(link).toHaveClass("vf-entry-link");
    expect(link).toHaveAttribute("href", "/parishes/myeongdong");
    const meta = Array.from(card.querySelectorAll(".vf-entry-meta")).map((el) => el.textContent);
    expect(meta).toEqual(["Cathedral", "0.4 mi away"]);
  });

  it("puts Get directions beneath the address, inside the card and above the card's link", () => {
    render(<ParishCard {...seoul} />);
    const card = screen.getByRole("article");
    const button = within(card).getByRole("button", { name: /get directions/i });
    const address = card.querySelector("address") as HTMLElement;
    // A sibling row of the address, not a column beside it.
    expect(address.parentElement).toBe(card);
    expect(button.closest(".vf-entry-action")?.parentElement).toBe(card);
    expect(address.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button).toHaveClass("vf-btn", "vf-btn-sm", "vf-btn-ghost", "vf-entry-control");
    // A button in a link is invalid HTML and swallows the tap.
    expect(button.closest("a")).toBeNull();
  });

  it("names the church in each button, so a list of buttons can tell them apart", () => {
    render(<ParishCard {...seoul} />);
    expect(
      screen.getByRole("button", {
        name: "Get directions to Myeongdong Daeseongdang (명동대성당)",
      }),
    ).toBeInTheDocument();
    // What a sighted reader sees stays the short label.
    expect(screen.getByRole("button")).toHaveTextContent(/^Get directions$/);
  });

  it("has no directions row for a town with no coordinates, and no address row without parts", () => {
    const { unmount } = render(<ParishCard name="St Anne" city="Denver" />);
    expect(document.querySelector(".vf-entry-action")).toBeNull();
    unmount();
    render(<ParishCard name="Kapelle" latitude={46.7} longitude={9.1} />);
    expect(document.querySelector("address")).toBeNull();
    expect(document.querySelector(".vf-entry-action")).not.toBeNull();
  });

  it("marks each line with its own language and direction for a screen reader", () => {
    render(<ParishCard {...seoul} />);
    const lines = Array.from(document.querySelectorAll("address span"));
    expect(lines.map((el) => el.getAttribute("lang"))).toEqual(["ko", "ko", null]);
    expect(lines.every((el) => el.getAttribute("dir") === "auto")).toBe(true);
    // The transliteration is read in the page's voice, the original in its own.
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Myeongdong Daeseongdang (명동대성당)");
    expect(heading.querySelector('[lang="ko"]')).toHaveTextContent(/^명동대성당$/);
  });

  it("marks a name wholly in another script as that language", () => {
    render(<ParishCard name="東京カテドラル聖マリア大聖堂" href="/p" countryCode="JP" />);
    const name = screen.getByText("東京カテドラル聖マリア大聖堂");
    expect(name).toHaveAttribute("lang", "ja");
  });
});

describe("the parish page", () => {
  it("is a reading page: title, designation, address, then its controls together", () => {
    render(
      <ParishCard
        variant="detail"
        name="Basilica of St. Mary"
        designation="minor-basilica"
        address="1600 Hennepin Avenue"
        city="Minneapolis"
        state="MN"
        postalCode="55403"
        countryCode="US"
        latitude={44.97}
        longitude={-93.29}
        action={<button type="button">Share</button>}
      />,
    );
    const page = screen.getByRole("article");
    expect(page).toHaveClass("vf-detail");
    const header = page.querySelector(".vf-detail-header") as HTMLElement;
    expect(within(header).getByRole("heading", { level: 1 })).toHaveClass("vf-detail-title");
    expect(within(header).getByText("Minor Basilica")).toHaveClass("vf-detail-subtitle");
    const actions = header.querySelector(".vf-detail-actions") as HTMLElement;
    expect(
      within(actions)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Get directions", "Share"]);
    const address = header.querySelector("address") as HTMLElement;
    expect(
      address.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("has no controls row when there is nothing to put in it", () => {
    render(<ParishCard variant="detail" name="St Anne" city="Denver" />);
    expect(document.querySelector(".vf-detail-actions")).toBeNull();
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

  it("writes the postal code after the town in the countries that do", () => {
    expect(
      parishAddressLines({ city: "Singapore", postalCode: "048616", countryCode: "SG" }),
    ).toEqual(["Singapore 048616"]);
    expect(
      parishAddressLines({
        city: "Cape Town",
        state: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      }),
    ).toEqual(["Cape Town, Western Cape 8001", "South Africa"]);
    expect(parishAddressLines({ city: "Makati", postalCode: "1226", countryCode: "PH" })).toEqual([
      "Makati 1226",
    ]);
    expect(
      parishAddressLines({
        city: "São Paulo",
        state: "SP",
        postalCode: "01310-100",
        countryCode: "BR",
      }),
    ).toEqual(["São Paulo, SP 01310-100"]);
    expect(
      parishAddressLines({ city: "London", postalCode: "SW1A 1AA", countryCode: "GB" }),
    ).toEqual(["London SW1A 1AA"]);
  });

  it("writes a country stored as a bare code in words, and places the postal code by it", () => {
    expect(parishAddressLines({ city: "Wien", country: "AT" })).toEqual(["Wien", "Austria"]);
    expect(parishAddressLines({ city: "Chicago", postalCode: "60629", country: "US" })).toEqual([
      "Chicago 60629",
      "United States",
    ]);
    // Not a code anything knows: as stored, never "Unknown Region".
    expect(parishAddressLines({ city: "X", country: "ZZ" })).toEqual(["X", "ZZ"]);
  });

  it("labels only the designations it knows — never a raw token", () => {
    expect(parishDesignationLabel("minor-basilica")).toBe("Minor Basilica");
    expect(parishDesignationLabel("Major Basilica")).toBe("Major Basilica");
    expect(parishDesignationLabel("major_basilica")).toBe("Major Basilica");
    expect(parishDesignationLabel("chapel")).toBe("Chapel");
    expect(parishDesignationLabel("oratory")).toBe("Oratory");
    expect(parishDesignationLabel("basilica")).toBe("Basilica");
    expect(parishDesignationLabel("wayside_cross")).toBeNull();
    expect(parishDesignationLabel(undefined)).toBeNull();
  });
});

describe("the language of a line", () => {
  it.each([
    ["수성로72길", "KR", "ko"],
    ["보행자 및 차량통로( 전체 편집자 : SATO )", "KR", "ko"],
    ["カトリック潮見教会", "JP", "ja"],
    // Han alone is settled by the country.
    ["文京区", "JP", "ja"],
    ["吉阳区", "CN", "zh"],
    ["屏東縣", "TW", "zh-Hant"],
    ["מנהרת כרם", "IL", "he"],
    ["شارع دكتور محمود صلاح الدين", "EG", "ar"],
    ["Κοκκινάκη 4", "GR", "el"],
    ["Комсомольская улица", "RU", "ru"],
    ["Заславська вулиця 25", "UA", "uk"],
    ["Люлин планина 5", "BG", "bg"],
    ["ถนนสุขุมวิท", "TH", "th"],
    ["बागमती प्रदेश", "NP", "ne"],
    ["Հաղթանակի պողոտա", "AM", "hy"],
  ])("%s in %s is %s", (line, code, language) => {
    expect(parishTextLanguage(line, code)).toBe(language);
  });

  it("leaves Latin script, numbers, and lines mostly in another script to the page", () => {
    expect(parishTextLanguage("Via Roma 12", "IT")).toBeUndefined();
    expect(parishTextLanguage("9574320", "IL")).toBeUndefined();
    expect(parishTextLanguage("Dae Seongdang (대성당)", "KR")).toBeUndefined();
    expect(parishTextLanguage("Rue Aïn Harrouda زنقة عين حرودة", "MA")).toBeUndefined();
    expect(parishTextLanguage("", "KR")).toBeUndefined();
    expect(parishTextLanguage(null)).toBeUndefined();
  });
});

describe("parish card helpers", () => {
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
});
