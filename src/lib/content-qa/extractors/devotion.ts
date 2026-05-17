/**
 * Devotion extractor (Section 8). Produces a typed Devotion package
 * payload with name, type, background, practice instructions, duration,
 * and optional steps.
 */

import type { DevotionPackagePayload } from "../contracts/devotion";

export type DevotionExtractionResult = {
  complete: boolean;
  payload: DevotionPackagePayload;
  provenance: Record<string, string>;
  missingFields: string[];
  /** Optional structured steps for persisters that store them outside the contract payload. */
  steps?: Array<{ title?: string; body?: string }>;
};

const DEVOTION_TYPE_HINTS: Array<{ kind: string; re: RegExp }> = [
  {
    kind: "Marian devotion",
    re: /\b(?:rosary|consecration\s+to\s+mary|holy\s+(?:queen|virgin)|our\s+lady)\b/i,
  },
  {
    kind: "Eucharistic devotion",
    re: /\b(?:adoration|eucharist|blessed\s+sacrament|holy\s+hour)\b/i,
  },
  { kind: "Devotion to the Sacred Heart", re: /\bsacred\s+heart\b/i },
  { kind: "Devotion to the Divine Mercy", re: /\bdivine\s+mercy\b/i },
  { kind: "Devotion to Saint Joseph", re: /\bsaint\s+joseph\b/i },
  { kind: "Devotion to the Holy Spirit", re: /\bholy\s+spirit\b/i },
  { kind: "Devotion to the Saints", re: /\bsaint(?:s)?\b/i },
];

const PRACTICE_RE =
  /\b(?:practice|how\s+to\s+pray|how\s+to\s+practice)[:\s—-]+([\s\S]+?)(?=\n\n|$)/i;
const DURATION_RE = /\b(?:duration|takes)[:\s—-]+(\d+)\s*(?:minutes?|mins?|m)\b/i;

function classifyDevotionType(text: string): string {
  for (const h of DEVOTION_TYPE_HINTS) {
    if (h.re.test(text)) return h.kind;
  }
  return "General devotion";
}

function extractSteps(body: string): Array<{ title?: string; body?: string }> {
  const steps: Array<{ title?: string; body?: string }> = [];
  const numberedRe = /(?:^|\n)\s*(\d{1,2})\.\s+([^\n]{5,200})/g;
  let m: RegExpExecArray | null;
  while ((m = numberedRe.exec(body)) !== null) {
    steps.push({ body: m[2].trim() });
  }
  return steps;
}

export function extractDevotion(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): DevotionExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];

  const devotionName = args.title?.trim() || undefined;
  if (devotionName) provenance.devotionName = "title input";
  else missingFields.push("devotionName");

  const background = args.body.split(/\n\n/)[0]?.trim() || undefined;
  if (background && background.length >= 50) {
    provenance.background = "first paragraph";
  } else {
    missingFields.push("background");
  }

  const devotionType = classifyDevotionType(`${devotionName ?? ""}\n${args.body}`);
  provenance.devotionType = "regex classifier";

  const practiceMatch = args.body.match(PRACTICE_RE);
  const practiceInstructions = practiceMatch ? practiceMatch[1].trim() : undefined;
  if (practiceInstructions) {
    provenance.practiceInstructions = "practice regex";
  } else {
    missingFields.push("practiceInstructions");
  }

  const durationMatch = args.body.match(DURATION_RE);
  const duration = durationMatch ? parseInt(durationMatch[1], 10) : undefined;
  if (duration) provenance.duration = "duration regex";

  const steps = extractSteps(args.body);
  if (steps.length > 0) provenance.steps = "numbered-list parser";

  return {
    complete: missingFields.length === 0,
    payload: {
      devotionType,
      devotionName,
      background,
      practiceInstructions,
      duration,
    },
    provenance,
    missingFields,
    // Steps are surfaced separately so the persister can use them
    // even though the contract payload type doesn't include them.
    steps: steps.length > 0 ? steps : undefined,
  };
}
