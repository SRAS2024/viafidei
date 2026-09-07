/**
 * Guide kind labels and category chips: every `kind` enum value has a human
 * label (no raw `lent_preparation` eyebrows), the eyebrow helper falls back
 * sensibly, and every curated guide lands under exactly one chip besides All.
 */

import { describe, expect, it } from "vitest";

import { ALL_CURATED_ENTRIES } from "@/lib/checklist";
import { GUIDE_KINDS } from "@/lib/checklist/schemas/guide";
import {
  GUIDE_FILTERS,
  GUIDE_KIND_LABELS,
  guideEyebrow,
} from "@/lib/content-shared/guide-categories";

describe("GUIDE_KIND_LABELS", () => {
  it("labels every kind of the guide schema with a human phrase", () => {
    for (const kind of GUIDE_KINDS) {
      const label = GUIDE_KIND_LABELS[kind];
      expect(label, kind).toBeTruthy();
      expect(label).not.toMatch(/_/);
    }
    expect(GUIDE_KIND_LABELS.lent_preparation).toBe("Lent");
    expect(GUIDE_KIND_LABELS.advent_preparation).toBe("Advent");
    expect(GUIDE_KIND_LABELS.rcia).toBe("OCIA");
    expect(GUIDE_KIND_LABELS.general).toBe("Guide");
  });

  it("guideEyebrow: kind label, else category, else Sacraments, else Guide", () => {
    expect(guideEyebrow({ kind: "rosary" })).toBe("Rosary");
    expect(guideEyebrow({ kind: "general", category: "liturgy" })).toBe("Mass & Liturgy");
    expect(guideEyebrow({ kind: "general", sacramentKey: "baptism" })).toBe("Sacraments");
    expect(guideEyebrow({ kind: "general" })).toBe("Guide");
    expect(guideEyebrow({})).toBe("Guide");
  });
});

describe("GUIDE_FILTERS over the curated guides", () => {
  // Was "exactly one chip": true only of the original nine guides, none of
  // which carried both a `category` and a `sacramentKey`. In the 100-guide
  // catalogue a guide legitimately carries both — the Nine First Fridays is a
  // Eucharistic guide AND a devotion, an OCIA guide leads to Baptism — and the
  // chips are FILTERS on /guides (one selected at a time via
  // applyPayloadFilter), not exclusive folders, so an overlap is correct.
  // What must still hold: no guide is unreachable, and "General" stays the
  // residual bucket that never overlaps a named chip.
  it("places every curated guide under at least one chip besides All", () => {
    const guides = ALL_CURATED_ENTRIES.filter((e) => e.contentType === "GUIDE");
    expect(guides.length).toBeGreaterThan(0);
    for (const g of guides) {
      const chips = GUIDE_FILTERS.filter((f) => f.key !== "all" && f.matches(g.payload));
      expect(
        chips.map((c) => c.key),
        g.slug,
      ).not.toHaveLength(0);
      if (chips.some((c) => c.key === "general")) {
        expect(
          chips.map((c) => c.key),
          g.slug,
        ).toEqual(["general"]);
      }
    }
  });

  it("offers the chip set of the 100-guide catalogue", () => {
    expect(GUIDE_FILTERS.map((f) => f.key)).toEqual([
      "all",
      "rosary-chaplets",
      "confession",
      "eucharist",
      "liturgy",
      "sacraments",
      "devotions",
      "seasons",
      "becoming-catholic",
      "discernment",
      "family",
      "general",
    ]);
  });
});
