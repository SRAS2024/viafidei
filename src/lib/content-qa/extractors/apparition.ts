/**
 * Marian Apparition extractor (Section 8). Produces a typed
 * MarianApparition payload with name, location, country, approval
 * status, background, and summary.
 */

import type { ApparitionPackagePayload } from "../contracts/apparition";

export type ApparitionExtractionResult = {
  complete: boolean;
  payload: ApparitionPackagePayload & {
    associatedPrayer?: string;
    feastDay?: string;
  };
  provenance: Record<string, string>;
  missingFields: string[];
};

const APPROVAL_HINTS: Array<{ status: string; re: RegExp }> = [
  { status: "Approved", re: /\b(?:officially\s+)?approved\b/i },
  {
    status: "Worthy of belief",
    re: /\b(?:worthy\s+of\s+belief|constat\s+de\s+supernaturalitate)\b/i,
  },
  { status: "Not approved", re: /\bnot\s+approved\b/i },
  {
    status: "Under investigation",
    re: /\b(?:under\s+investigation|being\s+investigated|pending\s+approval)\b/i,
  },
  { status: "Condemned", re: /\bcondemned\b/i },
];

const KNOWN_LOCATIONS: Record<string, { location: string; country: string }> = {
  fatima: { location: "Fátima", country: "Portugal" },
  lourdes: { location: "Lourdes", country: "France" },
  guadalupe: { location: "Tepeyac", country: "Mexico" },
  knock: { location: "Knock", country: "Ireland" },
  "la salette": { location: "La Salette", country: "France" },
  akita: { location: "Akita", country: "Japan" },
  kibeho: { location: "Kibeho", country: "Rwanda" },
  champion: { location: "Champion", country: "United States" },
};

function classifyApproval(text: string): string {
  for (const h of APPROVAL_HINTS) {
    if (h.re.test(text)) return h.status;
  }
  return "No official approval found";
}

function detectLocation(text: string): { location?: string; country?: string } {
  const lc = text.toLowerCase();
  for (const key of Object.keys(KNOWN_LOCATIONS)) {
    if (lc.includes(key)) {
      return KNOWN_LOCATIONS[key];
    }
  }
  return {};
}

const FEAST_DAY_RE =
  /\bfeast\s+day[:\s—-]+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i;

const ASSOCIATED_PRAYER_RE = /(?:associated\s+)?prayer[:\s—-]+([\s\S]+?)(?=\n\n|$)/i;

export function extractApparition(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): ApparitionExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];

  const apparitionName = args.title?.trim() || undefined;
  if (apparitionName) provenance.apparitionName = "title input";
  else missingFields.push("apparitionName");

  const background = args.body.split(/\n\n/)[0]?.trim() || undefined;
  if (background && background.length >= 50) {
    provenance.background = "first paragraph";
  } else {
    missingFields.push("background");
  }

  const summary = args.body.split(/\n\n/).slice(0, 2).join("\n\n").trim() || undefined;
  if (summary) provenance.summary = "first two paragraphs";

  const { location, country } = detectLocation(`${apparitionName ?? ""}\n${args.body}`);
  if (location) provenance.location = "known-place lookup";
  if (country) provenance.country = "known-place lookup";
  if (!location) missingFields.push("location");
  if (!country) missingFields.push("country");

  const approvalStatus = classifyApproval(args.body);
  provenance.approvalStatus = "regex classifier";

  const feastMatch = args.body.match(FEAST_DAY_RE);
  const feastDay = feastMatch ? `${feastMatch[1]} ${feastMatch[2]}` : undefined;
  if (feastDay) provenance.feastDay = "feast-day regex";

  const prayerMatch = args.body.match(ASSOCIATED_PRAYER_RE);
  const associatedPrayer = prayerMatch ? prayerMatch[1].trim() : undefined;
  if (associatedPrayer) provenance.associatedPrayer = "prayer regex";

  return {
    complete: missingFields.length === 0,
    payload: {
      apparitionName,
      location,
      country,
      approvalStatus,
      background,
      summary,
      associatedPrayer,
      feastDay,
    },
    provenance,
    missingFields,
  };
}
