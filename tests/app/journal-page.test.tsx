/**
 * @vitest-environment jsdom
 */
/**
 * The journal page's messages. A reader with entries who opened the favorites view was told
 * "Your entries will appear here", which is not what the view was showing them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { listJournalEntries } = vi.hoisted(() => ({ listJournalEntries: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ id: "u1" }),
}));
vi.mock("@/lib/data/journal", () => ({ listJournalEntries }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/profile/journal",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("@/lib/i18n/translator");
  return { getTranslator: async () => ({ t: createTranslator("en"), locale: "en" }) };
});

import JournalPage from "@/app/profile/journal/page";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

const EN = DICTIONARIES.en!;

async function show(params: { filter?: string; error?: string }) {
  render(await JournalPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  listJournalEntries.mockReset().mockResolvedValue([]);
});

afterEach(() => cleanup());

describe("/profile/journal", () => {
  it("says the entries will appear, when there are none", async () => {
    await show({});
    expect(screen.getByText(EN["profile.journal.empty"]!)).toBeInTheDocument();
    expect(listJournalEntries).toHaveBeenCalledWith("u1", { favoritesOnly: false });
  });

  it("says none are favorited, in the favorites view", async () => {
    await show({ filter: "favorites" });
    expect(screen.getByText(EN["profile.journal.emptyFavorites"]!)).toBeInTheDocument();
    expect(screen.queryByText(EN["profile.journal.empty"]!)).not.toBeInTheDocument();
    expect(listJournalEntries).toHaveBeenCalledWith("u1", { favoritesOnly: true });
  });

  it("says when a plain form post could not save, with the limits", async () => {
    await show({ error: "not_saved" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("20,000");
    expect(alert).toHaveTextContent("200");
  });

  it("says nothing of the kind otherwise", async () => {
    await show({ error: "anything-else" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names each entry's PDF link, and says it opens a new tab", async () => {
    listJournalEntries.mockResolvedValue([
      {
        id: "e1",
        title: "A title",
        body: "Words",
        isFavorite: false,
        updatedAt: new Date("2026-11-07T12:00:00Z"),
      },
    ]);
    await show({});
    const link = screen.getByRole("link", {
      name: "Print or save A title as a PDF (opens a new tab)",
    });
    expect(link).toHaveAttribute("href", "/api/journal/e1/download");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("PDF");
  });
});
