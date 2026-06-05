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

export interface RosaryMystery {
  /** The mystery's name. */
  name: string;
  /** Scripture reference for the meditation reading. */
  scripture: string;
  /** The spiritual fruit traditionally associated with the mystery. */
  fruit: string;
}

export interface MysterySet {
  key: MysterySetKey;
  label: string;
  /** The five mysteries, in order, each with its meditation and fruit. */
  mysteries: RosaryMystery[];
}

export const ROSARY_MYSTERY_SETS: MysterySet[] = [
  {
    key: "joyful",
    label: "Joyful Mysteries",
    mysteries: [
      { name: "The Annunciation", scripture: "Luke 1:26–38", fruit: "Humility" },
      { name: "The Visitation", scripture: "Luke 1:39–45", fruit: "Love of Neighbor" },
      { name: "The Nativity", scripture: "Luke 2:1–14", fruit: "Poverty of Spirit" },
      {
        name: "The Presentation in the Temple",
        scripture: "Luke 2:22–35",
        fruit: "Obedience",
      },
      {
        name: "The Finding of Jesus in the Temple",
        scripture: "Luke 2:41–52",
        fruit: "Joy in Finding Jesus",
      },
    ],
  },
  {
    key: "sorrowful",
    label: "Sorrowful Mysteries",
    mysteries: [
      { name: "The Agony in the Garden", scripture: "Luke 22:39–46", fruit: "Sorrow for Sin" },
      { name: "The Scourging at the Pillar", scripture: "John 19:1", fruit: "Purity" },
      {
        name: "The Crowning with Thorns",
        scripture: "Matthew 27:27–31",
        fruit: "Moral Courage",
      },
      { name: "The Carrying of the Cross", scripture: "Luke 23:26–32", fruit: "Patience" },
      {
        name: "The Crucifixion and Death of Our Lord",
        scripture: "Luke 23:33–46",
        fruit: "Perseverance",
      },
    ],
  },
  {
    key: "glorious",
    label: "Glorious Mysteries",
    mysteries: [
      { name: "The Resurrection", scripture: "Luke 24:1–12", fruit: "Faith" },
      { name: "The Ascension", scripture: "Acts 1:6–11", fruit: "Hope" },
      {
        name: "The Descent of the Holy Spirit",
        scripture: "Acts 2:1–13",
        fruit: "Love of God",
      },
      { name: "The Assumption of Mary", scripture: "Revelation 12:1", fruit: "Devotion to Mary" },
      {
        name: "The Coronation of Mary as Queen of Heaven",
        scripture: "Revelation 12:1; Judith 13:18–20",
        fruit: "Eternal Happiness",
      },
    ],
  },
  {
    key: "luminous",
    label: "Luminous Mysteries",
    mysteries: [
      {
        name: "The Baptism of Jesus in the Jordan",
        scripture: "Matthew 3:13–17",
        fruit: "Openness to the Holy Spirit",
      },
      { name: "The Wedding at Cana", scripture: "John 2:1–11", fruit: "To Jesus through Mary" },
      {
        name: "The Proclamation of the Kingdom of God",
        scripture: "Mark 1:14–15",
        fruit: "Repentance and Trust in God",
      },
      { name: "The Transfiguration", scripture: "Luke 9:28–36", fruit: "Desire for Holiness" },
      {
        name: "The Institution of the Eucharist",
        scripture: "Matthew 26:26–28",
        fruit: "Adoration",
      },
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
