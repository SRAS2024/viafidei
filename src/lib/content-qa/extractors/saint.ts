/**
 * Saint extractor (Section 8). Produces a typed Saint package payload
 * with name, type, feast day/month/day-of-month, biography, patronage,
 * and optional official prayer.
 */

export type SaintExtractionResult = {
  complete: boolean;
  payload: {
    saintType?: string;
    saintName?: string;
    feastDay?: string;
    feastMonth?: number;
    feastDayOfMonth?: number;
    biography?: string;
    patronages?: string[];
    officialPrayer?: string;
    sourceUrl?: string;
    sourceHost?: string;
  };
  provenance: Record<string, string>;
  missingFields: string[];
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_RE = new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})\\b`, "i");

const SAINT_TYPE_HINTS: Array<{ kind: string; re: RegExp }> = [
  { kind: "Doctor of the Church", re: /\bdoctor\s+of\s+the\s+church\b/i },
  { kind: "Pope", re: /\b(?:pope|pontiff)\b/i },
  { kind: "Martyr", re: /\bmartyr(?:ed)?\b/i },
  { kind: "Bishop", re: /\bbishop\b/i },
  { kind: "Priest", re: /\bpriest\b/i },
  { kind: "Religious", re: /\b(?:monk|nun|friar|sister|brother|abbot|abbess)\b/i },
  { kind: "Virgin", re: /\bvirgin\b/i },
  { kind: "Apostle", re: /\bapostle\b/i },
  { kind: "Confessor", re: /\bconfessor\b/i },
];

const PARISH_INDICATORS_RE = /\b(?:parish|church\s+of|our\s+lady\s+of\s+the|school\s+of)\b/i;

function classifySaintType(biography: string): string {
  for (const h of SAINT_TYPE_HINTS) {
    if (h.re.test(biography)) return h.kind;
  }
  return "Saint";
}

function extractFeastDate(text: string): {
  feastDay?: string;
  feastMonth?: number;
  feastDayOfMonth?: number;
} {
  // Look for "feast day" near a month + day.
  const feastWindow = text.match(/feast\s+day[:\s—-]+([\s\S]{0,80})/i);
  const searchText = feastWindow ? feastWindow[1] : text;
  const m = searchText.match(MONTH_RE);
  if (!m) return {};
  const monthName = m[1];
  const day = parseInt(m[2], 10);
  const monthIndex = MONTHS.findIndex((mo) => mo.toLowerCase() === monthName.toLowerCase());
  if (monthIndex < 0 || isNaN(day)) return {};
  return {
    feastDay: `${MONTHS[monthIndex]} ${day}`,
    feastMonth: monthIndex + 1,
    feastDayOfMonth: day,
  };
}

function extractPatronages(text: string): string[] {
  const patronages: string[] = [];
  const m = text.match(/patron(?:ess)?\s+(?:saint\s+)?of\s+([^.]+)\./i);
  if (m) {
    // Split on commas / " and ".
    const parts = m[1]
      .split(/,| and /i)
      .map((p) => p.trim())
      .filter((p) => p.length > 1 && p.length < 80);
    patronages.push(...parts);
  }
  return patronages;
}

function extractOfficialPrayer(text: string): string | undefined {
  const m = text.match(/(?:^|\n)\s*(?:official\s+)?prayer[:\s—-]+([\s\S]+?)(?=\n\n|$)/i);
  return m ? m[1].trim() : undefined;
}

function sourceHostFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function extractSaint(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): SaintExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];

  const saintName = args.title?.trim() || undefined;
  if (saintName) provenance.saintName = "title input";
  else missingFields.push("saintName");

  const biography = args.body?.trim() || undefined;
  if (biography && biography.length >= 50) {
    provenance.biography = "body input";
  } else {
    missingFields.push("biography");
  }

  // Wrong-content guard: a "biography" dominated by parish-indicator
  // phrases is almost certainly a parish/school page. The strict QA
  // contract will reject it; the extractor returns missingFields so
  // the dashboard can show "could_not_identify_saint_vs_institution".
  if (biography && PARISH_INDICATORS_RE.test(biography) && biography.split(/\s+/).length < 80) {
    missingFields.push("biography");
  }

  const saintType = biography ? classifySaintType(biography) : "Saint";
  if (saintType) provenance.saintType = "regex classifier";

  const feast = biography ? extractFeastDate(biography) : {};
  if (feast.feastDay) provenance.feastDay = "feast-day regex";

  const patronages = biography ? extractPatronages(biography) : [];
  if (patronages.length > 0) provenance.patronages = "patronage regex";

  const officialPrayer = biography ? extractOfficialPrayer(biography) : undefined;
  if (officialPrayer) provenance.officialPrayer = "official-prayer regex";

  const sourceHost = sourceHostFromUrl(args.sourceUrl);
  if (sourceHost) provenance.sourceHost = "URL parse";

  return {
    complete: missingFields.length === 0,
    payload: {
      saintType,
      saintName,
      feastDay: feast.feastDay,
      feastMonth: feast.feastMonth,
      feastDayOfMonth: feast.feastDayOfMonth,
      biography,
      patronages,
      officialPrayer,
      sourceUrl: args.sourceUrl,
      sourceHost,
    },
    provenance,
    missingFields,
  };
}
