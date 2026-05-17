/**
 * Rosary extractor (Section 8). Produces a typed Rosary package payload
 * with background / how-to-pray / opening prayers / mystery sets +
 * five mysteries per set with optional scripture references.
 */

import type { Mystery, MysterySet, RosaryPackagePayload } from "../contracts/rosary";

export type RosaryExtractionResult = {
  complete: boolean;
  payload: RosaryPackagePayload;
  provenance: Record<string, string>;
  missingPrayers: string[];
  missingMysterySets: string[];
};

const REQUIRED_PRAYERS = [
  "Sign of the Cross",
  "Apostles' Creed",
  "Our Father",
  "Hail Mary",
  "Glory Be",
  "Hail Holy Queen",
] as const;

const OPTIONAL_PRAYERS = ["Fatima Prayer", "Closing Prayer"] as const;

const MYSTERY_SETS = [
  "Joyful Mysteries",
  "Sorrowful Mysteries",
  "Glorious Mysteries",
  "Luminous Mysteries",
] as const;

const MYSTERY_PATTERNS: Record<string, RegExp[]> = {
  "Joyful Mysteries": [
    /\bThe\s+Annunciation\b/i,
    /\bThe\s+Visitation\b/i,
    /\bThe\s+Nativity\b/i,
    /\bThe\s+Presentation\b/i,
    /\bThe\s+Finding\s+(?:in\s+the\s+Temple|of\s+Jesus)\b/i,
  ],
  "Sorrowful Mysteries": [
    /\bThe\s+Agony\s+in\s+the\s+Garden\b/i,
    /\bThe\s+Scourging\s+at\s+the\s+Pillar\b/i,
    /\bThe\s+Crowning\s+(?:with|of)\s+Thorns\b/i,
    /\bThe\s+Carrying\s+of\s+the\s+Cross\b/i,
    /\bThe\s+Crucifixion\b/i,
  ],
  "Glorious Mysteries": [
    /\bThe\s+Resurrection\b/i,
    /\bThe\s+Ascension\b/i,
    /\bThe\s+Descent\s+of\s+the\s+Holy\s+Spirit\b/i,
    /\bThe\s+Assumption\b/i,
    /\bThe\s+Coronation\b/i,
  ],
  "Luminous Mysteries": [
    /\bThe\s+Baptism\s+of\s+(?:Jesus|the\s+Lord)\b/i,
    /\bThe\s+Wedding\s+(?:at|of)\s+Cana\b/i,
    /\bThe\s+Proclamation\s+of\s+the\s+Kingdom\b/i,
    /\bThe\s+Transfiguration\b/i,
    /\bThe\s+Institution\s+of\s+the\s+Eucharist\b/i,
  ],
};

const SCRIPTURE_REF_RE =
  /\b(?:matt|mark|luke|john|acts|rom|cor|gal|eph|phil|col|thess|tim|tit|heb|jas|pet|jude|rev|gen|exod|lev|num|deut|josh|judg|ruth|sam|kings|chr|ezra|neh|esth|job|ps(?:a|alm)?|prov|eccl|isa|jer|lam|ezek|dan|hos|joel|amos|jonah|mic|nah|hab|zeph|hag|zech|mal)\.?\s*\d+:\d+(?:-\d+)?/i;

function extractMysterySet(body: string, setName: string): MysterySet | null {
  const patterns = MYSTERY_PATTERNS[setName] ?? [];
  const mysteries: Mystery[] = [];
  for (let i = 0; i < patterns.length; i += 1) {
    const m = body.match(patterns[i]);
    if (m) {
      // Look for a scripture reference in the surrounding 200 chars.
      const start = Math.max(0, m.index! - 200);
      const end = Math.min(body.length, m.index! + 200);
      const window = body.slice(start, end);
      const scriptureMatch = window.match(SCRIPTURE_REF_RE);
      mysteries.push({
        name: m[0],
        order: i + 1,
        scriptureReference: scriptureMatch ? scriptureMatch[0] : undefined,
      });
    }
  }
  if (mysteries.length === 0) return null;
  return { name: setName, mysteries };
}

export function extractRosary(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): RosaryExtractionResult {
  const provenance: Record<string, string> = {};
  const missingPrayers: string[] = [];
  const missingMysterySets: string[] = [];

  const title = args.title?.trim() || undefined;
  if (title) provenance.title = "title input";

  const background = args.body.split(/\n\n/)[0]?.trim() || undefined;
  if (background) provenance.background = "first paragraph";

  const howToPray = (() => {
    const m = args.body.match(/how\s+to\s+pray[:\s—-]+([\s\S]+?)(?=\n\n|$)/i);
    return m ? m[1].trim() : undefined;
  })();
  if (howToPray) provenance.howToPray = "how-to-pray section";

  // Required opening prayers.
  const openingPrayers: string[] = [];
  for (const p of REQUIRED_PRAYERS) {
    const re = new RegExp(p.replace(/'/g, "['']").replace(/\s+/g, "\\s+"), "i");
    if (re.test(args.body)) openingPrayers.push(p);
    else missingPrayers.push(p);
  }
  for (const p of OPTIONAL_PRAYERS) {
    const re = new RegExp(p.replace(/'/g, "['']").replace(/\s+/g, "\\s+"), "i");
    if (re.test(args.body)) openingPrayers.push(p);
  }
  if (openingPrayers.length > 0) provenance.openingPrayers = "prayer-name regex";

  // Mystery sets — Luminous is optional, the other three are required.
  const mysterySets: MysterySet[] = [];
  for (const setName of MYSTERY_SETS) {
    const set = extractMysterySet(args.body, setName);
    if (set) {
      mysterySets.push(set);
    } else if (setName !== "Luminous Mysteries") {
      missingMysterySets.push(setName);
    }
  }
  if (mysterySets.length > 0) provenance.mysterySets = "mystery-name regex";

  // A complete Rosary package needs every required prayer + every
  // required mystery set with at least one mystery extracted.
  const complete =
    missingPrayers.length === 0 &&
    missingMysterySets.length === 0 &&
    mysterySets.every((s) => s.mysteries.length >= 5);

  return {
    complete,
    payload: {
      title,
      background,
      howToPray,
      openingPrayers,
      mysterySets,
      decadeStructure:
        "Sign of the Cross, Apostles' Creed, Our Father, ten Hail Marys per decade, Glory Be after each decade.",
      closingPrayers: openingPrayers.filter(
        (p) => p === "Hail Holy Queen" || p === "Closing Prayer",
      ),
    },
    provenance,
    missingPrayers,
    missingMysterySets,
  };
}
