/**
 * The pray-along speeds: 1x → 1.25x → 1.5x → 1x, written with the reader's decimal mark.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RATE,
  formatRate,
  isRate,
  nextRate,
  rateOrDefault,
  RATES,
} from "@/lib/pray-along/rate";

describe("pray-along speeds", () => {
  it("are 1x, 1.25x and 1.5x, normal speed first", () => {
    expect(RATES).toEqual([1, 1.25, 1.5]);
    expect(DEFAULT_RATE).toBe(1);
  });

  it("step 1x → 1.25x → 1.5x and back to 1x", () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(1.25)).toBe(1.5);
    expect(nextRate(1.5)).toBe(1);
  });

  it("accept only those speeds", () => {
    for (const ok of [1, 1.25, 1.5]) expect(isRate(ok)).toBe(true);
    for (const bad of [0, 0.5, 1.2, 2, NaN, "1.25", null, undefined]) {
      expect(isRate(bad)).toBe(false);
    }
    expect(rateOrDefault(2)).toBe(1);
    expect(rateOrDefault(1.5)).toBe(1.5);
  });

  it("are written as the owner asked, with each language's decimal mark", () => {
    expect(formatRate(1, "en")).toBe("1x");
    expect(formatRate(1.25, "en")).toBe("1.25x");
    expect(formatRate(1.5, "en")).toBe("1.5x");
    expect(formatRate(1.25, "fr")).toBe("1,25x");
    expect(formatRate(1.5, "de")).toBe("1,5x");
    expect(formatRate(1.25, "la")).toBe("1.25x");
    expect(formatRate(1.25, "zh")).toBe("1.25x");
  });
});
