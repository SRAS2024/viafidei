/**
 * Canonical internal Rosary structure (spec §9).
 *
 * The Rosary has four mystery sets, each with five mysteries, each
 * meditated on while praying a decade (one Our Father + ten Hail
 * Marys + one Glory Be). The structure is fixed; sources contribute
 * prayer text + meditation text only.
 *
 * The factory uses CANONICAL_ROSARY_STRUCTURE to validate that a
 * source-supplied Rosary "fits" — same mystery set names, same
 * mystery count per set, recognised mystery titles. A source that
 * deviates triggers `build_failed_missing_required_fields` with the
 * mismatch in `failureReason`.
 */

export const ROSARY_MYSTERY_SETS = ["joyful", "sorrowful", "glorious", "luminous"] as const;

export type RosaryMysterySet = (typeof ROSARY_MYSTERY_SETS)[number];

export type RosaryMystery = {
  index: 1 | 2 | 3 | 4 | 5;
  title: string;
  /** Optional Scripture reference (e.g. "Luke 1:26-38"). */
  scriptureReference?: string;
};

export const CANONICAL_ROSARY_STRUCTURE: Record<RosaryMysterySet, ReadonlyArray<RosaryMystery>> = {
  joyful: [
    { index: 1, title: "The Annunciation", scriptureReference: "Luke 1:26-38" },
    { index: 2, title: "The Visitation", scriptureReference: "Luke 1:39-56" },
    { index: 3, title: "The Nativity", scriptureReference: "Luke 2:1-20" },
    { index: 4, title: "The Presentation in the Temple", scriptureReference: "Luke 2:22-38" },
    {
      index: 5,
      title: "The Finding in the Temple",
      scriptureReference: "Luke 2:41-52",
    },
  ],
  sorrowful: [
    { index: 1, title: "The Agony in the Garden", scriptureReference: "Matthew 26:36-46" },
    { index: 2, title: "The Scourging at the Pillar", scriptureReference: "John 19:1" },
    {
      index: 3,
      title: "The Crowning with Thorns",
      scriptureReference: "Matthew 27:27-31",
    },
    { index: 4, title: "The Carrying of the Cross", scriptureReference: "Luke 23:26-32" },
    { index: 5, title: "The Crucifixion", scriptureReference: "Luke 23:33-49" },
  ],
  glorious: [
    { index: 1, title: "The Resurrection", scriptureReference: "Matthew 28:1-10" },
    { index: 2, title: "The Ascension", scriptureReference: "Luke 24:50-53" },
    {
      index: 3,
      title: "The Descent of the Holy Spirit",
      scriptureReference: "Acts 2:1-13",
    },
    { index: 4, title: "The Assumption of Mary", scriptureReference: "Revelation 12:1" },
    { index: 5, title: "The Coronation of Mary", scriptureReference: "Revelation 12:1" },
  ],
  luminous: [
    { index: 1, title: "The Baptism in the Jordan", scriptureReference: "Matthew 3:13-17" },
    { index: 2, title: "The Wedding at Cana", scriptureReference: "John 2:1-11" },
    {
      index: 3,
      title: "The Proclamation of the Kingdom",
      scriptureReference: "Mark 1:14-15",
    },
    { index: 4, title: "The Transfiguration", scriptureReference: "Matthew 17:1-9" },
    {
      index: 5,
      title: "The Institution of the Eucharist",
      scriptureReference: "Luke 22:14-20",
    },
  ],
};

/** Map of "joyful mysteries" / "sorrowful mysteries" / etc. → set key. */
const SET_ALIASES: ReadonlyArray<readonly [RegExp, RosaryMysterySet]> = [
  [/joyful\s+mysteries?/i, "joyful"],
  [/sorrowful\s+mysteries?/i, "sorrowful"],
  [/glorious\s+mysteries?/i, "glorious"],
  [/luminous\s+mysteries?/i, "luminous"],
  [/mysteries?\s+of\s+light/i, "luminous"],
];

/**
 * Match a heading like "The Joyful Mysteries" → "joyful". Returns
 * null when the heading does not look like a mystery-set boundary.
 */
export function matchMysterySet(heading: string): RosaryMysterySet | null {
  const trimmed = heading.trim();
  for (const [pattern, set] of SET_ALIASES) {
    if (pattern.test(trimmed)) return set;
  }
  return null;
}

/**
 * Compare a source-supplied Rosary structure against the canonical
 * structure. Returns a list of mismatches the builder can surface
 * as missing-field errors.
 */
export function diffRosaryStructure(opts: {
  set: RosaryMysterySet;
  mysteryTitles: ReadonlyArray<string>;
}): {
  matches: number;
  missingTitles: ReadonlyArray<string>;
  extraTitles: ReadonlyArray<string>;
} {
  const canonical = CANONICAL_ROSARY_STRUCTURE[opts.set];
  const canonicalSet = new Set(canonical.map((m) => m.title.toLowerCase()));
  const provided = new Set(opts.mysteryTitles.map((t) => t.trim().toLowerCase()));
  const matches = canonical.filter((m) => provided.has(m.title.toLowerCase())).length;
  const missingTitles = canonical
    .filter((m) => !provided.has(m.title.toLowerCase()))
    .map((m) => m.title);
  const extraTitles = [...provided].filter((t) => !canonicalSet.has(t));
  return { matches, missingTitles, extraTitles };
}

/**
 * Detect when a source page about the Rosary is actually an article
 * or livestream rather than a Rosary guide. Returns true when the
 * page should be rejected by the builder.
 */
export function isRosaryArticleOrLivestream(opts: {
  title?: string | null;
  body?: string | null;
}): boolean {
  const combined = `${opts.title ?? ""}\n${opts.body ?? ""}`.toLowerCase();
  const livestreamCues = [
    "watch live",
    "live stream",
    "livestreamed",
    "join us live",
    "click here to join",
    "register for tonight",
  ];
  const articleCues = [
    "according to ",
    "as theologian ",
    "scholars believe ",
    "have you ever wondered",
    "in this article",
    "click here to subscribe",
  ];
  const livestreamHits = livestreamCues.filter((c) => combined.includes(c)).length;
  if (livestreamHits >= 1) return true;
  const articleHits = articleCues.filter((c) => combined.includes(c)).length;
  if (articleHits >= 2) return true;
  return false;
}
