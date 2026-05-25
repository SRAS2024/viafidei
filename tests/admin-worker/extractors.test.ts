/**
 * Per-content-type extractors (spec §9). Each extractor must:
 *   - extract required fields when present
 *   - emit per-field provenance
 *   - fail precisely (fatalReasons) when required fields are missing
 *   - never guess missing required fields
 */

import { describe, expect, it } from "vitest";

import {
  ConsecrationExtractor,
  DevotionExtractor,
  HistoryExtractor,
  LiturgyExtractor,
  MarianApparitionExtractor,
  NovenaExtractor,
  ParishExtractor,
  PrayerExtractor,
  RosaryExtractor,
  SacramentExtractor,
  SaintExtractor,
  extractByType,
} from "@/lib/admin-worker/extractors";

const base = (
  overrides: Partial<{ url: string; host: string; title: string | null; bodyText: string }>,
) => ({
  url: overrides.url ?? "https://example.org/x",
  host: overrides.host ?? "example.org",
  title: overrides.title ?? null,
  bodyText: overrides.bodyText ?? "",
});

describe("PrayerExtractor", () => {
  it("extracts prayer text and emits provenance", () => {
    const out = PrayerExtractor({
      ...base({}),
      title: "The Memorare",
      bodyText:
        "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection was left unaided. Amen.",
    });
    expect(out.fields.prayerTitle).toBe("The Memorare");
    expect(out.fields.prayerText).toMatch(/Amen/);
    expect(out.sourceEvidence.length).toBeGreaterThan(0);
    expect(out.fatalReasons).toEqual([]);
  });

  it("fails fatally when no prayer block ends with Amen", () => {
    const out = PrayerExtractor({
      ...base({}),
      title: "Reflection",
      bodyText: "This is a reflection on prayer.",
    });
    expect(out.fatalReasons.length).toBeGreaterThan(0);
    expect(out.confidenceScore).toBeLessThan(1);
  });
});

describe("SaintExtractor", () => {
  it("rejects institutions named after a saint", () => {
    const out = SaintExtractor({
      ...base({}),
      url: "https://stmary-school.example/",
      title: "Saint Mary's School",
      bodyText: "Saint Mary's School is a Catholic school.",
    });
    expect(out.fatalReasons.length).toBeGreaterThan(0);
    expect(out.fields.saintName).toBeUndefined();
  });

  it("extracts feast day + biography for a real saint page", () => {
    const out = SaintExtractor({
      ...base({}),
      url: "https://catholic.example/saints/saint-francis",
      title: "Saint Francis of Assisi",
      bodyText:
        "Saint Francis of Assisi was born in 1181 in Italy. He died in 1226. His feast day is October 4. He is the patron of animals and the environment.",
    });
    expect(out.fields.saintName).toMatch(/Francis/i);
    expect(out.fields.feastDay).toBe("October 4");
    expect(out.fields.feastMonth).toBe(10);
    expect(out.fields.feastDayNumber).toBe(4);
    expect(out.fields.patronage).toMatch(/animals/);
  });
});

describe("MarianApparitionExtractor", () => {
  it("requires an approval status", () => {
    const out = MarianApparitionExtractor({
      ...base({}),
      title: "Our Lady of Mystery",
      bodyText: "Our Lady appeared in Mystery in 1900.",
    });
    expect(out.fatalReasons.some((r) => /approval/i.test(r))).toBe(true);
  });

  it("extracts location, date, and approval status", () => {
    const out = MarianApparitionExtractor({
      ...base({}),
      title: "Our Lady of Lourdes",
      bodyText:
        "Our Lady appeared in Lourdes in 1858. The apparition was approved by the Holy See.",
    });
    expect(out.fields.apparitionLocation).toMatch(/Lourdes/);
    expect(out.fields.apparitionDate).toBe("1858");
    expect(out.fields.approvalStatus).toMatch(/approved/i);
  });
});

describe("DevotionExtractor", () => {
  it("requires a how-to-practice section", () => {
    const out = DevotionExtractor({
      ...base({}),
      title: "Devotion to the Sacred Heart",
      bodyText: "A short note about devotion.",
    });
    expect(out.fatalReasons.length).toBeGreaterThan(0);
  });
});

describe("NovenaExtractor", () => {
  it("fails when fewer than 9 days are present", () => {
    const out = NovenaExtractor({
      ...base({}),
      title: "Short Novena",
      bodyText: "Day 1 begins. Through Christ our Lord. Amen.",
    });
    expect(out.fatalReasons.filter((r) => /Day/.test(r)).length).toBeGreaterThanOrEqual(8);
  });

  it("captures all 9 days when present", () => {
    const days = Array.from(
      { length: 9 },
      (_, i) => `\nDay ${i + 1}: Intention for day ${i + 1}.\nThrough Christ our Lord. Amen.`,
    ).join("\n\n");
    const out = NovenaExtractor({
      ...base({}),
      title: "Divine Mercy Novena",
      bodyText: `Background paragraph. Purpose: mercy. ${days}`,
    });
    expect(Object.keys(out.fields.days ?? {}).length).toBe(9);
    expect(out.fatalReasons).toEqual([]);
  });
});

describe("RosaryExtractor", () => {
  it("requires at least one mystery set with 5 mysteries", () => {
    const out = RosaryExtractor({
      ...base({}),
      title: "How to Pray the Rosary",
      bodyText: "Pray the Rosary every day.",
    });
    expect(out.fatalReasons.length).toBeGreaterThan(0);
  });

  it("captures a complete set of 5 mysteries", () => {
    const body = `
Joyful Mysteries
1. The Annunciation
2. The Visitation
3. The Nativity
4. The Presentation
5. The Finding of Jesus in the Temple
`.trim();
    const out = RosaryExtractor({ ...base({}), title: "The Joyful Mysteries", bodyText: body });
    expect(out.fields.mysterySets?.[0]?.mysteries.length).toBe(5);
  });
});

describe("ConsecrationExtractor", () => {
  it("requires a final consecration prayer", () => {
    const out = ConsecrationExtractor({
      ...base({}),
      title: "33-Day Consecration",
      bodyText:
        "Day 1: Pray. Through Christ our Lord. Amen.\nDay 33: Final day. Through Christ our Lord. Amen.",
    });
    expect(out.fatalReasons.some((r) => /consecration prayer/i.test(r))).toBe(true);
  });
});

describe("SacramentExtractor", () => {
  it("rejects pages not naming one of the seven sacraments", () => {
    const out = SacramentExtractor({
      ...base({}),
      title: "About Catholic Faith",
      bodyText: "Information about Catholic faith.",
    });
    expect(out.fatalReasons.length).toBeGreaterThan(0);
  });

  it("classifies baptism correctly", () => {
    const out = SacramentExtractor({
      ...base({}),
      title: "The Sacrament of Baptism",
      bodyText:
        "Baptism is the first sacrament of initiation. Preparation: study the Catechism. Participation: confess your faith.",
    });
    expect(out.fields.sacramentKey).toBe("BAPTISM");
    expect(out.fields.description).toBeDefined();
    expect(out.fields.preparation).toBeDefined();
  });
});

describe("HistoryExtractor", () => {
  it("rejects pages that don't match an approved history type", () => {
    const out = HistoryExtractor({
      ...base({}),
      title: "A random page",
      bodyText: "Random content with no history markers.",
    });
    expect(out.fatalReasons.length).toBeGreaterThan(0);
  });

  it("identifies a council page", () => {
    const out = HistoryExtractor({
      ...base({}),
      title: "Council of Trent",
      bodyText:
        "The Council of Trent was held between 1545 and 1563. It addressed many doctrinal questions during the Counter-Reformation period.",
    });
    expect(out.fields.historyType).toBe("councils");
    expect(out.fields.dateOrEra).toMatch(/154|156/);
  });
});

describe("LiturgyExtractor", () => {
  it("requires a summary paragraph", () => {
    const out = LiturgyExtractor({
      ...base({}),
      title: "Order of Mass",
      bodyText: "x",
    });
    expect(out.fatalReasons.length).toBeGreaterThan(0);
  });
});

describe("ParishExtractor", () => {
  it("requires an address", () => {
    const out = ParishExtractor({
      ...base({}),
      title: "St. Patrick's Catholic Church",
      bodyText: "A parish in the city.",
    });
    expect(out.fatalReasons.some((r) => /address/i.test(r))).toBe(true);
  });
});

describe("extractByType dispatcher", () => {
  it("routes PRAYER to PrayerExtractor", () => {
    const out = extractByType("PRAYER", {
      ...base({}),
      title: "Prayer",
      bodyText: "Holy God. Amen.",
    });
    expect(out.fields.sourceUrl).toBeDefined();
  });

  it("routes SAINT to SaintExtractor", () => {
    const out = extractByType("SAINT", {
      ...base({}),
      title: "Saint Anne",
      bodyText: "Saint Anne was born long ago.",
    });
    expect(out.fields.sourceUrl).toBeDefined();
  });
});
