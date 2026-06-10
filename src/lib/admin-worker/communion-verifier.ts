/**
 * "In communion with Rome" verifier for parish discovery.
 *
 * When the worker finds a parish via Google Maps, it must confirm the place is
 * a Roman Catholic parish in full communion with the Holy See before publishing
 * it — Maps lists "Catholic" churches that are NOT in communion with Rome (Old
 * Catholic / Union of Utrecht, Polish National Catholic, sedevacantist and other
 * independent "Catholic" bodies, and the Eastern Orthodox / Anglican churches).
 * A parish website almost never states its communion status explicitly, so this
 * reads the site's own words for the tell-tale signals on each side.
 *
 * Verdicts:
 *   - not-in-communion: a disqualifying signal is present (Old Catholic, PNCC,
 *     sedevacantist, independent/national catholic, women's ordination, an
 *     explicit "not in communion", Orthodox/Anglican identity). NEVER published.
 *   - in-communion: a Roman signal is present (the words "Roman Catholic", an
 *     explicit communion statement, USCCB / Holy See, a named (Arch)diocese in a
 *     Catholic context) and NO disqualifying signal. Eligible to publish.
 *   - unknown: neither side is clear (or canonically-irregular groups such as the
 *     SSPX). Routed to human review, never auto-published.
 *
 * The check is conservative by design: "Catholic" alone is never enough (Old
 * Catholics call themselves Catholic too), and anything ambiguous goes to a
 * human rather than being published on a guess.
 */

export type CommunionStatus = "in-communion" | "not-in-communion" | "unknown";

export interface CommunionSignals {
  positive: string[];
  negative: string[];
  /** Canonically-irregular markers (SSPX, …) that force human review. */
  review: string[];
}

export interface CommunionVerdict {
  status: CommunionStatus;
  /** 0..1 — how strongly the signals support the verdict. */
  confidence: number;
  signals: CommunionSignals;
  reason: string;
}

/** Disqualifying — bodies and claims that are NOT in communion with Rome. */
const NEGATIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bold[\s-]?catholic\b/i, label: "Old Catholic" },
  { re: /\bold[\s-]?roman[\s-]?catholic\b/i, label: "Old Roman Catholic" },
  { re: /\bunion of utrecht\b/i, label: "Union of Utrecht (Old Catholic)" },
  { re: /\bpolish national catholic\b/i, label: "Polish National Catholic" },
  { re: /\bp\.?n\.?c\.?c\.?\b/i, label: "PNCC" },
  { re: /\bsedevacant/i, label: "sedevacantist" },
  { re: /\bindependent (old )?catholic\b/i, label: "independent Catholic" },
  { re: /\bnational catholic church\b/i, label: "national Catholic church" },
  { re: /\bamerican (national )?catholic\b/i, label: "American National Catholic" },
  { re: /\becumenical catholic\b/i, label: "Ecumenical Catholic Communion" },
  { re: /\bliberal catholic\b/i, label: "Liberal Catholic" },
  { re: /\bgnostic\b/i, label: "gnostic" },
  {
    re: /\bnot in (full )?communion with (rome|the (roman )?(holy see|pope|see))/i,
    label: "states it is not in communion with Rome",
  },
  { re: /\b(wo)?m[ae]n (are )?(ordain|priest)/i, label: "women's ordination" },
  { re: /\bfemale (priest|clergy|ordination)\b/i, label: "female ordination" },
  { re: /\beastern orthodox\b/i, label: "Eastern Orthodox" },
  { re: /\b(greek|russian|antiochian|serbian) orthodox\b/i, label: "Orthodox church" },
  { re: /\banglican\b/i, label: "Anglican" },
  { re: /\bepiscopal church\b/i, label: "Episcopal Church" },
];

/** Roman signals — being in full communion with the Holy See. */
const POSITIVE_PATTERNS: Array<{ re: RegExp; label: string; weight: number }> = [
  { re: /\broman catholic\b/i, label: '"Roman Catholic"', weight: 3 },
  {
    re: /\bin (full )?communion with (rome|the (roman )?(holy see|pope|catholic church)|the bishop of rome|peter)/i,
    label: "states communion with Rome / the Holy See",
    weight: 4,
  },
  {
    re: /\bunited states conference of catholic bishops\b|\busccb\b/i,
    label: "USCCB",
    weight: 3,
  },
  { re: /\bholy see\b|\bvatican\.va\b/i, label: "Holy See / Vatican", weight: 2 },
  {
    re: /\b(arch)?diocese of [a-z.\s'-]+/i,
    label: "named (Arch)diocese",
    weight: 1,
  },
  { re: /\bcatholic (arch)?diocese\b/i, label: "Catholic (Arch)diocese", weight: 2 },
  {
    re: /\b(the )?(holy father|supreme pontiff)\b|\bpope (francis|leo|benedict|john paul)\b/i,
    label: "names the Pope / Holy Father",
    weight: 2,
  },
  { re: /\bmagisterium\b/i, label: "the Magisterium", weight: 2 },
  {
    re: /\bsacrament of (reconciliation|confession|the eucharist)\b/i,
    label: "Catholic sacraments",
    weight: 1,
  },
];

/** Canonically-irregular — Catholic in origin but route to human review. */
const REVIEW_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bsociety of (saint|st\.?) pius x\b|\bsspx\b/i, label: "SSPX (canonically irregular)" },
  { re: /\bsedevacantist?\b/i, label: "sedevacantist" }, // also negative; belt and braces
];

/** Strip HTML to readable text for scanning (tags, scripts, styles, entities). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Assess communion status from a parish website's visible text. Pure and
 * deterministic — unit-testable without a network call.
 */
export function assessCommunionFromText(rawText: string): CommunionVerdict {
  const text = rawText ?? "";
  const negative: string[] = [];
  const positive: string[] = [];
  const review: string[] = [];

  for (const { re, label } of NEGATIVE_PATTERNS) if (re.test(text)) negative.push(label);
  for (const { re, label } of REVIEW_PATTERNS) if (re.test(text)) review.push(label);

  let positiveWeight = 0;
  for (const { re, label, weight } of POSITIVE_PATTERNS) {
    if (re.test(text)) {
      positive.push(label);
      positiveWeight += weight;
    }
  }

  const signals: CommunionSignals = { positive, negative, review };

  // 1. Any disqualifying signal → not in communion. Never published.
  if (negative.length > 0) {
    return {
      status: "not-in-communion",
      confidence: Math.min(1, 0.7 + 0.1 * negative.length),
      signals,
      reason: `Disqualifying signal(s): ${negative.join("; ")}.`,
    };
  }

  // 2. Canonically-irregular (SSPX) with no disqualifier → human review.
  if (review.length > 0) {
    return {
      status: "unknown",
      confidence: 0.5,
      signals,
      reason: `Canonically-irregular signal(s) require review: ${review.join("; ")}.`,
    };
  }

  // 3. A clear Roman signal (weight ≥ 3, e.g. "Roman Catholic", a communion
  //    statement, or USCCB) → in communion. A lone weak signal (a bare diocese
  //    name) is not enough on its own.
  if (positiveWeight >= 3) {
    return {
      status: "in-communion",
      confidence: Math.min(1, 0.6 + 0.1 * positiveWeight),
      signals,
      reason: `Roman signal(s): ${positive.join("; ")}.`,
    };
  }

  // 4. Otherwise undetermined → human review, never auto-published.
  return {
    status: "unknown",
    confidence: 0.3,
    signals,
    reason:
      positive.length > 0
        ? `Only weak Catholic signal(s) (${positive.join("; ")}); not enough to confirm communion with Rome.`
        : "No clear signal either way.",
  };
}

/**
 * Fetch a parish website and assess its communion status. Returns an `unknown`
 * verdict (with the fetch error noted) when the site can't be read — the caller
 * then routes to human review rather than publishing on no evidence. Honours
 * ADMIN_WORKER_SKIP_NETWORK for tests / offline deployments.
 */
export async function verifyParishCommunion(website: string): Promise<CommunionVerdict> {
  const empty: CommunionVerdict = {
    status: "unknown",
    confidence: 0,
    signals: { positive: [], negative: [], review: [] },
    reason: "Parish website could not be read.",
  };
  if (!website || process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return empty;

  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return { ...empty, reason: "Parish website URL did not parse." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return empty;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { ...empty, reason: `Parish website returned HTTP ${res.status}.` };
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|xml|text\/plain/i.test(contentType)) {
      return { ...empty, reason: `Parish website is not HTML (${contentType}).` };
    }
    const raw = (await res.text()).slice(0, 1_500_000);
    const verdict = assessCommunionFromText(htmlToText(raw));
    return verdict;
  } catch (err) {
    return {
      ...empty,
      reason: `Parish website fetch failed: ${err instanceof Error ? err.message : "error"}.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
