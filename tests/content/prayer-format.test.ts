/**
 * Reading a prayer's stored text for what each line of it is.
 *
 * Two promises are held here. Nothing is lost: every published and curated prayer
 * reads back whole, in order. And when unsure it is spoken: a line that merely
 * sounds like a command stays a line of the prayer.
 */
import { describe, expect, it } from "vitest";

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import {
  parsePrayerText,
  prayerLineText,
  prayerStanzasText,
  type PrayerLine,
  type PrayerRunRole,
} from "@/lib/content-shared/prayer-format";

/** The one line a text parses to. */
function line(text: string): PrayerLine {
  const stanzas = parsePrayerText(text);
  expect(stanzas).toHaveLength(1);
  expect(stanzas[0]!.lines).toHaveLength(1);
  return stanzas[0]!.lines[0]!;
}

/** Every line of a text, in order. */
const lines = (text: string) => parsePrayerText(text).flatMap((stanza) => stanza.lines);

/** A line's runs of one role, as text. */
const runs = (l: PrayerLine, role: PrayerRunRole) =>
  l.runs.filter((run) => run.role === role).map((run) => run.text);

/** The stanzas as arrays of their lines' text. */
const shape = (text: string) =>
  parsePrayerText(text).map((stanza) => stanza.lines.map(prayerLineText));

const withoutSpace = (text: string) => text.replace(/\s+/g, "");

describe("parsePrayerText: stanzas and lines", () => {
  it("makes each stored line a line and each blank line a stanza break", () => {
    expect(shape("Our Father, who art in heaven,\nhallowed be thy name;\n\nAmen.")).toEqual([
      ["Our Father, who art in heaven,", "hallowed be thy name;"],
      ["Amen."],
    ]);
  });

  it("is not troubled by Windows line ends, stray spaces or runs of blank lines", () => {
    expect(shape("  One line.  \r\nTwo lines.\r\n \r\n\r\n\n Three lines.\n")).toEqual([
      ["One line.", "Two lines."],
      ["Three lines."],
    ]);
  });

  it("gives nothing for empty text", () => {
    expect(parsePrayerText("")).toEqual([]);
    expect(parsePrayerText(" \n\n \n")).toEqual([]);
  });

  it("finds the seams of a text stored as one run: the Angelus", () => {
    const angelus = [
      "V. The Angel of the Lord declared unto Mary.",
      "R. And she conceived of the Holy Spirit.",
      "(Hail Mary)",
      "V. Behold the handmaid of the Lord.",
      "R. Be it done unto me according to thy word.",
      "(Hail Mary)",
      "V. Pray for us, O Holy Mother of God.",
      "R. That we may be made worthy of the promises of Christ.",
      "Let us pray:",
      "Pour forth, we beseech Thee, O Lord, Thy grace into our hearts;",
      "through the same Christ Our Lord. Amen.",
    ];
    expect(shape(angelus.join("\n"))).toEqual([
      angelus.slice(0, 3),
      angelus.slice(3, 6),
      angelus.slice(6, 8),
      angelus.slice(8),
    ]);
  });

  it("sets a versicle apart from the verse before it", () => {
    expect(
      shape(
        "O clement, O loving, O sweet Virgin Mary!\nV. Pray for us, O holy Mother of God.\nR. That we may be made worthy.",
      ),
    ).toEqual([
      ["O clement, O loving, O sweet Virgin Mary!"],
      ["V. Pray for us, O holy Mother of God.", "R. That we may be made worthy."],
    ]);
  });

  it("keeps a call and its response together when no versicle mark opens it", () => {
    expect(
      shape("O most sweet Jesus, have mercy on them.\nR. Have mercy on them, O Lord."),
    ).toEqual([["O most sweet Jesus, have mercy on them.", "R. Have mercy on them, O Lord."]]);
  });

  it("does not break a sentence at an instruction inside it", () => {
    const text =
      "to hear my prayer and grant my desires,\n[here mention your request]\nthrough the merits of Our Saviour.";
    expect(shape(text)).toEqual([text.split("\n")]);
  });

  it("runs what only introduces the next stanza into it", () => {
    expect(shape("Let us pray.\n\nBless this bedroom, Lord.")).toEqual([
      ["Let us pray.", "Bless this bedroom, Lord."],
    ]);
    expect(shape("Say three times,\n\nVirgin of all virgins,")).toEqual([
      ["Say three times,", "Virgin of all virgins,"],
    ]);
    expect(shape("First Decade.\n\nThe Archangel Gabriel.")).toEqual([
      ["First Decade.", "The Archangel Gabriel."],
    ]);
  });

  it("starts a stanza at a part's name and at Let us pray", () => {
    expect(shape("A verse.\nSecond Decade.\nA verse.\nLet us pray.\nA collect.")).toEqual([
      ["A verse."],
      ["Second Decade.", "A verse."],
      ["Let us pray.", "A collect."],
    ]);
  });
});

describe("parsePrayerText: the leader and the people", () => {
  it.each([
    ["V. Lord, open my lips.", "versicle", "V.", "Lord, open my lips."],
    ["V: Lord, open my lips.", "versicle", "V:", "Lord, open my lips."],
    ["V/. Lord, open my lips.", "versicle", "V/.", "Lord, open my lips."],
    ["℣. Lord, open my lips.", "versicle", "℣.", "Lord, open my lips."],
    ["Leader: Lord, open my lips.", "versicle", "Leader:", "Lord, open my lips."],
    ["R. And my mouth shall declare.", "response", "R.", "And my mouth shall declare."],
    ["R: And my mouth shall declare.", "response", "R:", "And my mouth shall declare."],
    ["℟. And my mouth shall declare.", "response", "℟.", "And my mouth shall declare."],
    ["All: And my mouth shall declare.", "response", "All:", "And my mouth shall declare."],
    ["People: And my mouth shall declare.", "response", "People:", "And my mouth shall declare."],
    [
      "Response: And my mouth shall declare.",
      "response",
      "Response:",
      "And my mouth shall declare.",
    ],
  ])("reads %s", (text, kind, marker, words) => {
    const read = line(text);
    expect(read.kind).toBe(kind);
    expect(read.marker).toBe(marker);
    expect(read.runs.map((run) => run.text).join("")).toBe(words);
    expect(prayerLineText(read)).toBe(text);
  });

  it("sets the people's whole line as their part, and only theirs", () => {
    expect(runs(line("R. Amen."), "response")).toEqual(["Amen."]);
    expect(runs(line("V. Let us pray."), "response")).toEqual([]);
  });

  it("hangs a short marker in the margin and runs a long one in", () => {
    expect(line("V. Lord.").markerHangs).toBe(true);
    expect(line("All: Amen.").markerHangs).toBe(true);
    expect(line("3. On the single bead.").markerHangs).toBe(true);
    expect(line("Leader: Lord.").markerHangs).toBeUndefined();
    expect(line("Meditation. Thy will be done.").markerHangs).toBeUndefined();
  });

  it("does not take the fifth of a numbered list for a versicle", () => {
    expect(
      lines("IV. To the Wound in the Left Foot.\nO Jesus.\nV. To the Wound in the sacred Side."),
    ).toMatchObject([{ kind: "heading" }, { kind: "spoken" }, { kind: "heading" }]);
    // A bare number is a part's number even when it is V.
    expect(lines("IV\nO Jesus.\nV\nO Mary.").map((l) => l.kind)).toEqual([
      "heading",
      "spoken",
      "heading",
      "spoken",
    ]);
    // With no IV. before it, "V. …" is a versicle however short.
    expect(line("V. To Thee, O Lord.").kind).toBe("versicle");
  });

  it("splits a versicle and response stored on one line", () => {
    expect(shape("V. May they rest in peace. R. Amen.")).toEqual([
      ["V. May they rest in peace.", "R. Amen."],
    ]);
    expect(lines("Praise be to God the Son. R. Amen. Ave Maria.").map((l) => l.kind)).toEqual([
      "spoken",
      "response",
    ]);
  });

  it("does not split at a Roman numeral or a refrain's closing mark", () => {
    expect(line("Station V. Simon of Cyrene helps Jesus.").kind).toBe("heading");
    expect(shape("in cloud, and majesty, and awe. R.")).toHaveLength(1);
  });

  it("takes a slash for the line break it stands for, and keeps it in the text", () => {
    const [versicle, response] = lines("V. The Lord be with you. / R. And also with you.");
    expect(prayerLineText(response!)).toBe("R. And also with you.");
    expect(runs(versicle!, "separator")).toEqual([" /"]);
    expect(prayerLineText(versicle!)).toBe("V. The Lord be with you. /");
  });

  it("carries a response on to the line that finishes its sentence", () => {
    const [refrain, rest] = lines("R: Rejoice! Rejoice! O Israel,\nto thee shall come Emmanuel!");
    expect(refrain!.kind).toBe("response");
    expect(rest).toMatchObject({ kind: "response", continuation: true });
    expect(runs(rest!, "response")).toEqual(["to thee shall come Emmanuel!"]);
  });

  it("lines the closing Amen up under a marked line", () => {
    const [numbered, amen] = lines("1. By the intercession of St. Michael.\nAmen.");
    expect(numbered!.marker).toBe("1.");
    expect(amen).toMatchObject({ kind: "spoken", continuation: true });
  });

  it("marks a refrain's closing pointer as the people's", () => {
    const close = line("and teach us in her ways to go. R.");
    expect(runs(close, "response")).toEqual(["R."]);
    expect(prayerLineText(close)).toBe("and teach us in her ways to go. R.");
  });
});

describe("parsePrayerText: instructions and notes", () => {
  it.each([
    "(Hail Mary)",
    "(make your request)",
    "(Pause here and silently recall the names of the sick for whom you are praying)",
    "(And it is sprinkled with holy water.)",
    "(Repeat step 2 and 3 for all five decades).",
    "[here mention your request]",
    "{Making a prostration}",
    "Then say three times,",
    "Then say the Credo in honour of the holy Apostles.",
    "Say one Our Father in honor of each of the following leading Angels.",
    "Begin with an act of contrition.",
    "End with the Apostles' Creed.",
    "Make the Sign of the Cross and say:",
    "After five Our Fathers say the following prayer:",
    "Adore the Holy Ghost with a Pater, Ave, and Gloria; then say,",
    "Passing on from one station to another, say, or sing,",
    "The following part of the decade is repeated nine times",
    "Here the first stanza is repeated.",
    "Repeat Pater, Ave, etc., as often as needed.",
    "Pater, Ave, Gloria.",
    "Pater noster. Ave Maria.",
    "Our Father, Hail Mary, Glory Be",
    "Our Father.",
    "Our Father (silently as far as):",
    "Ave Maria thrice, and after each:",
    "Ave Maria…",
    "Glory be ....",
  ])("types %s as an instruction", (text) => {
    expect(line(text).kind).toBe("rubric");
  });

  // Every one of these opens like a command and is Scripture or prayer.
  it.each([
    "Say to Aaron and his sons: Thus shall you bless the children of Israel.",
    "Say, O wond'ring Mary, say",
    "Make me love Thee ever more and more.",
    "Make us, at Thy table seated,",
    "Then shalt thou accept the sacrifice of justice.",
    "Then Tobias sighed, and began to pray with tears,",
    "Sing, my tongue, the Saviour's glory,",
    "Sing ye to the Lord a new canticle.",
    "Pray for us, St. Jude, Apostle of Christ.",
    "Pray ye for the things that are for the peace of Jerusalem.",
    "Begin ye to the Lord with timbrels.",
    "Turn away thy face from my sins.",
    "He hath set me in a place of pasture.",
    "Hail Mary, full of grace,",
    "Our Father, who art in heaven,",
    "Glory be to Thee, O Lord.",
    "Ave, ave, ave Maria!",
    "Let those who know repeat the theme:",
    "Gloria",
    "Amen.",
    "Let us pray.",
  ])("keeps %s spoken", (text) => {
    expect(line(text).kind).toBe("spoken");
  });

  it("keeps Scripture in brackets spoken when a comma shows the sentence goes on", () => {
    const text = "(For I would willingly and readily have kissed even the steps of his feet,)";
    expect(line(text).kind).toBe("spoken");
  });

  it("numbers an instruction like any other line", () => {
    const step = line("2. Then on the Our Father Beads say the following:");
    expect(step).toMatchObject({ kind: "rubric", marker: "2.", markerHangs: true });
  });

  it("sets an instruction in brackets inside a spoken line apart", () => {
    const read = line("Most Sacred Heart of Jesus, have mercy on us. (Thrice.)");
    expect(read.kind).toBe("spoken");
    expect(runs(read, "rubric")).toEqual(["(Thrice.)"]);
    expect(runs(line("for the soul of (here express his name) our Pope."), "rubric")).toEqual([
      "(here express his name)",
    ]);
  });

  it("sets a placeholder in brackets inside a spoken line apart", () => {
    expect(runs(line("obtain for me (request). Amen."), "rubric")).toEqual(["(request)."]);
  });

  it("leaves an alternative in brackets as the words it is", () => {
    expect(runs(line("I accept willingly this sickness [or trial] from you."), "rubric")).toEqual(
      [],
    );
    expect(runs(line("Lo! beneath the species dual (Signs not things)"), "rubric")).toEqual([]);
  });

  it("sets the prayers a spoken line closes by naming apart", () => {
    const decade = line("1. The Son of God made man is born of Mary. Pater noster.");
    expect(runs(decade, "rubric")).toEqual(["Pater noster."]);
    expect(prayerLineText(decade)).toBe(
      "1. The Son of God made man is born of Mary. Pater noster.",
    );
    expect(
      runs(
        line("Spare, O Lord, spare thy people. Pater once, Ave four times, Gloria once."),
        "rubric",
      ),
    ).toEqual(["Pater once, Ave four times, Gloria once."]);
    expect(
      runs(
        line("the sorrow of Mary his most loving Mother. Pater, Ave, Requiem æternam."),
        "rubric",
      ),
    ).toEqual(["Pater, Ave, Requiem æternam."]);
  });

  it("needs a sentence to have ended before the prayers it closes by naming", () => {
    expect(runs(line("Hail, Ave Maria"), "rubric")).toEqual([]);
  });

  it("types a remark about the prayer as a note", () => {
    expect(line("Prayed on Thursdays.").kind).toBe("note");
    expect(line("To be said in reparation for blasphemies.").kind).toBe("note");
    const meditation = line("Meditation. “Do not extinguish the Spirit” (1 Thess. v, 19).");
    expect(meditation).toMatchObject({ kind: "note", marker: "Meditation." });
  });

  it("sets a closing Scripture reference apart", () => {
    const mystery = line("First Joyful Mystery: The Annunciation (Lk 1:26-27)");
    expect(runs(mystery, "note")).toEqual(["(Lk 1:26-27)"]);
    expect(runs(line("Thou art my God (St Luke iv, 1, 2)."), "note")).toEqual([
      "(St Luke iv, 1, 2).",
    ]);
    expect(runs(line("the three theological virtues (1 Cor. 13)."), "note")).toEqual([
      "(1 Cor. 13).",
    ]);
  });

  it.each([
    "First Decade.",
    "Third Mystery.",
    "First Mystery. Jesus was conceived of the Virgin Mary by the power of the Holy Ghost.",
    "Fifth Word: I thirst.",
    "Station IV. Jesus meets his Mother.",
    "II",
    "VII.",
    "II. All Angels and Saints.",
    "Antiphon",
    "Antiphon.",
    "Prayer.",
    "Prayer II",
    "Concluding prayers:",
    "Act of Faith.",
    "For Sunday.",
  ])("types %s as the name of a part", (text) => {
    expect(line(text).kind).toBe("heading");
  });

  it("runs an antiphon's name into its line", () => {
    const read = line("Ant. Into the way of peace.");
    expect(read).toMatchObject({ kind: "spoken", marker: "Ant.", markerHangs: true });
  });
});

describe("parsePrayerText: litany responses", () => {
  const litany = [
    "Holy Mary, pray for us.",
    "Holy Mother of God, pray for us.",
    "Mirror of justice, pray for us.",
  ];

  it("sets a known response apart wherever it closes a line of a litany", () => {
    for (const read of lines(litany.join("\n"))) {
      expect(runs(read, "response")).toEqual(["pray for us."]);
      expect(runs(read, "text")[0]).toMatch(/, $/);
    }
  });

  it("recognises a known response said only once, when the text is plainly a litany", () => {
    const [, , , mercy] = lines(
      [...litany, "God the Son, Redeemer of the world, have mercy on us."].join("\n"),
    );
    expect(runs(mercy!, "response")).toEqual(["have mercy on us."]);
  });

  it("recognises a response it has never seen by its repeating", () => {
    const text = [
      "From all evil, Lord, save your people.",
      "From all sin, Lord, save your people.",
      "From everlasting death, Lord, save your people.",
    ].join("\n");
    for (const read of lines(text)) {
      expect(runs(read, "response")).toEqual(["Lord, save your people."]);
    }
  });

  it("takes the whole response when part of it repeats more often", () => {
    const [first, , , other] = lines(
      [
        "From all sin, deliver us, O Jesus.",
        "From Thy wrath, deliver us, O Jesus.",
        "From everlasting death, deliver us, O Jesus.",
        "Be merciful, graciously spare us, O Jesus.",
      ].join("\n"),
    );
    expect(runs(first!, "response")).toEqual(["deliver us, O Jesus."]);
    expect(runs(other!, "response")).toEqual(["graciously spare us, O Jesus."]);
  });

  it("reads a response after a semicolon, in any case", () => {
    const text = [
      "Holy Mary; Pray for us.",
      "Mother of Christ; Pray for us.",
      "Queen of peace; Pray for us.",
    ];
    expect(runs(lines(text.join("\n"))[0]!, "response")).toEqual(["Pray for us."]);
  });

  it("reads a refrain after a colon, as in the Benedicite", () => {
    const text = [
      "O ye angels of the Lord, bless the Lord: praise and exalt him above all for ever.",
      "O ye heavens, bless the Lord: praise and exalt him above all for ever.",
      "O ye waters, bless the Lord: praise and exalt him above all for ever.",
    ];
    expect(runs(lines(text.join("\n"))[0]!, "response")).toEqual([
      "praise and exalt him above all for ever.",
    ]);
  });

  it("sets the people's half of a doubled call apart", () => {
    const kyrie = line("Lord, have mercy on us. Lord, have mercy on us.");
    expect(runs(kyrie, "text")).toEqual(["Lord, have mercy on us. "]);
    expect(runs(kyrie, "response")).toEqual(["Lord, have mercy on us."]);
    expect(runs(line("Lord have mercy; Lord have mercy."), "response")).toEqual([
      "Lord have mercy.",
    ]);
  });

  it("sets 'graciously hear us' apart with or without the call on its line", () => {
    expect(runs(line("Christ, hear us. Christ, graciously hear us."), "response")).toEqual([
      "Christ, graciously hear us.",
    ]);
    expect(
      runs(
        line("Lord, have mercy on us. Christ, hear us. Christ, graciously hear us."),
        "response",
      ),
    ).toEqual(["Christ, graciously hear us."]);
    expect(runs(line("Christ graciously hear us."), "response")).toEqual([
      "Christ graciously hear us.",
    ]);
  });

  it("sets what follows the Lamb of God apart, whatever it asks", () => {
    expect(
      runs(
        line("Lamb of God, who takes away the sins of the world, spare us, O Lord."),
        "response",
      ),
    ).toEqual(["spare us, O Lord."]);
    expect(
      runs(
        line("Lamb of God, Who takest away the sins of the world, Send us Thy Holy Ghost."),
        "response",
      ),
    ).toEqual(["Send us Thy Holy Ghost."]);
    expect(
      runs(line("Agnus Dei, qui tollis peccata mundi, parce nobis, Domine."), "response"),
    ).toEqual(["parce nobis, Domine."]);
  });

  it("prefers the known response to a longer phrase that also repeats", () => {
    const text = [
      "Pater de caelis, Deus, miserere nobis.",
      "Fili, Redemptor mundi, Deus, miserere nobis.",
      "Spiritus sancte, Deus, miserere nobis.",
    ];
    expect(runs(lines(text.join("\n"))[0]!, "response")).toEqual(["miserere nobis."]);
  });

  it("works the same in Latin", () => {
    const text = [
      "Sancta Maria, ora pro nobis.",
      "Sancte Ioseph, ora pro nobis.",
      "Lumen Patriarcharum, ora pro nobis.",
    ];
    expect(runs(lines(text.join("\n"))[2]!, "response")).toEqual(["ora pro nobis."]);
  });

  it("works the same in a language it has no words for", () => {
    const text = [
      "Santa María, ruega por nosotros.",
      "Madre de Cristo, ruega por nosotros.",
      "Reina de la paz, ruega por nosotros.",
    ];
    expect(runs(lines(text.join("\n"))[1]!, "response")).toEqual(["ruega por nosotros."]);
  });

  it("does not take the call to the Lord for an invocation", () => {
    expect(runs(line("Lord, have mercy on us."), "response")).toEqual([]);
    expect(runs(line("Christ, hear us."), "response")).toEqual([]);
  });

  it("leaves a single known phrase at the end of a prayer as its words", () => {
    expect(runs(line("Jesus, Son of David, have mercy on me."), "response")).toEqual([]);
    expect(
      runs(
        lines(
          "Protect my eyes from every harm.\n\nHeart of Jesus, Fount of all purity, have mercy on us.",
        )[1]!,
        "response",
      ),
    ).toEqual([]);
  });

  it("does not take a whole line said again for a response", () => {
    const text = Array(3).fill("Spare, O Lord, spare thy people.").join("\n\n");
    expect(runs(lines(text)[0]!, "response")).toEqual([]);
    const hymn = Array(4).fill("Ave, Ave, Ave, Maria!").join("\n");
    expect(runs(lines(hymn)[0]!, "response")).toEqual([]);
  });

  it("does not take a hymn's repeated mid-sentence phrase for a response", () => {
    const verses = [
      "Sanctus fortis, Sanctus Deus,",
      "Holy strong one, Sanctus Deus,",
      "Mighty God, Sanctus Deus,",
    ];
    expect(runs(lines(verses.join("\n"))[0]!, "response")).toEqual([]);
  });

  it("carries a response through a comma when it closes other lines", () => {
    const regina = lines(
      "Queen of Heaven, rejoice, alleluia.\nFor He whom you did merit to bear, alleluia,\nHas risen as He said, alleluia.",
    );
    expect(regina.map((l) => runs(l, "response")[0])).toEqual([
      "alleluia.",
      "alleluia,",
      "alleluia.",
    ]);
  });

  it("does not take a repeated clause of a long petition for a response", () => {
    const long =
      "O my dear and holy Patron, for the love of Jesus I implore thee to pray for me, that, as He has brought thee to heaven, so in due time He may take me to heaven also.";
    expect(runs(lines(Array(3).fill(long).join("\n\n"))[0]!, "response")).toEqual([]);
  });

  it("keeps what closes a line out of the response", () => {
    const read = lines(
      "St Bridgett, servant of God, pray for us.\nSt Bridgett, patient, pray for us.\nSt Bridgett, wonderful, pray for us. Pater, Ave, Gloria.",
    )[2]!;
    expect(runs(read, "response")).toEqual(["pray for us."]);
    expect(runs(read, "rubric")).toEqual(["Pater, Ave, Gloria."]);
  });
});

describe("parsePrayerText: signs and paragraphs", () => {
  it("marks the printed signs that are not words", () => {
    const read = line("V. May almighty God bless you, + the Father, + and the Son.");
    expect(runs(read, "symbol")).toEqual(["+", "+"]);
    expect(prayerLineText(read)).toBe(
      "V. May almighty God bless you, + the Father, + and the Son.",
    );
    expect(runs(line("R. I believe. * And in my flesh."), "symbol")).toEqual(["*"]);
    expect(runs(line("Behold the Cross of the Lord, ✠ flee ye adversaries."), "symbol")).toEqual([
      "✠",
    ]);
  });

  it("marks the rule left for a name as a sign", () => {
    expect(runs(line("Pope ____________________,"), "symbol")).toEqual(["____________________"]);
  });

  it("lets a line alone in its stanza wrap as a paragraph", () => {
    expect(line("In the name of the Father, and of the Son.").prose).toBe(true);
  });

  it("lets a long line beside one other wrap as a paragraph", () => {
    const long =
      "O God, who didst instruct the hearts of the faithful by the light of the Holy Spirit, grant us.";
    const [pray, collect] = lines(`Let us pray.\n${long}`);
    expect(pray!.prose).toBeUndefined();
    expect(collect!.prose).toBe(true);
  });

  it("hangs a run of verses however long they are", () => {
    const verse =
      "Have mercy on me, O God, according to thy great mercy, and according to the multitude of thy tender mercies.";
    for (const read of lines([verse, verse, verse].join("\n"))) {
      expect(read.prose).toBeUndefined();
    }
  });

  it("does not make a marked line a paragraph", () => {
    expect(
      line(
        "V. O God, who didst instruct the hearts of the faithful by the light of the Holy Spirit.",
      ).prose,
    ).toBeUndefined();
  });

  it("sets a note flush", () => {
    expect(line("Prayed on Thursdays.").prose).toBe(true);
  });
});

describe("parsePrayerText: nothing is lost", () => {
  it("reads back marker by marker, run by run", () => {
    const text = [
      "V. The Lord be with you. / R. And also with you.",
      "",
      "1. The Son of God is born. Pater noster.",
      "Most Sacred Heart of Jesus, have mercy on us. (Thrice.)",
      "St. Peter, pray for us.",
      "St. Paul, pray for us.",
      "St. Andrew, pray for us. Pater, Ave, Gloria.",
    ].join("\n");
    expect(withoutSpace(prayerStanzasText(parsePrayerText(text)))).toBe(withoutSpace(text));
  });

  it("keeps every word and character of every curated prayer, in order", () => {
    let checked = 0;
    for (const prayer of prayerKnowledge) {
      const payload = prayer.payload as Record<string, unknown>;
      for (const field of ["body", "latin", "greek"]) {
        const stored = payload[field];
        if (typeof stored !== "string") continue;
        expect(withoutSpace(prayerStanzasText(parsePrayerText(stored))), prayer.slug).toBe(
          withoutSpace(stored),
        );
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("never drops a run's words into a marker's gap", () => {
    const read = line("R.   And with your spirit.");
    expect(read.marker).toBe("R.");
    expect(read.runs.map((run) => run.text).join("")).toBe("And with your spirit.");
  });
});
