/**
 * @vitest-environment jsdom
 */
/**
 * The prayer dropdowns of a guide, novena, devotion or chaplet, and the one
 * language choice they share with the prayer page.
 *
 * The guide list used to carry its own "English / Latin / Greek" switch and
 * the inline step panels another, neither connected to the prayer page's
 * session choice — Latin picked on the Our Father did not open the Rosary's
 * prayers in Latin, and the chips looked different everywhere. Every surface
 * now uses PrayerLanguageChips: Latin / Greek only (the vernacular is the
 * default), one choice for the whole session, and no chip for a language no
 * prayer in the list has.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { GuidePrayers, type GuidePrayerData } from "@/components/ui/GuidePrayers";
import { PrayerLanguageToggle } from "@/components/ui/PrayerLanguageToggle";

const OUR_FATHER: GuidePrayerData = {
  slug: "our-father",
  title: "Our Father",
  variants: [
    { code: "en", label: "English", text: "Our Father, who art in heaven...", preserve: false },
    { code: "la", label: "Latin", text: "Pater noster, qui es in caelis...", preserve: true },
    { code: "el", label: "Greek", text: "Πάτερ ἡμῶν...", preserve: true },
  ],
};
const DAY_PRAYER: GuidePrayerData = {
  slug: "divine-mercy-chaplet-prayers",
  title: "The Prayers of the Chaplet",
  variants: [
    { code: "en", label: "English", text: "Eternal Father, I offer You...", preserve: false },
  ],
};
const ENGLISH_ONLY: GuidePrayerData = {
  slug: "prayer-for-priests",
  title: "Prayer for Priests",
  variants: [{ code: "en", label: "English", text: "O Jesus, eternal Priest...", preserve: false }],
};

const open = (title: string) => fireEvent.click(screen.getByRole("button", { name: title }));

afterEach(() => cleanup());
beforeEach(() => window.sessionStorage.clear());

describe("GuidePrayers", () => {
  it("offers Latin and Greek chips — never an English one — and switches every dropdown", () => {
    render(<GuidePrayers prayers={[OUR_FATHER, DAY_PRAYER]} />);
    expect(screen.getByRole("button", { name: "Latin" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Greek" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();

    open(/Our Father/);
    open(/The Prayers of the Chaplet/);
    expect(screen.getByText(/Our Father, who art in heaven/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    const latin = screen.getByText(/Pater noster/).closest(".vf-prayer");
    expect(latin).toHaveAttribute("translate", "no");
    expect(latin).toHaveAttribute("lang", "la");
    // A prayer with no Latin keeps its English text rather than going blank.
    expect(screen.getByText(/Eternal Father, I offer You/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vf_prayer_lang")).toBe("la");

    // Selecting the active chip again returns to the vernacular.
    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    expect(screen.getByText(/Our Father, who art in heaven/)).toBeInTheDocument();
  });

  it("shows no chips when no prayer in the list has another language", () => {
    render(<GuidePrayers prayers={[ENGLISH_ONLY, DAY_PRAYER]} />);
    expect(screen.queryByRole("group", { name: /prayer language/i })).not.toBeInTheDocument();
  });

  it("opens in the language chosen earlier in the session", () => {
    window.sessionStorage.setItem("vf_prayer_lang", "el");
    render(<GuidePrayers prayers={[OUR_FATHER]} />);
    open(/Our Father/);
    expect(screen.getByText("Πάτερ ἡμῶν...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Greek" })).toHaveAttribute("aria-pressed", "true");
  });

  it("takes the heading of the page it sits on", () => {
    render(<GuidePrayers prayers={[OUR_FATHER]} heading="Prayers of this novena" />);
    expect(screen.getByRole("heading", { name: "Prayers of this novena" })).toBeInTheDocument();
  });

  it("says under a dropdown when the chosen language is a machine translation", () => {
    const creed: GuidePrayerData = {
      slug: "apostles-creed",
      title: "Apostles' Creed",
      variants: [
        { code: "en", label: "English", text: "I believe in God...", preserve: false },
        { code: "el", label: "Greek", text: "Πιστεύω...", preserve: true, unofficial: true },
      ],
    };
    render(<GuidePrayers prayers={[creed, OUR_FATHER]} />);
    open(/Apostles' Creed/);
    open(/Our Father/);
    expect(screen.queryByText(/Unofficial translation/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Greek" }));
    // One note: the Creed's Greek is a machine fill, the Our Father's is not.
    expect(screen.getAllByText(/Unofficial translation/)).toHaveLength(1);
  });

  it("reads heading, language, a line of help, then the list, and keeps to the reading column", () => {
    const { container } = render(<GuidePrayers prayers={[OUR_FATHER, DAY_PRAYER]} />);
    const section = container.querySelector("section")!;
    expect(section).toHaveClass("vf-prayer-list");
    expect(section.className).not.toMatch(/max-w-|px-4|pb-12/);
    expect([...section.children].map((el) => el.tagName)).toEqual(["H2", "DIV", "P", "DIV"]);
    expect(section.children[1]).toHaveAttribute("role", "group");
    expect(section.children[3]).toHaveClass("vf-disclosure-list");
  });

  it("numbers a sequence, and claims no order for a set of alternatives", () => {
    const { unmount } = render(<GuidePrayers prayers={[OUR_FATHER, DAY_PRAYER]} />);
    expect(screen.getByRole("button", { name: /^Prayer 1\s*Our Father/ })).toBeInTheDocument();
    expect(screen.getByText(/In the order they are prayed/)).toBeInTheDocument();
    unmount();

    render(<GuidePrayers prayers={[OUR_FATHER, DAY_PRAYER]} ordered={false} />);
    expect(screen.getByRole("button", { name: "Our Father" })).toBeInTheDocument();
    expect(screen.queryByText(/Prayer \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/In the order they are prayed/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Tap a prayer to reveal its full text in the chosen language."),
    ).toBeInTheDocument();
  });

  it("shares one choice with every other prayer on the page", () => {
    render(
      <>
        <PrayerLanguageToggle variants={OUR_FATHER.variants} />
        <GuidePrayers prayers={[OUR_FATHER]} />
      </>,
    );
    open(/^Prayer 1/);
    const [pageLatin] = screen.getAllByRole("button", { name: "Latin" });
    fireEvent.click(pageLatin!);
    // Both the prayer text and the dropdown below it are now in Latin.
    expect(screen.getAllByText(/Pater noster/)).toHaveLength(2);
    for (const chip of screen.getAllByRole("button", { name: "Latin" })) {
      expect(chip).toHaveAttribute("aria-pressed", "true");
    }
  });
});
