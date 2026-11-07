/**
 * Reading structure out of running text: the steps of a how-to, paragraphs at
 * sentence ends, and the words a reader is told to say.
 *
 * The promise everything here holds to is that no word is lost or changed, so the
 * last block runs the readers over every curated guide, practice and devotion.
 */
import { describe, expect, it } from "vitest";

import { devotionKnowledge } from "@/lib/checklist/knowledge/devotions";
import { guideKnowledge } from "@/lib/checklist/knowledge/guides";
import { novenaKnowledge } from "@/lib/checklist/knowledge/novenas";
import { spiritualPracticeKnowledge } from "@/lib/checklist/knowledge/spiritual-practices";
import {
  novenaTimingFacts,
  parseSequence,
  readingBlocks,
  splitParagraphs,
  splitSpokenWords,
  toDisclosureItems,
} from "@/lib/content-shared/structured-content";

const LECTIO =
  "1. Lectio (reading): read a brief passage of Scripture slowly, twice. 2. Meditatio (meditation): reflect on a word or phrase that resonates. 3. Oratio (prayer): respond to God from the heart. 4. Contemplatio (contemplation): rest silently in God's presence. Pope Benedict XVI urged the rediscovery of Lectio Divina in Verbum Domini (2010).";

describe("parseSequence", () => {
  it("gives Lectio Divina its four movements, each named, and keeps the closing sentence after them", () => {
    expect(parseSequence(LECTIO)).toEqual({
      lead: "",
      steps: [
        {
          order: 1,
          title: "Lectio (reading)",
          body: "Read a brief passage of Scripture slowly, twice.",
        },
        {
          order: 2,
          title: "Meditatio (meditation)",
          body: "Reflect on a word or phrase that resonates.",
        },
        { order: 3, title: "Oratio (prayer)", body: "Respond to God from the heart." },
        {
          order: 4,
          title: "Contemplatio (contemplation)",
          body: "Rest silently in God's presence.",
        },
      ],
      trailing: "Pope Benedict XVI urged the rediscovery of Lectio Divina in Verbum Domini (2010).",
    });
  });

  it("keeps a lead-in before the steps and gives a step no title unless all of them have one", () => {
    const parsed = parseSequence(
      "Choose the passage the night before. Then: 1. Take a moment to recall God. 2. Enter the scene with the senses: see the persons. Do not analyse the text. 3. End with a colloquy. Repetition is part of the method.",
    );
    expect(parsed?.lead).toBe("Choose the passage the night before. Then:");
    expect(parsed?.steps.map((s) => s.title)).toEqual([null, null, null]);
    expect(parsed?.steps[1]?.body).toBe(
      "Enter the scene with the senses: see the persons. Do not analyse the text.",
    );
    expect(parsed?.trailing).toBe("Repetition is part of the method.");
  });

  it("reads numerals in brackets, and drops only the semicolons that separated them", () => {
    const parsed = parseSequence(
      "Begin with an act of contrition. Then take the sorrows in order: (1) the prophecy of Simeon (Luke 2:34-35); (2) the flight into Egypt; (3) Jesus is laid in the tomb. For each sorrow pray one Our Father.",
    );
    expect(parsed?.lead).toBe("Begin with an act of contrition. Then take the sorrows in order:");
    expect(parsed?.steps.map((s) => s.body)).toEqual([
      "The prophecy of Simeon (Luke 2:34-35)",
      "The flight into Egypt",
      "Jesus is laid in the tomb",
    ]);
    expect(parsed?.trailing).toBe("For each sorrow pray one Our Father.");
  });

  it("reads numbered lines and 'Step 1:'", () => {
    const lines = parseSequence("Do this:\n1. Kneel.\n2. Pray.\nThen rest a moment.");
    expect(lines?.steps.map((s) => s.body)).toEqual(["Kneel.", "Pray."]);
    expect(lines?.lead).toBe("Do this:");
    expect(lines?.trailing).toBe("Then rest a moment.");

    const words = parseSequence("Step 1: Kneel down. Step 2: Make the Sign of the Cross.");
    expect(words?.steps.map((s) => s.order)).toEqual([1, 2]);
    expect(words?.steps[1]?.body).toBe("Make the Sign of the Cross.");
  });

  it("reads 'First, ... Second, ... Third, ...' only when all three begin sentences in order", () => {
    const doors = parseSequence(
      "There are three good doors in. First, patronage: look for one whose patronage touches your life. Second, your own name: consider simply keeping it. Third, your story: a saint who struggled where you struggle. Make a short list.",
    );
    expect(doors?.steps).toEqual([
      { order: 1, title: "Patronage", body: "Look for one whose patronage touches your life." },
      { order: 2, title: "Your own name", body: "Consider simply keeping it." },
      { order: 3, title: "Your story", body: "A saint who struggled where you struggle." },
    ]);
    expect(doors?.trailing).toBe("Make a short list.");

    // Two are an argument, not a sequence.
    expect(
      parseSequence("Then obey two principles. First, make it small. Second, show it to a priest."),
    ).toBeNull();
    // Not ordinals at all.
    expect(
      parseSequence(
        "Keep the First Friday and the Second Vatican Council's teaching. The Third Order prays.",
      ),
    ).toBeNull();
  });

  it("counts on from an earlier step's ordinals, and keeps what each item prays", () => {
    const parsed = parseSequence(
      'Fourth: "By the intercession of Saint Michael. Amen." Our Father, three Hail Marys. Fifth: "...and the Powers. Amen." Our Father, three Hail Marys. Sixth: "...and the Virtues. Amen." Our Father, three Hail Marys.',
    );
    expect(parsed?.steps.map((s) => s.order)).toEqual([4, 5, 6]);
    expect(parsed?.steps[2]?.body).toBe(
      '"...and the Virtues. Amen." Our Father, three Hail Marys.',
    );
    expect(parsed?.trailing).toBe("");
  });

  it("reads a list the text has counted, keeping the joining 'and'", () => {
    const parsed = parseSequence(
      "Keep to it. A widely used sequence of three stations runs: the Resurrection; the road to Emmaus; and the descent of the Holy Spirit. At each station keep silence.",
    );
    expect(parsed?.steps.map((s) => s.body)).toEqual([
      "The Resurrection",
      "The road to Emmaus; and",
      "The descent of the Holy Spirit",
    ]);
    expect(parsed?.trailing).toBe("At each station keep silence.");
  });

  it("does not take 'the other six' for a count of what follows", () => {
    expect(
      parseSequence(
        "So keep the rest of the day different from the other six: a proper meal; rest; a walk; a visit; an hour with a book; time together.",
      ),
    ).toBeNull();
  });

  it.each([
    ["a scripture reference", "Read 1 Cor. 13 slowly. Then read 2 Cor. 5 and 3 John. Then pray."],
    [
      "references with verses",
      "'Give alms' (Luke 11:41). See also Matthew 18:15-17 and Psalm 130.",
    ],
    ["dates", "Born on 3 February 1917. Died on 2 May 1958. Canonized on 1 June 2000."],
    ["a year ending a sentence", "It spread in 1917. 2 February is its feast. 3 people kept it."],
    ["canon numbers", "Canon 1. The law. Canon 2. The rule. Canon 3. The norm."],
    ["a section sign", "Canon 919 §1: one is to abstain. Canon 919 §3 excuses the sick."],
    ["no. references", "The rite (no. 69) has the Creed. See nos. 1, 2 and 3 for more."],
    ["numbers out of order", "1. Kneel. 3. Pray. 2. Rise."],
    ["only two inline", "1. Kneel down. 2. Pray a while."],
    ["a list that does not open a sentence", "See chapter 1. Then chapter 2. Then chapter 3."],
    ["empty text", "   "],
  ])("does not fire on %s", (_name, text) => {
    expect(parseSequence(text)).toBeNull();
  });
});

describe("splitParagraphs", () => {
  const sentence = (n: number) =>
    `This is sentence number ${n} of a long instruction, written out at about ordinary length.`;
  const long = Array.from({ length: 12 }, (_, i) => sentence(i + 1)).join(" ");

  it("leaves text of a readable length alone", () => {
    expect(splitParagraphs("A short paragraph. Another sentence.")).toEqual([
      "A short paragraph. Another sentence.",
    ]);
  });

  it("breaks a long paragraph only at sentence ends, with the same words", () => {
    const pieces = splitParagraphs(long);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(" ")).toBe(long);
    for (const piece of pieces) {
      expect(piece.length).toBeLessThanOrEqual(640);
      expect(piece).toMatch(/\.$/);
    }
  });

  it("never breaks after an abbreviation, an initial or a short form", () => {
    const filler =
      "Keep this sentence going for a good while so that the paragraph is long. ".repeat(5);
    const tricky =
      `${filler}Pray with St. Thérèse and Fr. Faber, as in Ps. 51 and 1 Cor. 13, for e.g. a friend, and read J. H. Newman in vol. 2 of his works. ${filler}`.trim();
    const pieces = splitParagraphs(tricky);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(" ")).toBe(tricky);
    expect(
      pieces.some((p) => p.includes("Pray with St. Thérèse and Fr. Faber, as in Ps. 51")),
    ).toBe(true);
    expect(pieces.some((p) => /\b(?:St|Fr|Ps|Cor|e\.g|J|H|vol)\.$/.test(p))).toBe(false);
  });

  it("never breaks inside a quotation or brackets", () => {
    const filler =
      "Keep this sentence going for a good while so that the paragraph is long. ".repeat(6);
    const text =
      `${filler}Say: 'Bless me, Father. It has been a year. These are my sins.' (This is how it begins. Go on.) ${filler}`.trim();
    const pieces = splitParagraphs(text);
    expect(
      pieces.some((p) => p.includes("'Bless me, Father. It has been a year. These are my sins.'")),
    ).toBe(true);
    expect(pieces.some((p) => p.includes("(This is how it begins. Go on.)"))).toBe(true);
  });

  it("gives each numbered part of a walk-through its own paragraph, and the cue after them its own", () => {
    expect(
      splitParagraphs(
        "The First Station: Jesus is condemned. Ask for courage. The Second Station: He takes up his Cross. The Third Station: He falls. At each:",
      ),
    ).toEqual([
      "The First Station: Jesus is condemned. Ask for courage.",
      "The Second Station: He takes up his Cross.",
      "The Third Station: He falls.",
      "At each:",
    ]);
  });

  it("keeps the blank lines a text has and leaves its line breaks alone", () => {
    expect(splitParagraphs("One.\n\nTwo.")).toEqual(["One.", "Two."]);
    const stanza = `${"Line of a stanza that goes on for quite a while. ".repeat(14)}\nR. Amen.`;
    expect(splitParagraphs(stanza)).toEqual([stanza]);
  });
});

describe("splitSpokenWords", () => {
  it("sets apart what the reader is told to say, in place", () => {
    expect(
      splitSpokenWords(
        "Begin: 'Bless me, Father, for I have sinned. It has been [time] since my last confession. These are my sins...' Confess all mortal sins by kind and number.",
      ),
    ).toEqual([
      { kind: "text", text: "Begin:" },
      {
        kind: "spoken",
        lines: [
          "Bless me, Father, for I have sinned. It has been [time] since my last confession. These are my sins...",
        ],
      },
      { kind: "text", text: "Confess all mortal sins by kind and number." },
    ]);
  });

  it("reads straight and curly marks, and a verb of saying with no colon", () => {
    expect(splitSpokenWords("Pause and pray, “We adore you, O Christ,” and go on.")).toEqual([
      { kind: "text", text: "Pause and pray," },
      { kind: "spoken", lines: ["We adore you, O Christ,"] },
      { kind: "text", text: "and go on." },
    ]);
    expect(
      splitSpokenWords(
        'The reader says, "The word of the Lord," and you answer, "Thanks be to God."',
      ),
    ).toEqual([
      { kind: "text", text: "The reader says," },
      { kind: "spoken", lines: ["The word of the Lord,"] },
      { kind: "text", text: "and you answer," },
      { kind: "spoken", lines: ["Thanks be to God."] },
    ]);
  });

  it("keeps quotations side by side as one exchange, a line each", () => {
    expect(
      splitSpokenWords(
        "The priest greets you: 'The Lord be with you.' 'And with your spirit.' Sit down.",
      ),
    ).toEqual([
      { kind: "text", text: "The priest greets you:" },
      { kind: "spoken", lines: ["The Lord be with you.", "And with your spirit."] },
      { kind: "text", text: "Sit down." },
    ]);
  });

  it("gives a versicle and its response a line each, quoted or not", () => {
    expect(
      splitSpokenWords(
        "At the end pray: 'V. Pray for us, O holy St. Joseph. R. That we may be made worthy of the promises of Christ,' and close.",
      ),
    ).toEqual([
      { kind: "text", text: "At the end pray:" },
      {
        kind: "spoken",
        lines: [
          "V. Pray for us, O holy St. Joseph.",
          "R. That we may be made worthy of the promises of Christ,",
        ],
      },
      { kind: "text", text: "and close." },
    ]);
    expect(
      splitSpokenWords(
        "Then: V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ. Let us pray: O God, grant us this. Amen. End with the Sign of the Cross.",
      ),
    ).toEqual([
      { kind: "text", text: "Then:" },
      {
        kind: "spoken",
        lines: [
          "V. Pray for us, O holy Mother of God.",
          "R. That we may be made worthy of the promises of Christ.",
          "Let us pray: O God, grant us this. Amen.",
        ],
      },
      { kind: "text", text: "End with the Sign of the Cross." },
    ]);
  });

  it("follows a dialogue marked with R., inside the quotation or between quotations", () => {
    expect(
      splitSpokenWords(
        "It opens with the Preface dialogue: 'The Lord be with you. R. And with your spirit. Lift up your hearts. R. We lift them up to the Lord.' Then all sing.",
      ),
    ).toEqual([
      { kind: "text", text: "It opens with the Preface dialogue:" },
      {
        kind: "spoken",
        lines: [
          "The Lord be with you.",
          "R. And with your spirit.",
          "Lift up your hearts.",
          "R. We lift them up to the Lord.",
        ],
      },
      { kind: "text", text: "Then all sing." },
    ]);
    expect(
      splitSpokenWords(
        "The priest greets the people: 'The Lord be with you.' R. 'And with your spirit.' Sit.",
      ),
    ).toEqual([
      { kind: "text", text: "The priest greets the people:" },
      { kind: "spoken", lines: ["The Lord be with you.", "R. And with your spirit."] },
      { kind: "text", text: "Sit." },
    ]);
  });

  it("carries on across a joining word, and moves punctuation outside the mark with the words", () => {
    expect(
      splitSpokenWords(
        "The minister traces a cross, saying either 'Repent, and believe in the Gospel' or 'Remember that you are dust.' No response is prescribed.",
      ),
    ).toEqual([
      { kind: "text", text: "The minister traces a cross, saying either" },
      { kind: "spoken", lines: ["Repent, and believe in the Gospel"] },
      { kind: "text", text: "or" },
      { kind: "spoken", lines: ["Remember that you are dust."] },
      { kind: "text", text: "No response is prescribed." },
    ]);
    expect(
      splitSpokenWords("Pray: 'N., I baptize you in the name of the Father', with water poured."),
    ).toEqual([
      { kind: "text", text: "Pray:" },
      { kind: "spoken", lines: ["N., I baptize you in the name of the Father,"] },
      { kind: "text", text: "with water poured." },
    ]);
  });

  it.each([
    [
      "Scripture with its reference",
      "The Lord himself said: 'Give alms, and behold, everything will be clean for you' (Luke 11:41). Lent calls for it.",
    ],
    [
      "a saint's reported words",
      "St. Francis de Sales counseled: 'Have you found a director? Then thank God a thousand times.' Meet regularly.",
    ],
    [
      "a story from the Gospel",
      "The angel came, and Mary answers: 'Let it be done to me according to your word, as you have said.' Fruit of the mystery: humility.",
    ],
    ["a one-word answer", "Then all answer: 'Amen.' Sit down."],
    ["an answer in passing", "You answer 'I do' to each question."],
    ["a term", "Mortification — 'putting to death' the works of the flesh — includes small acts."],
    ["a hymn's name", "Sing a verse of 'O Come, O Come, Emmanuel' and then read the Gospel."],
    [
      "words in brackets",
      "Pray the Confiteor ('I confess to almighty God and to you') if you like.",
    ],
    [
      "several things named",
      "Pray with the new invocations: 'Guardian of the Redeemer', 'Servant of Christ', 'Patron of exiles.'",
    ],
    [
      "lower-case words",
      "It says of Mary: 'a woman clothed with the sun, with the moon under her feet.' Fruit: devotion.",
    ],
    [
      "an apostrophe",
      "Pray the Apostles' Creed and Saint Joseph's litany, as the bishops' guide asks.",
    ],
  ])("leaves %s in the running text", (_name, text) => {
    expect(splitSpokenWords(text)).toEqual([{ kind: "text", text }]);
  });

  it("finds a quotation that holds a plural possessive", () => {
    expect(
      splitSpokenWords("Pray: 'We believe the Apostles' Creed with all our hearts.' Rise."),
    ).toEqual([
      { kind: "text", text: "Pray:" },
      { kind: "spoken", lines: ["We believe the Apostles' Creed with all our hearts."] },
      { kind: "text", text: "Rise." },
    ]);
  });
});

describe("novenaTimingFacts", () => {
  it("makes two facts of a line that says when it begins and ends", () => {
    expect(novenaTimingFacts("16 March, ending on 24 March, the eve of the solemnity")).toEqual([
      { label: "Begins", value: "16 March" },
      { label: "Ends", value: "24 March, the eve of the solemnity" },
    ]);
    expect(novenaTimingFacts("29 April, ending on the eve of his feast, 8 May")).toEqual([
      { label: "Begins", value: "29 April" },
      { label: "Ends", value: "The eve of his feast, 8 May" },
    ]);
  });

  it("does not call a season or a condition a beginning", () => {
    expect(novenaTimingFacts("Any time of need")).toEqual([
      { label: "When", value: "Any time of need" },
    ]);
    expect(novenaTimingFacts("The nine days before any feast of Our Lady")).toEqual([
      { label: "When", value: "The nine days before any feast of Our Lady" },
    ]);
    expect(novenaTimingFacts("Any Tuesday, continuing on the eight Tuesdays that follow")).toEqual([
      { label: "Begins", value: "Any Tuesday, continuing on the eight Tuesdays that follow" },
    ]);
  });

  it("has nothing to say when nothing is stored", () => {
    expect(novenaTimingFacts(undefined)).toEqual([]);
    expect(novenaTimingFacts("  ")).toEqual([]);
  });
});

describe("toDisclosureItems for novena days", () => {
  it("does not print the day twice when the title already counts it", () => {
    expect(toDisclosureItems([{ day: 1, title: "Day 1", prayerText: "O God." }])).toEqual([
      { title: "Day 1", body: "O God." },
    ]);
    expect(
      toDisclosureItems([
        { day: 3, title: "Third Tuesday: Guarding the Tongue", prayerText: "O God." },
      ]),
    ).toEqual([{ title: "Third Tuesday: Guarding the Tongue", body: "O God." }]);
    expect(toDisclosureItems([{ day: 1, title: "First Fruits", prayerText: "O God." }])).toEqual([
      { eyebrow: "Day 1", title: "First Fruits", body: "O God." },
    ]);
  });

  it("paragraphs a long prayer stored as one block, with the same words", () => {
    const prayer = "O Lord, hear this petition and grant it in thy mercy, we beseech thee. "
      .repeat(14)
      .trim();
    const [item] = toDisclosureItems([{ day: 1, title: "Mercy", prayerText: prayer }])!;
    expect(item!.body).toContain("\n\n");
    expect(item!.body.replace(/\n\n/g, " ")).toBe(prayer);
  });
});

/* -------------------------------------------------- every curated record */

/** The words of a text, ignoring case, punctuation and what marks are around them. */
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A sequence's numbers become the list's own, so neither side counts them. */
const withoutListNumbers = (text: string) =>
  text
    .replace(/\b\d{1,2}\b/g, " ")
    .replace(/\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const text = (value: unknown): string[] =>
  typeof value === "string" && value.trim() ? [value] : [];

const HOW_TO: [string, string][] = [
  ...spiritualPracticeKnowledge.flatMap((e) =>
    text(e.payload.instructions).map((t): [string, string] => [e.slug, t]),
  ),
  ...devotionKnowledge.flatMap((e) =>
    text(e.payload.practiceInstructions).map((t): [string, string] => [e.slug, t]),
  ),
  ...guideKnowledge.flatMap((e) =>
    (Array.isArray(e.payload.steps) ? (e.payload.steps as { body?: unknown }[]) : []).flatMap(
      (step, i) => text(step.body).map((t): [string, string] => [`${e.slug} step ${i + 1}`, t]),
    ),
  ),
];
const PROSE: [string, string][] = [
  ...spiritualPracticeKnowledge,
  ...devotionKnowledge,
  ...novenaKnowledge,
  ...guideKnowledge,
].flatMap((e) =>
  ["background", "intro", "whenToPray"].flatMap((key) =>
    text(e.payload[key]).map((t): [string, string] => [`${e.slug} ${key}`, t]),
  ),
);

describe("every curated guide, practice, devotion and novena", () => {
  it("loses and changes no word of any how-to", () => {
    expect(HOW_TO.length).toBeGreaterThan(800);
    for (const [name, value] of HOW_TO) {
      const sequence = parseSequence(value);
      const parts = sequence
        ? [
            sequence.lead,
            ...sequence.steps.flatMap((step) => [step.title ?? "", step.body]),
            sequence.trailing,
          ]
        : [value];
      const read = parts
        .filter(Boolean)
        .flatMap((part) => readingBlocks(part))
        .map((block) => (block.kind === "text" ? block.text : block.lines.join(" ")))
        .join(" ");
      const same = sequence
        ? withoutListNumbers(words(read)) === withoutListNumbers(words(value))
        : words(read) === words(value);
      expect(same, name).toBe(true);
    }
  });

  it("loses no word of any background, and leaves no paragraph long", () => {
    expect(PROSE.length).toBeGreaterThan(300);
    for (const [name, value] of PROSE) {
      const blocks = readingBlocks(value);
      const read = blocks
        .map((block) => (block.kind === "text" ? block.text : block.lines.join(" ")))
        .join(" ");
      expect(words(read), name).toBe(words(value));
      for (const block of blocks) {
        if (block.kind === "text") expect(block.text.length, name).toBeLessThan(1000);
      }
    }
  });

  it("finds the sequences they hold", () => {
    const fired = new Set(HOW_TO.filter(([, t]) => parseSequence(t)).map(([name]) => name));
    for (const name of [
      "lectio-divina",
      "ignatian-examen",
      "ignatian-contemplation",
      "nightly-examination-of-conscience",
      "vocational-discernment",
      "chaplet-of-the-seven-sorrows",
      "stations-of-the-cross",
      "seven-sundays-of-saint-joseph",
      "three-hours-agony-tre-ore",
      "via-lucis",
      "how-to-pray-a-litany step 2",
      "how-to-pray-the-chaplet-of-saint-michael step 4",
    ]) {
      expect(fired.has(name), name).toBe(true);
    }
    for (const name of [
      "keeping-sunday-holy",
      "a-personal-rule-of-life",
      "the-eucharistic-fast",
      "fraternal-correction",
      "holy-rosary",
    ]) {
      expect(fired.has(name), name).toBe(false);
    }
  });

  it("numbers every sequence in order, with at least two steps and no empty one", () => {
    for (const [name, value] of HOW_TO) {
      const sequence = parseSequence(value);
      if (!sequence) continue;
      expect(sequence.steps.length, name).toBeGreaterThan(1);
      sequence.steps.forEach((step, i) => {
        expect(step.body.trim().length, name).toBeGreaterThan(0);
        if (i > 0) expect(step.order, name).toBe(sequence.steps[i - 1]!.order + 1);
      });
    }
  });
});
