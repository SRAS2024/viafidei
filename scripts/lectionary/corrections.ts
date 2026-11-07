/**
 * Corrections the table build cannot work out from its sources, applied last.
 *
 * Each one was read against the USCCB annual liturgical calendar (2026-2028) and
 * the USCCB daily readings pages. They fall into three groups:
 *  - formularies a one-section-per-kind table cannot hold (the Easter Vigil's nine
 *    readings, the Extended Vigil of Pentecost);
 *  - days whose sources contradict each other in a way a vote cannot settle (the
 *    USCCB pages number the two Masses of John the Baptist and of Peter and Paul
 *    differently from the printed calendar, and file Mary, Mother of the Church
 *    under the Visitation's number);
 *  - readings the Lectionary offers on top of the year's own, which must stay
 *    available as an "or" rather than replace them (the Holy Family, the Baptism,
 *    the Ascension, Pentecost, Easter Sunday).
 */

import type { ReadingKind } from "../../src/lib/content-shared/daily-readings";
import type {
  KeyMapEntry,
  LectionaryByNumber,
  LectionaryCycle,
  LectionaryEntry,
  LectionarySection,
} from "../../src/lib/content-shared/lectionary/types";

type Row = readonly [
  kind: ReadingKind,
  cycle: LectionaryCycle | null,
  citation: string,
  label?: string,
];

interface EntryCorrection {
  label?: string;
  key?: string | null;
  variant?: string | null;
  /** The whole formulary, in proclamation order. Omit to keep what the build found. */
  sections?: readonly Row[];
  /** Replace only these kinds; every other section stays as the build found it. */
  replace?: readonly Row[];
}

const R = "Responsorial Psalm";

export const ENTRY_CORRECTIONS: Readonly<Record<string, EntryCorrection>> = {
  // The Holy Family: Sirach, Psalm 128 and Colossians belong to every year. The
  // USCCB pages read them; Years B and C also offer their own, so both stay.
  "17": {
    sections: [
      ["FIRST_READING", null, "Sir 3:2-6, 12-14"],
      ["FIRST_READING", "B", "Sir 3:2-6, 12-14 or Gn 15:1-6; 21:1-3"],
      ["FIRST_READING", "C", "Sir 3:2-6, 12-14 or 1 Sm 1:20-22, 24-28"],
      ["PSALM", null, "Ps 128:1-2, 3, 4-5"],
      ["PSALM", "B", "Ps 128:1-2, 3, 4-5 or Ps 105:1-2, 3-4, 5-6, 8-9"],
      ["PSALM", "C", "Ps 128:1-2, 3, 4-5 or Ps 84:2-3, 5-6, 9-10"],
      ["SECOND_READING", null, "Col 3:12-21 or Col 3:12-17"],
      ["SECOND_READING", "B", "Col 3:12-21 or Col 3:12-17 or Heb 11:8, 11-12, 17-19"],
      ["SECOND_READING", "C", "Col 3:12-21 or Col 3:12-17 or 1 Jn 3:1-2, 21-24"],
      ["ACCLAMATION", null, "Col 3:15a, 16a"],
      ["ACCLAMATION", "B", "Col 3:15a, 16a or Heb 1:1-2"],
      ["ACCLAMATION", "C", "Col 3:15a, 16a or Acts 16:14b"],
      ["GOSPEL", "A", "Mt 2:13-15, 19-23"],
      ["GOSPEL", "B", "Lk 2:22-40 or Lk 2:22, 39-40"],
      ["GOSPEL", "C", "Lk 2:41-52"],
    ],
  },
  // The Baptism of the Lord: the same pattern as the Holy Family.
  "21": {
    sections: [
      ["FIRST_READING", null, "Is 42:1-4, 6-7"],
      ["FIRST_READING", "B", "Is 42:1-4, 6-7 or Is 55:1-11"],
      ["FIRST_READING", "C", "Is 42:1-4, 6-7 or Is 40:1-5, 9-11"],
      ["PSALM", null, "Ps 29:1-2, 3-4, 3, 9-10"],
      ["PSALM", "B", "Ps 29:1-2, 3-4, 3, 9-10 or Is 12:2-3, 4bcd, 5-6"],
      ["PSALM", "C", "Ps 29:1-2, 3-4, 3, 9-10 or Ps 104:1b-2, 3-4, 24-25, 27-28, 29b-30"],
      ["SECOND_READING", null, "Acts 10:34-38"],
      ["SECOND_READING", "B", "Acts 10:34-38 or 1 Jn 5:1-9"],
      ["SECOND_READING", "C", "Acts 10:34-38 or Ti 2:11-14; 3:4-7"],
      ["ACCLAMATION", null, "cf. Mk 9:7"],
      ["ACCLAMATION", "B", "cf. Mk 9:7 or Jn 1:29"],
      ["ACCLAMATION", "C", "cf. Mk 9:7 or Lk 3:16"],
      ["GOSPEL", "A", "Mt 3:13-17"],
      ["GOSPEL", "B", "Mk 1:7-11"],
      ["GOSPEL", "C", "Lk 3:15-16, 21-22"],
    ],
  },
  // Palm Sunday: #37 is the Gospel at the Procession and nothing else. The Mass
  // itself, with the Passion, is #38.
  "37": {
    label: "Palm Sunday of the Passion of the Lord: At the Procession with Palms",
    key: "palm-sunday",
    variant: "procession",
    sections: [
      ["GOSPEL", "A", "Mt 21:1-11"],
      ["GOSPEL", "B", "Mk 11:1-10 or Jn 12:12-16"],
      ["GOSPEL", "C", "Lk 19:28-40"],
    ],
  },
  "38": { key: "palm-sunday" },
  // The Easter Vigil: seven readings from the Old Testament with their psalms,
  // the Epistle with its psalm, and the year's Gospel. Named sections keep this
  // order; see sectionsForCycles.
  "41": {
    label: "Holy Saturday: At the Easter Vigil in the Holy Night of Easter",
    key: "easter-vigil",
    variant: null,
    sections: [
      ["FIRST_READING", null, "Gn 1:1—2:2 or Gn 1:1, 26-31a", "First Reading"],
      [
        "PSALM",
        null,
        "Ps 104:1-2, 5-6, 10, 12, 13-14, 24, 35 or Ps 33:4-5, 6-7, 12-13, 20 and 22",
        R,
      ],
      ["SECOND_READING", null, "Gn 22:1-18 or Gn 22:1-2, 9a, 10-13, 15-18", "Second Reading"],
      ["PSALM", null, "Ps 16:5, 8, 9-10, 11", R],
      ["OTHER", null, "Ex 14:15—15:1", "Third Reading"],
      ["PSALM", null, "Ex 15:1-2, 3-4, 5-6, 17-18", R],
      ["OTHER", null, "Is 54:5-14", "Fourth Reading"],
      ["PSALM", null, "Ps 30:2, 4, 5-6, 11-12, 13", R],
      ["OTHER", null, "Is 55:1-11", "Fifth Reading"],
      ["PSALM", null, "Is 12:2-3, 4, 5-6", R],
      ["OTHER", null, "Bar 3:9-15, 32—4:4", "Sixth Reading"],
      ["PSALM", null, "Ps 19:8, 9, 10, 11", R],
      ["OTHER", null, "Ez 36:16-17a, 18-28", "Seventh Reading"],
      [
        "PSALM",
        null,
        "Ps 42:3, 5; 43:3, 4 or Is 12:2-3, 4bcd, 5-6 or Ps 51:12-13, 14-15, 18-19",
        R,
      ],
      ["OTHER", null, "Rom 6:3-11", "Epistle"],
      ["PSALM", null, "Ps 118:1-2, 16-17, 22-23", R],
      ["GOSPEL", "A", "Mt 28:1-10"],
      ["GOSPEL", "B", "Mk 16:1-7"],
      ["GOSPEL", "C", "Lk 24:1-12"],
    ],
  },
  // Easter Sunday: John, or the Vigil's Gospel of the year, or Emmaus at an
  // afternoon or evening Mass.
  "42": {
    label: "Easter Sunday of the Resurrection of the Lord: At the Mass during the Day",
    variant: null,
    replace: [
      ["GOSPEL", "A", "Jn 20:1-9 or Mt 28:1-10 or Lk 24:13-35"],
      ["GOSPEL", "B", "Jn 20:1-9 or Mk 16:1-7 or Lk 24:13-35"],
      ["GOSPEL", "C", "Jn 20:1-9 or Lk 24:1-12 or Lk 24:13-35"],
    ],
  },
  // The Ascension: Ephesians 1 may be read in every year.
  "58": {
    replace: [
      ["SECOND_READING", "A", "Eph 1:17-23"],
      ["SECOND_READING", "B", "Eph 1:17-23 or Eph 4:1-13 or Eph 4:1-7, 11-13"],
      ["SECOND_READING", "C", "Eph 1:17-23 or Heb 9:24-28; 10:19-23"],
    ],
  },
  "62": {
    label: "Pentecost Sunday: At the Vigil Mass",
    key: "pentecost",
    variant: "vigil",
  },
  // The Extended Vigil of Pentecost, from the 2017 Lectionary Supplement. It has
  // the same Lectionary number as the Vigil, so the table files it under a suffix.
  "62-extended": {
    label: "Pentecost Sunday: At the Extended Vigil",
    key: "pentecost",
    variant: "extended-vigil",
    sections: [
      ["FIRST_READING", null, "Gn 11:1-9", "First Reading"],
      ["PSALM", null, "Ps 33:10-11, 12-13, 14-15", R],
      ["SECOND_READING", null, "Ex 19:3-8a, 16-20b", "Second Reading"],
      ["PSALM", null, "Dn 3:52, 53, 54, 55, 56", R],
      ["OTHER", null, "Ez 37:1-14", "Third Reading"],
      ["PSALM", null, "Ps 107:2-3, 4-5, 6-7, 8-9", R],
      ["OTHER", null, "Jl 3:1-5", "Fourth Reading"],
      ["PSALM", null, "Ps 104:1-2, 24 and 35, 27-28, 29-30", R],
      ["OTHER", null, "Rom 8:22-27", "Epistle"],
      ["GOSPEL", null, "Jn 7:37-39"],
    ],
  },
  // Pentecost during the Day: 1 Corinthians and John 20 belong to every year.
  "63": {
    label: "Pentecost Sunday: At the Mass during the Day",
    variant: "day",
    replace: [
      ["PSALM", null, "Ps 104:1, 24, 29-30, 31, 34"],
      ["SECOND_READING", null, "1 Cor 12:3b-7, 12-13"],
      ["SECOND_READING", "B", "1 Cor 12:3b-7, 12-13 or Gal 5:16-25"],
      ["SECOND_READING", "C", "1 Cor 12:3b-7, 12-13 or Rom 8:8-17"],
      ["GOSPEL", null, "Jn 20:19-23"],
      ["GOSPEL", "B", "Jn 20:19-23 or Jn 15:26-27; 16:12-15"],
      ["GOSPEL", "C", "Jn 20:19-23 or Jn 14:15-16, 23b-26"],
    ],
  },
  // Year A reads the Mt 14:13-21 of Monday on the Sunday before, and moves on.
  "407": {
    replace: [
      ["ACCLAMATION", null, "Mt 4:4"],
      ["ACCLAMATION", "A", "Jn 1:49b"],
      ["GOSPEL", null, "Mt 14:13-21"],
      ["GOSPEL", "A", "Mt 14:22-36"],
    ],
  },
  // The USCCB calendars print both Gospels for this Tuesday in every year.
  "408": {
    replace: [["GOSPEL", null, "Mt 14:22-36 or Mt 15:1-2, 10-14"]],
  },
  // Saints Timothy and Titus keep the weekday's Gospel; the Lectionary's own is
  // the Common's, kept here only so the formulary is whole.
  "520": { label: "Saints Timothy and Titus, Bishops" },
  "572": {
    label: "The Visitation of the Blessed Virgin Mary",
    key: "visitation",
    sections: [
      ["FIRST_READING", null, "Zep 3:14-18a or Rom 12:9-16"],
      ["PSALM", null, "Is 12:2-3, 4bcd, 5-6"],
      ["ACCLAMATION", null, "cf. Lk 1:45"],
      ["GOSPEL", null, "Lk 1:39-56"],
    ],
  },
  "572A": {
    label: "The Blessed Virgin Mary, Mother of the Church",
    key: "mary-mother-of-the-church",
  },
  // The readings the Lectionary prints for the Immaculate Heart. The calendar
  // keeps the weekday's first reading and psalm, so only its Gospel is ever read.
  "573": {
    label: "The Immaculate Heart of the Blessed Virgin Mary",
    key: "immaculate-heart",
    sections: [
      ["FIRST_READING", null, "Is 61:9-11"],
      ["PSALM", null, "1 Sm 2:1, 4-5, 6-7, 8abcd"],
      ["ACCLAMATION", null, "cf. Lk 2:19"],
      ["GOSPEL", null, "Lk 2:41-51"],
    ],
  },
  "586": {
    key: "nativity-of-john-the-baptist",
    variant: "vigil",
    sections: [
      ["FIRST_READING", null, "Jer 1:4-10"],
      ["PSALM", null, "Ps 71:1-2, 3-4a, 5-6ab, 15ab and 17"],
      ["SECOND_READING", null, "1 Pt 1:8-12"],
      ["ACCLAMATION", null, "cf. Jn 1:7; Lk 1:17"],
      ["GOSPEL", null, "Lk 1:5-17"],
    ],
  },
  "587": {
    key: "nativity-of-john-the-baptist",
    variant: "day",
    sections: [
      ["FIRST_READING", null, "Is 49:1-6"],
      ["PSALM", null, "Ps 139:1b-3, 13-14ab, 14c-15"],
      ["SECOND_READING", null, "Acts 13:22-26"],
      ["ACCLAMATION", null, "cf. Lk 1:76"],
      ["GOSPEL", null, "Lk 1:57-66, 80"],
    ],
  },
  "590": {
    key: "sts-peter-and-paul",
    variant: "vigil",
    sections: [
      ["FIRST_READING", null, "Acts 3:1-10"],
      ["PSALM", null, "Ps 19:2-3, 4-5"],
      ["SECOND_READING", null, "Gal 1:11-20"],
      ["ACCLAMATION", null, "Jn 21:17"],
      ["GOSPEL", null, "Jn 21:15-19"],
    ],
  },
  "591": {
    key: "sts-peter-and-paul",
    variant: "day",
    sections: [
      ["FIRST_READING", null, "Acts 12:1-11"],
      ["PSALM", null, "Ps 34:2-3, 4-5, 6-7, 8-9"],
      ["SECOND_READING", null, "2 Tm 4:6-8, 17-18"],
      ["ACCLAMATION", null, "Mt 16:18"],
      ["GOSPEL", null, "Mt 16:13-19"],
    ],
  },
  "668": {
    replace: [["SECOND_READING", null, "Rom 5:5-11 or Rom 6:3-9"]],
  },
  // #690 is Saint Damasus. The USCCB pages file Our Lady of Guadalupe under it, and
  // her readings had overwritten his; hers is #690A.
  "690": {
    key: null,
    sections: [
      ["FIRST_READING", null, "Acts 20:17-18a, 28-32, 36"],
      ["PSALM", null, "Ps 110:1, 2, 3, 4"],
      ["GOSPEL", null, "Jn 15:9-17"],
    ],
  },
};

const dated = (masses: KeyMapEntry["masses"]): KeyMapEntry[] => [
  { cycle: null, masses, source: "dates" },
];

/** Year B and C Sundays of Lent may also take the Year A readings of the scrutinies. */
function scrutiny(a: string, b: string, c: string): KeyMapEntry[] {
  return [
    { cycle: "A", masses: [{ number: a, variant: null }], source: "dates" },
    {
      cycle: "B",
      masses: [
        { number: b, variant: null },
        { number: a, variant: "year-a" },
      ],
      source: "dates",
    },
    {
      cycle: "C",
      masses: [
        { number: c, variant: null },
        { number: a, variant: "year-a" },
      ],
      source: "dates",
    },
  ];
}

/** Keys whose formularies the dated join cannot read from its sources. */
export const KEY_MAP_CORRECTIONS: Readonly<Record<string, KeyMapEntry[]>> = {
  "easter-vigil": dated([{ number: "41", variant: null }]),
  "easter-sunday": dated([{ number: "42", variant: null }]),
  "lent-3-sunday": scrutiny("28", "29", "30"),
  "lent-4-sunday": scrutiny("31", "32", "33"),
  "lent-5-sunday": scrutiny("34", "35", "36"),
  "mary-mother-of-the-church": dated([{ number: "572A", variant: null }]),
  "our-lady-of-guadalupe": dated([{ number: "690A", variant: null }]),
  "palm-sunday": dated([
    { number: "38", variant: null },
    { number: "37", variant: "procession" },
  ]),
  pentecost: dated([
    { number: "63", variant: "day" },
    { number: "62", variant: "vigil" },
    { number: "62-extended", variant: "extended-vigil" },
  ]),
};

function toSections(rows: readonly Row[]): LectionarySection[] {
  return rows.map(([kind, cycle, citation, label]) => ({
    kind,
    cycle,
    citation,
    ...(label ? { label } : {}),
    source: "usccb" as const,
  }));
}

function entryKind(number: string): LectionaryEntry["kind"] {
  const n = Number.parseInt(number, 10);
  if (n < 175) return "sunday";
  if (n < 510) return "weekday";
  if (n < 700) return "sanctoral";
  return "common";
}

/** Apply ENTRY_CORRECTIONS to a built table, creating an entry the build never saw. */
export function applyEntryCorrections(table: LectionaryByNumber): void {
  for (const [number, fix] of Object.entries(ENTRY_CORRECTIONS)) {
    const current: LectionaryEntry = table[number] ?? {
      number,
      label: fix.label ?? number,
      cycle: null,
      kind: entryKind(number),
      variant: null,
      key: null,
      sections: [],
    };
    let sections = current.sections;
    if (fix.sections) sections = toSections(fix.sections);
    if (fix.replace) {
      const kinds = new Set(fix.replace.map(([kind]) => kind));
      const kept = sections.filter((s) => !kinds.has(s.kind));
      const merged = [...kept, ...toSections(fix.replace)];
      sections = merged.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    }
    table[number] = {
      ...current,
      label: fix.label ?? current.label,
      key: fix.key === undefined ? current.key : fix.key,
      variant: fix.variant === undefined ? current.variant : fix.variant,
      // These formularies vary by section, never as a whole entry.
      cycle: fix.sections || fix.replace ? null : current.cycle,
      sections,
    };
  }
}

const ORDER: readonly ReadingKind[] = [
  "FIRST_READING",
  "PSALM",
  "SECOND_READING",
  "ACCLAMATION",
  "GOSPEL",
];

export function applyKeyMapCorrections(map: Record<string, KeyMapEntry[]>): void {
  for (const [key, rows] of Object.entries(KEY_MAP_CORRECTIONS)) map[key] = rows;
}
