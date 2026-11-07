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
  LONG_STEP_PARAGRAPH,
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

  it("reads the sentences from 'Begin' to 'Conclude' as steps, one to a sentence", () => {
    expect(
      parseSequence(
        "Begin with the Sign of the Cross and the Apostles' Creed. Pray one Our Father, three Hail Marys (for an increase of faith, hope, and charity), and a Glory Be. Then meditate on each of the five mysteries in turn, praying one Our Father, ten Hail Marys, and a Glory Be for each. Conclude with the Hail Holy Queen.",
      ),
    ).toEqual({
      lead: "",
      steps: [
        {
          order: 1,
          title: null,
          body: "Begin with the Sign of the Cross and the Apostles' Creed.",
        },
        {
          order: 2,
          title: null,
          body: "Pray one Our Father, three Hail Marys (for an increase of faith, hope, and charity), and a Glory Be.",
        },
        {
          order: 3,
          title: null,
          body: "Then meditate on each of the five mysteries in turn, praying one Our Father, ten Hail Marys, and a Glory Be for each.",
        },
        { order: 4, title: null, body: "Conclude with the Hail Holy Queen." },
      ],
      trailing: "",
    });
  });

  it("keeps a lead-in and what follows the closing step out of the steps", () => {
    const parsed = parseSequence(
      "Keep the hour. Begin with silence. Read the Gospel. End with a Hail Mary. It takes ten minutes.",
    );
    expect(parsed?.lead).toBe("Keep the hour.");
    expect(parsed?.steps.map((s) => s.body)).toEqual([
      "Begin with silence.",
      "Read the Gospel.",
      "End with a Hail Mary.",
    ]);
    expect(parsed?.trailing).toBe("It takes ten minutes.");
  });

  it.each([
    [
      "'Begin' and 'Then' alone, which is how a good many counsels start",
      "Begin in the liturgy and learn the parts by heart. Then learn a small common repertoire. Sing at home.",
    ],
    ["'Begin' and 'End' with nothing between", "Begin with a prayer. End with a prayer."],
    ["a closing word before the opening one", "Finally, keep it simple. Begin with a prayer."],
    ["words in the middle of a sentence", "Before you begin, pray. Then end the day in peace."],
  ])("does not read %s as steps", (_name, text) => {
    expect(parseSequence(text)).toBeNull();
  });

  it("reads 'The First Week ... The Second Week ...', each keeping its name, whatever runs on after", () => {
    const parsed = parseSequence(
      "The shape is fixed. They open with the Foundation. The First Week considers sin. The Second Week contemplates the life of Christ. The Third Week accompanies the Passion. The Fourth Week contemplates the Resurrection. In the full form the retreatant keeps silence.",
    );
    expect(parsed?.lead).toBe("The shape is fixed. They open with the Foundation.");
    expect(parsed?.steps).toEqual([
      { order: 1, title: null, body: "The First Week considers sin." },
      { order: 2, title: null, body: "The Second Week contemplates the life of Christ." },
      { order: 3, title: null, body: "The Third Week accompanies the Passion." },
      { order: 4, title: null, body: "The Fourth Week contemplates the Resurrection." },
    ]);
    expect(parsed?.trailing).toBe("In the full form the retreatant keeps silence.");
  });

  it.each([
    [
      "parts that do not start at the first",
      "The Second Week contemplates Christ. The Third Week accompanies the Passion. The Fourth Week rejoices.",
    ],
    ["only two", "The First Week considers sin. The Second Week contemplates Christ."],
    [
      "different things counted",
      "The First Week considers sin. The Second Vatican Council taught it. The Third Order prays.",
    ],
    [
      "stations with their own colons, which keep their paragraphs",
      "The First Station: Jesus is condemned. The Second Station: He takes up his Cross. The Third Station: He falls.",
    ],
  ])("does not take %s for the parts of a sequence", (_name, text) => {
    expect(parseSequence(text)).toBeNull();
  });

  it("gives named parts their names as titles", () => {
    const parsed = parseSequence(
      "Keep it to one page and to four headings. Prayer: the fixed times and the fixed forms. Word and study: what you will read daily. Penance and asceticism: the Friday penance. Charity and duty: the works of mercy. Then obey two principles.",
    );
    expect(parsed?.parts).toBe(true);
    expect(parsed?.lead).toBe("Keep it to one page and to four headings.");
    expect(parsed?.steps).toEqual([
      { order: 1, title: "Prayer", body: "The fixed times and the fixed forms." },
      { order: 2, title: "Word and study", body: "What you will read daily." },
      { order: 3, title: "Penance and asceticism", body: "The Friday penance." },
      { order: 4, title: "Charity and duty", body: "The works of mercy." },
    ]);
    expect(parsed?.trailing).toBe("Then obey two principles.");
  });

  it("leaves a dialogue to be set as one, and two named things as a sentence", () => {
    expect(
      parseSequence(
        "The priest may then say: 'Give thanks to the Lord.' Answer: 'His mercy endures for ever.' Dismissal: 'Go in peace.'",
      ),
    ).toBeNull();
    expect(parseSequence("Prayer: the fixed times. Study: what you will read.")).toBeNull();
    expect(
      parseSequence(
        "Canon 919 says this: one is to abstain. Note this too. Water: it may be taken. Medicine: so may it.",
      ),
    ).toBeNull();
  });

  it("reads a list whose lead-in says it comes in order, and not one that only names the Order", () => {
    const parsed = parseSequence(
      "The procession forms after Mass. The usual order is: the cross with candles; the faithful; the choir; and after the Sacrament, the clergy. Custom varies.",
    );
    expect(parsed?.lead).toBe("The procession forms after Mass. The usual order is:");
    expect(parsed?.steps.map((s) => s.body)).toEqual([
      "The cross with candles",
      "The faithful",
      "The choir; and",
      "After the Sacrament, the clergy",
    ]);
    expect(parsed?.trailing).toBe("Custom varies.");
    expect(
      parseSequence(
        "It uses the Order of Celebrating Matrimony, and may be as simple as you wish: many choose a weekday; others choose a Saturday; some renew their consent at Mass.",
      ),
    ).toBeNull();
  });

  it("marks by hand what no wording could tell, and only those exact words", () => {
    const wreath =
      "Make or buy a wreath of evergreen. On the First Sunday of Advent gather the household; then light the first candle. Each evening afterwards, light the candles for the week. Keep the wreath unlit for Christmas itself.";
    const parsed = parseSequence(wreath);
    expect(parsed?.steps.map((s) => s.body)).toEqual([
      "Make or buy a wreath of evergreen.",
      "On the First Sunday of Advent gather the household; then light the first candle.",
      "Each evening afterwards, light the candles for the week.",
    ]);
    expect(parsed?.trailing).toBe("Keep the wreath unlit for Christmas itself.");
    // An edited text, or the same text in another language, reads as paragraphs.
    expect(parseSequence(wreath.replace("Make or buy a wreath", "Buy a wreath"))).toBeNull();
    expect(
      parseSequence("Haz o compra una corona. El primer domingo de Adviento, enciende la vela."),
    ).toBeNull();
  });

  it("splits one sentence where the hand-marked words open its second step", () => {
    const parsed = parseSequence(
      "Pray one Our Father and three Hail Marys in honor of each of the nine choirs of angels (nine salutations), then conclude with four Our Fathers in honor of Saints Michael, Gabriel, Raphael, and one's guardian angel, and the closing prayer to Saint Michael.",
    );
    expect(parsed?.steps.map((s) => s.body)).toEqual([
      "Pray one Our Father and three Hail Marys in honor of each of the nine choirs of angels (nine salutations)",
      "Then conclude with four Our Fathers in honor of Saints Michael, Gabriel, Raphael, and one's guardian angel, and the closing prayer to Saint Michael",
    ]);
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

  it("does not keep a paragraph long rather than leave a short one on its own", () => {
    // How to Participate in Mass kept 780 characters together: its long sentence had
    // only two short ones to go with, and a short paragraph used to cost more.
    const longSentence = `${"Stand from the chant and sit for the reading; ".repeat(14).trim()} and stand at the end.`;
    const text = `${longSentence} Standing is the posture of the risen. Each is a prayer of the body.`;
    expect(text.length).toBeGreaterThan(LONG_STEP_PARAGRAPH);
    const pieces = splitParagraphs(text, LONG_STEP_PARAGRAPH);
    expect(pieces).toEqual([
      longSentence,
      "Standing is the posture of the risen. Each is a prayer of the body.",
    ]);
  });

  it("breaks a step's text sooner than a page's, with the same words", () => {
    const sentences = Array.from(
      { length: 4 },
      (_, i) =>
        `This is sentence number ${i + 1} of a step, written out at an ordinary length here.`,
    );
    const text = [...sentences, ...sentences, sentences[0]].join(" ");
    expect(text.length).toBeGreaterThan(LONG_STEP_PARAGRAPH);
    expect(text.length).toBeLessThan(800);
    expect(splitParagraphs(text, 800)).toEqual([text]);
    const pieces = splitParagraphs(text, LONG_STEP_PARAGRAPH);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(" ")).toBe(text);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(LONG_STEP_PARAGRAPH);
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

describe("splitSpokenWords on sentences that all open the same way", () => {
  it("sets a litany a line at a time, as the Divine Praises are said", () => {
    const blocks = splitSpokenWords(
      "The minister leads the Divine Praises, the people repeating each line: 'Blessed be God. Blessed be his holy Name. Blessed be Jesus Christ, true God and true Man. Blessed be God in his angels and in his saints.'",
    );
    expect(blocks).toEqual([
      {
        kind: "text",
        text: "The minister leads the Divine Praises, the people repeating each line:",
      },
      {
        kind: "spoken",
        lines: [
          "Blessed be God.",
          "Blessed be his holy Name.",
          "Blessed be Jesus Christ, true God and true Man.",
          "Blessed be God in his angels and in his saints.",
        ],
      },
    ]);
  });

  it("leaves three alike, or sentences that differ, in one line", () => {
    const say = (words: string) => splitSpokenWords(`Then say: '${words}'`).at(-1);
    expect(say("Lord, have mercy. Lord, have mercy. Lord, have mercy.")).toEqual({
      kind: "spoken",
      lines: ["Lord, have mercy. Lord, have mercy. Lord, have mercy."],
    });
    expect(say("Blessed be God. Holy is his Name. Blessed be God. Praise him always.")).toEqual({
      kind: "spoken",
      lines: ["Blessed be God. Holy is his Name. Blessed be God. Praise him always."],
    });
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

const STEP_BODIES: [string, string][] = guideKnowledge.flatMap((e) =>
  (Array.isArray(e.payload.steps) ? (e.payload.steps as { body?: unknown }[]) : []).flatMap(
    (step, i) => text(step.body).map((t): [string, string] => [`${e.slug} step ${i + 1}`, t]),
  ),
);
const HOW_TO: [string, string][] = [
  ...spiritualPracticeKnowledge.flatMap((e) =>
    text(e.payload.instructions).map((t): [string, string] => [e.slug, t]),
  ),
  ...devotionKnowledge.flatMap((e) =>
    text(e.payload.practiceInstructions).map((t): [string, string] => [e.slug, t]),
  ),
  ...STEP_BODIES,
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

/** The pieces of a how-to in reading order, a step's own sequence included, as the page does. */
function asThePageSetsIt(value: string): string[] {
  const sequence = parseSequence(value);
  if (!sequence) return [value];
  return [
    sequence.lead,
    ...sequence.steps.flatMap((step) => [step.title ?? "", ...asThePageSetsIt(step.body)]),
    sequence.trailing,
  ];
}

describe("every curated guide, practice, devotion and novena", () => {
  it("loses and changes no word of any how-to", () => {
    expect(HOW_TO.length).toBeGreaterThan(800);
    for (const [name, value] of HOW_TO) {
      const sequence = parseSequence(value);
      const parts = asThePageSetsIt(value);
      for (const limit of [undefined, LONG_STEP_PARAGRAPH]) {
        const read = parts
          .filter(Boolean)
          .flatMap((part) => readingBlocks(part, limit))
          .map((block) => (block.kind === "text" ? block.text : block.lines.join(" ")))
          .join(" ");
        const same = sequence
          ? withoutListNumbers(words(read)) === withoutListNumbers(words(value))
          : words(read) === words(value);
        expect(same, name).toBe(true);
      }
    }
  });

  it("leaves no step with a paragraph a reader has to scroll through", () => {
    for (const [name, value] of STEP_BODIES) {
      const sequence = parseSequence(value);
      const parts = sequence
        ? [sequence.lead, ...sequence.steps.map((step) => step.body), sequence.trailing]
        : [value];
      for (const block of parts.flatMap((part) => readingBlocks(part, LONG_STEP_PARAGRAPH))) {
        if (block.kind === "text") expect(block.text.length, name).toBeLessThanOrEqual(600);
        else for (const line of block.lines) expect(line.length, name).toBeLessThanOrEqual(600);
      }
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
      // From "Begin" to "Conclude".
      "holy-rosary",
      "divine-mercy-chaplet",
      "chaplet-of-saint-joseph",
      "how-to-pray-the-liturgy-of-the-hours step 6",
      // Counted parts, named parts, and lists that say they come in order.
      "the-spiritual-exercises",
      "a-personal-rule-of-life",
      "how-to-discern-a-call-to-marriage step 4",
      "nocturnal-adoration",
      "how-to-take-part-in-a-eucharistic-procession step 3",
      "how-to-teach-a-child-the-basic-prayers step 7",
      "how-to-make-and-bless-an-advent-wreath step 3",
    ]) {
      expect(fired.has(name), name).toBe(true);
    }
    // Counsels that follow one another with no order a reader has to keep, and text
    // whose sequence words are not a sequence, stay paragraphs: a wrong list is worse.
    for (const name of [
      "keeping-sunday-holy",
      "the-eucharistic-fast",
      "spiritual-reading",
      "custody-of-the-eyes",
      "franciscan-simplicity",
      "sung-prayer-and-gregorian-chant",
      "month-of-the-holy-rosary",
      "dominican-study-as-prayer",
      "detachment-of-heart",
      "the-practice-of-silence",
      "memento-mori",
      "how-to-have-a-marriage-convalidated step 5",
      "how-to-go-to-confession step 8",
    ]) {
      expect(
        HOW_TO.some(([n]) => n === name),
        `${name} is a record`,
      ).toBe(true);
      expect(fired.has(name), name).toBe(false);
    }
  });

  // A hand-marked line that stops matching its record, because the record was edited,
  // goes back to paragraphs without a sound. This says so out loud.
  it.each([
    ["how-to-participate-in-mass step 2", 11],
    ["how-to-choose-godparents step 2", 5],
    ["preparing-for-baptism-infant step 3", 5],
    ["how-to-be-a-confirmation-sponsor step 1", 5],
    ["preparing-for-confirmation step 4", 5],
    ["how-to-choose-a-confirmation-saint-and-sponsor step 4", 5],
    ["how-to-make-a-marian-consecration step 2", 14],
    ["chaplet-of-saint-anthony", 3],
    ["chaplet-of-saint-michael", 2],
    ["little-crown-of-the-infant-jesus", 4],
    ["chaplet-of-the-blessed-sacrament", 2],
    ["advent-wreath", 3],
    ["visits-to-the-blessed-sacrament", 4],
    ["benediction-of-the-blessed-sacrament", 5],
    ["thanksgiving-after-holy-communion", 4],
    ["the-angelus", 2],
    ["las-posadas", 4],
    ["visita-iglesia-altar-of-repose", 3],
    ["devotion-to-the-five-wounds", 3],
    ["jesse-tree", 3],
    ["may-crowning-and-the-month-of-mary", 3],
    ["corpus-christi-procession", 4],
    ["spiritual-communion", 3],
    ["consecration-to-the-immaculate-heart-of-mary", 4],
    ["blessing-of-easter-food", 4],
    ["saint-josephs-table", 3],
    ["scapular-medal", 3],
    ["mental-prayer", 4],
    ["monthly-confession", 6],
    ["fraternal-correction", 4],
    ["praying-with-the-word-of-god-daily", 4],
    ["the-direction-of-intention", 3],
    ["vocal-prayer", 3],
    ["how-to-pray-the-liturgy-of-the-hours step 4", 8],
    ["how-to-pray-the-liturgy-of-the-hours step 5", 7],
    ["how-to-make-and-bless-an-advent-wreath step 4", 4],
    ["how-to-set-up-and-bless-a-nativity-scene step 3", 5],
    ["how-to-set-up-and-bless-a-nativity-scene step 5", 4],
    ["joyful-mysteries-of-the-rosary step 1", 5],
    ["luminous-mysteries-of-the-rosary step 1", 5],
    ["sorrowful-mysteries-of-the-rosary step 1", 5],
    ["glorious-mysteries-of-the-rosary step 1", 5],
    ["how-to-pray-the-rosary step 2", 3],
    ["how-to-lead-a-group-rosary step 2", 3],
    ["how-to-make-the-five-first-saturdays step 4", 3],
    ["how-to-pray-the-o-antiphons step 9", 4],
    ["how-to-pray-the-stations-of-the-cross step 3", 4],
    ["how-to-pray-the-christmas-novena step 4", 3],
    ["how-to-bless-your-home-and-use-holy-water step 2", 3],
    ["how-to-bless-your-home-and-use-holy-water step 4", 6],
    ["how-to-enthrone-the-sacred-heart-in-your-home step 3", 4],
    ["examination-of-conscience-for-children step 7", 6],
    ["how-to-make-a-first-confession step 5", 4],
    ["how-to-make-a-general-confession step 5", 3],
    ["how-to-fulfil-your-easter-duty step 4", 5],
    ["how-to-begin-and-end-the-day-with-prayer step 4", 4],
    ["how-to-request-anointing-of-the-sick step 5", 6],
    ["how-to-be-a-confirmation-sponsor step 3", 5],
    ["how-to-plan-a-catholic-funeral step 2", 3],
    ["black-scapular-of-the-seven-sorrows", 2],
    ["blue-scapular-of-the-immaculate-conception", 2],
    ["white-scapular-of-the-most-holy-trinity", 2],
    ["confraternity-of-the-most-holy-rosary", 2],
    ["medal-of-saint-benedict", 3],
    ["consecration-to-mary", 5],
    ["sign-of-the-cross-daily-devotion", 3],
    ["veneration-of-relics", 4],
    ["regina-caeli-in-eastertide", 2],
    ["perpetual-adoration", 4],
    ["contemplative-prayer", 2],
    ["praying-the-liturgy-of-the-hours", 8],
    ["praying-the-angelus", 2],
    ["carmelite-recollection", 8],
    ["family-prayer-in-the-domestic-church", 6],
    ["silent-retreat", 7],
  ])("still reads %s as %i steps", (name, count) => {
    const found = HOW_TO.find(([n]) => n === name);
    expect(found, name).toBeDefined();
    expect(parseSequence(found![1])?.steps).toHaveLength(count);
  });

  it("says what each hand-marked devotion leaves after its steps, not inside them", () => {
    const after = (name: string) => parseSequence(HOW_TO.find(([n]) => n === name)![1])?.trailing;
    expect(after("advent-wreath")).toMatch(/^Keep the wreath unlit/);
    expect(after("monthly-confession")).toMatch(/^Keeping the same confessor/);
    expect(after("fraternal-correction")).toMatch(/^Never correct in public/);
    expect(after("how-to-participate-in-mass step 2")).toMatch(/^Standing is the posture/);
    expect(after("the-spiritual-exercises")).toMatch(/^In the full thirty-day form/);
    expect(after("a-personal-rule-of-life")).toMatch(/^Then obey two principles/);
    expect(after("how-to-make-and-bless-an-advent-wreath step 4")).toMatch(
      /^Light them in the same/,
    );
    expect(after("how-to-set-up-and-bless-a-nativity-scene step 3")).toMatch(
      /^A star can be added/,
    );
    expect(after("praying-the-liturgy-of-the-hours")).toMatch(/^Say the psalms slowly/);
    expect(after("perpetual-adoration")).toMatch(/^Exposition may never/);
  });

  // This record is published without a curated source, so its words are given here.
  it("reads the Holy Hour's own order, and leaves its counsels after it", () => {
    const parsed = parseSequence(
      "Come before the Blessed Sacrament — reserved in the tabernacle or exposed in the monstrance — and adore the Lord truly present in body, blood, soul, and divinity. Begin with an act of faith and adoration; then converse with the Lord, read Scripture (lectio divina), pray the Rosary or the Liturgy of the Hours, intercede for the world, and rest in loving silence. Where the Sacrament is exposed, genuflect on both knees; if Benediction is given, adore as the Tantum Ergo is sung. The devotion is fittingly made on Thursdays in memory of Holy Thursday.",
    );
    expect(parsed?.steps.slice(1).map((step) => step.body)).toEqual([
      "Begin with an act of faith and adoration",
      "Then converse with the Lord",
      "Read Scripture (lectio divina)",
      "Pray the Rosary or the Liturgy of the Hours",
      "Intercede for the world; and",
      "Rest in loving silence.",
    ]);
    expect(parsed?.trailing).toMatch(/^Where the Sacrament is exposed/);
  });

  it("drops a joining comma or dash, and keeps the word after it, in a list set out in a sentence", () => {
    const body = (name: string) =>
      parseSequence(HOW_TO.find(([n]) => n === name)![1])!.steps.map((step) => step.body);
    expect(body("perpetual-adoration")).toEqual([
      "Begin with adoration",
      "Then thanksgiving",
      "Reparation; and",
      "Intercession, using Scripture, the rosary, or silence",
    ]);
    expect(body("praying-the-liturgy-of-the-hours")[4]).toBe(
      "The Gospel canticle — the Benedictus at Morning Prayer, the Magnificat at Evening Prayer, the Nunc Dimittis at Night Prayer",
    );
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
