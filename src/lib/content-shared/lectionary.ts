/**
 * Lectionary — the deterministic "liturgical day → Scripture readings" table
 * the Admin Worker uses to assemble and store each day's Mass readings.
 *
 * Keyed on the `lectionaryKey` produced by `resolveLiturgicalDay` (General
 * Roman Calendar), so a finite table serves every year automatically. Each
 * entry lists the day's readings in proclamation order with their citations;
 * the Scripture text is the public-domain Douay-Rheims (Challoner), resolved
 * per citation from the vendored store by `resolveDouayPassage`
 * (./bible/dra.ts), which maps the lectionary's modern chapter:verse
 * numbering onto the Vulgate numbering with a verified alignment table.
 *
 * Accuracy posture (agreed with the site owner): citations are encoded
 * best-effort and every reading page shows the official source link for
 * verification. Any day NOT in this table resolves to null and the caller
 * falls back to the official link — a reading is never fabricated or shown
 * half-wrong. Likewise a citation the resolver cannot align with certainty
 * (see the alignment policy in ./bible/README.md) carries its citation only
 * (`body: null`), never a shifted passage. The table is designed to grow: add
 * a lectionaryKey entry and that day is covered for all years at once.
 */

import { vulgatePsalmNumber } from "./bible/alignment";
import { resolveDouayPassage } from "./bible/dra";
import type { ReadingKind, ReadingSection } from "./daily-readings";

export { vulgatePsalmNumber };

interface ReadingSpec {
  kind: ReadingKind;
  label: string;
  citation: string;
}

/**
 * The lectionary table, keyed by `lectionaryKey`. Seeded with principal
 * solemnities whose readings are stable across the Sunday cycle. Every
 * section's text (including the Responsorial Psalm, in Vulgate numbering) is
 * resolved from the Douay-Rheims store at call time. Expand by adding entries.
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
 * (citation always set; body set when the Douay-Rheims text resolves with a
 * verified alignment), or null when the day isn't in the table yet (caller
 * falls back to the link).
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
    body: resolveDouayPassage(s.citation).text,
  }));
  const withText = sections.filter((s) => typeof s.body === "string" && s.body.length > 0).length;
  return { sections, confidence: withText / sections.length };
}

/** Liturgical-day keys the lectionary currently covers (for diagnostics). */
export function coveredLectionaryKeys(): string[] {
  return Object.keys(LECTIONARY);
}
