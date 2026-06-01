/**
 * admin-worker:proof:all-content-types
 *
 * One full pipeline proof per content type, driving the REAL extractor
 * against a content-correct fixture and asserting the strict content
 * contract (spec §178-243): the required fields are recovered, junk is
 * rejected, and the package builds. This is the proof that the worker
 * "implements content correctly" across every content type — e.g. a
 * saint yields name + feast day + patronage + biography, a novena yields
 * exactly nine days, a rosary yields five mysteries per set.
 */

import { describe, expect, it } from "vitest";

import { extractByType, type ExtractorInput } from "@/lib/admin-worker/extractors";
import { buildContentPackage } from "@/lib/admin-worker/content-builder";

type ExtractType = Parameters<typeof extractByType>[0];

const base = (over: Partial<ExtractorInput>): ExtractorInput => ({
  url: over.url ?? "https://www.vatican.va/x",
  host: over.host ?? "vatican.va",
  title: over.title ?? null,
  bodyText: over.bodyText ?? "",
});

interface Scenario {
  label: string;
  type: ExtractType;
  packageType: string;
  pass: ExtractorInput;
  /** Content-contract assertions on the recovered fields. */
  assertFields: (fields: Record<string, unknown>) => void;
  /** A junk fixture that MUST fail (spec §176-177). */
  junk: ExtractorInput;
}

const NINE_DAYS = Array.from(
  { length: 9 },
  (_, i) => `\nDay ${i + 1}: Intention for day ${i + 1}.\nThrough Christ our Lord. Amen.`,
).join("\n\n");

const SCENARIOS: Scenario[] = [
  {
    label: "PRAYER — prayer name + actual prayer text",
    type: "PRAYER",
    packageType: "PRAYER",
    pass: base({
      title: "The Memorare",
      bodyText:
        "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection was left unaided. Amen.",
    }),
    assertFields: (f) => {
      expect(f.prayerTitle).toBe("The Memorare");
      expect(String(f.prayerText)).toMatch(/Amen/);
    },
    junk: base({ title: "Reflection", bodyText: "A reflection on the value of prayer." }),
  },
  {
    label: "SAINT — name + feast day + patronage + biography",
    type: "SAINT",
    packageType: "SAINT",
    pass: base({
      url: "https://catholic.example/saints/saint-francis",
      title: "Saint Francis of Assisi",
      bodyText:
        "Saint Francis of Assisi was born in 1181 in Assisi, Italy, into a wealthy merchant family. He died in 1226. His feast day is October 4. He is the patron of animals and the environment.",
    }),
    assertFields: (f) => {
      expect(String(f.saintName)).toMatch(/Francis/);
      expect(f.feastDay).toBe("October 4");
      expect(f.feastMonth).toBe(10);
      expect(f.feastDayNumber).toBe(4);
      expect(String(f.patronage)).toMatch(/animals/);
      expect(String(f.background)).toMatch(/born/);
    },
    junk: base({
      url: "https://stmary-school.example/",
      title: "Saint Mary's School",
      bodyText: "Saint Mary's School is a Catholic school for grades K-8.",
    }),
  },
  {
    label: "APPARITION — location + date + approval status",
    type: "APPARITION",
    packageType: "APPARITION",
    pass: base({
      title: "Our Lady of Lourdes",
      bodyText:
        "Our Lady appeared in Lourdes in 1858. The apparition was approved by the Holy See.",
    }),
    assertFields: (f) => {
      expect(String(f.apparitionLocation)).toMatch(/Lourdes/);
      expect(f.apparitionDate).toBe("1858");
      expect(String(f.approvalStatus)).toMatch(/approved/i);
    },
    junk: base({
      title: "Our Lady of Mystery",
      bodyText: "Our Lady appeared in Mystery in 1900.",
    }),
  },
  {
    label: "DEVOTION — name + background + practice instructions",
    type: "DEVOTION",
    packageType: "DEVOTION",
    pass: base({
      title: "Devotion to the Sacred Heart of Jesus",
      bodyText:
        "The devotion to the Sacred Heart of Jesus is one of the most widely practiced and well known Catholic devotions, taking Jesus Christ's physical heart as the representation of his divine love. How to practice: begin by making the sign of the cross, then pray the Litany of the Sacred Heart daily for nine days with a contrite and humble spirit. Amen.",
    }),
    assertFields: (f) => {
      expect(f.devotionTitle).toBe("Devotion to the Sacred Heart of Jesus");
      expect(String(f.howToPractice)).toMatch(/sign of the cross/i);
      expect(String(f.background ?? "")).not.toBe("");
    },
    junk: base({ title: "Sacred Heart", bodyText: "A short note about devotion." }),
  },
  {
    label: "NOVENA — exactly nine days",
    type: "NOVENA",
    packageType: "NOVENA",
    pass: base({
      title: "Divine Mercy Novena",
      bodyText: `Background paragraph about the novena. Purpose: mercy. ${NINE_DAYS}`,
    }),
    assertFields: (f) => {
      expect(Object.keys((f.days as Record<string, unknown>) ?? {}).length).toBe(9);
    },
    junk: base({
      title: "Short Novena",
      bodyText: "Day 1 begins. Through Christ our Lord. Amen.",
    }),
  },
  {
    label: "ROSARY — five mysteries per set",
    type: "ROSARY",
    packageType: "ROSARY",
    pass: base({
      title: "The Joyful Mysteries",
      bodyText: `
Joyful Mysteries
1. The Annunciation
2. The Visitation
3. The Nativity
4. The Presentation
5. The Finding of Jesus in the Temple
`.trim(),
    }),
    assertFields: (f) => {
      const sets = f.mysterySets as Array<{ mysteries: string[] }>;
      expect(sets[0].mysteries.length).toBe(5);
    },
    junk: base({ title: "How to Pray the Rosary", bodyText: "Pray the Rosary every day." }),
  },
  {
    label: "CONSECRATION — duration + daily structure + final consecration prayer",
    type: "CONSECRATION",
    packageType: "CONSECRATION",
    pass: base({
      title: "33-Day Consecration",
      bodyText:
        "This 33-day consecration prepares the soul for total consecration to Jesus through Mary. Day 1: O Lord, on this first day of preparation I renounce the spirit of the world and ask for the grace of true devotion as I begin this journey. Amen. Act of consecration: I renew the vows of my Baptism; I renounce Satan and give myself entirely to Jesus Christ through the hands of Mary. Amen.",
    }),
    assertFields: (f) => {
      expect(String(f.duration)).toMatch(/33/);
      expect((f.dailyStructure as unknown[]).length).toBeGreaterThan(0);
      expect(String(f.finalConsecrationPrayer)).toMatch(/Mary/);
    },
    junk: base({
      title: "33-Day Consecration",
      bodyText: "Day 1: Pray. Amen. Day 33: Final day. Amen.",
    }),
  },
  {
    label: "SACRAMENT — key + description + preparation",
    type: "SACRAMENT",
    packageType: "SACRAMENT",
    pass: base({
      title: "The Sacrament of Baptism",
      bodyText:
        "Baptism is the first sacrament of initiation and the gateway to life in the Spirit. Preparation: study the Catechism of the Catholic Church. Participation: profess the faith of the Church.",
    }),
    assertFields: (f) => {
      expect(f.sacramentKey).toBe("BAPTISM");
      expect(String(f.description ?? "")).not.toBe("");
      expect(String(f.preparation ?? "")).not.toBe("");
    },
    junk: base({
      title: "About Catholic Faith",
      bodyText: "Information about the Catholic faith.",
    }),
  },
  {
    label: "CHURCH_DOCUMENT (History) — approved category + date/era",
    type: "CHURCH_DOCUMENT",
    packageType: "CHURCH_DOCUMENT",
    pass: base({
      title: "Council of Trent",
      bodyText:
        "The Council of Trent was held between 1545 and 1563. It addressed many doctrinal questions during the Counter-Reformation.",
    }),
    assertFields: (f) => {
      expect(f.historyType).toBe("councils");
      expect(String(f.dateOrEra)).toMatch(/154|156/);
    },
    junk: base({ title: "A random page", bodyText: "Random content with no history markers." }),
  },
  {
    label: "LITURGICAL — formation content (not a Mass schedule)",
    type: "LITURGICAL",
    packageType: "LITURGICAL",
    pass: base({
      title: "Liturgy of the Hours",
      bodyText:
        "The Liturgy of the Hours is the daily prayer of the Church, sanctifying the day with psalms, canticles, and intercessions prayed at fixed hours by clergy, religious, and laity throughout the world.",
    }),
    assertFields: (f) => {
      expect(f.liturgyTitle).toBe("Liturgy of the Hours");
      expect(String(f.summary ?? "")).not.toBe("");
    },
    junk: base({ title: "Order of Mass", bodyText: "x" }),
  },
  {
    label: "PARISH — real directory record (name + address + city)",
    type: "PARISH",
    packageType: "PARISH",
    pass: base({
      title: "Saint Patrick Catholic Church",
      bodyText:
        "Saint Patrick Catholic Church is located at 123 Main Street, Springfield, IL 62704. Diocese of Springfield.",
    }),
    assertFields: (f) => {
      expect(String(f.address)).toMatch(/123 Main Street/);
      expect(String(f.city)).toMatch(/Springfield/);
    },
    junk: base({ title: "St. Patrick's Catholic Church", bodyText: "A parish in the city." }),
  },
];

describe("admin-worker:proof:all-content-types", () => {
  for (const s of SCENARIOS) {
    describe(s.label, () => {
      it("recovers the content contract from a real fixture", () => {
        const out = extractByType(s.type, s.pass);
        expect(out.fatalReasons).toEqual([]);
        s.assertFields(out.fields as Record<string, unknown>);
        // Every recovered field carries provenance (spec: source provenance).
        expect(out.sourceEvidence.length).toBeGreaterThan(0);
      });

      it("builds a package with required fields + a slug", () => {
        const out = extractByType(s.type, s.pass);
        const pkg = buildContentPackage({ contentType: s.packageType, extractor: out });
        expect(pkg.packageType).toBe(s.packageType);
        expect(pkg.normalizedSlug.length).toBeGreaterThan(0);
        expect(pkg.requiredFields.length).toBeGreaterThan(0);
      });

      it("rejects junk content (proves junk fails)", () => {
        const out = extractByType(s.type, s.junk);
        expect(out.fatalReasons.length).toBeGreaterThan(0);
      });
    });
  }

  it("normalizes Confession to Reconciliation under Sacraments (spec §239-240)", () => {
    const out = extractByType("SACRAMENT", {
      ...base({
        title: "The Sacrament of Confession",
        bodyText:
          "Confession, also called the Sacrament of Penance and Reconciliation, restores the baptized to grace. Preparation: examine your conscience. Participation: confess your sins to a priest.",
      }),
    });
    expect(out.fatalReasons).toEqual([]);
    expect(out.fields.sacramentKey).toBe("RECONCILIATION");
    expect(out.fields.sacramentBadge).toBe("reconciliation");
  });
});
