/**
 * @vitest-environment jsdom
 */
/**
 * Sentences this branch added to client components, said in the words their page hands
 * them: the journal's failed favorite, the calendar's year range, the readings' note on
 * a passage the Douay-Rheims numbers differently, the history slider's names and its
 * empty list. Without the words, each keeps its English exactly.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HistoryEmpty } from "@/app/history/HistoryTimeline";
import { LiturgicalCalendarBrowser } from "@/app/liturgical-calendar/LiturgicalCalendarBrowser";
import { ReadingSections } from "@/app/liturgy/readings/ReadingSections";
import { JournalFavoriteButton } from "@/app/profile/journal/JournalFavoriteButton";
import { createTranslator } from "@/lib/i18n/translator";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const es = createTranslator("es");

describe("the journal's favorite, when the save fails", () => {
  it.each([
    [undefined, "Could not save. Please try again."],
    [es("save.failed"), "No se pudo guardar. Inténtalo de nuevo."],
  ])("says so in the page's language (%s)", async (failedLabel, said) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(
      <JournalFavoriteButton
        entryId="e1"
        isFavorite={false}
        favoriteLabel="Favorito"
        failedLabel={failedLabel}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(said);
  });
});

describe("the calendar's date hint, for a year it does not cover", () => {
  it("is the page's language", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={[{ value: "roman", label: "Romano" }]}
        initialRite="roman"
        loadingLabel="Cargando el calendario…"
        outOfRangeLabel={es("calendar.outOfRange")}
      />,
    );
    const field = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(field, { target: { value: "2100-01-01" } });
    expect(screen.getByText("Este calendario abarca los años 1970 a 2099.")).toBeInTheDocument();
  });
});

describe("a reading the Douay-Rheims numbers differently", () => {
  const sections = [
    {
      kind: "FIRST_READING",
      label: "First Reading",
      citation: "Zec 2:14-17",
      reference: "Zechariah 2:14-17",
      body: null,
      layout: null,
      douayCitation: null,
      alignment: "exact",
      partialVerses: false,
      note: null,
      response: null,
      source: "usccb",
      overlaid: false,
      alternatives: [],
    },
  ];

  it("keeps its English without the words", () => {
    render(
      <ReadingSections
        sections={sections as never}
        sourceUrl="https://bible.usccb.org/"
        sourceName="USCCB"
      />,
    );
    expect(
      screen.getByText(/^The Douay-Rheims numbers this passage differently/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAccessibleName("Read it at USCCB (opens in a new tab)");
  });

  it("is said in the page's language", () => {
    render(
      <ReadingSections
        sections={sections as never}
        sourceUrl="https://bible.usccb.org/"
        sourceName="USCCB"
        words={{
          douayMisses: es("readings.douayMisses"),
          readItAt: es("readings.readItAt"),
          newTab: es("common.opensInNewTab"),
        }}
      />,
    );
    expect(screen.getByText(/^La Douay-Rheims numera este pasaje/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAccessibleName(
      "Leerlo en USCCB (se abre en una pestaña nueva)",
    );
  });
});

describe("the history page's empty list", () => {
  it("speaks the page's language", () => {
    render(
      <HistoryEmpty
        view={{ q: "", theme: "all", era: null, params: { order: "oldest" } } as never}
        base={{}}
        noneText=""
        hintText=""
        clearText=""
        emptyText={es("history.noEvents")}
        searchAllText={es("history.searchAll")}
        showAllText={es("history.showAll")}
      />,
    );
    expect(screen.getByText("No hay acontecimientos aquí.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Mostrar todos los acontecimientos" }),
    ).toBeInTheDocument();
  });
});
