/**
 * ConfusionDetector (spec §8). Catches "easily-confused" pages that
 * the URL / title classifier would otherwise mark as the wrong
 * content type. Each detector returns a confusion reason when it
 * fires; the classifier subtracts confidence and may flip the page
 * to UNUSABLE.
 *
 * Spec §8 confusion patterns:
 *   - saint-named schools, hospitals, parishes
 *   - prayer livestreams / event pages
 *   - novena articles without the actual novena
 *   - devotion articles without practice instructions
 *   - sacrament parish schedule pages (not catechism)
 *   - Mass schedules mistaken as liturgy formation
 *   - Church news mistaken as history
 *   - parish bulletins mistaken as parish records
 */

export interface ConfusionInput {
  url: string;
  title?: string | null;
  bodyText?: string | null;
  headings?: string[];
  proposedContentType: string;
}

export interface ConfusionResult {
  /** True when a confusion pattern matched. */
  confused: boolean;
  /** Names of the rules that fired (for the audit view). */
  rules: string[];
  /** Penalty to subtract from classifier confidence. */
  penalty: number;
  /** Human-readable explanation for the admin UI. */
  explanation: string;
}

interface ConfusionRule {
  name: string;
  appliesTo: string[];
  urlPattern?: RegExp;
  titlePattern?: RegExp;
  bodyMustContain?: RegExp[]; // if NONE present, it's confused
  bodyMustNotContain?: RegExp[]; // if ANY present, it's confused
  penalty: number;
  reason: string;
}

const CONFUSION_RULES: ConfusionRule[] = [
  // ── Saint-named schools / hospitals / parishes ─────────────────
  {
    name: "saint-named-school",
    appliesTo: ["SAINT"],
    urlPattern: /\/school|\/academy|\/college\/[^/]*saint|\/st-[a-z]+-(school|academy)/i,
    titlePattern: /(school|academy|college).+saint|saint.+(school|academy|college)/i,
    penalty: 0.6,
    reason: "Page is a saint-named school, not a saint biography.",
  },
  {
    name: "saint-named-hospital",
    appliesTo: ["SAINT"],
    urlPattern: /\/hospital|\/medical-center|\/healthcare|\/health-system/i,
    titlePattern: /(hospital|medical center|healthcare).+saint|saint.+(hospital|medical|health)/i,
    penalty: 0.6,
    reason: "Page is a saint-named hospital, not a saint biography.",
  },
  {
    name: "saint-named-parish",
    appliesTo: ["SAINT"],
    urlPattern: /\/parish\/|saint-[a-z]+-parish|\/st-[a-z]+-(parish|church)/i,
    bodyMustContain: [/feast day/i, /canoni[sz]ed/i, /biography/i, /born in/i, /died in/i],
    penalty: 0.55,
    reason: "Page is a saint-named parish directory, not a saint biography.",
  },

  // ── Prayer livestreams / event pages ──────────────────────────
  {
    name: "prayer-livestream",
    appliesTo: ["PRAYER"],
    urlPattern: /\/(livestream|live|watch|broadcast)/i,
    penalty: 0.6,
    reason: "Page is a livestream, not a prayer text.",
  },
  {
    name: "prayer-event",
    appliesTo: ["PRAYER"],
    urlPattern: /\/event\/|\/events\/|\/calendar/i,
    bodyMustContain: [/amen\.?$/im, /our father/i, /hail mary/i, /through christ our lord/i],
    penalty: 0.55,
    reason: "Page is an event listing, not the actual prayer.",
  },

  // ── Novena articles without the actual novena ─────────────────
  {
    name: "novena-article-no-days",
    appliesTo: ["NOVENA"],
    bodyMustContain: [/day 1|day one/i, /day 2|day two/i, /day 3|day three/i, /day 9|day nine/i],
    penalty: 0.6,
    reason: "Article talks about a novena but contains no day-by-day prayer sections.",
  },

  // ── Devotion articles without practice instructions ───────────
  {
    name: "devotion-no-instructions",
    appliesTo: ["DEVOTION"],
    bodyMustContain: [/how to|instructions|steps|begin by|recite|pray as follows/i],
    penalty: 0.5,
    reason: "Article describes a devotion but does not include practice instructions.",
  },

  // ── Sacrament parish-schedule pages mistaken for catechism ────
  {
    name: "sacrament-schedule",
    appliesTo: ["SACRAMENT"],
    urlPattern: /(schedule|mass-times|confession-times)/i,
    penalty: 0.55,
    reason: "Page is a parish sacrament schedule, not catechetical formation.",
  },
  {
    name: "sacrament-no-catechism",
    appliesTo: ["SACRAMENT"],
    bodyMustContain: [
      /one of the seven sacraments|catechism|matter|form|minister|effect|sign and instrument/i,
    ],
    penalty: 0.4,
    reason: "Page mentions a sacrament but contains no catechetical content.",
  },

  // ── Mass schedules mistaken as liturgy formation ──────────────
  {
    name: "liturgy-schedule",
    appliesTo: ["LITURGICAL"],
    urlPattern: /(mass-schedule|mass-times|service-times|liturgy-schedule|schedule\/|\/hours)/i,
    bodyMustNotContain: [/order of mass|eucharistic prayer|lectionary/i],
    penalty: 0.55,
    reason: "Page is a Mass schedule, not liturgical formation content.",
  },

  // ── Church news mistaken as history ───────────────────────────
  {
    name: "history-is-news",
    appliesTo: ["CHURCH_DOCUMENT", "HISTORY"],
    urlPattern: /\/news\/|\/press|\/blog\/|\/announc/i,
    penalty: 0.55,
    reason: "Page is a news article, not a Church history document.",
  },

  // ── Parish bulletins mistaken as parish records ───────────────
  {
    name: "parish-bulletin",
    appliesTo: ["PARISH"],
    urlPattern: /\/bulletin/i,
    penalty: 0.55,
    reason: "Page is a parish bulletin, not a parish directory record.",
  },
];

export function detectConfusion(input: ConfusionInput): ConfusionResult {
  const url = input.url ?? "";
  const title = input.title ?? "";
  const body = input.bodyText ?? "";
  const text = `${title}\n${body}`;
  const matchedRules: string[] = [];
  const reasons: string[] = [];
  let penalty = 0;

  for (const rule of CONFUSION_RULES) {
    if (!rule.appliesTo.includes(input.proposedContentType)) continue;
    let fires = false;
    if (rule.urlPattern && rule.urlPattern.test(url)) fires = true;
    if (rule.titlePattern && rule.titlePattern.test(title)) fires = true;

    // "Must contain" rules fire when NONE of the patterns are found —
    // we expected one of them and got nothing.
    if (rule.bodyMustContain && rule.bodyMustContain.length > 0) {
      const matchedAny = rule.bodyMustContain.some((p) => p.test(text));
      if (!matchedAny) fires = true;
    }
    if (rule.bodyMustNotContain) {
      const matchedAny = rule.bodyMustNotContain.some((p) => p.test(text));
      if (matchedAny) fires = true;
    }

    if (fires) {
      matchedRules.push(rule.name);
      reasons.push(rule.reason);
      penalty += rule.penalty;
    }
  }

  return {
    confused: matchedRules.length > 0,
    rules: matchedRules,
    penalty: Math.min(1, penalty),
    explanation: reasons.length === 0 ? "No confusion patterns matched." : reasons.join(" "),
  };
}

export const CONFUSION_RULE_NAMES = CONFUSION_RULES.map((r) => r.name);
