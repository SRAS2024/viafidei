/**
 * History extractor (Section 8). Produces a typed History package
 * payload restricted to the approved history categories: councils,
 * major Church events, encyclicals, papal consecrations, schisms,
 * religious order foundings, catechisms, Code of Canon Law, major
 * papal acts, doctrinal definitions, ecumenical events, liturgical
 * reforms.
 *
 * News articles, parish events, and modern blog posts are flagged as
 * "wrong content" (returns complete=false with a category
 * `source_was_news_article`).
 */

import { VALID_HISTORY_TYPES, type HistoryType } from "../contracts/history";

export type HistoryExtractionResult = {
  complete: boolean;
  payload: {
    historyType?: HistoryType;
    title?: string;
    dateOrEra?: string;
    summary?: string;
    body?: string;
    sourceUrl?: string;
  };
  provenance: Record<string, string>;
  missingFields: string[];
  wrongContentReason?: string;
};

const TYPE_HINTS: Array<{ kind: HistoryType; re: RegExp }> = [
  { kind: "Council", re: /\b(?:council\s+of|ecumenical\s+council|vatican\s+(?:i|ii))\b/i },
  { kind: "Encyclical", re: /\bencyclical\b/i },
  { kind: "Papal consecration", re: /\bpapal\s+consecration\b/i },
  { kind: "Schism", re: /\bschism\b/i },
  {
    kind: "Religious order founding",
    re: /\b(?:founding\s+of\s+the|order\s+(?:of|was\s+founded))\b/i,
  },
  { kind: "Catechism", re: /\bcatechism\s+of\s+the\s+catholic\s+church\b/i },
  { kind: "Code of Canon Law", re: /\bcode\s+of\s+canon\s+law\b/i },
  { kind: "Major papal act", re: /\b(?:papal\s+(?:act|decree|bull|brief)|ex\s+cathedra)\b/i },
  {
    kind: "Major doctrinal definition",
    re: /\b(?:doctrinal\s+definition|dogma\s+(?:of|defined))\b/i,
  },
  {
    kind: "Major ecumenical event",
    re: /\b(?:ecumenical\s+event|major\s+gathering|world\s+youth\s+day)\b/i,
  },
  {
    kind: "Major liturgical reform",
    re: /\b(?:liturgical\s+reform|missal\s+reform|trent\s+reform)\b/i,
  },
  { kind: "Major Church event", re: /\b(?:major\s+church\s+event|jubilee\s+year|holy\s+year)\b/i },
];

const NEWS_ARTICLE_RE =
  /\b(?:news\s+(?:article|release|report)|press\s+release|breaking\s+news|blog\s+post|read\s+more\s+at)\b/i;

const PARISH_LOCAL_RE =
  /\b(?:parish\s+(?:event|fundraiser|council)|fundraiser|gala\s+night|conference\s+registration)\b/i;

const YEAR_RE =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+century|\d{3,4}(?:\s*[-–]\s*\d{3,4})?\s*(?:AD|BC|CE|BCE)?)\b/i;

function classifyHistoryType(text: string): HistoryType | undefined {
  for (const h of TYPE_HINTS) {
    if (h.re.test(text)) return h.kind;
  }
  return undefined;
}

export function extractHistory(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): HistoryExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];
  let wrongContentReason: string | undefined;

  const title = args.title?.trim() || undefined;
  if (title) provenance.title = "title input";
  else missingFields.push("title");

  const textForClassifier = `${title ?? ""}\n${args.body}`;

  // Wrong-content guard: a "history" entry that's actually a news
  // article or parish event must NOT pass through.
  if (NEWS_ARTICLE_RE.test(textForClassifier)) {
    wrongContentReason = "source_was_news_article";
    missingFields.push("historyType");
  } else if (PARISH_LOCAL_RE.test(textForClassifier)) {
    wrongContentReason = "source_was_event_page";
    missingFields.push("historyType");
  }

  const historyType = classifyHistoryType(textForClassifier);
  if (historyType && VALID_HISTORY_TYPES.includes(historyType)) {
    provenance.historyType = "regex classifier";
  } else if (!wrongContentReason) {
    missingFields.push("historyType");
  }

  const yearMatch = args.body.match(YEAR_RE);
  const dateOrEra = yearMatch ? yearMatch[1] : undefined;
  if (dateOrEra) provenance.dateOrEra = "year-or-era regex";

  const summary = args.body.split(/\n\n/)[0]?.trim() || undefined;
  if (summary) provenance.summary = "first paragraph";

  const body = args.body.trim() || undefined;
  if (body && body.length >= 100) {
    provenance.body = "input body";
  } else {
    missingFields.push("body");
  }

  return {
    complete: missingFields.length === 0,
    payload: {
      historyType,
      title,
      dateOrEra,
      summary,
      body,
      sourceUrl: args.sourceUrl,
    },
    provenance,
    missingFields,
    wrongContentReason,
  };
}
