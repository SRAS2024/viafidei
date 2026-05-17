/**
 * Sacrament extractor (Section 8). Produces a typed Sacrament package
 * payload mapping the source text to one of the seven canonical
 * sacraments (with confession → reconciliation normalization).
 */

import {
  SACRAMENT_KEYS,
  SACRAMENT_GROUP_BY_KEY,
  normalizeSacrament,
  type SacramentKey,
} from "../sacrament-normalize";

export type SacramentExtractionResult = {
  complete: boolean;
  payload: {
    sacramentKey?: SacramentKey;
    sacramentName?: string;
    sacramentGroup?: string;
    catholicExplanation?: string;
    preparationGuide?: string;
    participationGuide?: string;
    biblicalFoundation?: string;
    catechismReferences?: string[];
    relatedPrayers?: string[];
    sourceUrl?: string;
    sourceHost?: string;
  };
  provenance: Record<string, string>;
  missingFields: string[];
};

const SACRAMENT_NAME_BY_KEY: Record<SacramentKey, string> = {
  baptism: "Baptism",
  confirmation: "Confirmation",
  eucharist: "The Eucharist",
  reconciliation: "Reconciliation",
  anointing_of_the_sick: "Anointing of the Sick",
  holy_orders: "Holy Orders",
  matrimony: "Matrimony",
};

function extractParagraphLabeled(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\n)\\s*${label}[:\\s—-]+([\\s\\S]+?)(?=\\n\\n|$)`, "i");
    const m = body.match(re);
    if (m && m[1].trim().length > 20) return m[1].trim();
  }
  return undefined;
}

function extractCatechismRefs(body: string): string[] {
  const refs = new Set<string>();
  const re = /\b(?:CCC|Catechism)\s*\.?\s*(\d{2,4})(?:[\s\-–](\d{2,4}))?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    refs.add(m[2] ? `CCC ${m[1]}-${m[2]}` : `CCC ${m[1]}`);
  }
  return Array.from(refs).slice(0, 20);
}

function sourceHostFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function extractSacrament(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): SacramentExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];

  // Identify sacrament key from title + body. The normalizer handles
  // confession → reconciliation; we reuse it here for the same effect.
  const norm = normalizeSacrament({ title: args.title ?? "", body: args.body });
  const sacramentKey = (norm.key as SacramentKey | undefined) ?? undefined;
  if (sacramentKey && SACRAMENT_KEYS.includes(sacramentKey)) {
    provenance.sacramentKey = "sacrament normalizer";
  } else {
    missingFields.push("sacramentKey");
  }
  const sacramentName = sacramentKey ? SACRAMENT_NAME_BY_KEY[sacramentKey] : args.title?.trim();
  const sacramentGroup = sacramentKey ? SACRAMENT_GROUP_BY_KEY[sacramentKey] : undefined;
  if (sacramentName) provenance.sacramentName = "key lookup";
  if (sacramentGroup) provenance.sacramentGroup = "key lookup";

  const catholicExplanation =
    extractParagraphLabeled(args.body, ["explanation", "what is", "definition"]) ||
    args.body.split(/\n\n/)[0]?.trim();
  if (catholicExplanation && catholicExplanation.length >= 50) {
    provenance.catholicExplanation = "labeled paragraph";
  } else {
    missingFields.push("catholicExplanation");
  }

  const preparationGuide = extractParagraphLabeled(args.body, [
    "preparation",
    "how to prepare",
    "preparing for",
  ]);
  if (preparationGuide) provenance.preparationGuide = "labeled paragraph";

  const participationGuide = extractParagraphLabeled(args.body, [
    "participation",
    "how to participate",
    "during the sacrament",
  ]);
  if (participationGuide) provenance.participationGuide = "labeled paragraph";

  const biblicalFoundation = extractParagraphLabeled(args.body, [
    "biblical foundation",
    "scripture",
    "scriptural basis",
  ]);
  if (biblicalFoundation) provenance.biblicalFoundation = "labeled paragraph";

  const catechismReferences = extractCatechismRefs(args.body);
  if (catechismReferences.length > 0) provenance.catechismReferences = "CCC regex";

  const sourceHost = sourceHostFromUrl(args.sourceUrl);
  if (sourceHost) provenance.sourceHost = "URL parse";

  return {
    complete: missingFields.length === 0,
    payload: {
      sacramentKey,
      sacramentName,
      sacramentGroup,
      catholicExplanation,
      preparationGuide,
      participationGuide,
      biblicalFoundation,
      catechismReferences: catechismReferences.length > 0 ? catechismReferences : undefined,
      sourceUrl: args.sourceUrl,
      sourceHost,
    },
    provenance,
    missingFields,
  };
}
