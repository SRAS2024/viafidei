/**
 * The order the voice engine pre-makes clips in: every language's female voice first,
 * English before Latin and Greek before the reader languages, and the stored number
 * the same in every run (so rows filed language by language keep one order).
 */
import { describe, expect, it } from "vitest";

import {
  KIND_OFFSET,
  languageBand,
  plannedPlace,
  storedPriority,
} from "@/lib/pray-along/plan-order";

const place = (
  lang: Parameters<typeof languageBand>[0],
  voice: "female" | "male",
  kind: keyof typeof KIND_OFFSET,
  index = 0,
  item = 0,
) => storedPriority(plannedPlace(languageBand(lang) + KIND_OFFSET[kind] + index, voice, item));

describe("the pre-making order", () => {
  it("makes every language's female voice before any male voice", () => {
    const lastFemale = place("zh", "female", "guides", 999, 999);
    expect(lastFemale).toBeLessThan(place("en", "male", "blocks"));
  });

  it("goes English, then Latin and Greek, then the reader languages", () => {
    expect(place("en", "female", "guides", 500)).toBeLessThan(place("la", "female", "blocks"));
    expect(place("el", "female", "prayers", 900)).toBeLessThan(place("es", "female", "blocks"));
  });

  it("starts each language with the Sign of the Cross, then the Rosary, prayers, novenas, guides", () => {
    const order = (["blocks", "rosary", "prayers", "novenas", "guides"] as const).map((k) =>
      place("en", "female", k),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("keeps a script's own order, and the same number in every run", () => {
    expect(place("en", "female", "prayers", 3, 0)).toBeLessThan(
      place("en", "female", "prayers", 3, 1),
    );
    expect(place("en", "female", "prayers", 3, 1)).toBeLessThan(
      place("en", "female", "prayers", 4, 0),
    );
    expect(place("fr", "male", "novenas", 41, 7)).toBe(place("fr", "male", "novenas", 41, 7));
    expect(Number.isInteger(place("fr", "male", "novenas", 41, 7))).toBe(true);
  });

  it("fits the 32-bit priority column at its largest", () => {
    expect(place("zh", "male", "guides", 9_999, 999)).toBeLessThan(2 ** 31 - 1);
  });
});
