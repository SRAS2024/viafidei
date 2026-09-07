/**
 * Verse-alignment table: modern (NAB / USCCB lectionary, Hebrew-based)
 * chapter:verse → Douay-Rheims (Vulgate) chapter:verse.
 *
 * Every span below was verified by reading the boundary verses in the
 * vendored JSON (`dra/*.json`) and comparing them with the modern text; the
 * `evidence` string records what was read. The rules are deliberately
 * explicit and local: a span maps ONE modern verse range of ONE chapter. A
 * verse of a count-mismatched chapter that no span covers is "unverified"
 * and the resolver withholds the text rather than guessing (see dra.ts).
 *
 * Span shapes (validated by tests/content/bible-dra.test.ts):
 *   - 1:1   — `dra.length === to - from + 1`: consecutive verses, in order.
 *   - merge — `dra.length === 1` with `to > from`: several modern verses live
 *             in one Douay verse (the Douay verse is shown once).
 *   - split — `from === to` with `dra.length > 1`: one modern verse spans
 *             several Douay verses (all are shown).
 *
 * Psalms: the Vulgate merges modern 9–10 and 114–115, and splits modern 116
 * and 147; otherwise modern 11–113 and 117–146 are numbered one lower. Both
 * numberings count the superscription as verse 1, so within a psalm the verse
 * numbers agree whenever the verse counts agree. The structural cases and the
 * seven psalms with an internal split/merge are listed here; the rest are
 * mapped by `vulgatePsalmNumber` + a verse-count check in dra.ts.
 *
 * Books not listed and chapters not listed: aligned when the DRA verse count
 * equals the modern count (modern-verses.ts), otherwise unverified. Sirach,
 * Tobit and Judith (Vulgate recensions that diverge pervasively) and Esther
 * outside addition C are never resolved.
 */

import type { BookCode } from "./books";
import type { EstherAddition } from "./citation";

export type DouayRef = readonly [chapter: number, verse: number];

export interface AlignmentSpan {
  /** Modern chapter (NAB numbering); Esther's Greek additions use a letter. */
  chapter: number | EstherAddition;
  /** Inclusive modern verse range. */
  from: number;
  to: number;
  /** Douay-Rheims verses, in reading order (see shapes above). */
  dra: readonly DouayRef[];
  /** What was read in the JSON to prove the mapping. */
  evidence: string;
}

/** Modern `chapter:from-to` → Douay `draChapter:draFirst…` (1:1, consecutive). */
const shift = (
  chapter: number | EstherAddition,
  from: number,
  to: number,
  draChapter: number,
  draFirst: number,
  evidence: string,
): AlignmentSpan => {
  const dra: DouayRef[] = [];
  for (let v = from; v <= to; v++) dra.push([draChapter, draFirst + (v - from)]);
  return { chapter, from, to, dra, evidence };
};

/** Identity for `chapter:from-to` inside a chapter whose counts differ. */
const same = (chapter: number, from: number, to: number, evidence: string): AlignmentSpan =>
  shift(chapter, from, to, chapter, from, evidence);

/** A single modern verse that sits at `dra` (possibly in another chapter). */
const one = (chapter: number, verse: number, dra: DouayRef, evidence: string): AlignmentSpan => ({
  chapter,
  from: verse,
  to: verse,
  dra: [dra],
  evidence,
});

/** Several modern verses that the Douay prints as one verse. */
const merge = (
  chapter: number,
  from: number,
  to: number,
  dra: DouayRef,
  evidence: string,
): AlignmentSpan => ({ chapter, from, to, dra: [dra], evidence });

/** One modern verse that the Douay prints as several verses. */
const split = (
  chapter: number,
  verse: number,
  dra: readonly DouayRef[],
  evidence: string,
): AlignmentSpan => ({ chapter, from: verse, to: verse, dra, evidence });

export const ALIGNMENT: Partial<Record<BookCode, readonly AlignmentSpan[]>> = {
  GEN: [
    same(31, 1, 54, "DRA 31:54 'after he had offered sacrifices… they lodged there' = NAB 31:54"),
    one(32, 1, [31, 55], "DRA 31:55 'Laban arose in the night, and kissed his sons' = NAB 32:1"),
    shift(
      32,
      2,
      33,
      32,
      1,
      "DRA 32:1 'Jacob also went on the journey… angels of God met him' = NAB 32:2",
    ),
    same(49, 1, 31, "DRA 49:31 'There they buried him, and Sara his wife' = NAB 49:31"),
    one(
      49,
      33,
      [49, 32],
      "DRA 49:32 'he drew up his feet upon the bed, and died' = NAB 49:33 (NAB 49:32 is folded into DRA 49:30)",
    ),
    same(
      50,
      1,
      21,
      "DRA 50:19 'Fear not: can we resist the will of God?' / 50:21 'I will feed you and your children' = NAB 50:19, 21",
    ),
    merge(
      50,
      22,
      23,
      [50, 22],
      "DRA 50:22 'lived a hundred and ten years… born on Joseph's knees' = NAB 50:22-23",
    ),
    shift(
      50,
      24,
      26,
      50,
      23,
      "DRA 50:23 'God will visit you after my death' = NAB 50:24; DRA 50:25 'he died being a hundred and ten' = NAB 50:26",
    ),
  ],
  EXO: [
    same(7, 1, 25, "DRA 7:25 'seven days were fully ended' = NAB 7:25"),
    shift(
      7,
      26,
      29,
      8,
      1,
      "DRA 8:1 'Go in to Pharao… Let my people go' = NAB 7:26; DRA 8:4 'frogs shall come in to thee' = NAB 7:29",
    ),
    shift(
      8,
      1,
      28,
      8,
      5,
      "DRA 8:5 'Say to Aaron, Stretch forth thy hand' = NAB 8:1; DRA 8:32 'Pharao's heart was hardened' = NAB 8:28",
    ),
    same(21, 1, 36, "DRA 21:36 'if he knew that his ox was wont to push' = NAB 21:36"),
    one(21, 37, [22, 1], "DRA 22:1 'If any man steal an ox or a sheep' = NAB 21:37"),
    shift(22, 1, 30, 22, 2, "DRA 22:2 'If a thief be found breaking open a house' = NAB 22:1"),
    same(40, 1, 12, "DRA 40:12 'bring Aaron and his sons to the door… washed them' = NAB 40:12"),
    merge(
      40,
      13,
      15,
      [40, 13],
      "DRA 40:13 'holy vestments… everlasting priesthood' = NAB 40:13-15",
    ),
    shift(
      40,
      16,
      38,
      40,
      14,
      "DRA 40:14 'Moses did all that the Lord had commanded' = NAB 40:16; DRA 40:32 'cloud covered the tabernacle' = NAB 40:34; DRA 40:36 = NAB 40:38",
    ),
  ],
  LEV: [
    same(5, 1, 19, "DRA 5:19 'by mistake he trespassed against the Lord' = NAB 5:19"),
    shift(
      5,
      20,
      26,
      6,
      1,
      "DRA 6:1 'The Lord spoke to Moses' = NAB 5:20; DRA 6:7 'he shall have forgiveness' = NAB 5:26",
    ),
    shift(6, 1, 23, 6, 8, "DRA 6:8 'And the Lord spoke to Moses, saying' = NAB 6:1"),
    same(26, 1, 44, "DRA 26:44 'I did not cast them off altogether' = NAB 26:44"),
    merge(
      26,
      45,
      46,
      [26, 45],
      "DRA 26:45 'I will remember my former covenant… These are the judgments… in mount Sinai' = NAB 26:45-46",
    ),
  ],
  NUM: [
    same(11, 1, 33, "DRA 11:33 'flesh was between their teeth… great plague' = NAB 11:33"),
    merge(
      11,
      34,
      35,
      [11, 34],
      "DRA 11:34 'graves of lust… they came unto Haseroth' = NAB 11:34-35",
    ),
    same(12, 1, 15, "DRA 12:15 'Mary therefore was put out of the camp seven days' = NAB 12:15"),
    one(
      12,
      16,
      [13, 1],
      "DRA 13:1 'the people marched from Haseroth… desert of Pharan' = NAB 12:16",
    ),
    shift(
      13,
      1,
      33,
      13,
      2,
      "DRA 13:2 'there the Lord spoke to Moses' = NAB 13:1; DRA 13:34 'we seemed like locusts' = NAB 13:33",
    ),
    same(16, 1, 35, "DRA 16:35 'a fire… destroyed the two hundred and fifty men' = NAB 16:35"),
    shift(
      17,
      1,
      15,
      16,
      36,
      "DRA 16:36 'the Lord spoke to Moses' = NAB 17:1; DRA 16:50 'Aaron returned to Moses' = NAB 17:15",
    ),
    shift(
      17,
      16,
      28,
      17,
      1,
      "DRA 17:2 'take of every one of them a rod' = NAB 17:17; DRA 17:13 'Whosoever approacheth… he dieth' = NAB 17:28",
    ),
    same(
      20,
      1,
      27,
      "DRA 20:1 'Mary died there' = NAB 20:1; DRA 20:27 'they went up into mount Hor' = NAB 20:27",
    ),
    split(
      20,
      28,
      [
        [20, 28],
        [20, 29],
      ],
      "DRA 20:28 'stripped Aaron… vested Eleazar' + 20:29 'Aaron being dead… came down' = NAB 20:28",
    ),
    one(20, 29, [20, 30], "DRA 20:30 'mourned for him thirty days' = NAB 20:29"),
    same(
      25,
      1,
      18,
      "DRA 25:17 'Let the Madianites find you enemies' = NAB 25:17 (NAB 25:19 is folded into DRA 26:1)",
    ),
  ],
  DEU: [
    same(12, 1, 31, "DRA 12:31 'offering their sons and daughters' = NAB 12:31"),
    one(13, 1, [12, 32], "DRA 12:32 'neither add any thing, nor diminish' = NAB 13:1"),
    shift(13, 2, 19, 13, 1, "DRA 13:1 'If there rise in the midst of thee a prophet' = NAB 13:2"),
    same(22, 1, 29, "DRA 22:29 'fifty sides of silver' = NAB 22:29"),
    one(23, 1, [22, 30], "DRA 22:30 'No man shall take his father's wife' = NAB 23:1"),
    shift(
      23,
      2,
      26,
      23,
      1,
      "DRA 23:1 'An eunuch… shall not enter into the church of the Lord' = NAB 23:2",
    ),
    same(28, 1, 68, "DRA 28:68 'bring thee again with ships into Egypt' = NAB 28:68"),
    one(
      28,
      69,
      [29, 1],
      "DRA 29:1 'These are the words of the covenant… in the land of Moab' = NAB 28:69",
    ),
    shift(29, 1, 28, 29, 2, "DRA 29:2 'Moses called all Israel… You have seen' = NAB 29:1"),
  ],
  JOS: [
    same(4, 1, 22, "DRA 4:22 'Israel passed over this Jordan through the dry channel' = NAB 4:22"),
    split(
      4,
      23,
      [
        [4, 23],
        [4, 24],
      ],
      "DRA 4:23 'drying up the waters' + 4:24 'As he had done before in the Red Sea' = NAB 4:23",
    ),
    one(4, 24, [4, 25], "DRA 4:25 'all the people of the earth may learn' = NAB 4:24"),
    same(5, 1, 13, "DRA 5:13 'Josue… saw a man standing over against him' = NAB 5:13"),
    split(
      5,
      14,
      [
        [5, 14],
        [5, 15],
      ],
      "DRA 5:14 'I am prince of the host of the Lord' + 5:15 'Josue fell on his face' = NAB 5:14",
    ),
    one(5, 15, [5, 16], "DRA 5:16 'Loose thy shoes from off thy feet' = NAB 5:15"),
  ],
  "1SA": [
    same(20, 1, 42, "DRA 20:42 'Go in peace… The Lord be between me and thee' = NAB 20:42"),
    one(
      21,
      1,
      [20, 43],
      "DRA 20:43 'David arose, and departed: and Jonathan went into the city' = NAB 21:1",
    ),
    shift(21, 2, 16, 21, 1, "DRA 21:1 'David came to Nobe to Achimelech the priest' = NAB 21:2"),
    // 1 Sm 23/24: counts equal and verified — DRA 23:28 'Rock of division' =
    // NAB 23:28; DRA 24:1 'David went up… strong holds of Engaddi' = NAB 24:1.
  ],
  "2SA": [
    same(18, 1, 32, "DRA 18:32 'Is the young man Absalom safe?' = NAB 18:32"),
    one(19, 1, [18, 33], "DRA 18:33 'My son Absalom, Absalom my son' = NAB 19:1"),
    shift(19, 2, 44, 19, 1, "DRA 19:1 'it was told Joab, that the king wept' = NAB 19:2"),
  ],
  "1KI": [
    same(
      4,
      1,
      20,
      "DRA 4:20 'Juda and Israel were innumerable, as the sand of the sea' = NAB 4:20",
    ),
    shift(
      5,
      1,
      14,
      4,
      21,
      "DRA 4:21 'Solomon had under him all the kingdoms' = NAB 5:1; DRA 4:34 'came from all nations to hear the wisdom' = NAB 5:14",
    ),
    shift(
      5,
      15,
      32,
      5,
      1,
      "DRA 5:1 'Hiram king of Tyre sent his servants to Solomon' = NAB 5:15; DRA 5:18 'Giblians prepared timber' = NAB 5:32",
    ),
  ],
  "2KI": [
    same(11, 1, 20, "DRA 11:20 'Athalia was slain with the sword' = NAB 11:20"),
    one(12, 1, [11, 21], "DRA 11:21 'Joas was seven years old, when he began to reign' = NAB 12:1"),
    shift(
      12,
      2,
      22,
      12,
      1,
      "DRA 12:1 'In the seventh year of Jehu Joas began to reign' = NAB 12:2",
    ),
  ],
  "1CH": [
    same(5, 1, 26, "DRA 5:26 'stirred up the spirit of Phul king of the Assyrians' = NAB 5:26"),
    shift(
      5,
      27,
      41,
      6,
      1,
      "DRA 6:1 'The sons of Levi were Gerson, Caath, and Merari' = NAB 5:27; DRA 6:15 'Josedec went out, when the Lord carried away Juda' = NAB 5:41",
    ),
    shift(
      6,
      1,
      66,
      6,
      16,
      "DRA 6:16 'So the sons of Levi were Gerson, Caath, and Merari' = NAB 6:1",
    ),
  ],
  "2CH": [
    same(
      1,
      1,
      17,
      "DRA 1:17 'A chariot of four horses for six hundred pieces of silver' = NAB 1:17",
    ),
    one(
      1,
      18,
      [2, 1],
      "DRA 2:1 'Solomon determined to build a house to the name of the Lord' = NAB 1:18",
    ),
    shift(
      2,
      1,
      17,
      2,
      2,
      "DRA 2:2 'he numbered out seventy thousand men to bear burdens' = NAB 2:1",
    ),
    same(13, 1, 22, "DRA 13:22 'the rest of the acts of Abia' = NAB 13:22"),
    one(13, 23, [14, 1], "DRA 14:1 'Abia slept with his fathers… Asa his son reigned' = NAB 13:23"),
    shift(
      14,
      1,
      14,
      14,
      2,
      "DRA 14:2 'Asa did that which was good… destroyed the altars' = NAB 14:1",
    ),
  ],
  NEH: [
    shift(
      3,
      33,
      38,
      4,
      1,
      "DRA 4:1 'when Sanaballat heard that we were building the wall he was angry' = NAB 3:33; DRA 4:6 'we built the wall… unto the half thereof' = NAB 3:38",
    ),
    shift(
      4,
      1,
      17,
      4,
      7,
      "DRA 4:7 'when Sanaballat, and Tobias, and the Arabians, and the Ammonites' = NAB 4:1",
    ),
    same(9, 1, 37, "DRA 9:37 'the fruits thereof grow up for the kings' = NAB 9:37"),
    one(10, 1, [9, 38], "DRA 9:38 'we ourselves make a covenant, and write it' = NAB 10:1"),
    shift(10, 2, 40, 10, 1, "DRA 10:1 'the subscribers were Nehemias, Athersatha' = NAB 10:2"),
  ],
  "1MA": [
    same(
      1,
      1,
      2,
      "DRA 1:2 'He fought many battles, and took the strong holds of all' = NAB 1:2 (NAB 1:3-4 are re-divided as DRA 1:3-5)",
    ),
    shift(
      1,
      5,
      19,
      1,
      6,
      "DRA 1:6 'he fell down upon his bed, and knew that he should die' = NAB 1:5; DRA 1:11 'Antiochus the Illustrious… hostage at Rome… 137th year' = NAB 1:10; DRA 1:16 'made themselves prepuces' = NAB 1:15; DRA 1:20 'took the strong cities in the land of Egypt' = NAB 1:19",
    ),
    shift(
      1,
      25,
      29,
      1,
      26,
      "DRA 1:26 'great mourning in Israel' = NAB 1:25; DRA 1:30 'after two full years the king sent the chief collector' = NAB 1:29",
    ),
    split(
      1,
      30,
      [
        [1, 31],
        [1, 32],
      ],
      "DRA 1:31 'peaceable words in deceit' + 1:32 'fell upon the city suddenly' = NAB 1:30",
    ),
    shift(
      1,
      31,
      33,
      1,
      33,
      "DRA 1:33 'took the spoils of the city, and burnt it' = NAB 1:31; DRA 1:35 'built the city of David with a great and strong wall' = NAB 1:33",
    ),
    one(1, 34, [1, 36], "DRA 1:36 'placed there a sinful nation, wicked men' = NAB 1:34"),
    split(
      1,
      35,
      [
        [1, 36],
        [1, 37],
      ],
      "DRA 1:36 'stored up armour, and victuals' + 1:37 'they became a great snare' = NAB 1:35",
    ),
    shift(
      1,
      36,
      44,
      1,
      38,
      "DRA 1:38 'a place to lie in wait against the sanctuary' = NAB 1:36; DRA 1:41 'Her sanctuary was desolate like a wilderness' = NAB 1:39; DRA 1:43 'king Antiochus wrote to all his kingdom' = NAB 1:41; DRA 1:46 'sent letters… to Jerusalem, and to all the cities of Juda' = NAB 1:44",
    ),
    split(
      1,
      45,
      [
        [1, 47],
        [1, 48],
      ],
      "DRA 1:47 'forbid holocausts and sacrifices' + 1:48 'prohibit the sabbath, and the festival days' = NAB 1:45",
    ),
    shift(
      1,
      46,
      47,
      1,
      49,
      "DRA 1:49 'holy places to be profaned' = NAB 1:46; DRA 1:50 'swine's flesh to be immolated' = NAB 1:47",
    ),
    merge(
      1,
      48,
      49,
      [1, 51],
      "DRA 1:51 'leave their children uncircumcised… forget the law' = NAB 1:48-49",
    ),
    one(1, 50, [1, 52], "DRA 1:52 'whosoever would not do… should be put to death' = NAB 1:50"),
    split(
      1,
      51,
      [
        [1, 53],
        [1, 54],
      ],
      "DRA 1:53 'he wrote to his whole kingdom, and he appointed rulers' + 1:54 'commanded the cities of Juda to sacrifice' = NAB 1:51",
    ),
    shift(
      1,
      52,
      64,
      1,
      55,
      "DRA 1:55 'many of the people were gathered to them that had forsaken the law' = NAB 1:52; DRA 1:57 'fifteenth day of Casleu… abominable idol of desolation' = NAB 1:54; DRA 1:62 'five and twentieth day… sacrificed upon the altar' = NAB 1:59; DRA 1:67 'very great wrath upon the people' = NAB 1:64",
    ),
  ],
  JOB: [
    same(
      39,
      1,
      30,
      "DRA 39:1 'wild goats bring forth among the rocks' = NAB 39:1; DRA 39:30 'Her young ones shall suck up blood' = NAB 39:30",
    ),
    shift(
      40,
      1,
      5,
      39,
      31,
      "DRA 39:31 'the Lord went on, and said to Job' = NAB 40:1; DRA 39:34 'I will lay my hand upon my mouth' = NAB 40:4; DRA 39:35 = NAB 40:5",
    ),
    shift(
      40,
      6,
      32,
      40,
      1,
      "DRA 40:1 'the Lord answering Job out of the whirlwind' = NAB 40:6; DRA 40:20 'Canst thou draw out the leviathan with a hook' = NAB 40:25; DRA 40:27 'Lay thy hand upon him: remember the battle' = NAB 40:32",
    ),
    one(41, 1, [40, 28], "DRA 40:28 'Behold his hope shall fail him' = NAB 41:1"),
    shift(
      41,
      2,
      26,
      41,
      1,
      "DRA 41:1 'I will not stir him up, like one that is cruel' = NAB 41:2; DRA 41:25 'king over all the children of pride' = NAB 41:26",
    ),
    same(
      42,
      1,
      15,
      "DRA 42:1 'Then Job answered the Lord' = NAB 42:1; DRA 42:15 'their father gave them inheritance among their brethren' = NAB 42:15",
    ),
    merge(
      42,
      16,
      17,
      [42, 16],
      "DRA 42:16 'Job lived after these things, a hundred and forty years… and he died an old man' = NAB 42:16-17",
    ),
  ],
  ECC: [
    // Eccl 4/5 are aligned (counts equal): DRA 4:17 'Keep thy foot, when thou
    // goest into the house of God' = NAB 4:17; DRA 5:1 'Speak not any thing
    // rashly' = NAB 5:1.
    same(6, 1, 11, "DRA 6:11 'many words that have much vanity' = NAB 6:11"),
    one(
      6,
      12,
      [7, 1],
      "DRA 7:1 'What needeth a man to seek things that are above him… what shall be after him' = NAB 6:12",
    ),
    shift(7, 1, 29, 7, 2, "DRA 7:2 'A good name is better than precious ointments' = NAB 7:1"),
  ],
  SNG: [
    // Modern 1:1 is the title ('The Song of Songs, by Solomon'); the Douay
    // has no title verse, so 1:1 stays unverified.
    shift(
      1,
      2,
      17,
      1,
      1,
      "DRA 1:1 'Let him kiss me with the kiss of his mouth' = NAB 1:2; DRA 1:16 'beams of our houses are of cedar' = NAB 1:17",
    ),
    same(
      5,
      1,
      16,
      "DRA 5:1 'I am come into my garden, O my sister' = NAB 5:1 (DRA 5:1 also carries NAB 4:16b 'Let my beloved come into his garden'); DRA 5:16 'such is my beloved, and he is my friend' = NAB 5:16",
    ),
    one(
      6,
      1,
      [5, 17],
      "DRA 5:17 'Whither is thy beloved gone, O thou most beautiful among women?' = NAB 6:1",
    ),
    shift(
      6,
      2,
      12,
      6,
      1,
      "DRA 6:1 'My beloved is gone down into his garden' = NAB 6:2; DRA 6:11 'chariots of Aminadab' = NAB 6:12",
    ),
    one(7, 1, [6, 12], "DRA 6:12 'Return, return, O Sulamitess' = NAB 7:1"),
    shift(
      7,
      2,
      14,
      7,
      1,
      "DRA 7:1 'How beautiful are thy steps in shoes, O prince's daughter' = NAB 7:2",
    ),
  ],
  WIS: [
    same(
      2,
      1,
      23,
      "DRA 2:12 'lie in wait for the just' = NAB 2:12; DRA 2:23 'God created man incorruptible' = NAB 2:23",
    ),
    split(
      2,
      24,
      [
        [2, 24],
        [2, 25],
      ],
      "DRA 2:24 'by the envy of the devil, death came into the world' + 2:25 'they follow him that are of his side' = NAB 2:24",
    ),
    same(
      5,
      1,
      22,
      "DRA 5:1 'the just stand with great constancy' = NAB 5:1; DRA 5:22 'shafts of lightning… as from a bow well bent' = NAB 5:22",
    ),
    split(
      5,
      23,
      [
        [5, 23],
        [5, 24],
      ],
      "DRA 5:23 'thick hail… the water of the sea shall rage' + 5:24 'A mighty wind shall stand up against them' = NAB 5:23",
    ),
    shift(
      6,
      1,
      17,
      6,
      2,
      "DRA 6:2 'Hear therefore, ye kings, and understand' = NAB 6:1; DRA 6:13 'Wisdom is glorious, and never fadeth away' = NAB 6:12; DRA 6:17 'she goeth about seeking such as are worthy of her' = NAB 6:16; DRA 6:18 'the beginning of her is the most true desire of discipline' = NAB 6:17",
    ),
    merge(
      6,
      18,
      19,
      [6, 19],
      "DRA 6:19 'care of discipline is love… keeping of her laws is the firm foundation of incorruption' = NAB 6:18-19",
    ),
    same(
      6,
      20,
      22,
      "DRA 6:20 'incorruption bringeth near to God' = NAB 6:20; DRA 6:22 'If then your delight be in thrones, and sceptres' = NAB 6:22 (DRA 6:23 is a Vulgate-only line)",
    ),
    shift(
      6,
      23,
      25,
      6,
      24,
      "DRA 6:24 'what wisdom is, and what was her origin, I will declare' = NAB 6:23; DRA 6:26 'multitude of the wise is the welfare of the whole world' = NAB 6:25 (DRA 6:27 is Vulgate-only)",
    ),
    same(
      9,
      1,
      17,
      "DRA 9:1 'God of my fathers, and Lord of mercy' = NAB 9:1; DRA 9:17 'who shall know thy thought, except thou give wisdom' = NAB 9:17",
    ),
    split(
      9,
      18,
      [
        [9, 18],
        [9, 19],
      ],
      "DRA 9:18 'so the ways of them that are upon earth may be corrected' + 9:19 'by wisdom they were healed' = NAB 9:18",
    ),
    same(11, 1, 4, "DRA 11:4 'water was given them out of the high rock' = NAB 11:4"),
    split(
      11,
      5,
      [
        [11, 5],
        [11, 6],
      ],
      "DRA 11:5 'by what things their enemies were punished' + 11:6 'By the same things they in their need were benefited' = NAB 11:5",
    ),
    shift(
      11,
      6,
      26,
      11,
      7,
      "DRA 11:7 'instead of a fountain of an ever running river, thou gavest human blood' = NAB 11:6; DRA 11:20 'the very sight might kill them through fear' = NAB 11:19; DRA 11:23 'the whole world before thee is as the least grain of the balance' = NAB 11:22; DRA 11:27 'thou sparest all: because they are thine, O Lord, who lovest souls' = NAB 11:26",
    ),
  ],
  ISA: [
    same(8, 1, 22, "DRA 8:22 'look to the earth, and behold trouble and darkness' = NAB 8:22"),
    one(
      8,
      23,
      [9, 1],
      "DRA 9:1 'the land of Zabulon, and the land of Nephtali… Galilee of the Gentiles' = NAB 8:23",
    ),
    shift(
      9,
      1,
      20,
      9,
      2,
      "DRA 9:2 'The people that walked in darkness, have seen a great light' = NAB 9:1",
    ),
    same(
      45,
      1,
      22,
      "DRA 45:1 'to my anointed Cyrus' = NAB 45:1; DRA 45:8 'Drop down dew, ye heavens' = NAB 45:8; DRA 45:22 'Be converted to me… all ye ends of the earth' = NAB 45:22",
    ),
    split(
      45,
      23,
      [
        [45, 23],
        [45, 24],
      ],
      "DRA 45:23 'I have sworn by myself' + 45:24 'every knee shall be bowed to me' = NAB 45:23",
    ),
    shift(
      45,
      24,
      25,
      45,
      25,
      "DRA 45:25 'In the Lord are my justices and empire' = NAB 45:24; DRA 45:26 'all the seed of Israel be justified' = NAB 45:25",
    ),
    split(
      63,
      19,
      [
        [63, 19],
        [64, 1],
      ],
      "DRA 63:19 'We are become as in the beginning, when thou didst not rule over us' + 64:1 'That thou wouldst rend the heavens' = NAB 63:19",
    ),
    shift(
      64,
      1,
      11,
      64,
      2,
      "DRA 64:2 'They would melt as at the burning of fire' = NAB 64:1; DRA 64:12 'Wilt thou refrain thyself, O Lord' = NAB 64:11",
    ),
  ],
  JER: [
    same(8, 1, 22, "DRA 8:22 'Is there no balm in Galaad?' = NAB 8:22"),
    one(
      8,
      23,
      [9, 1],
      "DRA 9:1 'Who will give water to my head, and a fountain of tears to my eyes' = NAB 8:23",
    ),
    shift(9, 1, 25, 9, 2, "DRA 9:2 'Who will give me in the wilderness a lodging place' = NAB 9:1"),
  ],
  EZK: [
    same(
      2,
      1,
      8,
      "DRA 2:2 'the spirit entered into me' = NAB 2:2; DRA 2:8 'open thy mouth, and eat what I give thee' = NAB 2:8",
    ),
    merge(
      2,
      9,
      10,
      [2, 9],
      "DRA 2:9 'a hand was sent to me, wherein was a book rolled up… lamentations, and canticles, and woe' = NAB 2:9-10",
    ),
    same(
      20,
      1,
      44,
      "DRA 20:44 'you shall know that I am the Lord, when I shall have done well by you' = NAB 20:44",
    ),
    shift(
      21,
      1,
      5,
      20,
      45,
      "DRA 20:45 'the word of the Lord came to me' = NAB 21:1; DRA 20:49 'Doth not this man speak by parables?' = NAB 21:5",
    ),
    shift(
      21,
      6,
      37,
      21,
      1,
      "DRA 21:1 'the word of the Lord came to me' / 21:2 'set thy face toward Jerusalem' = NAB 21:6-7; DRA 21:32 'Thou shalt be fuel for the fire' = NAB 21:37",
    ),
  ],
  DAN: [
    same(
      5,
      1,
      30,
      "DRA 5:1 'Baltasar the king made a great feast' = NAB 5:1; DRA 5:30 'The same night Baltasar the Chaldean king was slain' = NAB 5:30",
    ),
    one(
      6,
      1,
      [5, 31],
      "DRA 5:31 'Darius the Mede succeeded to the kingdom, being threescore and two years old' = NAB 6:1",
    ),
    shift(
      6,
      2,
      29,
      6,
      1,
      "DRA 6:1 'appointed over the kingdom a hundred and twenty governors' = NAB 6:2; DRA 6:28 'Daniel continued unto the reign of Darius' = NAB 6:29",
    ),
    same(
      13,
      1,
      64,
      "DRA 13:1 'a man that dwelt in Babylon, and his name was Joakim' = NAB 13:1; DRA 13:64 'Daniel became great in the sight of the people' = NAB 13:64",
    ),
    one(
      14,
      1,
      [13, 65],
      "DRA 13:65 'king Astyages was gathered to his fathers, and Cyrus the Persian received his kingdom' = NAB 14:1",
    ),
    shift(
      14,
      2,
      42,
      14,
      1,
      "DRA 14:1 'Daniel was the king's guest' = NAB 14:2; DRA 14:2 'an idol called Bel' = NAB 14:3; DRA 14:41 'those that had been the cause of his destruction, he cast into the den' = NAB 14:42 (DRA 14:42 is Vulgate-only)",
    ),
  ],
  HOS: [
    same(1, 1, 9, "DRA 1:9 'Call his name, Not my people' = NAB 1:9"),
    shift(
      2,
      1,
      2,
      1,
      10,
      "DRA 1:10 'the number of the children of Israel shall be as the sand of the sea' = NAB 2:1; DRA 1:11 'children of Juda, and the children of Israel shall be gathered together' = NAB 2:2",
    ),
    shift(
      2,
      3,
      25,
      2,
      1,
      "DRA 2:1 'Say ye to your brethren: You are my people' = NAB 2:3; DRA 2:24 'I will say to that which was not my people: Thou art my people' = NAB 2:25",
    ),
    same(
      11,
      1,
      11,
      "DRA 11:1 'Israel was a child, and I loved him: and I called my son out of Egypt' = NAB 11:1 (with the tail of NAB 10:15); DRA 11:11 'fly away like a bird out of Egypt' = NAB 11:11",
    ),
    one(12, 1, [11, 12], "DRA 11:12 'Ephraim hath compassed me about with denials' = NAB 12:1"),
    shift(
      12,
      2,
      15,
      12,
      1,
      "DRA 12:1 'Ephraim feedeth on the wind' = NAB 12:2; DRA 12:14 'Ephraim hath provoked me to wrath with his bitterness' = NAB 12:15",
    ),
  ],
  JOL: [
    same(2, 1, 27, "DRA 2:27 'you shall know that I am in the midst of Israel' = NAB 2:27"),
    shift(
      3,
      1,
      5,
      2,
      28,
      "DRA 2:28 'I will pour out my spirit upon all flesh' = NAB 3:1; DRA 2:32 'every one that shall call upon the name of the Lord shall be saved' = NAB 3:5",
    ),
    shift(
      4,
      1,
      21,
      3,
      1,
      "DRA 3:1 'when I shall bring back the captivity of Juda and Jerusalem' = NAB 4:1; DRA 3:21 'the Lord will dwell in Sion' = NAB 4:21",
    ),
  ],
  AMO: [
    same(
      6,
      1,
      9,
      "DRA 6:1 'Woe to you that are wealthy in Sion' = NAB 6:1; DRA 6:4 'sleep upon beds of ivory' = NAB 6:4; DRA 6:9 'if there remain ten men in one house' = NAB 6:9",
    ),
    split(
      6,
      10,
      [
        [6, 10],
        [6, 11],
      ],
      "DRA 6:10 'a man's kinsman shall take him up… Is there yet any with thee?' + 6:11 'There is an end… Hold thy peace' = NAB 6:10",
    ),
    shift(
      6,
      11,
      14,
      6,
      12,
      "DRA 6:12 'the Lord hath commanded… strike the greater house with breaches' = NAB 6:11; DRA 6:15 'I will raise up a nation against you, O house of Israel' = NAB 6:14",
    ),
  ],
  MIC: [
    same(4, 1, 13, "DRA 4:13 'Arise, and tread, O daughter of Sion' = NAB 4:13"),
    one(
      4,
      14,
      [5, 1],
      "DRA 5:1 'they have laid siege against us, with a rod shall they strike the cheek of the judge of Israel' = NAB 4:14",
    ),
    shift(
      5,
      1,
      9,
      5,
      2,
      "DRA 5:2 'AND THOU, BETHLEHEM Ephrata' = NAB 5:1; DRA 5:5 'this man shall be our peace' = NAB 5:4; DRA 5:10 'take away thy horses… destroy thy chariots' = NAB 5:9",
    ),
    merge(
      5,
      10,
      11,
      [5, 11],
      "DRA 5:11 'destroy the cities of thy land… take away sorceries out of thy hand' = NAB 5:10-11",
    ),
    same(
      5,
      12,
      14,
      "DRA 5:12 'destroy thy graven things, and thy statues' = NAB 5:12; DRA 5:14 'execute vengeance… among all the nations that have not given ear' = NAB 5:14",
    ),
  ],
  NAM: [
    same(1, 1, 14, "DRA 1:14 'no more of thy name shall be sown' = NAB 1:14"),
    one(
      2,
      1,
      [1, 15],
      "DRA 1:15 'Behold upon the mountains the feet of him that bringeth good tidings' = NAB 2:1",
    ),
    shift(
      2,
      2,
      14,
      2,
      1,
      "DRA 2:1 'He is come up that shall destroy before thy face' = NAB 2:2; DRA 2:13 'I will burn thy chariots even to smoke' = NAB 2:14",
    ),
  ],
  HAG: [
    same(1, 1, 14, "DRA 1:14 'the Lord stirred up the spirit of Zorobabel' = NAB 1:14"),
    one(
      1,
      15,
      [2, 1],
      "DRA 2:1 'In the four and twentieth day of the month, in the sixth month' = NAB 1:15",
    ),
    shift(
      2,
      1,
      23,
      2,
      2,
      "DRA 2:2 'in the seventh month, the word of the Lord came by the hand of Aggeus' = NAB 2:1; DRA 2:24 'I will take thee, O Zorobabel… as a signet' = NAB 2:23",
    ),
  ],
  ZEC: [
    same(1, 1, 17, "DRA 1:17 'the Lord will yet comfort Sion' = NAB 1:17"),
    shift(
      2,
      1,
      4,
      1,
      18,
      "DRA 1:18 'I lifted up my eyes, and saw: and behold four horns' = NAB 2:1; DRA 1:21 'to cast down the horns of the nations' = NAB 2:4",
    ),
    shift(
      2,
      5,
      17,
      2,
      1,
      "DRA 2:1 'a man, with a measuring line in his hand' = NAB 2:5; DRA 2:13 'Let all flesh be silent at the presence of the Lord' = NAB 2:17",
    ),
  ],
  MAL: [
    same(3, 1, 18, "DRA 3:18 'see the difference between the just and the wicked' = NAB 3:18"),
    shift(
      3,
      19,
      24,
      4,
      1,
      "DRA 4:1 'the day shall come kindled as a furnace' = NAB 3:19; DRA 4:2 'the Sun of justice shall arise' = NAB 3:20; DRA 4:5 'I will send you Elias the prophet' = NAB 3:23",
    ),
  ],
  MAT: [
    same(
      17,
      1,
      13,
      "DRA 17:9 'Tell the vision to no man' = NAB 17:9; DRA 17:13 'he had spoken to them of John the Baptist' = NAB 17:13",
    ),
    merge(
      17,
      14,
      15,
      [17, 14],
      "DRA 17:14 'a man falling down on his knees… Lord, have pity on my son, for he is a lunatic' = NAB 17:14-15",
    ),
    shift(
      17,
      16,
      21,
      17,
      15,
      "DRA 17:15 'I brought him to thy disciples, and they could not cure him' = NAB 17:16; DRA 17:19 'faith as a grain of mustard seed' = NAB 17:20; DRA 17:20 'this kind is not cast out but by prayer and fasting' = the verse the NAB numbers 17:21 but omits",
    ),
    shift(
      17,
      22,
      27,
      17,
      21,
      "DRA 17:21 'The Son of man shall be betrayed into the hands of men' = NAB 17:22; DRA 17:23 'they that received the didrachmas' = NAB 17:24; DRA 17:26 'thou shalt find a stater' = NAB 17:27",
    ),
  ],
  MRK: [
    same(
      4,
      1,
      39,
      "DRA 4:35 'Let us pass over to the other side' = NAB 4:35; DRA 4:39 'Peace, be still' = NAB 4:39",
    ),
    merge(
      4,
      40,
      41,
      [4, 40],
      "DRA 4:40 'Why are you fearful?… Who is this… that both wind and sea obey him?' = NAB 4:40-41",
    ),
    same(8, 1, 38, "DRA 8:38 'he that shall be ashamed of me, and of my words' = NAB 8:38"),
    one(
      9,
      1,
      [8, 39],
      "DRA 8:39 'some of them that stand here, who shall not taste death' = NAB 9:1",
    ),
    shift(
      9,
      2,
      50,
      9,
      1,
      "DRA 9:1 'after six days Jesus taketh with him Peter and James and John' = NAB 9:2; DRA 9:48 'every one shall be salted with fire' = NAB 9:49; DRA 9:49 'Salt is good' = NAB 9:50",
    ),
  ],
  JHN: [
    same(
      6,
      1,
      50,
      "DRA 6:1 'Jesus went over the sea of Galilee' = NAB 6:1; DRA 6:48 'I am the bread of life' = NAB 6:48; DRA 6:50 'if any man eat of it, he may not die' = NAB 6:50",
    ),
    split(
      6,
      51,
      [
        [6, 51],
        [6, 52],
      ],
      "DRA 6:51 'I am the living bread which came down from heaven' + 6:52 'the bread that I will give, is my flesh, for the life of the world' = NAB 6:51",
    ),
    shift(
      6,
      52,
      71,
      6,
      53,
      "DRA 6:53 'The Jews therefore strove among themselves' = NAB 6:52; DRA 6:54 'Except you eat the flesh of the Son of man' = NAB 6:53; DRA 6:69 'Lord, to whom shall we go?' = NAB 6:68; DRA 6:72 'he meant Judas Iscariot' = NAB 6:71",
    ),
  ],
  ACT: [
    same(
      7,
      1,
      54,
      "DRA 7:54 'they were cut to the heart, and they gnashed with their teeth' = NAB 7:54",
    ),
    merge(
      7,
      55,
      56,
      [7, 55],
      "DRA 7:55 'full of the Holy Ghost… Behold, I see the heavens opened' = NAB 7:55-56",
    ),
    shift(
      7,
      57,
      60,
      7,
      56,
      "DRA 7:56 'crying out with a loud voice, stopped their ears' = NAB 7:57; DRA 7:58 'Lord Jesus, receive my spirit' = NAB 7:59; DRA 7:59 'Lord, lay not this sin to their charge' = NAB 7:60",
    ),
    same(
      14,
      1,
      5,
      "DRA 14:5 'an assault made by the Gentiles and the Jews… to stone them' = NAB 14:5",
    ),
    merge(
      14,
      6,
      7,
      [14, 6],
      "DRA 14:6 'fled to Lystra, and Derbe… and were there preaching the gospel' = NAB 14:6-7",
    ),
    shift(
      14,
      8,
      28,
      14,
      7,
      "DRA 14:7 'a certain man at Lystra, impotent in his feet' = NAB 14:8; DRA 14:18 'stoning Paul, drew him out of the city' = NAB 14:19; DRA 14:21 'through many tribulations we must enter into the kingdom of God' = NAB 14:22; DRA 14:27 'they abode no small time with the disciples' = NAB 14:28",
    ),
  ],
  "1TH": [
    same(4, 1, 10, "DRA 4:1 'we pray and beseech you in the Lord Jesus' = NAB 4:1"),
    merge(
      4,
      11,
      12,
      [4, 11],
      "DRA 4:11 'be quiet… work with your own hands… walk honestly towards them that are without' = NAB 4:11-12",
    ),
    shift(
      4,
      13,
      18,
      4,
      12,
      "DRA 4:12 'we will not have you ignorant, brethren, concerning them that are asleep' = NAB 4:13; DRA 4:17 'comfort ye one another with these words' = NAB 4:18",
    ),
  ],
  "2TH": [
    same(
      2,
      1,
      9,
      "DRA 2:3 'unless there come a revolt first, and the man of sin be revealed' = NAB 2:3; DRA 2:9 'according to the working of Satan' = NAB 2:9",
    ),
    merge(
      2,
      10,
      11,
      [2, 10],
      "DRA 2:10 'seduction of iniquity to them that perish… God shall send them the operation of error' = NAB 2:10-11",
    ),
    shift(
      2,
      12,
      17,
      2,
      11,
      "DRA 2:11 'all may be judged who have not believed the truth' = NAB 2:12; DRA 2:14 'stand fast; and hold the traditions' = NAB 2:15; DRA 2:16 'Exhort your hearts, and confirm you in every good work' = NAB 2:17",
    ),
  ],
  "3JN": [
    same(1, 1, 13, "DRA 1:13 'I would not by ink and pen write to thee' = NAB 13"),
    merge(
      1,
      14,
      15,
      [1, 14],
      "DRA 1:14 'I hope speedily to see thee… Peace be to thee. Our friends salute thee' = NAB 14-15",
    ),
  ],
  EST: [
    // Addition C (Mordecai's and Esther's prayers) = Vulgate 13:8-18 + 14:1-19,
    // verified verse by verse (11 + 19 verses on both sides).
    shift(
      "C",
      1,
      11,
      13,
      8,
      "DRA 13:8 'Mardochai besought the Lord, remembering all his works' = NAB C:1; DRA 13:12 'not out of pride and contempt… that I refused to worship the proud Aman' = NAB C:5; DRA 13:18 'all Israel… cried to the Lord, because they saw certain death hanging over their heads' = NAB C:11",
    ),
    shift(
      "C",
      12,
      30,
      14,
      1,
      "DRA 14:1 'Queen Esther also, fearing the danger… had recourse to the Lord' = NAB C:12; DRA 14:3 'O my Lord, who alone art our king, help me a desolate woman' = NAB C:14; DRA 14:12 'shew thyself to us in the time of our tribulation' = NAB C:23; DRA 14:14 'deliver us by thy hand, and help me, who have no other helper' = NAB C:25; DRA 14:19 'hear the voice of them, that have no other hope' = NAB C:30",
    ),
  ],
  PSA: [
    // Structural merges/splits (modern → Vulgate). Verse counts: modern 9+10 =
    // 21+18 = 39 = DRA 9; modern 114+115 = 8+18 = 26 = DRA 113; modern 116 =
    // 19 = DRA 114 (9) + 115 (10); modern 147 = 20 = DRA 146 (11) + 147 (9).
    same(9, 1, 21, "DRA 9:21 'Appoint, O Lord, a lawgiver over them' = NAB 9:21"),
    shift(10, 1, 18, 9, 22, "DRA 9:22 'Why, O Lord, hast thou retired afar off?' = NAB 10:1"),
    shift(
      114,
      1,
      8,
      113,
      1,
      "DRA 113:1 'When Israel went out of Egypt' = NAB 114:1; DRA 113:8 'turned the rock into pools of water' = NAB 114:8",
    ),
    shift(
      115,
      1,
      18,
      113,
      9,
      "DRA 113:9 'Not to us, O Lord, not to us; but to thy name give glory' = NAB 115:1",
    ),
    shift(
      116,
      1,
      9,
      114,
      1,
      "DRA 114:1 'I have loved, because the Lord will hear the voice of my prayer' = NAB 116:1",
    ),
    shift(116, 10, 19, 115, 1, "DRA 115:1 'I have believed, therefore have I spoken' = NAB 116:10"),
    shift(147, 1, 11, 146, 1, "DRA 146:1 'Praise ye the Lord, because psalm is good' = NAB 147:1"),
    shift(
      147,
      12,
      20,
      147,
      1,
      "DRA 147:1 'Praise the Lord, O Jerusalem: praise thy God, O Sion' = NAB 147:12",
    ),
    // Psalms with an internal split/merge (modern count ≠ DRA count).
    same(2, 1, 11, "DRA 2:11 'Serve ye the Lord with fear' = NAB 2:11"),
    split(
      2,
      12,
      [
        [2, 12],
        [2, 13],
      ],
      "DRA 2:12 'Embrace discipline, lest… the Lord be angry' + 2:13 'blessed are all they that trust in him' = NAB 2:12",
    ),
    same(4, 1, 8, "DRA 4:8 'By the fruit of their corn, their wine and oil' = NAB 4:8"),
    split(
      4,
      9,
      [
        [4, 9],
        [4, 10],
      ],
      "DRA 4:9 'In peace in the selfsame I will sleep' + 4:10 'thou, O Lord, singularly hast settled me in hope' = NAB 4:9",
    ),
    split(
      11,
      1,
      [
        [10, 1],
        [10, 2],
      ],
      "DRA 10:1 title + 10:2 'In the Lord I put my trust: how then do you say to my soul' = NAB 11:1",
    ),
    shift(
      11,
      2,
      7,
      10,
      3,
      "DRA 10:3 'the wicked have bent their bow' = NAB 11:2; DRA 10:8 'the Lord is just, and hath loved justice' = NAB 11:7",
    ),
    shift(
      43,
      1,
      3,
      42,
      1,
      "DRA 42:1 'Judge me, O God, and distinguish my cause' = NAB 43:1; DRA 42:3 'Send forth thy light and thy truth' = NAB 43:3",
    ),
    split(
      43,
      4,
      [
        [42, 4],
        [42, 5],
      ],
      "DRA 42:4 'I will go in to the altar of God' + 42:5a 'To thee, O God my God, I will give praise upon the harp' = NAB 43:4",
    ),
    split(
      43,
      5,
      [
        [42, 5],
        [42, 6],
      ],
      "DRA 42:5b 'why art thou sad, O my soul?' + 42:6 'Hope in God, for I will still give praise to him' = NAB 43:5",
    ),
    shift(
      56,
      1,
      10,
      55,
      1,
      "DRA 55:2 'Have mercy on me, O God, for man hath trodden me under foot' = NAB 56:2",
    ),
    merge(
      56,
      11,
      12,
      [55, 11],
      "DRA 55:11 'In God will I praise the word… In God have I hoped, I will not fear' = NAB 56:11-12",
    ),
    shift(
      56,
      13,
      14,
      55,
      12,
      "DRA 55:12 'In me, O God, are vows to thee' = NAB 56:13; DRA 55:13 'thou hast delivered my soul from death' = NAB 56:14",
    ),
    shift(
      126,
      1,
      5,
      125,
      1,
      "DRA 125:1 'When the lord brought back the captivity of Sion' = NAB 126:1; DRA 125:5 'They that sow in tears shall reap in joy' = NAB 126:5",
    ),
    split(
      126,
      6,
      [
        [125, 6],
        [125, 7],
      ],
      "DRA 125:6 'Going they went and wept, casting their seeds' + 125:7 'coming they shall come with joyfulness, carrying their sheaves' = NAB 126:6",
    ),
    shift(
      136,
      1,
      26,
      135,
      1,
      "DRA 135:1 'Praise the Lord, for he is good' = NAB 136:1; DRA 135:26 'Give glory to the God of heaven' = NAB 136:26 (DRA 135:27 is Vulgate-only)",
    ),
    // Modern Ps 20 (DRA 19) and Ps 44 (DRA 43) have irregular merges and are
    // left unverified.
  ],
};

/** Books whose Vulgate recension diverges too pervasively to align at all. */
export const UNALIGNABLE_BOOKS: ReadonlySet<BookCode> = new Set<BookCode>(["SIR", "TOB", "JDT"]);

/**
 * Modern (Masoretic) psalm number → Douay-Rheims (Vulgate) psalm number.
 * Vulgate 9 = modern 9–10, Vulgate 113 = modern 114–115, modern 116 = Vulgate
 * 114–115, modern 147 = Vulgate 146–147; 1–8 and 148–150 coincide.
 */
export function vulgatePsalmNumber(masoretic: number): number {
  if (masoretic <= 8) return masoretic;
  if (masoretic === 9 || masoretic === 10) return 9;
  if (masoretic <= 113) return masoretic - 1;
  if (masoretic === 114 || masoretic === 115) return 113;
  if (masoretic === 116) return 114;
  if (masoretic <= 146) return masoretic - 1;
  if (masoretic === 147) return 146;
  return masoretic;
}
