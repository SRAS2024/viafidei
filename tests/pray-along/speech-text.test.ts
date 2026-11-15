/**
 * What a prayer's text says aloud: the prayer and nothing else.
 */
import { describe, expect, it } from "vitest";

import {
  normalizeForSpeech,
  prayersNamedIn,
  splitForClips,
  spokenSteps,
  toMonotonicGreek,
  type SpokenStep,
} from "@/lib/pray-along/speech-text";

const PRAYERS = [
  { slug: "our-father", title: "Our Father" },
  { slug: "hail-mary", title: "Hail Mary" },
  { slug: "glory-be", title: "Glory Be" },
  { slug: "apostles-creed", title: "Apostles' Creed" },
  { slug: "sign-of-the-cross", title: "Sign of the Cross" },
];

const said = (steps: SpokenStep[]) =>
  steps
    .filter((s): s is Extract<SpokenStep, { kind: "say" }> => s.kind === "say")
    .map((s) => s.text);
const prayed = (steps: SpokenStep[]) =>
  steps
    .filter((s): s is Extract<SpokenStep, { kind: "prayer" }> => s.kind === "prayer")
    .map((s) => `${s.slug}x${s.count}`);

describe("normalizeForSpeech", () => {
  it("says a saint's abbreviation and a pope's number as words", () => {
    expect(normalizeForSpeech("St. Joseph and Sts. Peter and Paul", "en")).toBe(
      "Saint Joseph and Saints Peter and Paul",
    );
    expect(normalizeForSpeech("Saint John Paul II, pray for us.", "en")).toBe(
      "Saint John Paul the Second, pray for us.",
    );
  });

  it("leaves out citations and a name placeholder, which are not prayed", () => {
    expect(
      normalizeForSpeech('cry with devotion, "O mighty Fiat!" (St Thomas of Villanova).', "en"),
    ).toBe('cry with devotion, "O mighty Fiat!".');
    expect(normalizeForSpeech("thy humility (S. Aug. Sermo de Sanct.), draw me", "en")).toBe(
      "thy humility, draw me",
    );
    expect(normalizeForSpeech("look down upon thy servant N., whom Thou hast chosen", "en")).toBe(
      "look down upon thy servant, whom Thou hast chosen",
    );
  });

  it("drops printed crosses and versicle signs", () => {
    expect(normalizeForSpeech("✠ In the name of the Father", "en")).toBe(
      "In the name of the Father",
    );
    expect(normalizeForSpeech("℣. Lord, have mercy.", "en")).toBe("Lord, have mercy.");
  });

  it("writes Latin ligatures out and Greek in monotonic spelling", () => {
    expect(normalizeForSpeech("qui es in cælis", "la")).toBe("qui es in caelis");
    expect(toMonotonicGreek("Πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς")).toBe("Πάτερ ημών ο εν τοίς ουρανοίς");
  });
});

describe("prayersNamedIn", () => {
  it("prays what an instruction names, as many times as it says", () => {
    expect(
      prayersNamedIn(
        "Begin with the Sign of the Cross, one Our Father, three Hail Marys and the Glory Be.",
        PRAYERS,
      ),
    ).toEqual([
      { slug: "sign-of-the-cross", count: 1 },
      { slug: "our-father", count: 1 },
      { slug: "hail-mary", count: 3 },
      { slug: "glory-be", count: 1 },
    ]);
    expect(prayersNamedIn("Hail Mary three times", PRAYERS)).toEqual([
      { slug: "hail-mary", count: 3 },
    ]);
  });

  it("reads a lone incipit as the prayer it opens", () => {
    expect(prayersNamedIn("Ave.", PRAYERS)).toEqual([{ slug: "hail-mary", count: 1 }]);
    expect(prayersNamedIn("Ave Maria.", PRAYERS)).toEqual([{ slug: "hail-mary", count: 1 }]);
    expect(prayersNamedIn("Pater noster.", PRAYERS)).toEqual([{ slug: "our-father", count: 1 }]);
  });
});

describe("spokenSteps", () => {
  it("says versicles and responses without their markers", () => {
    const steps = spokenSteps(
      "V. Send forth thy Spirit and they shall be created;\nR. And Thou shalt renew the face of the earth.",
      { lang: "en", prayers: PRAYERS },
    );
    expect(said(steps)).toEqual([
      "Send forth thy Spirit and they shall be created; And Thou shalt renew the face of the earth.",
    ]);
  });

  it("prays the Hail Mary an 'Ave Maria.' at the end of a petition asks for", () => {
    const steps = spokenSteps("O mighty Virgin, enable me to humble myself. Ave Maria.", {
      lang: "en",
      prayers: PRAYERS,
    });
    expect(said(steps)).toEqual(["O mighty Virgin, enable me to humble myself."]);
    expect(prayed(steps)).toEqual(["hail-maryx1"]);
  });

  it("prays the prayers an instruction line names, and reads none of it", () => {
    const steps = spokenSteps("O Saint Joseph, pray for us.\nOur Father, Hail Mary, Glory Be.", {
      lang: "en",
      prayers: PRAYERS,
    });
    expect(said(steps)).toEqual(["O Saint Joseph, pray for us."]);
    expect(prayed(steps)).toEqual(["our-fatherx1", "hail-maryx1", "glory-bex1"]);
  });

  it("says a '(Thrice.)' line three times", () => {
    const steps = spokenSteps("Saint Joseph, pray for us. (Thrice.)", {
      lang: "en",
      prayers: PRAYERS,
    });
    expect(said(steps).join(" ")).toBe(
      "Saint Joseph, pray for us. Saint Joseph, pray for us. Saint Joseph, pray for us.",
    );
  });

  it("leaves out a part's heading", () => {
    const steps = spokenSteps("First Decade.\nO Jesus, have mercy on us.", {
      lang: "en",
      prayers: PRAYERS,
    });
    expect(said(steps)).toEqual(["O Jesus, have mercy on us."]);
  });

  it("judges a translated line by its English: an instruction stays an instruction", () => {
    const steps = spokenSteps("San José, ruega por nosotros.\nPadre Nuestro, Ave María, Gloria.", {
      lang: "es",
      english: "Saint Joseph, pray for us.\nOur Father, Hail Mary, Glory Be.",
      prayers: PRAYERS,
    });
    expect(said(steps)).toEqual(["San José, ruega por nosotros."]);
    expect(prayed(steps)).toEqual(["our-fatherx1", "hail-maryx1", "glory-bex1"]);
  });

  it("says a line the translator has not reached yet in English", () => {
    const steps = spokenSteps("San José, ruega por nosotros.\n\nO Jesus, have mercy on us.", {
      lang: "es",
      english: "Saint Joseph, pray for us.\n\nO Jesus, have mercy on us.",
      prayers: PRAYERS,
    });
    const langs = steps.flatMap((s) => (s.kind === "say" ? [s.lang] : []));
    expect(langs).toEqual(["es", "en"]);
  });
});

describe("splitForClips", () => {
  it("keeps clips under the limit, cutting at lines and then sentences", () => {
    const lines = Array.from(
      { length: 12 },
      (_, i) => `Holy Mary, Mother number ${i}, pray for us.`,
    );
    const clips = splitForClips(lines, 120);
    expect(clips.length).toBeGreaterThan(3);
    for (const clip of clips) expect(clip.length).toBeLessThanOrEqual(120);
    expect(clips.join(" ")).toBe(lines.join(" "));
  });

  it("keeps a short opening with the sentence it opens", () => {
    const long = "who obtained by your profound humility ".repeat(9).trim() + ".";
    const clips = splitForClips([`O immaculate Mary! ${long}`], 300);
    expect(clips[0]!.startsWith("O immaculate Mary! who obtained")).toBe(true);
  });
});
