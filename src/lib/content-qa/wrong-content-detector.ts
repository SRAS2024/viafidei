/**
 * WrongContentDetector — the global "this is not actually devotional
 * content" gate. Runs before persistence and during database cleanup
 * for every content type that should be the actual prayer / saint /
 * apparition / devotion / novena / sacrament / rosary / consecration /
 * spiritual guide / parish profile.
 *
 * The detector classifies a candidate's title + body for "wrong
 * content" signals — livestream, event, bulletin, news article,
 * registration page, press release, podcast, etc. A single harmless
 * word does not delete a valid item; the detector requires combinations
 * of signals OR a single strong signal paired with the absence of the
 * actual content-type marker.
 *
 * Each public delete rule documented in the spec:
 *
 *   - Prayer candidate containing "livestream/watch live/YouTube/
 *     prayer service" with no actual prayer language → delete.
 *   - Saint candidate containing "parish/school/staff/bulletin/
 *     livestream" that cannot prove it is a saint profile → delete.
 *   - Sacrament candidate containing "registration/schedule/class
 *     sign up" with no sacramental formation content → delete.
 *   - Devotion candidate containing "event/retreat/join us" with no
 *     practice structure → delete.
 *
 * This module is content-type agnostic; the per-contract delete rules
 * live in the contracts themselves and call helpers from here.
 */

import type { ContentTypeKey } from "./types";

/**
 * Strong wrong-content signals — these almost always mean the page is
 * a livestream / event / bulletin / news / press release page rather
 * than the actual content the tab promises.
 */
const STRONG_WRONG_SIGNALS: ReadonlyArray<RegExp> = [
  // Livestream / broadcast indicators.
  /\b(live\s*stream(?:ed)?|live[-\s]?broadcast|broadcast(?:ing)?|watch\s+live|watch\s+now|stream(?:ing)?\s+(?:live|now|today))\b/i,
  /\bwatch\s+(?:on\s+)?(?:youtube|vimeo|facebook|instagram|twitch|x\.com)\b/i,
  /\b(?:facebook\s+live|zoom\s+(?:meeting|webinar)|google\s+meet)\b/i,
  /\b(?:livestream\s+from\s+|livestreamed\s+(?:from|by|at))/i,
  /\b(?:homily\s+video|podcast\s+episode|episode\s+\d+|series\s+overview)\b/i,
  // Event / registration / RSVP signals.
  /\b(?:register\s+(?:now|today|here)|registration\s+(?:opens?|required|deadline)|rsvp(?:\s+by)?|sign\s+up\s+(?:here|now|today))\b/i,
  /\b(?:tickets?\s+(?:available|sold|on\s+sale)|buy\s+tickets|event\s+tickets)\b/i,
  /\b(?:upcoming\s+events?|event\s+(?:calendar|listings?)|join\s+us\s+for|click\s+here\s+to)\b/i,
  // Bulletin / newsletter / weekly update.
  /\b(?:parish\s+bulletin|weekly\s+bulletin|sunday\s+bulletin|bulletin\s+(?:archive|issue))\b/i,
  /\b(?:weekly\s+(?:update|newsletter)|monthly\s+newsletter|subscribe\s+to\s+our)\b/i,
  /\b(?:parish\s+announcement|school\s+announcement|diocesan\s+announcement)\b/i,
  // News / press release / blog post.
  /\b(?:news\s+(?:article|release|report)|press\s+release|breaking\s+news|news\s+story)\b/i,
  /\b(?:blog\s+(?:post|article|entry)|originally\s+(?:posted|published)\s+on|read\s+more\s+at)\b/i,
  // Donation / staff / office hours.
  /\b(?:donate\s+(?:now|today|here)|donation\s+(?:page|appeal|drive)|make\s+a\s+(?:donation|gift))\b/i,
  /\b(?:staff\s+(?:directory|page|listing)|meet\s+(?:our|the)\s+(?:staff|team)|parish\s+staff)\b/i,
  /\b(?:office\s+hours|parish\s+office\s+(?:hours|address|phone))\b/i,
];

/**
 * Weaker signals — these only mean "wrong" when combined with another
 * weak signal OR with the absence of the content-type's positive
 * marker (a prayer with no prayer language, a saint with no
 * biography vocabulary, etc.).
 */
const WEAK_WRONG_SIGNALS: ReadonlyArray<RegExp> = [
  /\b(?:event|calendar|conference)\b/i,
  /\b(?:join\s+us|come\s+(?:join|celebrate))\b/i,
  /\b(?:retreat|workshop|class\s+sign[- ]?up)\b/i,
  /\b(?:youtube|vimeo|facebook|instagram|twitter|tiktok|twitch)\b/i,
  /\b(?:schedule|calendar|directory|listing)\b/i,
];

const MASS_SCHEDULE_SIGNAL =
  /\b(?:mass\s+(?:schedule|times?|hours)|times?\s+of\s+mass|sunday\s+mass\s+at|daily\s+mass\s+(?:at|times?))\b/i;

const PRAYER_LANGUAGE_RE =
  /\b(amen|o\s+lord|o\s+god|o\s+jesus|hail\s+mary|glory\s+be|lord\s+have\s+mercy|we\s+beseech|grant\s+(?:us|me|that)|pray\s+for\s+us|in\s+the\s+name\s+of\s+the\s+father|i\s+(?:believe|confess|adore|love|offer|thank)|have\s+mercy|hallowed|forgive\s+us|deliver\s+us|come\s+holy\s+spirit|let\s+us\s+pray)\b/i;

const SAINT_BIOGRAPHY_RE =
  /\b(?:saint|st\.?|blessed|bl\.?|venerable|martyr|virgin|priest|monk|nun|bishop|pope|doctor\s+of\s+the\s+church|born|died|canon(?:ized|ised)|beatif(?:ied|ication)|feast\s+day|patron(?:ess)?)\b/i;

const DEVOTION_PRACTICE_RE =
  /\b(?:how\s+to\s+pray|to\s+pray\s+(?:the|this)|practice|steps?\s+of|begin\s+by|first[, ]|then\s+(?:say|pray|recite)|recite|step[s\s]+\d+|day\s+\d+|opening\s+prayer|closing\s+prayer|mysteries|decades?)\b/i;

const SACRAMENT_FORMATION_RE =
  /\b(?:sacrament(?:al)?\s+(?:grace|theology|character|effect|matter|form|minister|instituted|preparation|gift)|sacrament\s+(?:instituted|is|of|gives|confers)|catechism|catechetical|biblical\s+foundation|preparation\s+(?:for|guide)|how\s+(?:to\s+receive|the\s+sacrament)|matter\s+is\s+\w+|form\s+is\s+(?:the\s+)?\w+|trinitarian\s+formula|sanctifying\s+grace|original\s+sin|christian\s+initiation|outward\s+sign|indelible\s+character)\b/i;

const HISTORY_NARRATIVE_RE =
  /\b(?:council|encyclical|schism|founding|catechism\s+of\s+the\s+catholic\s+church|code\s+of\s+canon\s+law|consecration\s+(?:of|by)|papal|pope|magisterium|doctrine|infallib|ex\s+cathedra|in\s+\d{3,4}|\d{3,4}\s+ad)\b/i;

const LITURGY_FORMATION_RE =
  /\b(?:liturgical\s+(?:year|season|color|book|symbol)|liturgy\s+(?:of|is)|mass\s+(?:structure|parts?|order)|eucharistic\s+(?:prayer|liturgy)|rite\s+of|funeral\s+rite|marriage\s+rite|ordination\s+rite|order\s+of\s+mass)\b/i;

/**
 * Density check — what fraction of the text is the strong-signal
 * regex matching against. A page that is mostly nav links + livestream
 * labels triggers; a page with one passing word does not.
 */
function strongSignalDensity(text: string): { count: number; density: number } {
  if (!text || text.length === 0) return { count: 0, density: 0 };
  let total = 0;
  for (const re of STRONG_WRONG_SIGNALS) {
    const matches = text.match(new RegExp(re.source, "gi"));
    if (matches) total += matches.length;
  }
  const wordCount = text.trim().split(/\s+/).length;
  return { count: total, density: wordCount === 0 ? 0 : total / wordCount };
}

function countWeakSignals(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (const re of WEAK_WRONG_SIGNALS) {
    if (re.test(text)) count += 1;
  }
  return count;
}

/**
 * What the detector returns. `delete: true` means hard-delete the row
 * (or refuse to persist a fresh ingest); `delete: false` means the
 * content passed the wrong-content gate (other contracts still run).
 */
export type WrongContentResult = {
  delete: boolean;
  reasons: string[];
  triggeredSignals: string[];
};

/**
 * Run the wrong-content detector against a candidate. The two text
 * fields are required because some content types carry the body in
 * `body`, others in `summary`, biography, practiceInstructions, etc.
 * The caller selects the right two fields.
 */
export function detectWrongContent(args: {
  contentType: ContentTypeKey;
  title: string | null | undefined;
  body: string | null | undefined;
}): WrongContentResult {
  const title = (args.title ?? "").trim();
  const body = (args.body ?? "").trim();
  const blob = `${title}\n${body}`;
  const reasons: string[] = [];
  const triggeredSignals: string[] = [];

  const titleHasStrong = STRONG_WRONG_SIGNALS.some((re) => re.test(title));
  const bodyStrong = strongSignalDensity(body);
  const weak = countWeakSignals(blob);

  // 1. Title clearly is a livestream / event / bulletin: strong delete.
  if (titleHasStrong) {
    reasons.push("Title matches a livestream / event / bulletin / news / press-release pattern");
    triggeredSignals.push("title:strong");
  }
  // 2. Body has multiple strong matches OR a single strong match in a
  // very short body (which means the page is essentially nothing but
  // that signal).
  if (bodyStrong.count >= 2) {
    reasons.push(
      `Body contains ${bodyStrong.count} strong wrong-content signals (livestream / event / news)`,
    );
    triggeredSignals.push("body:strong-multi");
  }
  if (bodyStrong.count >= 1 && body.length < 240) {
    reasons.push(
      "Body is short AND contains a wrong-content signal (livestream / event / news / press)",
    );
    triggeredSignals.push("body:strong-short");
  }

  // 3. Per-content-type combination rules. The wrong-content detector
  // is content-type aware — a Saint candidate that contains "parish"
  // AND lacks any biography vocabulary is wrong content; a Prayer
  // candidate that contains "livestream" AND no prayer language is
  // wrong content.
  switch (args.contentType) {
    case "Prayer":
      if (bodyStrong.count >= 1 && !PRAYER_LANGUAGE_RE.test(blob)) {
        reasons.push(
          "Prayer candidate has wrong-content signals AND lacks recognisable prayer language",
        );
        triggeredSignals.push("prayer:strong-no-prayer-lang");
      }
      // Specific livestream / event prayer-page deletion (the spec's
      // canonical example).
      if (
        /\b(?:livestream|watch\s+live|prayer\s+service|youtube|vimeo|facebook\s+live)\b/i.test(
          blob,
        ) &&
        !PRAYER_LANGUAGE_RE.test(blob)
      ) {
        reasons.push("Prayer candidate is a livestream / video / event with no actual prayer text");
        triggeredSignals.push("prayer:livestream");
      }
      break;

    case "Saint":
      if (
        /\b(?:parish|church|school|academy|university|hospital|shrine\s+event|staff\s+directory|ministry\s+page|livestream|bulletin)\b/i.test(
          blob,
        ) &&
        !SAINT_BIOGRAPHY_RE.test(blob)
      ) {
        reasons.push(
          "Saint candidate contains institution / livestream / bulletin signals AND lacks biography vocabulary",
        );
        triggeredSignals.push("saint:institution-no-bio");
      }
      // Mass schedule alone on a saint page = parish page, not saint.
      if (MASS_SCHEDULE_SIGNAL.test(blob) && !SAINT_BIOGRAPHY_RE.test(blob)) {
        reasons.push("Saint candidate is essentially a Mass schedule, not a saint biography");
        triggeredSignals.push("saint:mass-schedule");
      }
      break;

    case "Sacrament":
      if (
        /\b(?:registration|class\s+sign[- ]?up|sign\s+up\s+(?:for|here)|enroll(?:ment)?|register\s+for)\b/i.test(
          blob,
        ) &&
        !SACRAMENT_FORMATION_RE.test(blob)
      ) {
        reasons.push(
          "Sacrament candidate is a registration / sign-up / schedule page, not sacramental formation",
        );
        triggeredSignals.push("sacrament:registration-no-formation");
      }
      // Plain confession schedule, with no sacramental theology.
      if (
        /\b(?:confession\s+(?:schedule|times?|hours)|times?\s+of\s+confession)\b/i.test(blob) &&
        !SACRAMENT_FORMATION_RE.test(blob)
      ) {
        reasons.push("Sacrament candidate is a confession schedule, not Reconciliation formation");
        triggeredSignals.push("sacrament:confession-schedule");
      }
      break;

    case "Devotion":
    case "Rosary":
    case "Novena":
    case "Consecration":
      if (
        /\b(?:event|retreat|workshop|conference|join\s+us|come\s+join|advertised|advertisement|registration)\b/i.test(
          blob,
        ) &&
        !DEVOTION_PRACTICE_RE.test(blob)
      ) {
        reasons.push(
          `${args.contentType} candidate is an event / retreat / advertisement, not a usable practice guide`,
        );
        triggeredSignals.push("devotion:event-no-practice");
      }
      break;

    case "SpiritualGuidance":
      if (
        bodyStrong.count >= 1 &&
        !DEVOTION_PRACTICE_RE.test(blob) &&
        !SACRAMENT_FORMATION_RE.test(blob) &&
        !PRAYER_LANGUAGE_RE.test(blob)
      ) {
        reasons.push(
          "Spiritual Guidance candidate has wrong-content signals AND lacks practice / formation language",
        );
        triggeredSignals.push("guide:no-practical");
      }
      break;

    case "Liturgy":
      // Mass-schedule by itself = parish information, not liturgical
      // formation.
      if (MASS_SCHEDULE_SIGNAL.test(blob) && !LITURGY_FORMATION_RE.test(blob)) {
        reasons.push(
          "Liturgy candidate is a Mass schedule / parish listing, not liturgical formation",
        );
        triggeredSignals.push("liturgy:mass-schedule");
      }
      if (
        bodyStrong.count >= 1 &&
        !LITURGY_FORMATION_RE.test(blob) &&
        !HISTORY_NARRATIVE_RE.test(blob)
      ) {
        reasons.push(
          "Liturgy candidate has wrong-content signals AND lacks liturgical-formation vocabulary",
        );
        triggeredSignals.push("liturgy:no-formation");
      }
      break;

    case "History":
      if (bodyStrong.count >= 1 && !HISTORY_NARRATIVE_RE.test(blob)) {
        reasons.push(
          "History candidate has wrong-content signals AND lacks historical / doctrinal narrative",
        );
        triggeredSignals.push("history:no-narrative");
      }
      break;

    case "Parish":
      // Parish records ARE allowed to mention Mass schedule, office
      // hours, and bulletins inline (that's normal parish data). They
      // are NOT allowed to be only a bulletin / livestream page.
      if (titleHasStrong) {
        reasons.push("Parish title is itself a bulletin / livestream / event page");
        triggeredSignals.push("parish:title-not-parish");
      }
      break;

    case "MarianApparition":
      if (
        /\b(?:travel|tourism|pilgrimage\s+booking|hotel|airfare|tour\s+package|visit\s+(?:lourdes|fatima|guadalupe))\b/i.test(
          blob,
        )
      ) {
        reasons.push("Marian apparition candidate is a travel / tourism / booking page");
        triggeredSignals.push("apparition:travel");
      }
      break;
  }

  // 4. High weak-signal density: a page mostly made of nav links,
  // event blurbs, and share buttons should be deleted regardless of
  // content type.
  if (weak >= 3 && body.length < 400) {
    reasons.push(
      `Page text appears to be mostly links / navigation / events (${weak} weak signals in a short body)`,
    );
    triggeredSignals.push("density:weak-many");
  }

  return {
    delete: reasons.length > 0,
    reasons,
    triggeredSignals,
  };
}

/**
 * Helper used by contracts to quickly check whether a body has any
 * prayer / biography / practice / formation positive marker. Exposed
 * for tests + reuse by other contracts.
 */
export const contentTypeMarkers = {
  prayer: PRAYER_LANGUAGE_RE,
  saint: SAINT_BIOGRAPHY_RE,
  devotionPractice: DEVOTION_PRACTICE_RE,
  sacramentFormation: SACRAMENT_FORMATION_RE,
  historyNarrative: HISTORY_NARRATIVE_RE,
  liturgyFormation: LITURGY_FORMATION_RE,
  massSchedule: MASS_SCHEDULE_SIGNAL,
};
