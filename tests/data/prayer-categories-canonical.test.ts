/**
 * Canonical prayer categories (src/lib/content-shared/prayer-categories.ts).
 *
 * Two defects this pins: the Acts of Faith, Hope and Love have prayerType
 * "act" and used to be filed under Penitential — they are professions of the
 * theological virtues, not sorrow for sin — and the curated files store
 * descriptive category strings ("theological-virtue", "dominical") that are
 * not filter chips and were reaching the homepage rail as raw labels.
 */
import { describe, expect, it } from "vitest";

import {
  PRAYER_CATEGORIES,
  categorizePrayer,
  prayerCategoryLabel,
} from "@/lib/content-shared/prayer-categories";

describe("Acts are their own category", () => {
  it("Acts of Faith, Hope and Love are 'act', not 'penitential'", () => {
    for (const title of ["Act of Faith", "Act of Hope", "Act of Love"]) {
      expect(categorizePrayer({ title, prayerType: "act", category: "theological-virtue" })).toBe(
        "act",
      );
    }
  });

  it("the Act of Contrition stays penitential — contrition is what decides", () => {
    expect(categorizePrayer({ title: "Act of Contrition", prayerType: "act" })).toBe("penitential");
  });

  it("an Act of Consecration is still a consecration", () => {
    expect(
      categorizePrayer({ title: "Act of Consecration to the Sacred Heart", prayerType: "act" }),
    ).toBe("consecration");
  });

  it("'act' is an offered filter chip with a human label", () => {
    expect(PRAYER_CATEGORIES.map((c) => c.value)).toContain("act");
    expect(prayerCategoryLabel("act")).toBe("Acts");
  });
});

describe("descriptive stored categories never reach the reader", () => {
  it("maps the curated aliases onto canonical categories", () => {
    expect(categorizePrayer({ title: "Glory Be", category: "doxology" })).toBe("trinitarian");
    expect(categorizePrayer({ title: "Nicene Creed", category: "creed" })).toBe("liturgical");
    expect(categorizePrayer({ title: "Regina Caeli", category: "marian-antiphon" })).toBe("marian");
    expect(categorizePrayer({ title: "Morning Offering", category: "morning" })).toBe("devotional");
  });

  it("labels an alias rather than echoing it", () => {
    expect(prayerCategoryLabel("theological-virtue")).toBe("Acts");
    expect(prayerCategoryLabel("dominical")).toBe("General");
    // Anything genuinely unknown still degrades to General, never to itself.
    expect(prayerCategoryLabel("not-a-category")).toBe("General");
  });

  it("a litany is still a litany, whatever its stored category", () => {
    expect(
      categorizePrayer({ title: "Litany of Loreto", prayerType: "litany", category: "marian" }),
    ).toBe("litany");
  });
});
