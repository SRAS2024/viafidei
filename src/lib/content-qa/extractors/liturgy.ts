/**
 * Liturgy extractor (Section 8). Produces a typed Liturgy package
 * payload limited to *formation* content — never a Mass schedule
 * page or parish event listing.
 *
 * Liturgy kinds: Mass structure, Liturgical year, Symbolism, Marriage
 * rite, Funeral rite, Ordination rite, Glossary, General formation.
 */

export type LiturgyExtractionResult = {
  complete: boolean;
  payload: {
    liturgyKind?: string;
    title?: string;
    summary?: string;
    body?: string;
    sourceUrl?: string;
  };
  provenance: Record<string, string>;
  missingFields: string[];
  wrongContentReason?: string;
};

const KIND_HINTS: Array<{ kind: string; re: RegExp }> = [
  {
    kind: "Mass structure",
    re: /\b(?:order\s+of\s+mass|mass\s+(?:structure|parts?|order)|eucharistic\s+prayer)\b/i,
  },
  {
    kind: "Liturgical year",
    re: /\b(?:liturgical\s+(?:year|season|calendar)|advent|lent|easter\s+season)\b/i,
  },
  { kind: "Symbolism", re: /\b(?:liturgical\s+(?:color|symbol)|vestment|chalice|paten)\b/i },
  { kind: "Marriage rite", re: /\bmarriage\s+rite\b/i },
  { kind: "Funeral rite", re: /\bfuneral\s+rite\b/i },
  { kind: "Ordination rite", re: /\bordination\s+rite\b/i },
  { kind: "Glossary", re: /\bglossary\b/i },
];

const MASS_SCHEDULE_RE =
  /\b(?:mass\s+(?:schedule|times?|hours)|times?\s+of\s+mass|sunday\s+mass\s+at|daily\s+mass\s+(?:at|times?))\b/i;
const PARISH_EVENT_RE = /\b(?:parish\s+event|youth\s+night|community\s+fundraiser|gala)\b/i;

function classifyLiturgyKind(text: string): string {
  for (const h of KIND_HINTS) {
    if (h.re.test(text)) return h.kind;
  }
  return "General liturgical formation";
}

export function extractLiturgy(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): LiturgyExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];
  let wrongContentReason: string | undefined;

  const title = args.title?.trim() || undefined;
  if (title) provenance.title = "title input";
  else missingFields.push("title");

  const textForClassifier = `${title ?? ""}\n${args.body}`;

  if (MASS_SCHEDULE_RE.test(textForClassifier)) {
    wrongContentReason = "source_was_event_page";
    missingFields.push("liturgyKind");
  } else if (PARISH_EVENT_RE.test(textForClassifier)) {
    wrongContentReason = "source_was_event_page";
    missingFields.push("liturgyKind");
  }

  const liturgyKind = classifyLiturgyKind(textForClassifier);
  if (!wrongContentReason) provenance.liturgyKind = "regex classifier";

  const summary = args.body.split(/\n\n/)[0]?.trim() || undefined;
  if (summary) provenance.summary = "first paragraph";

  const body = args.body.trim() || undefined;
  if (body && body.length >= 80) {
    provenance.body = "input body";
  } else {
    missingFields.push("body");
  }

  return {
    complete: missingFields.length === 0,
    payload: {
      liturgyKind,
      title,
      summary,
      body,
      sourceUrl: args.sourceUrl,
    },
    provenance,
    missingFields,
    wrongContentReason,
  };
}
