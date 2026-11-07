/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PrayerLanguageToggle } from "@/components/ui/PrayerLanguageToggle";
import type { PrayerVariant } from "@/lib/content-shared/prayer-language";

const EN: PrayerVariant = { code: "en", label: "English", text: "Hail Mary...", preserve: false };
const LA: PrayerVariant = { code: "la", label: "Latin", text: "Ave Maria...", preserve: true };
const ES: PrayerVariant = {
  code: "es",
  label: "Spanish",
  text: "Dios te salve...",
  preserve: false,
};

afterEach(() => cleanup());
beforeEach(() => window.sessionStorage.clear());

describe("PrayerLanguageToggle", () => {
  it("shows the text with no toggle when there is only one language", () => {
    render(<PrayerLanguageToggle variants={[EN]} />);
    expect(screen.getByText("Hail Mary...")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /prayer language/i })).not.toBeInTheDocument();
  });

  it("switches the displayed text and persists the choice to sessionStorage", () => {
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    expect(screen.getByText("Hail Mary...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    expect(screen.getByText("Ave Maria...")).toBeInTheDocument();
    expect(screen.queryByText("Hail Mary...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Latin" })).toHaveAttribute("aria-pressed", "true");
    expect(window.sessionStorage.getItem("vf_prayer_lang")).toBe("la");
  });

  it("restores the session-persisted language on mount when available", () => {
    window.sessionStorage.setItem("vf_prayer_lang", "la");
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    expect(screen.getByText("Ave Maria...")).toBeInTheDocument();
    expect(screen.queryByText("Hail Mary...")).not.toBeInTheDocument();
  });

  it("falls back to the first variant when the stored language is unavailable", () => {
    window.sessionStorage.setItem("vf_prayer_lang", "el");
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    expect(screen.getByText("Hail Mary...")).toBeInTheDocument();
  });

  it("marks Latin / Greek text translate=no so it is never auto-translated", () => {
    window.sessionStorage.setItem("vf_prayer_lang", "la");
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    const latin = screen.getByText("Ave Maria...").closest(".vf-prayer");
    expect(latin).toHaveAttribute("translate", "no");
    expect(latin).toHaveAttribute("lang", "la");
  });

  it("offers the languages as the site's small outlined buttons, each saying if it is on", () => {
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    const group = screen.getByRole("group", { name: "Prayer language" });
    const latin = within(group).getByRole("button", { name: "Latin" });
    expect(latin).toHaveClass("vf-btn", "vf-btn-sm", "vf-btn-ghost");
    expect(latin).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(latin);
    // The selected look comes with aria-pressed, not with a second button style.
    expect(latin).toHaveClass("vf-btn", "vf-btn-sm", "vf-btn-ghost");
    expect(latin).toHaveAttribute("aria-pressed", "true");
  });

  it("works from the keyboard", async () => {
    const user = userEvent.setup();
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    await user.tab();
    const latin = screen.getByRole("button", { name: "Latin" });
    expect(latin).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Ave Maria...")).toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByText("Hail Mary...")).toBeInTheDocument();
  });

  it("sets the text as prayer in whichever language is shown", () => {
    const body: PrayerVariant = { ...EN, text: "V. Lord, open my lips.\nR. And my mouth." };
    const latin: PrayerVariant = { ...LA, text: "V. Domine, labia mea aperies.\nR. Et os meum." };
    render(<PrayerLanguageToggle variants={[body, latin]} />);
    expect(screen.getByText("And my mouth.")).toHaveClass("vf-prayer-response");
    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    expect(screen.getByText("Et os meum.")).toHaveClass("vf-prayer-response");
  });

  it("never renders the vernacular as a toggle button (it is the implicit default)", () => {
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    // Only Latin gets a chip; English is the default and has no button.
    expect(screen.getByRole("button", { name: "Latin" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();
  });

  it("toggles back to the vernacular when the active language chip is re-selected", () => {
    render(<PrayerLanguageToggle variants={[EN, LA]} />);
    const latinBtn = screen.getByRole("button", { name: "Latin" });

    fireEvent.click(latinBtn);
    expect(screen.getByText("Ave Maria...")).toBeInTheDocument();

    fireEvent.click(latinBtn);
    expect(screen.getByText("Hail Mary...")).toBeInTheDocument();
    expect(latinBtn).toHaveAttribute("aria-pressed", "false");
    expect(window.sessionStorage.getItem("vf_prayer_lang")).toBe("vernacular");
  });

  // PR-13: the schema and buildPrayerVariants have always accepted vernacular
  // translations (es/it/fr/…), but only Latin/Greek got chips, so a Spanish
  // translation could be published and never read.
  it("offers a chip for a vernacular translation, not only Latin/Greek", () => {
    render(<PrayerLanguageToggle variants={[EN, LA, ES]} />);
    expect(screen.getByRole("button", { name: "Latin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spanish" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Spanish" }));
    expect(screen.getByText("Dios te salve...")).toBeInTheDocument();
    expect(screen.queryByText("Hail Mary...")).not.toBeInTheDocument();
    // A translation is NOT liturgical text, so it stays translatable.
    expect(screen.getByText("Dios te salve...").closest(".vf-prayer")).not.toHaveAttribute(
      "translate",
      "no",
    );
  });

  it("shows no chip at all for a Latin-only prayer (a chip that toggles nothing)", () => {
    render(<PrayerLanguageToggle variants={[LA]} />);
    expect(screen.getByText("Ave Maria...")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /prayer language/i })).not.toBeInTheDocument();
  });

  it("restores a persisted vernacular translation on mount", () => {
    window.sessionStorage.setItem("vf_prayer_lang", "es");
    render(<PrayerLanguageToggle variants={[EN, LA, ES]} />);
    expect(screen.getByText("Dios te salve...")).toBeInTheDocument();
  });

  // The Rosary and chaplet prayers name the prayers they are built from; each
  // name opens that prayer in place, with its own Latin chip.
  describe("prayers the text names", () => {
    const OPENING = "On the single bead, pray the Our Father.";
    const OUR_FATHER = {
      slug: "our-father",
      title: "Our Father",
      variants: [
        { code: "en", label: "English", text: "Our Father, who art in heaven...", preserve: false },
        { code: "la", label: "Latin", text: "Pater noster, qui es in caelis...", preserve: true },
      ],
    };
    const variants: PrayerVariant[] = [
      { code: "en", label: "English", text: OPENING, preserve: false },
    ];

    it("opens a named prayer inline, in Latin when the reader picks Latin", () => {
      render(<PrayerLanguageToggle variants={variants} linkedPrayers={[OUR_FATHER]} />);
      const name = screen.getByRole("button", { name: /Our Father/ });
      expect(name).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(name);
      expect(screen.getByText(/who art in heaven/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Latin" }));
      expect(screen.getByText(/Pater noster/).closest(".vf-prayer")).toHaveAttribute(
        "translate",
        "no",
      );
    });

    it("keeps an opened prayer open, and focus on its chip, when Latin switches the page", async () => {
      const user = userEvent.setup();
      const angelus: PrayerVariant[] = [
        {
          code: "en",
          label: "English",
          text: "V. The Angel.\nR. And she.\n(Our Father)",
          preserve: false,
        },
        {
          code: "la",
          label: "Latin",
          text: "V. Angelus.\nR. Et concepit.\n(Pater noster)",
          preserve: true,
        },
      ];
      render(<PrayerLanguageToggle variants={angelus} linkedPrayers={[OUR_FATHER]} />);
      fireEvent.click(screen.getByRole("button", { name: "Our Father" }));

      const panelGroup = screen.getByRole("group", { name: "Our Father language" });
      const chip = within(panelGroup).getByRole("button", { name: "Latin" });
      chip.focus();
      await user.keyboard(" ");

      // The page's text is Latin now, and the prayer opened from it still stands.
      expect(screen.getByText("Angelus.")).toBeInTheDocument();
      expect(screen.getByText(/Pater noster, qui es in caelis/)).toBeInTheDocument();
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveFocus();
      expect(chip).toHaveAttribute("aria-pressed", "true");
      // The Latin text's own name for the prayer is its way in.
      expect(screen.getByRole("button", { name: "Pater noster" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      // And back: the English again, with the prayer still open under its stanza.
      await user.keyboard(" ");
      expect(chip).toHaveFocus();
      expect(screen.getByText("The Angel.")).toBeInTheDocument();
      expect(screen.getByText(/who art in heaven/)).toBeInTheDocument();
    });

    it("keeps an opened prayer when the other language has fewer stanzas", async () => {
      const user = userEvent.setup();
      const body: PrayerVariant[] = [
        {
          code: "en",
          label: "English",
          text: "One.\n\nTwo.\n\nPray the Our Father.",
          preserve: false,
        },
        { code: "la", label: "Latin", text: "Unum.", preserve: true },
      ];
      render(<PrayerLanguageToggle variants={body} linkedPrayers={[OUR_FATHER]} />);
      fireEvent.click(screen.getByRole("button", { name: "Our Father" }));
      const chip = within(screen.getByRole("group", { name: "Our Father language" })).getByRole(
        "button",
        { name: "Latin" },
      );
      chip.focus();
      await user.keyboard(" ");
      expect(screen.getByText("Unum.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Our Father" })).toBeInTheDocument();
      // Focus is on a chip still: a language switch never leaves the reader nowhere.
      expect(document.activeElement).not.toBe(document.body);
    });

    it("keeps Latin verbatim with an English prayer opened inside it", () => {
      const noLatin = {
        slug: "glory-be",
        title: "Glory Be",
        variants: [
          { code: "en", label: "English", text: "Glory be to the Father...", preserve: false },
        ],
      };
      const body: PrayerVariant[] = [
        { code: "en", label: "English", text: "Pray the Glory Be.", preserve: false },
        { code: "la", label: "Latin", text: "Gloria Patri.", preserve: true },
      ];
      window.sessionStorage.setItem("vf_prayer_lang", "la");
      render(<PrayerLanguageToggle variants={body} linkedPrayers={[noLatin]} />);
      const line = screen.getByRole("button", { name: "Gloria Patri" });
      expect(line.closest(".vf-prayer")).toHaveAttribute("translate", "no");
      fireEvent.click(line);
      // A prayer with no Latin shows its vernacular, which stays translatable.
      const opened = screen.getByText("Glory be to the Father...").closest(".vf-prayer");
      expect(opened).toHaveAttribute("translate", "yes");
      expect(opened).toHaveAttribute("lang", "en");
    });

    it("reads the text plainly when it names nothing it was given", () => {
      render(<PrayerLanguageToggle variants={variants} linkedPrayers={[]} />);
      expect(screen.getByText(OPENING)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
