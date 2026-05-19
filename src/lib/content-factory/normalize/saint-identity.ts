/**
 * Saint identity guard (spec §7).
 *
 * Tells the Saint builder when a page is *about* a saint (good) vs.
 * an *institution named after* a saint (bad — must be rejected).
 *
 * Examples that should be rejected:
 *   - "St. Patrick's Cathedral, New York" (parish/church)
 *   - "St. Thomas Aquinas Catholic School"
 *   - "St. Joseph Hospital"
 *   - "Father John at St. Mary's Parish"
 *   - "Holy Trinity Catholic School Staff Directory"
 *
 * The matcher returns:
 *   - kind: "saint_profile"   — looks like a real saint biography
 *   - kind: "institution"      — looks like a parish/school/hospital
 *   - kind: "staff_or_bulletin" — looks like a staff page or bulletin
 *   - kind: "livestream"        — a Mass / event / livestream page
 *   - kind: "unknown"           — neutral; fall back to existing builder rules
 *
 * The Saint builder calls `assessSaintIdentity()` first and aborts
 * with the matching `wrong_content` outcome when the kind is not
 * "saint_profile" or "unknown".
 */

export type SaintIdentityKind =
  | "saint_profile"
  | "institution"
  | "staff_or_bulletin"
  | "livestream"
  | "unknown";

export type SaintIdentityAssessment = {
  kind: SaintIdentityKind;
  reason: string;
};

const INSTITUTION_SUFFIXES: ReadonlyArray<RegExp> = [
  /\b(parish|cathedral|chapel|church|basilica|abbey|monastery|priory|oratory)\b/i,
  /\b(school|academy|college|university|institute|seminary)\b/i,
  /\b(hospital|clinic|hospice|medical\s+center|health\s+center)\b/i,
  /\b(nursing\s+home|retirement\s+home|home\s+for\s+the\s+aged)\b/i,
  /\b(diocese\s+of|archdiocese\s+of)\b/i,
];

const STAFF_BULLETIN_PATTERNS: ReadonlyArray<RegExp> = [
  /\bstaff\s+directory\b/i,
  /\bparish\s+(staff|bulletin|news|calendar)\b/i,
  /\bweekly\s+bulletin\b/i,
  /\bmass\s+schedule\b/i,
  /\boffice\s+hours\b/i,
  /\bcontact\s+(us|info|information)\b/i,
  /\bgiving\s+page\b/i,
  /\bdonation\s+page\b/i,
  /\bregister\s+for\s+\w+\s+class\b/i,
  /\bphone:\s+\(?\d/i,
  /\bemail:\s+\S+@\S/i,
];

const LIVESTREAM_PATTERNS: ReadonlyArray<RegExp> = [
  /\blive\s+(stream|streaming|broadcast)\b/i,
  /\bwatch\s+live\b/i,
  /\bjoin\s+us\s+(live|online)\b/i,
  /\bzoom\s+(meeting|link)\b/i,
  /\bevent\s+(listing|page|registration)\b/i,
  /\bretreat\s+registration\b/i,
];

const SAINT_PROFILE_CUES: ReadonlyArray<RegExp> = [
  /\bfeast\s+day:?\s+/i,
  /\bcanonized\b/i,
  /\bbeatified\b/i,
  /\bdoctor\s+of\s+the\s+church\b/i,
  /\bpatron(age)?\s+(of|saint\s+of)\b/i,
  /\bborn\s+in\b/i,
  /\bdied\s+in\b/i,
  /\bmartyr(ed|dom)?\b/i,
  /\breligious\s+order\b/i,
  /\bfounder\s+of\b/i,
];

function countMatches(text: string, patterns: ReadonlyArray<RegExp>): number {
  let n = 0;
  for (const p of patterns) if (p.test(text)) n += 1;
  return n;
}

export function assessSaintIdentity(opts: {
  title?: string | null;
  body?: string | null;
}): SaintIdentityAssessment {
  const title = opts.title ?? "";
  const body = opts.body ?? "";
  const combined = `${title}\n${body}`;

  // Livestream / event page beats everything else — these are noise
  // and must be rejected even when a saint's name is in the title.
  if (countMatches(combined, LIVESTREAM_PATTERNS) >= 1) {
    return {
      kind: "livestream",
      reason: "Page contains livestream / event registration cues",
    };
  }

  // Staff directory / bulletin — common false positive for saint
  // profiles because parishes name themselves after saints.
  if (countMatches(combined, STAFF_BULLETIN_PATTERNS) >= 2) {
    return {
      kind: "staff_or_bulletin",
      reason: "Page contains multiple staff/bulletin cues (phone, email, mass schedule, ...)",
    };
  }

  // Institution match in the title is the strongest signal that the
  // page is *about an institution*, not a saint. We only count the
  // signal as decisive when the body does not also clearly profile
  // the saint themselves.
  const profileCues = countMatches(combined, SAINT_PROFILE_CUES);
  const institutionTitle = INSTITUTION_SUFFIXES.some((p) => p.test(title));
  const institutionBody = INSTITUTION_SUFFIXES.some((p) => p.test(body));
  if (institutionTitle && profileCues <= 1) {
    return {
      kind: "institution",
      reason: "Title names an institution (parish/church/school/hospital/etc.)",
    };
  }
  if (institutionTitle && institutionBody && profileCues < 3) {
    return {
      kind: "institution",
      reason: "Title and body both reference an institution; profile cues are weak",
    };
  }

  // Strong profile signals — fast accept.
  if (profileCues >= 2) {
    return {
      kind: "saint_profile",
      reason: `Detected ${profileCues} saint-profile cues (feast day, canonization, patronage, etc.)`,
    };
  }

  return {
    kind: "unknown",
    reason: "No decisive signal",
  };
}
