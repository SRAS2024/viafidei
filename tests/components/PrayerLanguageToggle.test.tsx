/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
    const latin = screen.getByText("Ave Maria...");
    expect(latin).toHaveAttribute("translate", "no");
    expect(latin).toHaveAttribute("lang", "la");
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
    expect(screen.getByText("Dios te salve...")).not.toHaveAttribute("translate", "no");
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
});
