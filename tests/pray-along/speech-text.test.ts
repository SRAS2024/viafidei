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

  it("leaves a sentence its full stop when 'etc.' ended it", () => {
    expect(normalizeForSpeech("Por medio de nuestro Señor Jesucristo, etc. Amén.", "es")).toBe(
      "Por medio de nuestro Señor Jesucristo. Amén.",
    );
    // At the end of the words, or where the sentence goes on, there is none to keep.
    expect(normalizeForSpeech("Por medio de nuestro Señor Jesucristo, etc.", "es")).toBe(
      "Por medio de nuestro Señor Jesucristo",
    );
    expect(normalizeForSpeech("O Jesu, etc., as above. Then pray.", "en")).toBe(
      "O Jesu. Then pray.",
    );
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
    expect(
      normalizeForSpeech("y lo coronas cuando es victorioso.”-St. Aug. en Sal. 32.", "es"),
    ).toBe("y lo coronas cuando es victorioso.”");
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

describe("versicle and response marks are never said", () => {
  const es = (text: string, english?: string) =>
    spokenSteps(text, { lang: "es", english, prayers: MORE });

  it("says a translated versicle without its mark, though its English was written out", () => {
    // The English says "Saint Dominic", so its words no longer show where its mark was.
    const steps = es(
      "V. Ruega por nosotros, St Dominic.\nR. Para que seamos dignos de las promesas de Cristo.",
      "V. Pray for us, St Dominic.\nR. That we may be made worthy of the promises of Christ.",
    );
    expect(said(steps)).toEqual([
      "Ruega por nosotros, St Dominic. Para que seamos dignos de las promesas de Cristo.",
    ]);
  });

  it("says a response stored on its versicle's line without its mark", () => {
    const steps = es(
      "Alabado sea Dios Padre, que la predestinó para ser la Madre de su Hijo. R. Amén. Ave Maria.",
      "Praise be to God the Father, who predestined her to be the Mother of his Son. R. Amen. Ave Maria.",
    );
    expect(said(steps)).toEqual([
      "Alabado sea Dios Padre, que la predestinó para ser la Madre de su Hijo. Amén.",
    ]);
    expect(prayed(steps)).toEqual(["hail-maryx1"]);
  });

  it("says a versicle and its response a translation keeps on one line, both of them", () => {
    // The slash stands for the line break between them, and goes with the mark.
    const steps = es(
      "V. El Señor sea con vosotros. / R. Y también con vosotros.",
      "V. The Lord be with you. / R. And also with you.",
    );
    expect(said(steps)).toEqual(["El Señor sea con vosotros. Y también con vosotros."]);
  });

  it("drops a litany's response mark after the invocation's comma", () => {
    expect(
      all(
        la(
          "Sancta Maria, ora pro nobis.\nCausa nostrae laetitiae, R. ora pro nobis.\nRegina sine peccato originali concepta, R. ora pro nobis.",
        ),
      ),
    ).toBe(
      "Sancta Maria, ora pro nobis. Causa nostrae laetitiae, ora pro nobis. Regina sine peccato originali concepta, ora pro nobis.",
    );
    expect(normalizeForSpeech("Pater de caelis, Deus, R. miserere nobis.", "la")).toBe(
      "Pater de caelis, Deus, miserere nobis.",
    );
    expect(
      normalizeForSpeech("Agnus Dei, qui tollis peccata mundi, R. exaudi nos, Domine.", "la"),
    ).toBe("Agnus Dei, qui tollis peccata mundi, exaudi nos, Domine.");
  });

  it("drops a mark after a Chinese stop, with or without a space", () => {
    expect(normalizeForSpeech("请为我们祈求！R. 阿们。", "zh")).toBe("请为我们祈求！阿们。");
    expect(normalizeForSpeech("天主圣母，请为我们祈求。V. 使我们堪受基督的恩许。", "zh")).toBe(
      "天主圣母，请为我们祈求。使我们堪受基督的恩许。",
    );
  });

  it("knows a mark at a line's start or after a quoted sentence, whatever came before", () => {
    expect(normalizeForSpeech("V. Ora pro nobis\nR. Amen.", "la")).toBe("Ora pro nobis Amen.");
    expect(normalizeForSpeech("«Ruega por nosotros.» R. Amén.", "es")).toBe(
      "«Ruega por nosotros.» Amén.",
    );
    // "N." is a name's place, not an initial: the next line's mark is still a mark,
    // and so is one on the same line.
    expect(normalizeForSpeech("Oremos por el Papa N.\nV. El Señor lo guarde.", "es")).toBe(
      "Oremos por el Papa. El Señor lo guarde.",
    );
    expect(
      normalizeForSpeech("Oremos por nuestro Sumo Pontífice N. R. El Señor le guarde.", "es"),
    ).toBe("Oremos por nuestro Sumo Pontífice. El Señor le guarde.");
  });

  it("drops the marks a translation read by its own rules keeps inside a line", () => {
    expect(
      said(es("Ven, Espíritu Santo, llena los corazones de tus fieles. R. ¡Aleluya!")),
    ).toEqual(["Ven, Espíritu Santo, llena los corazones de tus fieles. ¡Aleluya!"]);
    expect(
      said(es("Envía tu Espíritu y serán creadas. R: Y renovarás la faz de la tierra.")),
    ).toEqual(["Envía tu Espíritu y serán creadas. Y renovarás la faz de la tierra."]);
  });

  it("drops the marks of a quoted versicle and response, in every language", () => {
    expect(
      normalizeForSpeech(
        "to serve God more and more faithfully every day. V. Pray for us, O glorious Saint Michael. R. That we may be made worthy of his promises.",
        "en",
      ),
    ).toBe(
      "to serve God more and more faithfully every day. Pray for us, O glorious Saint Michael. That we may be made worthy of his promises.",
    );
    expect(
      normalizeForSpeech(
        "puis : « V. Priez pour nous, ô sainte Mère de Dieu. R. Afin que nous soyons dignes des promesses du Christ. »",
        "fr",
      ),
    ).toBe(
      "puis: « Priez pour nous, ô sainte Mère de Dieu. Afin que nous soyons dignes des promesses du Christ. »",
    );
    expect(normalizeForSpeech("V/. Ruega por nosotros. R/. Para que seamos dignos.", "es")).toBe(
      "Ruega por nosotros. Para que seamos dignos.",
    );
    expect(normalizeForSpeech("El Señor esté con vosotros. / R. Y con tu espíritu.", "es")).toBe(
      "El Señor esté con vosotros. Y con tu espíritu.",
    );
    expect(normalizeForSpeech("V. Rogai por nós.\nR. Para que sejamos dignos.", "pt")).toBe(
      "Rogai por nós. Para que sejamos dignos.",
    );
    expect(normalizeForSpeech("V. Prega per noi. R. “Affinché siamo fatti degni”.", "it")).toBe(
      "Prega per noi. “Affinché siamo fatti degni”.",
    );
    expect(normalizeForSpeech("R. 使我们堪受基督的恩许。", "zh")).toBe("使我们堪受基督的恩许。");
  });

  it("leaves a Roman numeral, an initial and a mention of the marks as they are", () => {
    for (const [text, lang] of [
      ["Saint Pius V. Pray for us.", "en"],
      ["Chapter V. The Annunciation.", "en"],
      ["IV. x", "en"],
      ["en el siglo V. Ruega por nosotros.", "es"],
      ["Estación V. Simón de Cirene ayuda a Jesús.", "es"],
      ["por la B. V. M. y por Fr. R. Knox y R. H. Benson", "es"],
      ["Amen. R. H. Benson wrote it.", "en"],
      ["by Msgr. R. Knox and Card. V. Merry del Val", "en"],
      ["O Jesu, as above. V. and R. as above.", "en"],
      ["Then the antiphon, V. and R. as above.", "en"],
      ["Luego la antífona, V. y R. como antes.", "es"],
      ["en los capítulos IV, V. y VI.", "es"],
      ["con santa Luisa, V. de Paul fundó las Hijas de la Caridad.", "es"],
    ] as const) {
      expect(normalizeForSpeech(text, lang)).toBe(text);
    }
    // "V." after "IV." is the next station's number, and its heading stays a heading.
    expect(
      said(en("IV. The Fourth Station.\n\nV. The Fifth Station.\n\nO Jesus, have mercy on us.")),
    ).toEqual(["O Jesus, have mercy on us."]);
    expect(
      said(
        es(
          "IV. La Cuarta Estación.\n\nV. La Quinta Estación.\n\nOh Jesús, ten piedad de nosotros.",
          "IV. The Fourth Station.\n\nV. The Fifth Station.\n\nO Jesus, have mercy on us.",
        ),
      ),
    ).toEqual(["Oh Jesús, ten piedad de nosotros."]);
  });
});

describe("a translated line is said in full", () => {
  const es = (text: string, english: string) =>
    spokenSteps(text, { lang: "es", english, prayers: MORE });

  it("says the closing Amén of a line whose English writes St out as Saint", () => {
    expect(
      said(
        es(
          "Oh Blessed St. Joseph, ruega por mí, para que pueda compartir la paz y la alegría de tu santa muerte. Amén.",
          "O Blessed St. Joseph, pray for me, that I may share in the peace and joy of your holy death. Amen.",
        ),
      ),
    ).toEqual([
      "Oh Blessed St. Joseph, ruega por mí, para que pueda compartir la paz y la alegría de tu santa muerte. Amén.",
    ]);
  });

  it("says every sentence of a line whose English holds a placeholder", () => {
    expect(
      said(
        es(
          "Oh Dios mío, yo (N.) creo con mi corazón todo lo que la Iglesia propone. En el principio era el Verbo, y el Verbo era con Dios.",
          "O my God, I (N.) believe with my heart all that the Church proposes. In the beginning was the Word, and the Word was with God.",
        ),
      ),
    ).toEqual([
      "Oh Dios mío, yo creo con mi corazón todo lo que la Iglesia propone. En el principio era el Verbo, y el Verbo era con Dios.",
    ]);
  });

  it("still leaves out a closing instruction, written in English or in the translator's words", () => {
    const steps = es(
      "Oh St. Joseph, haz que ninguno de nosotros sucumba al pecado. Ave Maria tres veces.",
      "O St. Joseph, make it thy care that none of us succumb to sin. Ave Maria thrice.",
    );
    expect(said(steps)).toEqual(["Oh St. Joseph, haz que ninguno de nosotros sucumba al pecado."]);
    expect(prayed(steps)).toEqual(["hail-maryx3"]);
    const kept = es(
      "Alabemos y demos gracias a Dios Hijo, que la eligió para su Madre. R. Amén. Pater noster.",
      "Let us praise and give thanks to God the Son, who chose her for his Mother. R. Amen. Pater noster.",
    );
    expect(said(kept)).toEqual([
      "Alabemos y demos gracias a Dios Hijo, que la eligió para su Madre. Amén.",
    ]);
    expect(prayed(kept)).toEqual(["our-fatherx1"]);
  });

  it("keeps the silence for a request, however the translator wrote its bracket", () => {
    const own = es(
      "Te ruego por todos los que sufren, y especialmente por aquellos por quienes oramos. (Aquí menciona a aquellos por quienes deseas orar).\nAmén.",
      "I pray for all who suffer, and especially those for whom we pray. (Here mention those for whom you wish to pray).\nAmen.",
    );
    expect(said(own)).toEqual([
      "Te ruego por todos los que sufren, y especialmente por aquellos por quienes oramos.",
      "Amén.",
    ]);
    expect(own.some((s) => s.kind === "pause" && s.ms === INTENTION_PAUSE_MS)).toBe(true);
    const favour = es(
      "Oh St. Joseph, contempladme a tus pies. Vengo a pedirte este favor: (aquí nombra tu petición).",
      "O St. Joseph, behold me at thy feet. I come to ask this favour: (here name your request).",
    );
    expect(said(favour)).toEqual([
      "Oh St. Joseph, contempladme a tus pies. Vengo a pedirte este favor:",
    ]);
  });

  it("says a translated petition that ends 'etc.' in the translator's words", () => {
    const steps = es(
      "Te suplicamos que no dejes caer sobre ella la sentencia de tu juicio, sino que merezca escapar de la condenación; quien vive, etc. R. Amén.",
      "We beseech Thee not to let the sentence of Thy judgment fall upon her, but may she deserve to escape condemnation; Who livest, etc. R. Amen.",
    );
    // "etc." ended the sentence, so its full stop stays: the Amén is a sentence of its own.
    expect(all(steps)).toBe(
      "Te suplicamos que no dejes caer sobre ella la sentencia de tu juicio, sino que merezca escapar de la condenación; quien vive. Amén.",
    );
  });

  it("leaves out a closing pointer though words were left out before it too", () => {
    const steps = es(
      "Obtén para nosotros el favor que imploramos (aquí declaramos el favor). Si lo obtienes, oh glorioso St Anthony, te ofreceremos pan para los pobres. Pater, Ave, Gloria.",
      "Obtain for us the favour which we implore (here state the favour needed). If thou dost obtain it, O glorious St Anthony, we will offer thee bread for the poor. Pater, Ave, Gloria.",
    );
    expect(all(steps)).toMatch(/pan para los pobres\.$/);
    expect(prayed(steps)).toEqual(["our-fatherx1", "hail-maryx1", "glory-bex1"]);
  });

  it("says a numbered line without its number, as its English is said", () => {
    const steps = es(
      "1. ¡Oh, celoso doctor de la Iglesia, St. Alphonsus, obtén para mí una fe viva en todas las verdades que la santa Iglesia Católica enseña! Gloria, etc.",
      "1. O most zealous doctor of the Church, St. Alphonsus, obtain for me a lively faith in all the truths that the holy Catholic Church teaches. Glory be, etc.",
    );
    expect(said(steps)).toEqual([
      "¡Oh, celoso doctor de la Iglesia, St. Alphonsus, obtén para mí una fe viva en todas las verdades que la santa Iglesia Católica enseña!",
    ]);
    expect(prayed(steps)).toEqual(["glory-bex1"]);
    // Taken off as the same mark the English has, whatever stop the number has.
    expect(
      said(
        es(
          "2) Oh muy celoso doctor de la Iglesia, St. Alphonsus, obtén para mí un ardiente amor de Dios. Gloria, etc.",
          "2) O most zealous doctor of the Church, St. Alphonsus, obtain for me an ardent love of God. Glory be, etc.",
        ),
      ),
    ).toEqual([
      "Oh muy celoso doctor de la Iglesia, St. Alphonsus, obtén para mí un ardiente amor de Dios.",
    ]);
  });

  it("leaves out a closing pointer the translation keeps in English, and the citation before it", () => {
    // The translator left out "draw me, I pray thee, …": what they wrote is said, and the
    // reference that now ends it is not.
    const steps = es(
      "María santísima, estabas turbada por tu modestia; por lo tanto, haz en tu incomparable humildad, “que dio a luz a Dios para los hombres, reabrió el Paraíso” (S. Aug. Sermo de Sanct.), Ave Maria.",
      'Most holy Mary, thou wast troubled by reason of thy modesty; wherefore do thou in thy incomparable humility, "which brought forth God for men, reopened Paradise" (S. Aug. Sermo de Sanct.), draw me, I pray thee, out of the deep pit of my sins. Ave Maria.',
    );
    expect(said(steps)).toEqual([
      "María santísima, estabas turbada por tu modestia; por lo tanto, haz en tu incomparable humildad, “que dio a luz a Dios para los hombres, reabrió el Paraíso”,",
    ]);
    expect(prayed(steps)).toEqual(["hail-maryx1"]);
  });

  it("cuts the English closing words only where they close the translation", () => {
    // The same words earlier in the prayer stay; only the last place they stand goes.
    const greeting = es(
      "Oh María, te saludo con el Ave Maria del Ángel, Ave Maria.",
      "O Mary, I greet thee with the Angel's Ave Maria. Ave Maria.",
    );
    expect(said(greeting)).toEqual(["Oh María, te saludo con el Ave Maria del Ángel,"]);
    expect(prayed(greeting)).toEqual(["hail-maryx1"]);
    // Words that stand anywhere else are the prayer's own: the translator wrote the
    // salutation in Latin and left the closing pointer out.
    const salutation = es(
      "Ave Maria, llena eres de gracia, el Señor es contigo.",
      "Hail Mary, full of grace, the Lord is with thee. Ave Maria.",
    );
    expect(said(salutation)).toEqual(["Ave Maria, llena eres de gracia, el Señor es contigo."]);
    expect(prayed(salutation)).toEqual(["hail-maryx1"]);
  });

  it("keeps every sentence of the prayer when the translator left out the closing instruction", () => {
    const steps = es(
      "Oh San José, ruega por nosotros. Haznos santos y puros.",
      "O Saint Joseph, pray for us. Make us holy and pure. Ave Maria thrice.",
    );
    expect(said(steps)).toEqual(["Oh San José, ruega por nosotros. Haznos santos y puros."]);
    expect(prayed(steps)).toEqual(["hail-maryx3"]);
    // Ran into the prayer's last sentence, the instruction has no sentence of its own to
    // leave out, and the prayer's is kept.
    const joined = es(
      "Oh San José, ruega por nosotros. Haznos santos y puros; Ave María tres veces.",
      "O Saint Joseph, pray for us. Make us holy and pure. Ave Maria thrice.",
    );
    expect(all(joined)).toMatch(/^Oh San José, ruega por nosotros\. Haznos santos y puros/);
    expect(prayed(joined)).toEqual(["hail-maryx3"]);
    // Nor is the only sentence a translation has ever cut away.
    const one = es(
      "Oh San José, ruega por nosotros con un Padrenuestro, Avemaría y Gloria.",
      "O Saint Joseph, pray for us. Pater, Ave, Gloria.",
    );
    expect(said(one)).toEqual([
      "Oh San José, ruega por nosotros con un Padrenuestro, Avemaría y Gloria.",
    ]);
  });

  it("says a translated petition that ends 'etc.' once, though its sentences do not match", () => {
    // The translator made two sentences of one: the line is said whole, once.
    const steps = es(
      "Oh Dios, ten piedad de ella. Te suplicamos que no dejes caer sobre ella la sentencia de tu juicio. Que escape de la condenación, tú que vives, etc.",
      "O God, have mercy on her. We beseech Thee not to let the sentence of Thy judgment fall heavy upon her, but may she escape condemnation, Who livest, etc.",
    );
    expect(said(steps)).toEqual([
      "Oh Dios, ten piedad de ella. Te suplicamos que no dejes caer sobre ella la sentencia de tu juicio. Que escape de la condenación, tú que vives",
    ]);
  });
});

describe("a translated line its English reads in several parts", () => {
  const es = (text: string, english: string) =>
    spokenSteps(text, { lang: "es", english, prayers: MORE });

  it("prays the prayers named after a station's prayer, and reads none of their names", () => {
    const steps = es(
      "Jesús mío, que por tu propia voluntad tomaste la cruz que yo te hice por mis pecados; hazme saber el peso de ellos. Pater, Ave. V. Miserere.",
      "My Jesus, who by thine own will didst take on Thee the Cross which I made for Thee by my sins; oh, make me know the weight of them. Pater, Ave. V. Miserere.",
    );
    expect(said(steps)).toEqual([
      "Jesús mío, que por tu propia voluntad tomaste la cruz que yo te hice por mis pecados; hazme saber el peso de ellos.",
    ]);
    expect(prayed(steps)).toEqual(["our-fatherx1", "hail-maryx1", "psalm-50x1"]);
  });

  it("keeps the silence for a request where the request stands, and does not read it", () => {
    const steps = es(
      "Por sus méritos, concédeme la gracia que pido. (Mencione su solicitud.) Y tú, mi poderoso intercesor, reza por mí. Amén.",
      "Through his merits, grant me the grace for which I ask. (Mention your request.) And you, my powerful intercessor, pray for me. Amen.",
    );
    expect(
      steps.map((s) => (s.kind === "say" ? s.text : s.kind === "pause" ? s.ms : s.slug)),
    ).toEqual([
      "Por sus méritos, concédeme la gracia que pido.",
      INTENTION_PAUSE_MS,
      "Y tú, mi poderoso intercesor, reza por mí. Amén.",
    ]);
  });

  it("never gives a request's share to a prayer sentence when the sentences only add up by chance", () => {
    // Two sentences merged and an Amén added: four sentences either way, but they do not line up.
    const steps = es(
      "Concédeme esta gracia y protégeme siempre. (Mencione su solicitud.) Ruega por mí. Amén.",
      "Grant me this grace. Protect me always. (Mention your request.) Pray for me.",
    );
    expect(all(steps)).toMatch(/Ruega por mí/);
  });
});

describe("a translation's own labels and conclusions", () => {
  const es = (text: string, english: string) =>
    spokenSteps(text, { lang: "es", english, prayers: MORE });

  it("leaves out a label the translator wrote in their own words", () => {
    expect(
      said(
        es(
          "Primera Palabra: Padre, perdónalos, porque no saben lo que hacen.",
          "First Word: Father, forgive them; for they know not what they do.",
        ),
      ),
    ).toEqual(["Padre, perdónalos, porque no saben lo que hacen."]);
    expect(
      said(
        es(
          "El primer misterio. Jesús fue concebido de la Virgen María por el poder del Espíritu Santo.",
          "First Mystery. Jesus was conceived of the Virgin Mary by the power of the Holy Ghost.",
        ),
      ),
    ).toEqual(["Jesús fue concebido de la Virgen María por el poder del Espíritu Santo."]);
    expect(
      said(
        es(
          "Todos: ¡Santo Dios! ¡Santo fuerte! Santo Inmortal, ten piedad de nosotros.",
          "All: Holy God! Holy Strong One! Holy Immortal One, have mercy upon us.",
        ),
      ),
    ).toEqual(["¡Santo Dios! ¡Santo fuerte! Santo Inmortal, ten piedad de nosotros."]);
  });

  it("leaves out a mistranslated antiphon label, and the cue that repeats the antiphon", () => {
    // "Ant." came back as "Horta.", and "We adore, etc." as "Nos encanta, etc.".
    const text = all(
      es(
        "Horta. Adoramos tu cruz, oh Señor, y alabamos y glorificamos tu santa resurrección. Que Dios tenga misericordia de nosotros y nos bendiga. Nos encanta, etc.",
        "Ant. We adore thy cross, O Lord! and we praise and glorify thy holy resurrection. Ps. May God have mercy on us and bless us. We adore, etc.",
      ),
    );
    expect(text).toMatch(
      /^Adoramos tu cruz, oh Señor, y alabamos y glorificamos tu santa resurrección\. Que Dios tenga misericordia de nosotros y nos bendiga\./,
    );
    expect(text).not.toMatch(/Horta|Nos encanta/);
  });

  it("says every word of a translation that has no label of its own", () => {
    expect(said(es("En el camino de la paz.", "Ant. Into the way of peace."))).toEqual([
      "En el camino de la paz.",
    ]);
    // A call closed by another stop than the label's is the prayer's.
    expect(said(es("Señor: escucha mi oración.", "Ant. Lord, hear my prayer."))).toEqual([
      "Señor: escucha mi oración.",
    ]);
    // So is a short first sentence, when the rest has more sentences than the English said.
    expect(
      said(
        es(
          "Dios te salve. Reina y Madre de misericordia. Vida, dulzura y esperanza nuestra.",
          "Ant. Hail, holy Queen, Mother of mercy, our life, our sweetness and our hope.",
        ),
      ),
    ).toEqual(["Dios te salve. Reina y Madre de misericordia. Vida, dulzura y esperanza nuestra."]);
    // A first sentence longer than the English label is the prayer's, even when the rest has
    // as many sentences as the English said.
    expect(
      said(
        es(
          "Dios te salve. Reina y Madre de misericordia, vida, dulzura y esperanza nuestra.",
          "Ant. Hail, holy Queen, Mother of mercy, our life, our sweetness and our hope.",
        ),
      ),
    ).toEqual(["Dios te salve. Reina y Madre de misericordia, vida, dulzura y esperanza nuestra."]);
  });

  it("says a conclusion the translator abbreviated, and not one they cut off", () => {
    expect(
      all(
        es(
          "Concede, oh Señor, a tu pueblo fiel que pueda comenzar el solemne servicio del ayuno con la debida piedad. Por medio de nuestro Señor Jesucristo, etc. Amén.",
          "Grant, O Lord, unto Thy faithful people that they may begin the solemn service of fasting with due piety. Through our Lord Jesus Christ, etc. Amen.",
        ),
      ),
    ).toBe(
      "Concede, oh Señor, a tu pueblo fiel que pueda comenzar el solemne servicio del ayuno con la debida piedad. Por medio de nuestro Señor Jesucristo. Amén.",
    );
    // "A través de" is only the opening of "Through our Lord …": nothing is said for it,
    // and no English in its place.
    expect(
      said(
        es(
          "Te rogamos, oh muy clemente Virgen María, que nos defiendas a nosotros, hermanos débiles, del peligro amenazante. A través de, &c.",
          "We pray thee, O most clement Virgin Mary, to defend us weak brethren from menacing danger. Through, &c.",
        ),
      ),
    ).toEqual([
      "Te rogamos, oh muy clemente Virgen María, que nos defiendas a nosotros, hermanos débiles, del peligro amenazante.",
    ]);
    // Nor a conclusion cut off before its close: "Who livest and reignest, &c." on the Mount
    // Carmel novena, and "Through our Lord, &c." without the Name.
    expect(
      said(
        es(
          "Concédenos, te rogamos, llegar a las alegrías eternas. Que vive y reina, &c.",
          "Grant, we beseech Thee, that we may come to everlasting joys. Who livest and reignest, &c.",
        ),
      ),
    ).toEqual(["Concédenos, te rogamos, llegar a las alegrías eternas."]);
    expect(
      said(
        es(
          "Concédele el brillo de la luz. Por medio de nuestro Señor, &c.",
          "Grant him the brightness of light. Through our Lord, &c.",
        ),
      ),
    ).toEqual(["Concédele el brillo de la luz."]);
  });

  it("never doubles a stop that ends a sentence before 'etc.'", () => {
    expect(normalizeForSpeech("¡Gloria al Padre! etc. Amén.", "es")).toBe(
      "¡Gloria al Padre! Amén.",
    );
    expect(normalizeForSpeech("¿Quién como Dios? etc. Amén.", "es")).toBe(
      "¿Quién como Dios? Amén.",
    );
  });
});

describe("the module stays safe for old Safari", () => {
  it("has no regex lookbehind", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/pray-along/speech-text.ts", "utf8");
    expect(source).not.toMatch(/\(\?<[=!]/);
  });
});

describe("a weekday over the prayer for that day", () => {
  it("is a heading, not a word of the prayer", () => {
    expect(
      said(
        en("Sunday.\nO great High-Priest, have mercy on us.\n\nMonday\nKing of virgins, hear us."),
      ),
    ).toEqual(["O great High-Priest, have mercy on us.", "King of virgins, hear us."]);
  });
});
