/**
 * One press of the pray-along button: the Sign of the Cross, the prayer prayed in
 * full, the Sign of the Cross.
 */
import { describe, expect, it } from "vitest";

import type { PrayerVariant } from "@/lib/content-shared/prayer-language";
import {
  divineMercyPrayers,
  novenaDayScript,
  planScript,
  prayerScript,
  rosaryScript,
  sequenceScript,
  type PrayAlongScript,
  type PrayerSource,
  type ScriptContext,
} from "@/lib/pray-along/script";
import { SIGN_OF_THE_CROSS } from "@/lib/pray-along/sign-of-the-cross";

function source(slug: string, title: string, en: string, la?: string, es?: string): PrayerSource {
  const variants: PrayerVariant[] = [
    es
      ? { code: "en", label: "Español", text: es, preserve: false, lang: "es" }
      : { code: "en", label: "English", text: en, preserve: false },
  ];
  if (la) variants.push({ code: "la", label: "Latin", text: la, preserve: true });
  return { slug, title, variants, english: en };
}

const HAIL_MARY = "Hail Mary, full of grace, the Lord is with thee. Amen.";
const PRAYERS = new Map<string, PrayerSource>(
  [
    source(
      "our-father",
      "Our Father",
      "Our Father, who art in heaven. Amen.",
      "Pater noster, qui es in caelis. Amen.",
    ),
    source("hail-mary", "Hail Mary", HAIL_MARY, "Ave Maria, gratia plena. Amen."),
    source("glory-be", "Glory Be", "Glory be to the Father. Amen.", "Gloria Patri. Amen."),
    source("apostles-creed", "Apostles' Creed", "I believe in God. Amen.", "Credo in Deum. Amen."),
    source("fatima-prayer", "Fatima Prayer", "O my Jesus, forgive us our sins. Amen."),
    source(
      "salve-regina",
      "Hail, Holy Queen",
      "Hail, holy Queen.\nV. Pray for us, O holy Mother of God.\nR. That we may be made worthy of the promises of Christ.",
      "Salve, Regina.",
    ),
  ].map((p) => [p.slug, p]),
);

const ctx = (
  chosen: string | null = null,
  pageLang: ScriptContext["pageLang"] = "en",
): ScriptContext => ({
  pageLang,
  chosen,
  prayers: PRAYERS,
});

const texts = (s: PrayAlongScript) => s.items.flatMap((i) => (i.kind === "say" ? [i.text] : []));
const count = (s: PrayAlongScript, text: string) => texts(s).filter((t) => t === text).length;

describe("prayerScript", () => {
  it("opens and closes with the Sign of the Cross", () => {
    const s = prayerScript("hail-mary", { text: HAIL_MARY, lang: "en" }, ctx());
    expect(texts(s)).toEqual([SIGN_OF_THE_CROSS.en, HAIL_MARY, SIGN_OF_THE_CROSS.en]);
    expect(s.items[1]).toEqual({ kind: "pause", ms: expect.any(Number) });
  });

  it("does not say the Sign of the Cross twice when the prayer already opens with it", () => {
    const text =
      "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.\nO God, come to my assistance.";
    const s = prayerScript("morning", { text, lang: "en" }, ctx());
    expect(texts(s)[0]).toBe(
      "In the name of the Father, and of the Son, and of the Holy Spirit. Amen. O God, come to my assistance.",
    );
    expect(texts(s).filter((t) => t.startsWith("In the name of the Father")).length).toBe(2);
  });

  it("says the Sign of the Cross's own page once", () => {
    const s = prayerScript(
      "sign-of-the-cross",
      {
        text: "In the name of the Father and of the Son and of the Holy Spirit. Amen.",
        lang: "en",
      },
      ctx(),
    );
    expect(texts(s)).toHaveLength(1);
  });

  it("prays in Latin, Sign of the Cross included, when Latin is shown", () => {
    const s = prayerScript(
      "hail-mary",
      { text: "Ave Maria, gratia plena. Amen.", lang: "la" },
      ctx("la"),
    );
    expect(texts(s)).toEqual([
      SIGN_OF_THE_CROSS.la,
      "Ave Maria, gratia plena. Amen.",
      SIGN_OF_THE_CROSS.la,
    ]);
    expect(s.items.every((i) => i.kind === "pause" || i.lang === "la")).toBe(true);
  });

  it("prays in full the prayers a litany's last line names", () => {
    const text = "Holy Mary, pray for us.\nOur Father, Hail Mary, Glory Be.";
    const s = prayerScript("litany", { text, lang: "en" }, ctx());
    expect(texts(s)).toEqual([
      SIGN_OF_THE_CROSS.en,
      "Holy Mary, pray for us.",
      "Our Father, who art in heaven. Amen.",
      HAIL_MARY,
      "Glory be to the Father. Amen.",
      SIGN_OF_THE_CROSS.en,
    ]);
  });
});

describe("rosaryScript", () => {
  it("prays the whole Rosary as the site's guide gives it", () => {
    const s = rosaryScript("joyful", ctx());
    const t = texts(s);
    expect(t[0]).toBe(SIGN_OF_THE_CROSS.en);
    expect(t[t.length - 1]).toBe(SIGN_OF_THE_CROSS.en);
    expect(count(s, HAIL_MARY)).toBe(53);
    expect(count(s, "Our Father, who art in heaven. Amen.")).toBe(6);
    expect(count(s, "Glory be to the Father. Amen.")).toBe(6);
    expect(count(s, "O my Jesus, forgive us our sins. Amen.")).toBe(5);
    expect(t.filter((x) => /Joyful Mystery:/.test(x))).toEqual([
      "The First Joyful Mystery: The Annunciation.",
      "The Second Joyful Mystery: The Visitation.",
      "The Third Joyful Mystery: The Nativity.",
      "The Fourth Joyful Mystery: The Presentation in the Temple.",
      "The Fifth Joyful Mystery: The Finding of Jesus in the Temple.",
    ]);
    // The English Hail, Holy Queen carries its versicle: it is said once, not twice.
    expect(t.filter((x) => x.includes("promises of Christ")).length).toBe(1);
    expect(t.some((x) => x.startsWith("Let us pray. O God, whose only-begotten Son"))).toBe(true);
  });

  it("rotates the takes of a prayer said many times", () => {
    const s = rosaryScript("sorrowful", ctx());
    const takes = s.items.flatMap((i) =>
      i.kind === "say" && i.text === HAIL_MARY ? [i.take] : [],
    );
    expect(new Set(takes)).toEqual(new Set([0, 1, 2]));
  });

  it("says the versicle once in a translation that carries it", () => {
    const spanish = new Map(PRAYERS);
    spanish.set(
      "salve-regina",
      source(
        "salve-regina",
        "Dios te salve, Reina",
        "Hail, holy Queen.\nV. Pray for us, O holy Mother of God.\nR. That we may be made worthy of the promises of Christ.",
        undefined,
        "Dios te salve, Reina.\nV. Ruega por nosotros.\nR. Para que seamos dignos de las promesas de Cristo.",
      ),
    );
    spanish.set(
      "hail-mary",
      source("hail-mary", "Ave María", HAIL_MARY, undefined, "Dios te salve, María. Amén."),
    );
    const s = rosaryScript("joyful", { pageLang: "es", chosen: null, prayers: spanish });
    expect(texts(s).filter((x) => /Ruega por nosotros/.test(x)).length).toBe(1);
    expect(texts(s).some((x) => x.startsWith("Primer misterio gozoso"))).toBe(true);
  });

  it("adds the versicle a Latin Salve Regina does not carry", () => {
    const s = rosaryScript("glorious", ctx("la"));
    expect(count(s, "Ave Maria, gratia plena. Amen.")).toBe(53);
    expect(texts(s)[0]).toBe(SIGN_OF_THE_CROSS.la);
  });
});

describe("the Divine Mercy chaplet", () => {
  const day =
    'Pray the Chaplet of the Divine Mercy. Begin with the Sign of the Cross, one Our Father, one Hail Mary and the Apostles\' Creed. On each Our Father bead: "Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son." On each of the ten Hail Mary beads: "For the sake of His sorrowful Passion, have mercy on us and on the whole world." After the five decades, three times: "Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world."';

  it("finds its three prayers in the instructions", () => {
    const p = divineMercyPrayers({ text: day, lang: "en" });
    expect(p?.eternal).toMatch(/^Eternal Father/);
    expect(p?.passion).toMatch(/^For the sake/);
    expect(p?.holy).toMatch(/^Holy God/);
  });

  it("prays five decades and the Holy God three times, reading no instruction", () => {
    const s = novenaDayScript({ text: day, lang: "en" }, ctx());
    const t = texts(s);
    expect(t.filter((x) => x.startsWith("For the sake")).length).toBe(50);
    expect(t.filter((x) => x.startsWith("Eternal Father")).length).toBe(5);
    expect(t.filter((x) => x.startsWith("Holy God")).length).toBe(3);
    expect(t.some((x) => /bead|decade|Begin with/i.test(x))).toBe(false);
  });
});

describe("sequenceScript", () => {
  it("prays a guide's prayers in order, with the Sign of the Cross only at its ends", () => {
    const s = sequenceScript(
      [{ slug: "sign-of-the-cross" }, { slug: "our-father" }, { slug: "glory-be" }],
      ctx(),
    );
    expect(texts(s)).toEqual([
      SIGN_OF_THE_CROSS.en,
      "Our Father, who art in heaven. Amen.",
      "Glory be to the Father. Amen.",
      SIGN_OF_THE_CROSS.en,
    ]);
  });
});

describe("planScript", () => {
  it("says a versicle and response a guide quotes without their marks", () => {
    const closing =
      "O glorious Prince Saint Michael, deliver us from all evil. V. Pray for us, O glorious Saint Michael, Prince of the Church of Jesus Christ. R. That we may be made worthy of his promises.";
    const s = planScript(
      [{ quote: { step: 7, index: 0 } }],
      { quote: () => ({ text: closing, lang: "en" }), rosarySet: "joyful", chaplet: null },
      ctx(),
    );
    expect(texts(s)).toEqual([
      SIGN_OF_THE_CROSS.en,
      "O glorious Prince Saint Michael, deliver us from all evil. Pray for us, O glorious Saint Michael, Prince of the Church of Jesus Christ. That we may be made worthy of his promises.",
      SIGN_OF_THE_CROSS.en,
    ]);
  });
});

describe("pages prayed through in full", () => {
  it("prays the whole Rosary on a page that sets out its mysteries", () => {
    const text =
      "First Joyful Mystery: The Annunciation (Lk 1:26-27)\nSecond Joyful Mystery: The Visitation (Lk 1:39-42)\n\nAt the beginning of each decade, announce the mystery to be contemplated.";
    const s = prayerScript("joyful-mysteries", { text, lang: "en" }, ctx());
    expect(count(s, HAIL_MARY)).toBe(53);
    expect(texts(s).some((t) => /Lk 1/.test(t))).toBe(false);
  });

  it("does not say the Sign of the Cross twice when the text tells the reader to make it", () => {
    const sign = new Map(PRAYERS);
    sign.set(
      "sign-of-the-cross",
      source("sign-of-the-cross", "Sign of the Cross", SIGN_OF_THE_CROSS.en),
    );
    const s = prayerScript(
      "surplice",
      {
        text: "Make the Sign of the Cross and say:\nClothe me, O Lord, with the new man.",
        lang: "en",
      },
      { pageLang: "en", chosen: null, prayers: sign },
    );
    expect(texts(s).filter((t) => t === SIGN_OF_THE_CROSS.en)).toHaveLength(2);
  });

  it("prays a Rosary novena's day and then that day's Rosary", () => {
    const s = novenaDayScript(
      { text: "Hail, Queen of the Most Holy Rosary, my Mother Mary, hail!", lang: "en" },
      ctx(),
      { rosary: "joyful" },
    );
    const t = texts(s);
    expect(t[1]).toBe("Hail, Queen of the Most Holy Rosary, my Mother Mary, hail!");
    expect(count(s, HAIL_MARY)).toBe(53);
    expect(t.filter((x) => x === SIGN_OF_THE_CROSS.en)).toHaveLength(2);
  });

  it("prays the prayers a text names, and says the collect's conclusion whole", () => {
    const text =
      "O God, who didst make this night holy. Through our Lord Jesus Christ, etc.\nPater, Ave, Gloria.";
    const s = prayerScript("collect", { text, lang: "en" }, ctx());
    expect(texts(s)).toEqual([
      SIGN_OF_THE_CROSS.en,
      "O God, who didst make this night holy. Through our Lord Jesus Christ, Thy Son, who liveth and reigneth with Thee in the unity of the Holy Ghost, God, world without end. Amen.",
      "Our Father, who art in heaven. Amen.",
      HAIL_MARY,
      "Glory be to the Father. Amen.",
      SIGN_OF_THE_CROSS.en,
    ]);
  });
});
