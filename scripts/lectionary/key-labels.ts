/**
 * Day label (as printed by catholic-resources.org) → the calendar engine's
 * `lectionaryKey`.
 *
 * The key map is derived by joining the engine with the DATED sources; this
 * label reader only fills the handful of keys those years never showed (a week
 * that no year between 2023 and 2028 reached, e.g. `advent-3-friday`, which
 * exists only when Advent runs its full length).
 */

import type { LectionaryEntryKind } from "../../src/lib/content-shared/lectionary/types";

const WEEKDAYS: Record<string, string> = {
  mon: "monday",
  monday: "monday",
  tue: "tuesday",
  tues: "tuesday",
  tuesday: "tuesday",
  wed: "wednesday",
  weds: "wednesday",
  wednesday: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  thursday: "thursday",
  fri: "friday",
  friday: "friday",
  sat: "saturday",
  saturday: "saturday",
};

const DOW = "(mon|tues?|weds?|thurs?|fri|sat)(?:day|s|nesday|rsday|urday)?";
const ORDINAL = "(\\d+)(?:st|nd|rd|th)";

function weekday(token: string): string | null {
  return WEEKDAYS[token.toLowerCase().replace(/\.$/, "")] ?? null;
}

function pad(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/** Feasts of the Christmas octave that the engine keys by their own celebration. */
const DECEMBER_FEASTS: Record<number, string> = {
  26: "st-stephen",
  27: "st-john-apostle",
  28: "holy-innocents",
};

function temporalKeyFromLabel(label: string): string | null {
  const l = label.toLowerCase().replace(/\s+/g, " ").trim();

  // ── Named celebrations first: several of them also contain a week ordinal. ──
  if (/most holy trinity|trinity sunday/.test(l)) return "trinity-sunday";
  if (/body (and|&) blood|corpus christi/.test(l)) return "corpus-christi";
  if (/sacred heart/.test(l)) return "sacred-heart";
  if (/christ the king/.test(l)) return "christ-the-king";
  if (/baptism of the lord/.test(l)) return "baptism-of-the-lord";
  if (/epiphany of the lord/.test(l)) return "epiphany";
  if (/second sunday after christmas/.test(l)) return "christmas-2-sunday";
  if (/holy family/.test(l)) return "holy-family";
  if (/mother of god/.test(l)) return "mary-mother-of-god";
  if (/nativity of the lord|^christmas:/.test(l)) return "nativity";
  if (/chrism mass/.test(l)) return "holy-thursday";
  if (/holy thursday/.test(l)) return "holy-thursday";
  if (/good friday/.test(l)) return "good-friday";
  if (/easter vigil/.test(l)) return "easter-vigil";
  if (/easter sunday|mass of easter day/.test(l)) return "easter-sunday";
  if (/palm/.test(l)) return "palm-sunday";
  if (/ascension/.test(l)) return "ascension";
  if (/pentecost sunday/.test(l)) return "pentecost";
  if (/^ash wednesday/.test(l)) return "ash-wednesday";

  let m = l.match(new RegExp(`^(thursday|friday|saturday) after ash wed`));
  if (m) return `after-ashes-${m[1]}`;
  m = l.match(new RegExp(`^${DOW} after epiphany`));
  if (m) {
    const day = weekday(m[1]);
    return day ? `after-epiphany-${day}` : null;
  }
  m = l.match(new RegExp(`^${ORDINAL} week of advent [–—-] ${DOW}`));
  if (m) {
    const day = weekday(m[2]);
    return day ? `advent-${Number(m[1])}-${day}` : null;
  }
  m = l.match(new RegExp(`^${ORDINAL} sunday of advent`));
  if (m) return `advent-${Number(m[1])}-sunday`;
  m = l.match(new RegExp(`^${ORDINAL} week of lent [–—-] ${DOW}`));
  if (m) {
    const day = weekday(m[2]);
    return day ? `lent-${Number(m[1])}-${day}` : null;
  }
  m = l.match(new RegExp(`^${ORDINAL} sunday of lent`));
  if (m) return `lent-${Number(m[1])}-sunday`;
  m = l.match(new RegExp(`^holy week [–—-] ${DOW}`));
  if (m) {
    const day = weekday(m[1]);
    return day ? `holy-week-${day}` : null;
  }
  m = l.match(new RegExp(`^octave of easter [–—-] ${DOW}`));
  if (m) {
    const day = weekday(m[1]);
    return day ? `easter-octave-${day}` : null;
  }
  m = l.match(new RegExp(`^${ORDINAL} week of easter [–—-] ${DOW}`));
  if (m) {
    const day = weekday(m[2]);
    return day ? `easter-${Number(m[1])}-${day}` : null;
  }
  m = l.match(new RegExp(`^${ORDINAL} sunday of easter`));
  if (m) return `easter-${Number(m[1])}-sunday`;
  m = l.match(new RegExp(`^week (\\d+) [–—-] ${DOW}`));
  if (m) {
    const day = weekday(m[2]);
    return day ? `ordinary-${Number(m[1])}-${day}` : null;
  }
  m = l.match(new RegExp(`^${ORDINAL} sunday in ordinary time`));
  if (m) return `ordinary-${Number(m[1])}-sunday`;

  // ── Christmas-season days the Lectionary keys by their calendar date. ──
  m = l.match(/^december (\d{1,2})\b/);
  if (m) {
    const day = Number(m[1]);
    if (day >= 17 && day <= 24) return `advent-${pad(12, day)}`;
  }
  m = l.match(/^\[?dec\.? (\d{1,2})\]?/);
  if (m) {
    const day = Number(m[1]);
    if (DECEMBER_FEASTS[day]) return DECEMBER_FEASTS[day];
    if (day >= 29 && day <= 31) return `christmas-${pad(12, day)}`;
  }
  m = l.match(/^\[?jan\.? (\d{1,2})\]?/);
  if (m) {
    const day = Number(m[1]);
    if (day >= 2 && day <= 7) return `christmas-${pad(1, day)}`;
  }
  return null;
}

/**
 * The engine key a catholic-resources day label names, or null when the label
 * is a sanctoral row (those are keyed from the dated join, which knows which
 * celebration actually outranked the day) or is not a day at all.
 */
export function keyFromCatholicResourcesLabel(
  label: string,
  kind: LectionaryEntryKind,
): string | null {
  if (kind === "sanctoral" || kind === "common") return null;
  return temporalKeyFromLabel(label);
}
