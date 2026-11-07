# Public-domain Scripture store (Douay-Rheims) and citation resolver

Server/worker-only module that turns a lectionary citation such as
`Ps 116:12-13, 15 and 16bc, 17-18` into Douay-Rheims text — or, when the
citation cannot be mapped onto the Douay-Rheims verse numbering with
certainty, into **no text at all** (citation only). A wrong or shifted passage
is never returned.

```ts
import { resolveDouayPassage, douayText } from "@/lib/content-shared/bible/dra";

resolveDouayPassage("Ps 98:1-6");
// {
//   text: "A psalm for David himself. Sing ye to the Lord …",
//   verses: ["97:1", "97:2", "97:3", "97:4", "97:5", "97:6"],
//   verseGroups: [["A psalm for David himself. Sing ye to the Lord …", …]],
//   bookLabel: "Psalm",
//   douayCitation: "Psalm 97:1-6 (Vulgate numbering)",
//   alignment: "remapped",
//   note: "Psalm 98 of the lectionary is Psalm 97 in the Douay-Rheims (Vulgate) numbering.",
// }

resolveDouayPassage("Sir 3:2-6, 12-14");
// { text: null, verses: [], bookLabel: "Sirach", douayCitation: "", alignment: "unverified", note: "Text withheld: …" }

douayText("JER", 9, 1); // "Who will give water to my head, …" (Douay numbering)
```

## Files

| File               | Purpose                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `dra/*.json`       | The text: 73 books, one file per book, keyed by Paratext/USFM code (`PSA.json`, `1SA.json` …). ~4.9 MB, prettier-ignored.    |
| `dra/index.ts`     | Static imports of the 73 files → `DRA_BOOKS`. Loaded once per process; bundler-safe for the Next.js server build.            |
| `books.ts`         | The 73 books: code, modern name, Douay name, every USCCB / catholic-resources.org abbreviation. `findBook`, `bookByCode`.    |
| `citation.ts`      | Pure parser: citation string → AST `{ raw, alternatives: [{ segments: [{ book, chapter, verses }] }] }`. Null, never throws. |
| `modern-verses.ts` | Modern (NAB) verse count per chapter for the 69 alignable books — the guard that detects numbering differences.              |
| `alignment.ts`     | The verified modern → Douay verse-alignment table, with the evidence read for every rule. `vulgatePsalmNumber`.              |
| `dra.ts`           | `resolveDouayPassage(citation)` and `douayText(book, chapter, verse)`.                                                       |

## Source

- **Text:** the Douay-Rheims Bible, Challoner revision, 1899 American Edition,
  as distributed by [ebible.org](https://ebible.org/find/details.php?id=engDRA)
  (`engDRA`, USFM/USX). Public domain. Converted to the JSON shape
  `{ code, name, translation, chapters: { "1": { "1": "text", … } } }`; verse
  numbers and chapter numbers are the Douay/Vulgate ones exactly as published
  (Vulgate psalm numbering, 1–4 Kings = 1–2 Samuel + 1–2 Kings, Esther's Greek
  additions as chapters 10:4–16:24, Daniel 13–14, etc.). Nothing was
  renumbered in the data; all mapping happens at resolve time.
- **Modern verse counts:** the original-language (Hebrew/Greek) versification
  the NAB and the USCCB lectionary follow (see `modern-verses.ts`).
- **Corrections:** the words are the printed Challoner text; see below. Do not
  regenerate the store from `engDRA`, which would bring the errors back.

## Corrections to the text

`engDRA` is a scan, and its errors came through to the readings page, where a
screen reader reads them aloud: "The ford is compassionate", "sound of comet",
a Psalm 127:3 with no olive plants. In November 2026 every verse the Lectionary
tables can display was checked: all 724 formularies, all cycles, every
alternative, 10,424 verses in 684 chapters.

Three witnesses were read against the store, word by word and mark by mark:

1. **Printed editions**, the authority. The OCR text of 13 scanned printings at
   archive.org, read together so that a slip in one scan is outvoted by the
   others, and read at each verse's own place in a scan, found by the words only
   that verse has and by the verses around it. Searching a scan for a verse's words
   will not do: 2 Thessalonians 1:2 has the words of 2 Corinthians 1:2 with other
   marks, Hebrews 2:12 those of Psalm 21:23, and "be cast into hell" stands in the
   verse before Matthew 5:30, where the printings have "go into hell". The scans:
   `holybibletransla00denv` (New York: Benziger, 1899);
   `holybible00balt` (Rockford: TAN, 1971); `holybibletransla00balt` and
   `holybibletransl00balt` (Baltimore: John Murphy, 1914);
   `holybibletransla00newy`, `TheHolyBible1914` and
   `theholybibletran00unknuoft` (New York: Kenedy, 1914);
   `holybibletransla00soui` (Sioux City: Fitzgibbon, 1912);
   `holybibletransla01unse` (St. Louis: Herder, 1906);
   `holybibletransla00bost` (Boston: Donahue, 1858);
   `holybibletransla00dubl` (Dublin: Duffy, 1857);
   `TheHolyBibleTranslatedFrom` (New York: Dunigan, 1844);
   `holybibletransla00chalrich` (Philadelphia: Kelly, 1821).
2. **drbo.org**, chapter by chapter. It agrees with the store in almost every
   mark, as if the two share an ancestor, so it catches what was damaged in the
   store alone and cannot see what was damaged in both.
3. **Project Gutenberg #1581**, a further reading. It has slips of its own and
   never decided anything by itself.

**The rule.** A reading is corrected when no printing holds it and the printings
agree on another, whatever drbo.org says; a lone scan that has it through its own
OCR slip does not count, such as "fire brands" broken at a line's end, or a comma
read as a full stop. A reading a printing really holds is an edition's reading,
and stays. Agreeing with drbo.org proves nothing by itself: it shares "exulted"
(Ps 117:16), "Median" (Is 9:4), "shirt" (Zec 8:23), "be cast" (Mt 5:30), the lost
"a" of Isaias 54:6 and Numbers 14:34, the lost "I" of 2 Samuel 18:14, and the loss
of whole clauses (Is 5:4, Eph 1:18) with the store, and has its own departures from
print: "cast lots" (Jn 19:24), "calves" (Mt 22:4), "convict" (Jn 16:8), "ask for
Barabbas, and take Jesus away" (Mt 27:20). Nothing was passed over for being small: a
single letter, a word split or joined, an apostrophe and a capital were read like any
other word.

**What changed.** 853 places in 786 verses, each listed in
`tests/content/fixtures/douay-corrections.json` with its old and new words,
whether drbo.org has the new reading, and how many of the 13 scans have it at that
verse's own place, marks and capitals included. Of these, 514 are in the 477 verses
a reader can reach: 382 of words (195 where drbo.org has the printed reading, 187
where it shares the error) and 132 of marks and capitals, such as a full stop in
mid-sentence, which a screen reader pauses at. The other 339 are in verses no
reading displays today, in chapters that were compared anyway or that the prayer
library quotes, whose psalms and canticles were read against the printings too.

**What was kept on purpose.** Spellings of this edition: neighbor, show, shown,
judgement, every where and everywhere, any thing and anything, today, tomorrow,
fullness, harkened, thrashingfloor, fulfill, mayest, naught, honor, labored,
skillful, Cesarea. The capital of a quoted saying ("How sayest thou, Shew us the
Father?"). The Hebrew letters that head the sections of Psalm 118. Psalm titles this
store leaves out of verse 1 and the printings have, such as those of Psalms 109,
137, 138 and 144, "Alleluia" on most of Psalms 110–118, 134, 135 and 146–150, and "A
gradual canticle" on most of Psalms 119–133, since the readings are better without
them.

Readings the printings themselves divide on stay too, by the rule, though most
printings can be against them. The ledger's `divided` list names those places on
displayable verses, with how many scans hold each side, such as "upon earth" (Mt
16:19) and "a good and just man" (Lk 23:50), which the 1821 and 1858 printings hold
and the others do not. Mark 8:6 is in that list because the store lacks a clause the
Latin has: three of the 1914 printings (`TheHolyBible1914`,
`holybibletransla00balt`, `theholybibletran00unknuoft`) open the verse "And he
commanded the multitude to sit down upon the ground", the 1821 and 1858 printings
"And he commanded the people to sit down on the ground", and the other eight scans
lack the clause, as the store does: 1844, 1857, 1899, 1906, 1912, the two other 1914
scans, and 1971.

**What was not done.** Verses outside the displayable set were corrected only
where their chapter was compared with drbo.org. Nothing shows the rest today,
but the printed editions disagree with about 1,060 more places in them, so if the
tables ever reach further, check those verses first.

**Checking again.** `tests/content/bible-dra-text.test.ts` pins the corrections,
the kept readings, the store's format and the displayable verses.
`npx tsx scripts/lectionary/check-douay-text.ts --strict` compares the displayable
verses with drbo.org again, five seconds a chapter as its robots.txt asks, and
fails on any difference the ledger does not account for. It accounts by place: a
ledger entry excuses its own words, and a new error elsewhere in the same verse is
still reported. It cannot see what the store and drbo.org share, which is what the
printed editions and the test's pins are for.

A correction here reaches the page on deploy. The worker's `DailyReading` rows
hold copies of this text from when they were written, and the readings page
ignores them in favour of what it computes; the worker's backfill rewrites them
on its next run.

## Numbering conventions

The lectionary cites the **modern** (NAB / Hebrew-based) numbering. The
Douay-Rheims follows the **Vulgate**. They differ in three ways:

1. **Psalm numbers.** Vulgate 9 = modern 9+10; Vulgate 113 = modern 114+115;
   modern 116 = Vulgate 114+115; modern 147 = Vulgate 146+147. Hence modern
   11–113 and 117–146 are numbered one lower in the Douay (modern Ps 98 =
   Douay Ps 97). Psalms 1–8 and 148–150 coincide. Both numberings count the
   superscription as verse 1, so within a psalm the verse numbers agree
   whenever the verse counts agree; the exceptions are listed in
   `alignment.ts` (Ps 2, 4, 11, 43, 56, 126, 136 have one internal split or
   merge; Ps 20 and 44 are irregular and stay unverified).
2. **Chapter boundaries** that the Vulgate draws elsewhere than the Hebrew:
   Gn 31/32, Ex 7/8, 21/22, Lv 5/6, Nm 12/13, 16/17, Dt 12/13, 22/23, 28/29,
   1 Sm 20/21, 2 Sm 18/19, 1 Kgs 4/5, 2 Kgs 11/12, 1 Chr 5/6, 2 Chr 1/2, 13/14,
   Neh 3/4, 9/10, Jb 39/40/41, Eccl 6/7, Sg 1, 5/6/7, Is 8/9, 63/64, Jer 8/9,
   Ez 20/21, Dn 5/6, 13/14, Hos 1/2, 11/12, Jl 2/3/4, Mi 4/5, Na 1/2, Hg 1/2,
   Zec 1/2, Mal 3/4, Mk 8/9. (1 Sm 23/24 and Nm 29/30 look like boundary
   cases but were verified aligned.)
3. **Verse merges/splits** inside a chapter: Gn 49, 50, Ex 40, Lv 26, Nm 11,
   20, Jos 4, 5, Wis 2, 5, 6, 9, 11, Is 45, Ez 2, Am 6, Mi 5, Mt 17, Mk 4,
   Jn 6, Acts 7, 14, 1 Thes 4, 2 Thes 2, 3 Jn, 1 Mc 1, Jb 42, and the psalms
   above.

Book names differ too (Isaias, Osee, Sophonias, 1 Paralipomenon, Canticle of
Canticles, Apocalypse …); `douayCitation` uses the Douay name. **"1 Kings" and
"2 Kings" always mean the modern books**; only "3 Kings"/"4 Kings" are accepted
as Douay aliases for them. USFM codes are not accepted as abbreviations, so
"Jud" (Judith? Judges? Jude?) is refused rather than guessed.

## Alignment policy (accuracy is non-negotiable)

For every modern verse the resolver does, in order:

1. **Unalignable books** — Sirach, Tobit, Judith — are always citation-only:
   the Vulgate recension diverges pervasively (e.g. Douay Sir 3 has 34 verses
   vs 31), so no count check can prove anything. Esther is citation-only
   except addition C (Mordecai's and Esther's prayers = Douay 13:8–18 +
   14:1–19), which was verified verse by verse.
2. **A verified rule** in `alignment.ts` covering that chapter:verse wins. Each
   rule is a local span (1:1 shift, merge, or split) and records the boundary
   text that was read in the JSON to prove it, e.g. modern Jer 8:23 "Oh, that
   my head were a spring of water" → Douay 9:1 "Who will give water to my
   head". Rules exist only where the boundary evidence was actually read.
3. **Otherwise, identity — but only if the Douay chapter has exactly the
   modern verse count** (`modern-verses.ts`; for Psalms the count of the
   Vulgate-numbered psalm). Equal counts + no rule → aligned ("exact", or
   "remapped" for a renumbered psalm). Unequal counts + no rule → the verse is
   **unverified**.
4. A Douay verse that does not exist → unverified. A citation that does not
   parse → unverified.

One unverified verse withholds the **whole** passage (`text: null`), so a
reading is never shown half-right. Partial verses (`12a`, `16bc`) include the
whole Douay verse and add a note. When a citation offers alternatives
(`Jn 20:1-9 or Lk 24:13-35`), the first is resolved and a note says so. A
second book joined by "and" (`Joel 2:12-18 and 2 Cor 5:20—6:2`) is resolved in
the same passage.

### Known unverified areas

Chapters whose Douay verse count differs from the modern count and for which
no rule was verified stay citation-only: Jos 21, Jgs 5, 21, Neh 3:1–32, 7, 12,
1 Chr 11, 12, 20, 1 Mc 1:3–4, 1:20–24, 12, 13, 2 Mc 2, 15, Jb 16, Is 46,
Jer 37, Wis 19, Sg 1:1 (the title verse the Douay lacks), Gn 49:32, Nm 25:19,
Ps 20, Ps 44 — plus all of Sirach, Tobit, Judith and Esther outside C. Add a
rule (with its evidence) to `alignment.ts` to cover one; the tests in
`tests/content/bible-dra.test.ts` validate every rule's shape and existence.

### Residual risk

For a chapter with equal counts and no rule, an internal split+merge pair
would leave the count unchanged while shifting verses in between. The
lectionary's heavily-used chapters were spot-checked (psalm openings, Dn 3,
Jn 6, Mk 9, Wis, Is 9, 45, …) and every mismatch found has a rule; this is
the accepted residual risk of a count-based guard. Every reading page also
shows the official source link for verification.

## Load strategy

`dra/index.ts` statically imports the 73 JSON files (~4.9 MB total). The
resolver is used by `lectionary.ts` (server component page + Admin Worker) —
never import it from a client component. Typecheck cost is negligible (JSON
literal types); the parsed store lives once per process.
