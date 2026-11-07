/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { createTranslator } from "@/lib/i18n/translator";

vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en") }),
}));

import RootError from "@/app/error";
import NotFound from "@/app/not-found";
import PrayerNotFound from "@/app/prayers/[slug]/not-found";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the site's message pages", () => {
  it("names a missing page in a heading and offers the way home", async () => {
    render(await NotFound());
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
  });

  it("offers the way back to a collection, its arrow silent to a screen reader", async () => {
    render(await PrayerNotFound());
    expect(screen.getByRole("heading", { level: 1, name: "Prayer not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Prayers" })).toHaveAttribute(
      "href",
      "/prayers",
    );
  });

  it("offers a retry and the way home when something has gone wrong", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<RootError error={error} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Something went wrong");
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
});
