/**
 * What a prayer's text says aloud: the prayer and nothing else.
 */
import { describe, expect, it } from "vitest";

import {
  INTENTION_PAUSE_MS,
  joinLines,
  normalizeForSpeech,
  prayersNamedIn,
  splitForClips,
  splitSentences,
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

/* -------------------------------------------------------------------------- */
/* The rules from the review of every spoken script                           */
/* -------------------------------------------------------------------------- */

const MORE = [
  ...PRAYERS,
  { slug: "eternal-rest", title: "Eternal Rest (Requiem Aeternam)" },
  { slug: "salve-regina", title: "Hail Holy Queen (Salve Regina)" },
];
const en = (text: string) => spokenSteps(text, { lang: "en", prayers: MORE });
const la = (text: string) => spokenSteps(text, { lang: "la", prayers: MORE });
const all = (steps: SpokenStep[]) => said(steps).join(" ");

describe("rule 1: etc. is never said", () => {
  it("prays the prayer an abbreviation names, in full", () => {
    const steps = en("1. Saint Catharine, obtain for us the love of prayer.\nGlory be, etc.");
    expect(said(steps)).toEqual(["Saint Catharine, obtain for us the love of prayer."]);
    expect(prayed(steps)).toEqual(["glory-bex1"]);
    expect(prayed(en("Pater, Ave, &c."))).toEqual(["our-fatherx1", "hail-maryx1"]);
    expect(prayed(la("Gloria Patri, et Filio, etc."))).toEqual(["glory-bex1"]);
    expect(prayed(en("Eternal rest, etc."))).toEqual(["eternal-restx1"]);
  });

  it("says a collect's abbreviated conclusion whole", () => {
    expect(all(en("O Lord, hear our prayer. Through our Lord Jesus Christ, etc. Amen."))).toBe(
      "O Lord, hear our prayer. Through our Lord Jesus Christ, Thy Son, who liveth and reigneth with Thee in the unity of the Holy Ghost, God, world without end. Amen.",
    );
    expect(
      all(en("O Lord Jesus, defend us by thy Mother's prayers. Who livest and reignest, &c.")),
    ).toContain(
      "Who livest and reignest with God the Father, in the unity of the Holy Ghost, God, world without end. Amen.",
    );
    expect(all(la("Deus, qui nos laetificas. Per Dominum nostrum, etc."))).toContain(
      "Per Dominum nostrum Iesum Christum, Filium tuum, qui tecum vivit et regnat in unitate Spiritus Sancti, Deus, per omnia saecula saeculorum. Amen.",
    );
  });

  it("repeats, in full, the passage a refrain's opening words stand for", () => {
    const text =
      "All ye who groan beneath\nA load of ills oppress'd.\n\nO victim dear to Heaven!\nO Paul, thou teacher true!\n\nPierced by the flame of love,\nThou soughtest to destroy.\nO victim, etc.";
    expect(said(en(text))[2]).toBe(
      "Pierced by the flame of love, Thou soughtest to destroy. O victim dear to Heaven! O Paul, thou teacher true!",
    );
    const responsory =
      "R. Caligaverunt oculi mei a fletu meo. Videte omnes populi, * Si est dolor similis sicut dolor meus.\nV. O vos omnes, qui transitis per viam, attendite et videte. * Si est dolor, etc.";
    expect(all(la(responsory))).toMatch(
      /attendite et videte\. Si est dolor similis sicut dolor meus\.$/,
    );
  });

  it("says nothing for a cue whose passage the text does not give", () => {
    expect(said(en("O come, etc."))).toEqual([]);
  });

  it("does not pray the Glory Be twice for its second half", () => {
    expect(prayed(en("V. Glory be, etc.\nR. As it was, etc."))).toEqual(["glory-bex1"]);
  });
});

describe("rule 2: prayers named as instructions, with their counts", () => {
  it("prays a set as many times as it says", () => {
    expect(prayed(en("Amen. Pater, Ave, Gloria, thrice."))).toEqual([
      ...["our-fatherx1", "hail-maryx1", "glory-bex1"],
      ...["our-fatherx1", "hail-maryx1", "glory-bex1"],
      ...["our-fatherx1", "hail-maryx1", "glory-bex1"],
    ]);
    expect(prayed(en("Five Our Fathers and Hail Marys."))).toEqual(
      Array.from({ length: 5 }, () => ["our-fatherx1", "hail-maryx1"]).flat(),
    );
    expect(prayed(en("Pater once, Ave seven times; Gloria once."))).toEqual([
      "our-fatherx1",
      "hail-maryx7",
      "glory-bex1",
    ]);
    expect(
      prayed(en("Recite daily nine times the Hail Mary; then say the following prayer:")),
    ).toEqual(["hail-maryx9"]);
  });

  it("says what follows as many times as an instruction asks", () => {
    const steps = en("Then say three times,\n\nHoly Mary, intercede for us. Amen.");
    expect(said(steps).join(" ")).toBe(
      "Holy Mary, intercede for us. Amen. Holy Mary, intercede for us. Amen. Holy Mary, intercede for us. Amen.",
    );
  });

  it("prays the Hail Mary before each saying of an ejaculation", () => {
    const steps = en(
      "Ave Maria thrice, and after each:\n\nBy thy Immaculate Conception, O Mary, make my body pure.",
    );
    expect(steps.filter((s) => s.kind !== "pause").map((s) => s.kind)).toEqual([
      "prayer",
      "say",
      "prayer",
      "say",
      "prayer",
      "say",
    ]);
  });

  it("adds the Glory Be to every third of twelve salutations", () => {
    const steps = en(
      "Repeat the following salutation twelve times, and add, Glory be to the Father, etc., to every third repetition.\n\nHail, daughter of the eternal Father!",
    );
    expect(said(steps)).toHaveLength(12);
    expect(prayed(steps)).toEqual(["glory-bex1", "glory-bex1", "glory-bex1", "glory-bex1"]);
  });

  it("counts the Hail Marys a repeat instruction totals, not adds", () => {
    const steps = en(
      "I salute Thee, saying, Hail Mary, &c.\nHere the Hail Mary is to be repeated three times.",
    );
    expect(said(steps)).toEqual(["I salute Thee, saying,"]);
    expect(prayed(steps)).toEqual(["hail-maryx3"]);
  });
});

describe("rule 3: placeholders", () => {
  it("is silent where the reader names a request", () => {
    const steps = en(
      "Saint Michael, intercede for me, especially (state your intention). Obtain for me a happy death.",
    );
    expect(steps.some((s) => s.kind === "pause" && s.ms === INTENTION_PAUSE_MS)).toBe(true);
    expect(all(steps)).toBe(
      "Saint Michael, intercede for me, especially. Obtain for me a happy death.",
    );
  });

  it("drops names, blanks and the other sex's words", () => {
    expect(normalizeForSpeech("pray for us, for N., and for all.", "en")).toBe(
      "pray for us, and for all.",
    );
    expect(normalizeForSpeech("My dear patron, St. ——, obtain for me", "en")).toBe(
      "My dear patron, obtain for me",
    );
    expect(normalizeForSpeech("come to his (her) aid, that he (or she) may live", "en")).toBe(
      "come to his aid, that he may live",
    );
    expect(normalizeForSpeech("this sickness [or trial] which", "en")).toBe("this sickness which");
    expect(normalizeForSpeech("animam famuli tui (vel famulae tuae) ut defunctus", "la")).toBe(
      "animam famuli tui ut defunctus",
    );
    expect(normalizeForSpeech("Christ in the poop [deck], Christ", "en")).toBe(
      "Christ in the poop deck, Christ",
    );
  });
});

describe("rule 4: citations", () => {
  it("drops references and attributions", () => {
    expect(normalizeForSpeech("that your joy may be full (John xvi. 24).", "en")).toBe(
      "that your joy may be full.",
    );
    expect(
      normalizeForSpeech("heart of man (Isaiah lxiv. 4; I Corinthians ii. 9). Not yet", "en"),
    ).toBe("heart of man. Not yet");
    expect(normalizeForSpeech("filled with joy. Ps. 66. Deus misereatur nostri", "la")).toBe(
      "filled with joy. Deus misereatur nostri",
    );
    expect(
      normalizeForSpeech("crown him when he is victorious.”—Saint Aug. in Ps. 32.", "en"),
    ).toBe("crown him when he is victorious.”");
  });
});

describe("rule 5: headings, prose instructions and narrative", () => {
  it("leaves out title lines and run-in labels", () => {
    expect(said(en("The First Sword\n\nO most sorrowful Virgin Mary, remember me."))).toEqual([
      "O most sorrowful Virgin Mary, remember me.",
    ]);
    expect(said(en("Act of Thanksgiving.\nI give Thee thanks, O Lord."))).toEqual([
      "I give Thee thanks, O Lord.",
    ]);
    expect(said(en("Invocation.—Good Saint Anne, pray for us."))).toEqual([
      "Good Saint Anne, pray for us.",
    ]);
    expect(
      said(en("Unto the end. A psalm for David.\nThe heavens shew forth the glory of God.")),
    ).toEqual(["The heavens shew forth the glory of God."]);
  });

  it("keeps a Let Us Pray line as the words said before the collect", () => {
    expect(said(en("Let Us Pray\nO God, who didst teach us."))[0]).toBe(
      "Let us pray. O God, who didst teach us.",
    );
  });

  it("drops instructions written as prose, praying the prayers they name", () => {
    const steps = en(
      "For Christmas Day and its Octave.\nV. The Word was made flesh.\nThe Alleluia is omitted during the rest of the year.\nOn the single bead, pray the Our Father.",
    );
    expect(said(steps)).toEqual(["The Word was made flesh."]);
    expect(prayed(steps)).toEqual(["our-fatherx1"]);
  });

  it("never takes Scripture or a petition for an instruction", () => {
    const text =
      "Then shall the virgin rejoice in the dance: and I will make them joyful.\nFinally, my dear patron, be with me, that we may sing the praises of Jesus.";
    expect(said(en(text)).join(" ")).toContain("Then shall the virgin rejoice");
    expect(said(en(text)).join(" ")).toContain("Finally, my dear patron");
  });

  it("leaves out the narrative that leads into a canticle", () => {
    expect(
      said(
        en(
          "Then Judith sung this canticle to the Lord, saying:\nBegin ye to the Lord with timbrels.",
        ),
      ),
    ).toEqual(["Begin ye to the Lord with timbrels."]);
    expect(said(en("And thou shalt say in that day: I will give thanks to thee, O Lord."))).toEqual(
      ["I will give thanks to thee, O Lord."],
    );
    expect(said(en("I said: In the midst of my days I shall go to the gates of hell."))[0]).toMatch(
      /^I said:/,
    );
  });

  it("prays a litany its name calls for, but not over the litany printed below it", () => {
    const P = [
      ...MORE,
      { slug: "litany-of-the-blessed-virgin-mary", title: "Litany of the Blessed Virgin Mary" },
    ];
    expect(
      prayed(spokenSteps("Amen.\n\nLitany of Loreto.\n\nO God, …", { lang: "en", prayers: P })),
    ).toEqual(["litany-of-the-blessed-virgin-maryx1"]);
    const printed =
      "Litany of Loretto.\nLord have mercy on us.\nHoly Mary, pray for us.\nMother of Christ, pray for us.";
    expect(prayed(spokenSteps(printed, { lang: "en", prayers: P }))).toEqual([]);
  });
});

describe("rule 6: a verse's closing R. says its refrain", () => {
  it("says the refrain in full after each verse", () => {
    const steps = en(
      "R: Hearken, O Lord, and have mercy.\n\nCrying, we raise our eyes to Thee. R.\n\nO God, hear our groans. R.",
    );
    expect(said(steps)).toEqual([
      "Hearken, O Lord, and have mercy.",
      "Crying, we raise our eyes to Thee. Hearken, O Lord, and have mercy.",
      "O God, hear our groans. Hearken, O Lord, and have mercy.",
    ]);
  });
});

describe("rule 7: clips never cut a sentence", () => {
  it("joins verse lines with a pause and packs whole sentences", () => {
    expect(
      splitForClips([
        "In heaven the blessed your glory proclaim",
        "On earth we invoke your fair name.",
      ]),
    ).toEqual(["In heaven the blessed your glory proclaim, On earth we invoke your fair name."]);
    const clips = splitForClips([
      `${"Lord, have mercy on us and hear our prayer. ".repeat(12).trim()}`,
    ]);
    for (const clip of clips) expect(clip).toMatch(/[.!?]$/);
  });

  it("cuts only a sentence over the long limit, at the semicolon nearest its middle", () => {
    const half = "who didst come down from heaven for us and for our salvation".repeat(5);
    const clips = splitForClips([`O Jesus, ${half}; grant that we may ${half}.`]);
    expect(clips).toHaveLength(2);
    expect(clips[0]!.endsWith(";")).toBe(true);
  });

  it("never ends a sentence at an abbreviation or before a small letter", () => {
    expect(
      splitSentences("O glorious St. Ursula, pray for us. O Mary! which you exhibited.", "en"),
    ).toEqual(["O glorious St. Ursula, pray for us.", "O Mary! which you exhibited."]);
    expect(joinLines(["O Mary,", "pray for us"])).toBe("O Mary, pray for us");
  });

  it("writes out St, viz. and &c. as they are said", () => {
    expect(normalizeForSpeech("O glorious St Joseph and SS. Peter and Paul", "en")).toBe(
      "O glorious Saint Joseph and Saints Peter and Paul",
    );
    expect(normalizeForSpeech("one thing to do, viz. to live", "en")).toBe(
      "one thing to do, namely to live",
    );
    expect(normalizeForSpeech("Through, &c.", "en")).toBe("Through");
  });
});

describe("translations are judged by their English", () => {
  it("prays the prayer a translated cue names and says none of its words", () => {
    const steps = spokenSteps("San José, ruega por nosotros.\nGloria, etc.", {
      lang: "es",
      english: "Saint Joseph, pray for us.\nGlory be, etc.",
      prayers: MORE,
    });
    expect(said(steps)).toEqual(["San José, ruega por nosotros."]);
    expect(prayed(steps)).toEqual(["glory-bex1"]);
  });
});

describe("the module stays safe for old Safari", () => {
  it("has no regex lookbehind", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/pray-along/speech-text.ts", "utf8");
    expect(source).not.toMatch(/\(\?<[=!]/);
  });
});
