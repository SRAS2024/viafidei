/**
 * Rosary mystery structure (spec — "Rosary structure with mystery toggle").
 *
 * The four sets of mysteries and the weekday on which each is traditionally
 * prayed are fixed devotional structure (like the seven sacraments or the
 * Catholic rites), so they are encoded here rather than fetched. The actual
 * step-by-step "how to pray" text still comes from published content; this
 * module only supplies the mysteries themselves and the weekday schedule so
 * the UI can default to today's set and let the user switch.
 */
export type MysterySetKey = "joyful" | "sorrowful" | "glorious" | "luminous";

export interface MysterySet {
  key: MysterySetKey;
  label: string;
  /** The five mysteries, in order. */
  mysteries: string[];
}

export const ROSARY_MYSTERY_SETS: MysterySet[] = [
  {
    key: "joyful",
    label: "Joyful Mysteries",
    mysteries: [
      "The Annunciation",
      "The Visitation",
      "The Nativity",
      "The Presentation in the Temple",
      "The Finding of Jesus in the Temple",
    ],
  },
  {
    key: "sorrowful",
    label: "Sorrowful Mysteries",
    mysteries: [
      "The Agony in the Garden",
      "The Scourging at the Pillar",
      "The Crowning with Thorns",
      "The Carrying of the Cross",
      "The Crucifixion and Death of Our Lord",
    ],
  },
  {
    key: "glorious",
    label: "Glorious Mysteries",
    mysteries: [
      "The Resurrection",
      "The Ascension",
      "The Descent of the Holy Spirit",
      "The Assumption of Mary",
      "The Coronation of Mary as Queen of Heaven",
    ],
  },
  {
    key: "luminous",
    label: "Luminous Mysteries",
    mysteries: [
      "The Baptism of Jesus in the Jordan",
      "The Wedding at Cana",
      "The Proclamation of the Kingdom of God",
      "The Transfiguration",
      "The Institution of the Eucharist",
    ],
  },
];

/**
 * The mystery prayed on each weekday under the schedule given by St. John
 * Paul II in Rosarium Virginis Mariae (2002), indexed by `Date#getDay()`
 * (0 = Sunday … 6 = Saturday).
 */
const WEEKDAY_SCHEDULE: MysterySetKey[] = [
  "glorious", // Sunday
  "joyful", // Monday
  "sorrowful", // Tuesday
  "glorious", // Wednesday
  "luminous", // Thursday
  "sorrowful", // Friday
  "joyful", // Saturday
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The set traditionally prayed on the given weekday (0 = Sunday). */
export function mysterySetForWeekday(weekday: number): MysterySetKey {
  const i = ((Math.trunc(weekday) % 7) + 7) % 7;
  return WEEKDAY_SCHEDULE[i];
}

export function mysterySet(key: MysterySetKey): MysterySet {
  return ROSARY_MYSTERY_SETS.find((s) => s.key === key) ?? ROSARY_MYSTERY_SETS[0];
}

/** Readable list of the weekdays a set is prayed, e.g. "Monday & Saturday". */
export function daysForMysterySet(key: MysterySetKey): string {
  const days = WEEKDAY_SCHEDULE.map((k, i) => (k === key ? DAY_NAMES[i] : null)).filter(
    (d): d is string => d !== null,
  );
  return days.join(" & ");
}

/** True when a published GUIDE payload is the "how to pray the Rosary" guide. */
export function isRosaryGuide(payload: Record<string, unknown>): boolean {
  return payload.kind === "rosary";
}
