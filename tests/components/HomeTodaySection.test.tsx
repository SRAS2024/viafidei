/**
 * @vitest-environment jsdom
 */
/**
 * What a screen reader is told while the day's three parts wait for the device's date.
 * Each is a client component and cannot read the language itself, so the section hands
 * each one its words.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";

import { HomeTodaySection } from "@/app/_sections/HomeTodaySection";
import { createTranslator } from "@/lib/i18n/translator";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const statuses = (html: string) =>
  [...html.matchAll(/<p role="status" class="sr-only">([^<]*)<\/p>/g)].map((match) => match[1]);

describe("HomeTodaySection, before the device's date is read", () => {
  it("says what each part is waiting for", () => {
    expect(
      statuses(renderToStaticMarkup(<HomeTodaySection t={createTranslator("en")} />)).map((text) =>
        text?.replaceAll("&#x27;", "'"),
      ),
    ).toEqual([
      "Loading today's liturgy…",
      "Choosing today's prayer…",
      "Loading the day's saints…",
    ]);
  });

  it("says it in the reader's language", () => {
    expect(statuses(renderToStaticMarkup(<HomeTodaySection t={createTranslator("es")} />))).toEqual(
      [
        "Cargando la liturgia de hoy…",
        "Eligiendo la oración de hoy…",
        "Cargando los santos del día…",
      ],
    );
  });
});

describe("HomeTodaySection, when the saints cannot be loaded", () => {
  it.each([
    ["en", "Could not load today's feast list."],
    ["es", "No se pudo cargar la lista de santos del día."],
    ["ko", "오늘의 성인 목록을 불러올 수 없습니다."],
  ] as const)("says so in the reader's language (%s)", async (locale, words) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<HomeTodaySection t={createTranslator(locale)} />);
    expect(await screen.findByText(words)).toHaveAttribute("role", "status");
  });
});
