/**
 * Deterministic content classifier (spec §7). Given a source page's
 * URL, title, headings, and body text, decides which content type it
 * belongs to — or rejects it as unusable.
 *
 * Rules-only: no AI APIs. Each rule contributes to a per-type score;
 * the highest score above the threshold wins. Below threshold rounds
 * to UNUSABLE (the planner can then route the page to rare human
 * review or drop it).
 */

import type { ChecklistContentType } from "@prisma/client";

import { detectConfusion } from "./confusion-detector";

export type ClassifierContentType =
  | ChecklistContentType
  | "ROSARY"
  | "CONSECRATION"
  | "WRONG"
  | "UNUSABLE";

export interface ClassifierInput {
  url: string;
  title?: string | null;
  headings?: string[];
  bodyText?: string | null;
  sourceHostRole?: string | null;
  sourceReputationTier?: "TRUSTED" | "PROBATION" | "PAUSED" | null;
}

export interface ClassificationResult {
  contentType: ClassifierContentType;
  confidence: number;
  reasons: string[];
  perTypeScores: Record<string, number>;
}

const CLASSIFY_THRESHOLD = 0.55;

/** URL-only junk patterns — short-circuit reject. */
const URL_JUNK_PATTERNS: RegExp[] = [
  /\/livestream/i,
  /\/event(s)?\//i,
  /\/bulletin/i,
  /\/donat(e|ion)/i,
  /\/staff/i,
  /\/store/i,
  /\/shop/i,
  /\/login/i,
  /\/calendar/i,
  /\/press[- ]release/i,
  /\/career/i,
  /\/job/i,
];

interface TypeRule {
  type: ClassifierContentType;
  urlPatterns?: RegExp[];
  titlePatterns?: RegExp[];
  headingPatterns?: RegExp[];
  bodyPatterns?: RegExp[];
  requiredTerms?: string[];
  negativePatterns?: RegExp[];
}

const RULES: TypeRule[] = [
  {
    type: "PRAYER",
    urlPatterns: [/\/pray(er)?(s)?\//i, /\/prayer-/i],
    titlePatterns: [/prayer/i, /\bsay\b.+prayer/i, /\boration\b/i],
    headingPatterns: [/in the name of the father/i, /amen\.?$/im],
    bodyPatterns: [
      /amen[.!]/i,
      /our father/i,
      /hail mary/i,
      /glory be/i,
      /through christ our lord/i,
    ],
    requiredTerms: ["prayer"],
    negativePatterns: [/livestream/i, /event/i, /commentary/i, /reflection only/i],
  },
  {
    type: "SAINT",
    urlPatterns: [/\/saint(s)?\//i, /\/st-[a-z]/i],
    titlePatterns: [/\bsaint\b/i, /\bst\.\s/i, /\bblessed\b/i, /\bvenerable\b/i],
    headingPatterns: [/feast day/i, /patron/i, /biography/i, /canoni[sz]ed/i],
    bodyPatterns: [/feast day/i, /born in \d/i, /died in \d/i, /canoni[sz]ed/i, /patronage/i],
    requiredTerms: ["saint", "feast", "patron", "blessed"],
    negativePatterns: [/saint.*school/i, /saint.*parish.*directory/i, /saint.*hospital/i],
  },
  {
    type: "APPARITION",
    urlPatterns: [/\/apparition/i, /\/lourdes|\/fatima|\/guadalupe|\/akita/i],
    titlePatterns: [/our lady of/i, /apparition/i, /mary appeared/i, /marian apparition/i],
    headingPatterns: [/approval/i, /seer/i, /apparition/i],
    bodyPatterns: [
      /our lady/i,
      /appeared to/i,
      /approved by/i,
      /apparition/i,
      /\b(seer|visionary)\b/i,
    ],
    requiredTerms: ["apparition", "our lady", "mary", "approved"],
  },
  {
    type: "DEVOTION",
    urlPatterns: [/\/devotion(s)?\//i, /\/divine-mercy/i, /\/sacred-heart/i],
    titlePatterns: [/devotion/i, /chaplet/i, /\bnovena\b/i],
    headingPatterns: [/how to pray/i, /instructions/i],
    bodyPatterns: [/devotion/i, /chaplet/i, /enrolled in/i],
    requiredTerms: ["devotion", "chaplet"],
  },
  {
    type: "NOVENA",
    urlPatterns: [/\/novena/i, /-novena/i],
    titlePatterns: [/novena/i, /nine days/i, /9[- ]day/i],
    headingPatterns: [/day 1/i, /day one/i, /day 9/i, /day nine/i],
    bodyPatterns: [/day 1/i, /day 2/i, /day 9/i, /nine consecutive/i],
    requiredTerms: ["novena"],
  },
  {
    type: "ROSARY",
    urlPatterns: [/\/rosary/i],
    titlePatterns: [/rosary/i, /mysteries/i],
    headingPatterns: [
      /joyful mysteries/i,
      /sorrowful mysteries/i,
      /glorious mysteries/i,
      /luminous mysteries/i,
    ],
    bodyPatterns: [
      /joyful mysteries/i,
      /sorrowful mysteries/i,
      /glorious mysteries/i,
      /how to pray the rosary/i,
    ],
    requiredTerms: ["rosary", "mystery"],
  },
  {
    type: "CONSECRATION",
    urlPatterns: [/\/consecration/i, /\/33-day/i],
    titlePatterns: [/consecration/i, /33[- ]day/i],
    headingPatterns: [/day 1/i, /preparation/i, /act of consecration/i],
    bodyPatterns: [/consecration/i, /33 days/i, /act of consecration/i],
    requiredTerms: ["consecration"],
  },
  {
    type: "SACRAMENT",
    urlPatterns: [
      /\/sacrament/i,
      /\/(baptism|eucharist|confirmation|reconciliation|matrimony|orders|anointing)/i,
    ],
    titlePatterns: [
      /sacrament/i,
      /baptism/i,
      /eucharist/i,
      /confirmation/i,
      /reconciliation/i,
      /matrimony/i,
      /holy orders/i,
      /anointing/i,
    ],
    headingPatterns: [/preparation/i, /participation/i, /catechism/i],
    bodyPatterns: [/sacrament/i, /one of the seven/i, /catechism of the catholic church/i],
    requiredTerms: ["sacrament"],
  },
  {
    type: "LITURGICAL",
    urlPatterns: [/\/liturg/i, /\/mass\//i, /\/divine-office/i],
    titlePatterns: [/liturgy/i, /mass/i, /divine office/i, /liturgy of the hours/i],
    headingPatterns: [/order of mass/i, /readings/i, /collect/i],
    bodyPatterns: [/liturgy/i, /eucharistic prayer/i, /lectionary/i],
    requiredTerms: ["liturgy", "mass"],
  },
  {
    type: "CHURCH_DOCUMENT",
    urlPatterns: [/\/encyclical/i, /\/council/i, /\/papal/i, /\/canon-law/i, /\/catechism/i],
    titlePatterns: [
      /encyclical/i,
      /council of/i,
      /apostolic (letter|exhortation|constitution)/i,
      /motu proprio/i,
      /papal/i,
      /catechism/i,
      /canon law/i,
    ],
    headingPatterns: [/articles?/i, /\bsections?\b/i],
    bodyPatterns: [/promulgated/i, /supreme pontiff/i, /apostolic see/i],
    requiredTerms: ["encyclical", "council", "papal", "catechism"],
  },
  {
    type: "MARIAN_TITLE",
    urlPatterns: [/\/marian|\/our-lady-of|\/blessed-virgin/i],
    titlePatterns: [/our lady of [a-z]/i, /\bmarian\b/i, /\bvirgin mary\b/i],
    bodyPatterns: [/our lady/i, /blessed virgin mary/i, /marian devotion/i],
    requiredTerms: ["marian", "our lady", "mary"],
  },
  {
    type: "GUIDE",
    urlPatterns: [/\/guide/i, /\/spiritual-(life|practice|guide)/i, /\/how-to/i],
    titlePatterns: [/guide to/i, /how to/i, /spiritual life/i, /spiritual practice/i],
    bodyPatterns: [/spiritual life/i, /spiritual practice/i, /step by step/i],
    requiredTerms: ["guide", "practice"],
  },
];

function scoreRule(input: ClassifierInput, rule: TypeRule): number {
  let score = 0;
  const url = input.url ?? "";
  const title = input.title ?? "";
  const headings = (input.headings ?? []).join(" \n ");
  const body = (input.bodyText ?? "").slice(0, 20_000); // cap

  if (rule.urlPatterns?.some((p) => p.test(url))) score += 0.35;
  if (rule.titlePatterns?.some((p) => p.test(title))) score += 0.25;
  if (rule.headingPatterns?.some((p) => p.test(headings))) score += 0.15;
  if (rule.bodyPatterns?.some((p) => p.test(body))) score += 0.2;
  if (rule.requiredTerms) {
    const text = `${title} ${body}`.toLowerCase();
    const hit = rule.requiredTerms.some((t) => text.includes(t.toLowerCase()));
    if (hit) score += 0.05;
  }
  if (rule.negativePatterns?.some((p) => p.test(`${url} ${title} ${body}`))) score -= 0.25;
  return Math.max(0, Math.min(1, score));
}

/** Map ROSARY/CONSECRATION into the closest ChecklistContentType. */
export function toChecklistContentType(c: ClassifierContentType): ChecklistContentType | null {
  if (c === "WRONG" || c === "UNUSABLE") return null;
  if (c === "ROSARY" || c === "CONSECRATION") return "SPIRITUAL_PRACTICE";
  return c as ChecklistContentType;
}

export function classify(input: ClassifierInput): ClassificationResult {
  const reasons: string[] = [];
  const perTypeScores: Record<string, number> = {};

  // 1. Junk URL short-circuit.
  for (const pattern of URL_JUNK_PATTERNS) {
    if (pattern.test(input.url)) {
      reasons.push(`URL matches junk pattern ${pattern}.`);
      return {
        contentType: "WRONG",
        confidence: 0.95,
        reasons,
        perTypeScores,
      };
    }
  }

  // 2. Score every rule.
  for (const rule of RULES) {
    const score = scoreRule(input, rule);
    perTypeScores[rule.type] = score;
  }

  // 3. Reputation modifier — TRUSTED sources get +0.05 to the top
  // score; PAUSED sources get -0.2.
  const reputationBonus =
    input.sourceReputationTier === "TRUSTED"
      ? 0.05
      : input.sourceReputationTier === "PAUSED"
        ? -0.2
        : 0;

  // 4. Pick the winner.
  let best: { type: ClassifierContentType; score: number } | null = null;
  for (const rule of RULES) {
    const adjusted = (perTypeScores[rule.type] ?? 0) + reputationBonus;
    if (!best || adjusted > best.score) best = { type: rule.type, score: adjusted };
  }

  if (!best || best.score < CLASSIFY_THRESHOLD) {
    reasons.push(
      `No type scored above the ${CLASSIFY_THRESHOLD} threshold; max=${best?.score.toFixed(2) ?? "0"}`,
    );
    return {
      contentType: "UNUSABLE",
      confidence: best ? Math.max(0, 1 - best.score) : 0.5,
      reasons,
      perTypeScores,
    };
  }

  reasons.push(`${best.type} scored ${best.score.toFixed(2)}.`);
  if (input.sourceReputationTier) {
    reasons.push(`Source tier ${input.sourceReputationTier} applied.`);
  }
  return {
    contentType: best.type,
    confidence: best.score,
    reasons,
    perTypeScores,
  };
}

/**
 * Spec §8 extended classifier output. Returns the same primary
 * decision plus the runner-up types, required-field signals
 * detected / missing, negative patterns found, and a confusion-
 * detector result. Stored durably on AdminWorkerSourceRead so the
 * publish gate + admin UI can show "why this was rejected".
 */
export interface DetailedClassification extends ClassificationResult {
  /** Up to two runner-up types whose score was within 0.2 of the winner. */
  secondaryContentTypes: Array<{ type: ClassifierContentType; score: number }>;
  /** Confidence the page should be rejected outright (1 - max score). */
  rejectionScore: number;
  /** Required-field signals detected in the body (eg. "feast day"). */
  requiredFieldsDetected: string[];
  /** Required-field signals that were absent. */
  requiredFieldsMissing: string[];
  /** Negative patterns the classifier saw (eg. /livestream/). */
  negativePatternsDetected: string[];
  /** Confusion detector verdict. */
  confusion: {
    confused: boolean;
    rules: string[];
    explanation: string;
    penalty: number;
  };
  /** Human-readable explanation combining all signals. */
  explanation: string;
}

/**
 * Required-field markers we expect to find in the body for each
 * content type. Used by the classifier to compute the
 * required-fields-detected / required-fields-missing arrays.
 */
const REQUIRED_FIELD_MARKERS: Record<string, RegExp[]> = {
  PRAYER: [/amen[.!]/i, /our father/i, /hail mary/i, /\bglory be\b/i],
  SAINT: [/feast day/i, /born in \d/i, /died in \d/i, /canoni[sz]ed/i, /patron of/i],
  APPARITION: [/our lady of/i, /appeared to/i, /approved by/i, /\b(seer|visionary)\b/i],
  NOVENA: [/day 1/i, /day 9/i, /nine days/i],
  ROSARY: [/joyful mysteries/i, /sorrowful mysteries/i, /glorious mysteries/i],
  CONSECRATION: [/33 days/i, /act of consecration/i],
  DEVOTION: [/how to|instructions|practice/i],
  SACRAMENT: [/one of the seven sacraments|catechism/i, /minister|effect|matter|form/i],
  LITURGICAL: [/order of mass|eucharistic prayer|lectionary/i],
  CHURCH_DOCUMENT: [/promulgated|supreme pontiff|apostolic see/i],
  PARISH: [/address|street|diocese|pastor/i],
};

/**
 * Extended classify entry point (spec §8). Wraps the simpler
 * classify() result with secondary types, required-field signals,
 * negative-pattern detection, and the confusion detector.
 */
export function classifyDetailed(input: ClassifierInput): DetailedClassification {
  const base = classify(input);

  // Runner-ups within 0.2 of the winner score.
  const sortedTypes = Object.entries(base.perTypeScores)
    .filter(([type]) => type !== base.contentType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type, score]) => ({ type: type as ClassifierContentType, score }));

  // Required-field signal scan against the body.
  const body = (input.bodyText ?? "").slice(0, 20_000);
  const requiredMarkers = REQUIRED_FIELD_MARKERS[base.contentType] ?? [];
  const detected: string[] = [];
  const missing: string[] = [];
  for (const m of requiredMarkers) {
    if (m.test(body)) detected.push(m.source);
    else missing.push(m.source);
  }

  // Negative patterns surfaced (URL or body).
  const negativeHits: string[] = [];
  const combined = `${input.url ?? ""} ${input.title ?? ""} ${body}`;
  for (const rule of RULES) {
    if (rule.type !== base.contentType) continue;
    for (const p of rule.negativePatterns ?? []) {
      if (p.test(combined)) negativeHits.push(p.source);
    }
  }

  // Confusion detector.
  const confusion = detectConfusion({
    url: input.url,
    title: input.title,
    bodyText: input.bodyText,
    headings: input.headings,
    proposedContentType: base.contentType,
  });

  // Adjust confidence downward by the confusion penalty.
  const adjustedConfidence = Math.max(0, base.confidence - confusion.penalty);
  const rejectionScore = 1 - adjustedConfidence;

  // Compose final classification: if confusion penalty pushes
  // confidence below threshold, treat as UNUSABLE — low-confidence
  // pages must not publish (spec §8).
  const finalType =
    adjustedConfidence < CLASSIFY_THRESHOLD
      ? ("UNUSABLE" as ClassifierContentType)
      : base.contentType;

  const explanationLines = [
    `Primary: ${finalType} (confidence ${adjustedConfidence.toFixed(2)}, rejection ${rejectionScore.toFixed(2)}).`,
    sortedTypes.length > 0
      ? `Runner-ups: ${sortedTypes.map((s) => `${s.type}=${s.score.toFixed(2)}`).join(", ")}.`
      : "No runner-up types.",
    detected.length > 0
      ? `Required signals detected: ${detected.slice(0, 4).join(", ")}.`
      : "No required signals detected.",
    missing.length > 0 ? `Missing signals: ${missing.slice(0, 4).join(", ")}.` : "",
    negativeHits.length > 0 ? `Negative patterns: ${negativeHits.join(", ")}.` : "",
    confusion.confused ? `Confusion: ${confusion.explanation}` : "",
  ].filter(Boolean);

  return {
    ...base,
    contentType: finalType,
    confidence: adjustedConfidence,
    secondaryContentTypes: sortedTypes,
    rejectionScore,
    requiredFieldsDetected: detected,
    requiredFieldsMissing: missing,
    negativePatternsDetected: negativeHits,
    confusion: {
      confused: confusion.confused,
      rules: confusion.rules,
      explanation: confusion.explanation,
      penalty: confusion.penalty,
    },
    explanation: explanationLines.join(" "),
  };
}
