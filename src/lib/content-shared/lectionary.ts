/**
 * Lectionary — the deterministic "liturgical day → Scripture readings" table
 * the Admin Worker uses to assemble and store each day's Mass readings.
 *
 * Keyed on the `lectionaryKey` produced by `resolveLiturgicalDay` (General
 * Roman Calendar), so a finite table serves every year automatically. Each
 * entry lists the day's readings in proclamation order with their citations;
 * the Scripture text is the public-domain Douay-Rheims (Challoner), vendored
 * per-citation in `dra-passages.json`.
 *
 * Accuracy posture (agreed with the site owner): citations are encoded
 * best-effort and every reading page shows the official source link for
 * verification. Any day NOT in this table resolves to null and the caller
 * falls back to the official link — a reading is never fabricated or shown
 * half-wrong. The table is designed to grow: add a lectionaryKey entry (and
 * vendor its passages) and that day is covered for all years at once.
 *
 * NOTE on Psalms: the lectionary cites the Responsorial Psalm in modern
 * (Masoretic) numbering, but the Douay-Rheims uses the Vulgate/Septuagint
 * numbering (lectionary "Ps 98" = DRA "Ps 97"), with intra-psalm verse
 * offsets too. To avoid showing a subtly wrong psalm, seed psalms carry the
 * citation only (text from the source link) until an authoritative,
 * lectionary-aligned psalm source is wired in. `vulgatePsalmNumber` is
 * provided for that future work.
 */

import type { ReadingKind, ReadingSection } from "./daily-readings";
import draPassages from "./dra-passages.json";

interface ReadingSpec {
  kind: ReadingKind;
  label: string;
  citation: string;
}

const PASSAGES = draPassages as Record<string, { translation: string; text: string }>;

/**
 * Map a modern (Masoretic) psalm number to its Douay-Rheims (Vulgate) number.
 * The two numbering systems diverge because the Vulgate merges Pss 9–10 and
 * 114–115 and splits 116 and 147. Intra-psalm verse numbers still differ, so
 * this is necessary but not sufficient for exact verse selections — hence the
 * seed shows psalms by citation only.
 */
export function vulgatePsalmNumber(masoretic: number): number {
  if (masoretic <= 8) return masoretic;
  if (masoretic === 9 || masoretic === 10) return 9; // Masoretic 9–10 = Vulgate 9
  if (masoretic <= 113) return masoretic - 1; // 11–113 → 10–112
  if (masoretic === 114 || masoretic === 115) return 113; // merged
  if (masoretic === 116) return 114; // split (114–115); first part
  if (masoretic <= 146) return masoretic - 1; // 117–146 → 116–145
  if (masoretic === 147) return 146; // split (146–147); first part
  return masoretic; // 148–150 align
}

/**
 * The lectionary table, keyed by `lectionaryKey`. Seeded with principal
 * solemnities whose readings are stable across the Sunday cycle; the text for
 * the First/Second/Gospel is vendored (Douay-Rheims), the Psalm carries its
 * citation (see the Psalm note above). Expand by adding entries + passages.
 */
const LECTIONARY: Record<string, ReadingSpec[]> = {
  nativity: [
    { kind: "FIRST_READING", label: "First Reading", citation: "Isaiah 52:7-10" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 98:1-6" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "Hebrews 1:1-6" },
    { kind: "GOSPEL", label: "Gospel", citation: "John 1:1-18" },
  ],
  epiphany: [
    { kind: "FIRST_READING", label: "First Reading", citation: "Isaiah 60:1-6" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 72:1-2, 7-8, 10-13" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "Ephesians 3:2-3a, 5-6" },
    { kind: "GOSPEL", label: "Gospel", citation: "Matthew 2:1-12" },
  ],
  "easter-sunday": [
    { kind: "FIRST_READING", label: "First Reading", citation: "Acts 10:34a, 37-43" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 118:1-2, 16-17, 22-23" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "Colossians 3:1-4" },
    { kind: "GOSPEL", label: "Gospel", citation: "John 20:1-9" },
  ],
  pentecost: [
    { kind: "FIRST_READING", label: "First Reading", citation: "Acts 2:1-11" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 104:1, 24, 29-31, 34" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "1 Corinthians 12:3b-7, 12-13" },
    { kind: "GOSPEL", label: "Gospel", citation: "John 20:19-23" },
  ],
  "ash-wednesday": [
    { kind: "FIRST_READING", label: "First Reading", citation: "Joel 2:12-18" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 51:3-6, 12-14, 17" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "2 Corinthians 5:20—6:2" },
    { kind: "GOSPEL", label: "Gospel", citation: "Matthew 6:1-6, 16-18" },
  ],
  "holy-thursday": [
    { kind: "FIRST_READING", label: "First Reading", citation: "Exodus 12:1-8, 11-14" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 116:12-13, 15-18" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "1 Corinthians 11:23-26" },
    { kind: "GOSPEL", label: "Gospel", citation: "John 13:1-15" },
  ],
  "good-friday": [
    { kind: "FIRST_READING", label: "First Reading", citation: "Isaiah 52:13—53:12" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 31:2, 6, 12-13, 15-17, 25" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "Hebrews 4:14-16; 5:7-9" },
    { kind: "GOSPEL", label: "Gospel", citation: "John 18:1—19:42" },
  ],
  "mary-mother-of-god": [
    { kind: "FIRST_READING", label: "First Reading", citation: "Numbers 6:22-27" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 67:2-3, 5-6, 8" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "Galatians 4:4-7" },
    { kind: "GOSPEL", label: "Gospel", citation: "Luke 2:16-21" },
  ],
  assumption: [
    { kind: "FIRST_READING", label: "First Reading", citation: "Revelation 11:19a; 12:1-6a, 10ab" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 45:10-12, 16" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "1 Corinthians 15:20-27" },
    { kind: "GOSPEL", label: "Gospel", citation: "Luke 1:39-56" },
  ],
  "all-saints": [
    { kind: "FIRST_READING", label: "First Reading", citation: "Revelation 7:2-4, 9-14" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 24:1-6" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "1 John 3:1-3" },
    { kind: "GOSPEL", label: "Gospel", citation: "Matthew 5:1-12a" },
  ],
  "immaculate-conception": [
    { kind: "FIRST_READING", label: "First Reading", citation: "Genesis 3:9-15, 20" },
    { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 98:1-4" },
    { kind: "SECOND_READING", label: "Second Reading", citation: "Ephesians 1:3-6, 11-12" },
    { kind: "GOSPEL", label: "Gospel", citation: "Luke 1:26-38" },
  ],
};

export interface ResolvedReadings {
  sections: ReadingSection[];
  /** 0..1 — share of readings whose verified text resolved. */
  confidence: number;
}

/**
 * Resolve the readings for a liturgical day. Returns the ordered sections
 * (citation always set; body set when the Douay-Rheims text is vendored), or
 * null when the day isn't in the table yet (caller falls back to the link).
 *
 * Cycle-aware: Sundays/solemnities whose readings vary by year are keyed
 * `${lectionaryKey}|${cycle}` (e.g. "ordinary-2-sunday|C"); a cycle-independent
 * entry is keyed by the bare lectionaryKey. We try the cycle-specific entry
 * first, then fall back to the bare key.
 */
export function resolveReadings(
  lectionaryKey: string,
  cycle?: "A" | "B" | "C",
): ResolvedReadings | null {
  const specs =
    (cycle ? LECTIONARY[`${lectionaryKey}|${cycle}`] : undefined) ?? LECTIONARY[lectionaryKey];
  if (!specs || specs.length === 0) return null;
  const sections: ReadingSection[] = specs.map((s) => ({
    kind: s.kind,
    label: s.label,
    citation: s.citation,
    body: PASSAGES[s.citation]?.text ?? null,
  }));
  const withText = sections.filter((s) => typeof s.body === "string" && s.body.length > 0).length;
  return { sections, confidence: withText / sections.length };
}

/** Liturgical-day keys the lectionary currently covers (for diagnostics). */
export function coveredLectionaryKeys(): string[] {
  return Object.keys(LECTIONARY);
}
