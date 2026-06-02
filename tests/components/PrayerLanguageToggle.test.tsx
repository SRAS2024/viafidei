/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PrayerLanguageToggle } from "@/components/ui/PrayerLanguageToggle";
import type { PrayerVariant } from "@/lib/content-shared/prayer-language";

const EN: PrayerVariant = { code: "en", label: "English", text: "Hail Mary...", preserve: false };
const LA: PrayerVariant = { code: "la", label: "Latin", text: "Ave Maria...", preserve: true };

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
});
