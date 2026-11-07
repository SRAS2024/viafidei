/**
 * The words of the Douay-Rheims store: a scanned text whose errors reached the readings
 * page, where VoiceOver reads them aloud. The README beside the store says how they were
 * found and corrected. This pins the result, so that regenerating the store from its
 * source, or "correcting" it against a single website, cannot quietly undo it.
 *
 * tests/content/fixtures/douay-corrections.json holds every correction, every reading the
 * store keeps against drbo.org, and the readings on which the printings divide.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  comparableWords,
  displayableVerses,
  drboPage,
  explainChapter,
  parseDrboChapter,
  wordDifferences,
} from "../../scripts/lectionary/check-douay-text";
import { BOOKS, type BookCode } from "@/lib/content-shared/bible/books";
import { douayText, resolveDouayPassage } from "@/lib/content-shared/bible/dra";
import { DRA_BOOKS } from "@/lib/content-shared/bible/dra/index";
import { resolveAlternative } from "@/lib/content-shared/lectionary";

import ledger from "./fixtures/douay-corrections.json";

function verseAt(ref: string): string {
  const [book, label] = ref.split(" ");
  const [chapter, verse] = label.split(":").map(Number);
  const text = douayText(book as BookCode, chapter, verse);
  expect(text, `${ref} is not in the store`).not.toBeNull();
  return text as string;
}

describe("corrected verses, word for word", () => {
  const pinned: [string, string][] = [
    // The wrong words the page was reading aloud.
    ["PSA 102:8", "The Lord is compassionate and merciful: longsuffering and plenteous in mercy."],
    [
      "ISA 9:4",
      "For the yoke of their burden, and the rod of their shoulder, and the sceptre of their oppressor thou hast overcome, as in the day of Madian.",
    ],
    [
      "PSA 97:6",
      "With long trumpets, and sound of cornet. Make a joyful noise before the Lord our king:",
    ],
    [
      "ISA 55:2",
      "Why do you spend money for that which is not bread, and your labour for that which doth not satisfy you? Hearken diligently to me, and eat that which is good, and your soul shall be delighted in fatness.",
    ],
    [
      "ISA 55:3",
      "Incline your ear and come to me: hear and your soul shall live, and I will make an everlasting covenant with you, the faithful mercies of David.",
    ],
    [
      "BAR 3:35",
      "They were called, and they said: Here we are: and with cheerfulness they have shined forth to him that made them.",
    ],
    [
      "PSA 15:10",
      "Because thou wilt not leave my soul in hell; nor wilt thou give thy holy one to see corruption.",
    ],
    [
      "EXO 14:26",
      "And the Lord said to Moses: Stretch forth thy hand over the sea, that the waters may come again upon the Egyptians, upon their chariots and horsemen.",
    ],
    ["PSA 117:1", "Give praise to the Lord, for he is good: for his mercy endureth for ever."],
    ["MRK 14:39", "And going away again, he prayed, saying the same words."],
    [
      "MRK 14:47",
      "And one of them that stood by, drawing a sword, struck a servant of the chief priest, and cut off his ear.",
    ],
    ["MAT 28:17", "And seeing him they adored: but some doubted."],
    [
      "LUK 3:16",
      "John answered, saying unto all: I indeed baptize you with water; but there shall come one mightier than I, the latchet of whose shoes I am not worthy to loose: he shall baptize you with the Holy Ghost, and with fire:",
    ],
    [
      "ISA 61:3",
      "To appoint to the mourners of Sion, and to give them a crown for ashes, the oil of joy for mourning, a garment of praise for the spirit of grief: and they shall be called in it the mighty ones of justice, the planting of the Lord to glorify him.",
    ],
    [
      "MRK 1:10",
      "And forthwith coming up out of the water, he saw the heavens opened, and the Spirit as a dove descending, and remaining on him.",
    ],
    [
      "EXO 17:5",
      "And the Lord said to Moses: Go before the people, and take with thee of the ancients of Israel: and take in thy hand the rod wherewith thou didst strike the river, and go.",
    ],
    [
      "PSA 123:7",
      "Our soul hath been delivered as a sparrow out of the snare of the fowlers. The snare is broken, and we are delivered.",
    ],
    [
      "PSA 97:1",
      "A psalm for David himself. Sing ye to the Lord a new canticle: because he hath done wonderful things. His right hand hath wrought for him salvation, and his arm is holy.",
    ],
    // Words that were lost, or doubled.
    [
      "PSA 127:3",
      "Thy wife as a fruitful vine, on the sides of thy house. Thy children as olive plants, round about thy table.",
    ],
    ["JHN 15:9", "As the Father hath loved me, I also have loved you. Abide in my love."],
    [
      "HOS 11:1",
      "As the morning passeth, so hath the king of Israel passed away. Because Israel was a child, and I loved him: and I called my son out of Egypt.",
    ],
    [
      "ACT 10:25",
      "And it came to pass, that when Peter was come in, Cornelius came to meet him, and falling at his feet adored.",
    ],
    // A lost "a" or "I", which a check that passed over single letters could not see.
    [
      "ISA 54:6",
      "For the Lord hath called thee as a woman forsaken and mourning in spirit, and as a wife cast off from her youth, said thy God.",
    ],
    [
      "NUM 14:34",
      "According to the number of the forty days, wherein you viewed the land: a year shall be counted for a day. And forty years you shall receive your iniquities, and shall know my revenge:",
    ],
    [
      "2SA 18:14",
      "And Joab said: Not as thou wilt, but I will set upon him in thy sight. So he took three lances in his hand, and thrust them into the heart of Absalom: and whilst he yet panted for life, sticking on the oak,",
    ],
    // "Be cast" belongs to the verse before it, which is how a search near the verse missed it.
    [
      "MAT 5:30",
      "And if thy right hand scandalize thee, cut it off, and cast it from thee: for it is expedient for thee that one of thy members should perish, rather than that thy whole body go into hell.",
    ],
    // A word split or joined in the store alone, and apostrophes no printing has.
    [
      "1KI 19:11",
      "And he said to him: Go forth, and stand upon the mount before the Lord: and behold the Lord passeth, and a great and strong wind before the Lord overthrowing the mountains, and breaking the rocks in pieces: the Lord is not in the wind, and after the wind an earthquake: the Lord is not in the earthquake.",
    ],
    [
      "ISA 7:4",
      "And thou shalt say to him: See thou be quiet: fear not, and let not thy heart be afraid of the two tails of these firebrands, smoking with the wrath of the fury of Rasin king of Syria, and of the son of Romelia.",
    ],
    [
      "PSA 117:19",
      "Open ye to me the gates of justice: I will go in to them, and give praise to the Lord.",
    ],
    [
      "1KI 21:8",
      "So she wrote letters in Achab’s name, and sealed them with his ring, and sent them to the ancients, and the chief men that were in his city, and that dwelt with Naboth.",
    ],
    [
      "1SA 9:3",
      "And the asses of Cis, Saul’s father, were lost: and Cis said to his son Saul: Take one of the servants with thee, and arise, go, and seek the asses. And when they had passed through mount Ephraim,",
    ],
    // Errors drbo.org shares with the store, which only the printed editions show.
    [
      "PSA 117:16",
      "The right hand of the Lord hath wrought strength: the right hand of the Lord hath exalted me: the right hand of the Lord hath wrought strength.",
    ],
    [
      "ISA 5:4",
      "What is there that I ought to do more to my vineyard, that I have not done to it? was it that I looked that it should bring forth grapes, and it hath brought forth wild grapes?",
    ],
    [
      "EPH 1:18",
      "The eyes of your heart enlightened, that you may know what the hope is of his calling, and what are the riches of the glory of his inheritance in the saints.",
    ],
    [
      "JER 2:2",
      "Go, and cry in the ears of Jerusalem, saying: Thus saith the Lord: I have remembered thee, pitying thy youth, and the love of thy espousals, when thou followedst me in the desert, in a land that is not sown.",
    ],
    [
      "ZEC 8:23",
      "Thus saith the Lord of hosts: In those days, wherein ten men of all languages of the Gentiles shall take hold, and shall hold fast the skirt of one that is a Jew, saying: We will go with you: for we have heard that God is with you.",
    ],
    ["PHP 4:13", "I can do all things in him who strengtheneth me."],
    [
      "JHN 19:29",
      "Now there was a vessel set there full of vinegar. And they, putting a sponge full of vinegar about hyssop, put it to his mouth.",
    ],
    [
      "JOB 42:14",
      "And he called the name of one Dies, and the name of the second Cassia, and the name of the third Cornustibii.",
    ],
    // Marks where no sentence stops: a screen reader pauses at them.
    [
      "DEU 11:28",
      "A curse, if you obey not the commandments of the Lord your God, but revolt from the way which now I shew you, and walk after strange gods which you know not.",
    ],
    [
      "EPH 5:27",
      "That he might present it to himself a glorious church, not having spot or wrinkle, or any such thing; but that it should be holy, and without blemish.",
    ],
    [
      "ISA 60:5",
      "Then shalt thou see, and abound, and thy heart shall wonder and be enlarged, when the multitude of the sea shall be converted to thee, the strength of the Gentiles shall come to thee.",
    ],
    [
      "1SA 1:14",
      "And said to her: How long wilt thou be drunk? digest a little the wine, of which thou hast taken too much.",
    ],
    [
      "MAT 2:1",
      "When Jesus therefore was born in Bethlehem of Juda, in the days of king Herod, behold, there came wise men from the east to Jerusalem,",
    ],
    ["MAT 7:1", "Judge not, that you may not be judged."],
    ["MAT 26:72", "And again he denied with an oath: I know not the man."],
    [
      "2CO 12:1",
      "If I must glory (it is not expedient indeed): but I will come to visions and revelations of the Lord.",
    ],
    [
      "2CH 36:22",
      "But in the first year of Cyrus king of the Persians, to fulfill the word of the Lord, which he had spoken by the mouth of Jeremias, the Lord stirred up the heart of Cyrus king of the Persians: who commanded it to be proclaimed through all his kingdom, and by writing also, saying:",
    ],
    // Capitals every printing has, where the store had others.
    [
      "MAT 5:31",
      "And it hath been said, Whosoever shall put away his wife, let him give her a bill of divorce.",
    ],
    [
      "MAT 26:18",
      "But Jesus said: Go ye into the city to a certain man, and say to him: The master saith, My time is near at hand, with thee I make the pasch with my disciples.",
    ],
    // The same words as another verse, with its own marks. The printings have these two as
    // here, so a verse's marks can only be read at its own place in them.
    ["2TH 1:2", "Grace unto you, and peace from God our Father, and from the Lord Jesus Christ."],
    ["2CO 1:2", "Grace unto you and peace from God our Father, and from the Lord Jesus Christ."],
    [
      "HEB 2:12",
      "I will declare thy name to my brethren; in the midst of the church will I praise thee.",
    ],
    [
      "PSA 21:23",
      "I will declare thy name to my brethren: in the midst of the church will I praise thee.",
    ],
  ];

  for (const [ref, text] of pinned) {
    it(ref, () => {
      expect(verseAt(ref)).toBe(text);
    });
  }
});

describe("the ledger of corrections", () => {
  it("still stands, every entry of it", () => {
    for (const { ref, was, now } of ledger.corrections) {
      const verse = verseAt(ref);
      expect(verse, `${ref} lost "${now}"`).toContain(now);
      // A clause restored at a verse's end leaves its old ending inside the new words.
      if (!now.includes(was)) expect(verse, `${ref} has "${was}" again`).not.toContain(was);
    }
  });

  it("covers the whole correction of the verses the tables can display", () => {
    const places = ledger.corrections.filter((c) => c.displayed);
    expect(places.length).toBeGreaterThanOrEqual(514);
    const shown = displayableVerses();
    for (const { ref } of places) expect(shown.has(ref), `${ref} is not displayable`).toBe(true);
  });

  it("has every displayed correction standing in several printings, at its own place", () => {
    for (const { ref, now, printings } of ledger.corrections.filter((c) => c.displayed)) {
      expect(printings, `${ref} "${now}"`).toBeGreaterThanOrEqual(5);
    }
  });

  it("holds nothing the printings, read at the verse's own place, go against", () => {
    const wrong = (ref: string, now: string) =>
      ledger.corrections.some((c) => c.ref === ref && c.now === now);
    expect(wrong("2TH 1:2", "unto you and peace")).toBe(false);
    expect(wrong("HEB 2:12", "my brethren: in the")).toBe(false);
  });
});

describe("readings the store keeps", () => {
  it("does not take drbo.org's word where it is the odd one out", () => {
    // The printed editions have these, and drbo.org has something else.
    expect(verseAt("JHN 19:24")).toContain("they have cast lot.");
    expect(verseAt("MAT 27:20")).toContain("should ask Barabbas, and make Jesus away.");
    expect(verseAt("MAT 22:4")).toContain("my beeves and fatlings");
    expect(verseAt("JHN 16:8")).toContain("he will convince the world");
    expect(verseAt("MRK 12:1")).toContain("a place for the winefat");
  });

  it("keeps the edition's spellings", () => {
    expect(verseAt("MAT 5:43")).toContain("love thy neighbor,");
    expect(verseAt("GEN 22:2")).toContain("I will show thee");
    expect(verseAt("JER 7:5")).toContain("execute judgement between");
    expect(verseAt("MRK 16:20")).toContain("preached every where:");
    expect(verseAt("MAT 16:13")).toContain("Cesarea Philippi");
  });

  it("still has every reading the ledger says it keeps", () => {
    for (const { ref, store } of ledger.kept) {
      if (store) expect(verseAt(ref), ref).toContain(store);
    }
  });

  it("stands with the printings that hold its reading where they divide", () => {
    const named = new Set(ledger.divided.map((d) => d.ref));
    for (const ref of ["LUK 23:50", "MAT 22:12", "MAT 16:19", "MRK 8:6"]) {
      expect(named.has(ref), ref).toBe(true);
    }
    for (const { ref, store, print, holding } of ledger.divided) {
      const verse = verseAt(ref);
      expect(verse, ref).toContain(store);
      expect(verse, ref).not.toContain(print);
      // By the rule a reading stays only because a real printing holds it, and more than one
      // scan does: a lone scan could be its own slip.
      expect(holding, ref).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the store's format", () => {
  const folder = join(process.cwd(), "src/lib/content-shared/bible/dra");

  it("is still one compact line per book, as it was published", () => {
    for (const { code } of BOOKS) {
      const raw = readFileSync(join(folder, `${code}.json`), "utf8");
      expect(JSON.stringify(JSON.parse(raw)), code).toBe(raw);
      expect(Object.keys(JSON.parse(raw)), code).toEqual([
        "code",
        "name",
        "translation",
        "chapters",
      ]);
    }
  });

  it("has clean verses throughout: no stray spaces, one kind of apostrophe", () => {
    for (const { code } of BOOKS) {
      for (const [chapter, verses] of Object.entries(DRA_BOOKS[code].chapters)) {
        for (const [verse, text] of Object.entries(verses)) {
          const ref = `${code} ${chapter}:${verse}`;
          expect(text.length, ref).toBeGreaterThan(0);
          expect(text, ref).toBe(text.trim());
          expect(text, ref).not.toMatch(/ {2}| [,.:;?!]/);
          expect(text, ref).not.toContain("'");
        }
      }
    }
  });
});

describe("every verse the Lectionary tables can display", () => {
  const shown = displayableVerses();

  it("is a verse of the store, and they are the many they should be", () => {
    expect(shown.size).toBeGreaterThan(10_000);
    for (const [ref, text] of shown) expect(verseAt(ref), ref).toBe(text);
  });

  it("carries no mark where no sentence stops", () => {
    for (const [ref, text] of shown) {
      expect(text, ref).not.toMatch(/\.\s+[a-z]/);
      expect(text, ref).not.toMatch(/[,;:]\s*[,;:.]/);
    }
  });

  it("carries no stray letter left by the scan", () => {
    // Only "a", "A", "I" and "O" stand alone in English. "O" is the vocative.
    for (const [ref, text] of shown) {
      expect(text, ref).not.toMatch(/(?:^|\s)(?![aAIO](?:[\s,.:;?!]|$))[A-Za-z](?=[\s,.:;?!]|$)/);
    }
  });

  it("carries none of the scan's own words", () => {
    const scanned = new Set(
      [
        "cheerfu Iness disiples keft opress accoding broutht neighhour joyfull grieviously grevious",
        "wnat Stait Lazareth Manesses Cornustibil Sadduccees Bythynia withersoever lightening",
      ]
        .join(" ")
        .split(" "),
    );
    for (const [ref, text] of shown) {
      for (const word of text.split(/[^A-Za-z]+/)) {
        expect(scanned.has(word), `${ref}: ${word}`).toBe(false);
      }
    }
  });
});

describe("a correction reaches the reading", () => {
  it("through the resolver and the layout the page sets", () => {
    const passage = resolveDouayPassage("Is 5:1-7");
    expect(passage.text).toContain("was it that I looked that it should bring forth grapes");

    const psalm = resolveAlternative("Ps 128:1-2, 3, 4-5", "PSALM");
    expect(psalm.layout?.form).toBe("verse");
    if (psalm.layout?.form === "verse") {
      expect(psalm.layout.stanzas.flat().join(" ")).toContain(
        "Thy children as olive plants, round about thy table.",
      );
    }

    const gospel = resolveAlternative("Jn 15:9-11");
    expect(gospel.body).toContain("I also have loved you. Abide in my love.");
    // No verse moved: the Lectionary's numbering still lands where it did.
    expect(resolveDouayPassage("Ps 128:3").verses).toEqual(["127:3"]);
    expect(resolveDouayPassage("Ps 118:16").verses).toEqual(["117:16"]);
  });
});

describe("the check script's accounting", () => {
  const wordsOf = (verses: Record<string, string>) =>
    comparableWords(Object.values(verses).join(" "));
  const inMatthewTwo = (verses: Record<string, string>, page: string[]) =>
    explainChapter("MAT", "2", verses, page, ledger);

  it("excuses a verse's own entry and nothing else in that verse", () => {
    const chapter = { ...DRA_BOOKS.MAT.chapters["2"] };
    const page = wordsOf(chapter);
    // Matthew 2:8 has an entry in the ledger, "come and adore", and this is another place.
    chapter["8"] = chapter["8"].replace("diligently inquire", "diligently require");
    expect(chapter["8"]).toContain("diligently require");
    const [difference, ...rest] = inMatthewTwo(chapter, page);
    expect(rest).toEqual([]);
    expect(difference).toMatchObject({
      ref: "MAT 2:8",
      store: "require",
      page: "inquire",
      known: false,
    });
  });

  it("excuses a kept reading and nothing else in that verse", () => {
    const chapter = { ...DRA_BOOKS.JHN.chapters["19"] };
    const page = wordsOf(chapter);
    chapter["24"] = chapter["24"].replace("Let us not cut it", "Let us not cast it");
    const differences = explainChapter("JHN", "19", chapter, page, ledger);
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({ ref: "JHN 19:24", known: false });
  });

  it("knows the ledger's own places, where drbo.org has the other reading", () => {
    const stored = DRA_BOOKS.MAT.chapters["2"];
    const page = wordsOf({
      ...stored,
      "8": stored["8"].replace("come and adore", "come to adore"),
    });
    expect(inMatthewTwo(stored, page)).toMatchObject([
      { ref: "MAT 2:8", store: "and", page: "to", known: true },
    ]);

    const john = DRA_BOOKS.JHN.chapters["19"];
    const johnPage = wordsOf({ ...john, "24": john["24"].replace("cast lot.", "cast lots.") });
    expect(explainChapter("JHN", "19", john, johnPage, ledger)).toMatchObject([
      { ref: "JHN 19:24", store: "lot", page: "lots", known: true },
    ]);
  });

  it("does not excuse a reading the ledger names when the page has a different one", () => {
    const stored = DRA_BOOKS.MAT.chapters["2"];
    const page = wordsOf({
      ...stored,
      "8": stored["8"].replace("come and adore", "come or adore"),
    });
    expect(inMatthewTwo(stored, page)).toMatchObject([{ store: "and", page: "or", known: false }]);
  });

  it("does not excuse a corrected place once the store has lost the correction's words", () => {
    const chapter = { ...DRA_BOOKS.MAT.chapters["2"] };
    const page = wordsOf({
      ...chapter,
      "8": chapter["8"].replace("come and adore", "come to adore"),
    });
    chapter["8"] = chapter["8"].replace("come and adore", "come and bless");
    const differences = inMatthewTwo(chapter, page);
    expect(differences.length).toBeGreaterThan(0);
    expect(differences.every((d) => !d.known)).toBe(true);
  });
});

describe("the check script's helpers", () => {
  it("reads a drbo.org chapter without its notes or its numbering of the psalms", () => {
    const html = `<td class=textarea valign=top>
      <p><a class=vn href="/x">&nbsp;1&nbsp;</a>Bless the Lord, O my soul.
      <a class=vn href="/x">&nbsp;2&nbsp;</a>Bless the Lord: Hebrews Psalm 10</p>
      <p class=note>[1] A note that is not the text.</p>
      <p><a class=vn href="/x">&nbsp;101&nbsp;</a>And never forget.</p>
      </td><table class="booknametable"></table>`;
    expect(parseDrboChapter(html)).toEqual([
      "Bless the Lord, O my soul.",
      "Bless the Lord:",
      "And never forget.",
    ]);
  });

  it("names drbo.org's page for a chapter, in drbo.org's order of the books", () => {
    expect(drboPage("GEN", "1")).toBe("01001.htm");
    expect(drboPage("PSA", "102")).toBe("21102.htm");
    expect(drboPage("MAL", "4")).toBe("44004.htm");
    expect(drboPage("1MA", "6")).toBe("45006.htm");
    expect(drboPage("MAT", "28")).toBe("47028.htm");
    expect(drboPage("REV", "12")).toBe("73012.htm");
  });

  it("finds a changed word, a lost word and a doubled phrase", () => {
    const diff = (a: string, b: string) =>
      wordDifferences(comparableWords(a), comparableWords(b)).map((d) => [d.store, d.page]);
    expect(diff("The Lord is good", "The Lord is good")).toEqual([]);
    expect(diff("The ford is good", "The Lord is good")).toEqual([["ford", "lord"]]);
    expect(diff("his mercy his truth", "his mercy and his truth")).toEqual([["", "and"]]);
    expect(diff("came to him, came to him, and fell", "came to him, and fell")).toEqual([
      ["came to him", ""],
    ]);
  });
});
