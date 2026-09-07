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
 * A site rarely says "we are in full communion with Rome" in those words, so the
 * verifier reads for the ordinary ways a real Catholic parish identifies itself:
 * the name of its (arch)diocese or (arch)eparchy, or the name of any of the 24
 * sui iuris Churches of the Catholic communion (Latin/Roman, Maronite, Melkite,
 * Ukrainian/Ruthenian/other Byzantine, Chaldean, Syro-Malabar, Syro-Malankara,
 * Coptic, Armenian, Syriac, Ethiopian/Eritrean, and the rest). Any one of those
 * is enough — the check is generous about confirming a Catholic identity so the
 * worker keeps publishing toward its goal, and strict only about the things that
 * genuinely mark a body as NOT in communion.
 *
 * Verdicts:
 *   - not-in-communion: a disqualifying signal is present (Old Catholic, PNCC,
 *     sedevacantist, the SSPX, independent/national catholic, women's ordination,
 *     an explicit "not in communion", Orthodox/Anglican identity). NEVER published.
 *   - in-communion: a Catholic signal is present (a named (arch)diocese or
 *     (arch)eparchy, any of the 24 rites/sui iuris churches, "Roman Catholic", an
 *     explicit communion statement, USCCB / Holy See, …) and NO disqualifying
 *     signal. Eligible to publish.
 *   - unknown: neither side is clear. Not auto-published on a guess.
 *
 * The one thing that is never enough on its own is a bare "Catholic" (Old
 * Catholics call themselves Catholic too) — that stays unknown until a diocese,
 * rite, or other concrete Catholic signal appears.
 */

export type CommunionStatus = "in-communion" | "not-in-communion" | "unknown";

export interface CommunionSignals {
  positive: string[];
  negative: string[];
  /** Retained for backward compatibility; always empty now that the once-
   * "review" bodies (SSPX) are treated as disqualifiers. */
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
  // The SSPX is not, at present, in canonical communion — treat it as
  // not-in-communion (a disqualifier) rather than a maybe.
  {
    re: /\bsociety of (saint|st\.?) pius x\b|\bsspx\b/i,
    label: "SSPX (not in communion at present)",
  },
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
  // Women's ordination. The `wom` prefix is REQUIRED: the old optional
  // `(wo)?` group matched "men ordained" / "four men priests" — ordinary
  // Catholic ordination news — and rejected real parishes.
  { re: /\bwom[ae]n(?:'s)? (?:are |being |were )?(?:ordain|priest)/i, label: "women's ordination" },
  { re: /\bordination of women\b|\bwomen priests?\b/i, label: "women's ordination" },
  { re: /\bfemale (priest|clergy|ordination)\b/i, label: "female ordination" },
  { re: /\beastern orthodox\b/i, label: "Eastern Orthodox" },
  {
    re: /\b(greek|russian|antiochian|serbian|coptic|romanian|bulgarian|ukrainian|macedonian|georgian|ethiopian|syriac|armenian) orthodox\b/i,
    label: "Orthodox church",
  },
  // Anglican / Episcopal IDENTITY, not the bare word: parishes of the
  // Personal Ordinariates (in full communion with Rome) describe their
  // "Anglican patrimony" / "Anglican Use", and ecumenical pages mention
  // Anglican neighbours. Only self-identification as part of the Anglican
  // Communion disqualifies (and the Ordinariate override below still wins).
  {
    re: /\banglican (communion|church|parish|diocese|province|cathedral|community|congregation)\b|\bchurch of england\b|\bchurch of ireland\b/i,
    label: "Anglican",
  },
  { re: /\bepiscopal (church|diocese)\b/i, label: "Episcopal Church" },
];

/**
 * Negatives that are softened by an explicit Catholic self-identification.
 * A Roman Catholic parish page legitimately says "ecumenical prayer with the
 * Greek Orthodox Church" or "shares its building with the Episcopal Church";
 * those mentions only disqualify when the page does NOT identify itself as
 * Roman Catholic / in communion with Rome. Old Catholic, PNCC, SSPX,
 * sedevacantist and women's-ordination signals are never softened.
 */
const SOFT_NEGATIVE_LABELS = new Set([
  "Eastern Orthodox",
  "Orthodox church",
  "Anglican",
  "Episcopal Church",
]);

/** Explicit Catholic self-identification strong enough to soften a soft negative. */
const SELF_IDENTIFIED_CATHOLIC_RE =
  /\broman catholic\b|\bin (full )?communion with (rome|the (roman )?(holy see|pope|catholic church|apostolic see)|the bishop of rome)/i;

/** The Personal Ordinariates (Anglican patrimony, full communion with Rome). */
const ORDINARIATE_RE =
  /\b(personal )?ordinariate of (the chair of (st\.?|saint) peter|our lady of walsingham|our lady of the southern cross)\b|\bpersonal ordinariate\b|\banglican (use|patrimony)\b/i;

/**
 * The 24 sui iuris Churches of the Catholic communion (the Latin Church + 23
 * Eastern Catholic Churches). Naming any of them is, by definition, a body in
 * full communion with Rome — none of these has a "not in communion" counterpart
 * that also uses the exact "<name> Catholic" wording, so each is a strong,
 * unambiguous positive. (Old/Orthodox/Anglican bodies are caught first by the
 * negative patterns, which always win.)
 */
const RITE_CHURCHES_RE =
  /\b(?:latin|roman|maronite|melkite|ukrainian(?:\s+greek)?|ruthenian|byzantine|greek|romanian(?:\s+greek)?|chaldean|syro[\s-]?malabar|syro[\s-]?malankara|coptic|ethiopian|eritrean|armenian|syriac|slovak(?:\s+greek)?|hungarian(?:\s+greek)?|italo[\s-]?albanian|macedonian(?:\s+greek)?|albanian(?:\s+greek)?|belarusian(?:\s+greek)?|russian(?:\s+greek)?|bulgarian(?:\s+greek)?|georgian|krizevci|krizhevtsi)\s+catholic\b/i;

/** Catholic signals — a body in full communion with the Holy See. */
const POSITIVE_PATTERNS: Array<{ re: RegExp; label: string; weight: number }> = [
  { re: /\broman catholic\b/i, label: '"Roman Catholic"', weight: 3 },
  { re: RITE_CHURCHES_RE, label: "a Catholic sui iuris church / rite", weight: 3 },
  {
    re: /\bin (full )?communion with (rome|the (roman )?(holy see|pope|catholic church|apostolic see)|the bishop of rome|the successor of (st\.?\s*)?peter|peter)/i,
    label: "states communion with Rome / the Holy See",
    weight: 4,
  },
  {
    re: /\b(part of|member of|belongs? to|within) the (roman |universal )?catholic church\b/i,
    label: "states it is part of the Catholic Church",
    weight: 3,
  },
  {
    re: /\bunited states conference of catholic bishops\b|\busccb\b/i,
    label: "USCCB",
    weight: 3,
  },
  // A named (arch)diocese or (arch)eparchy it belongs to is exactly how a real
  // parish identifies its place in the Church — enough on its own to confirm
  // (the disqualifiers for Old/Orthodox/Anglican "dioceses" are checked first).
  {
    re: /\b(arch)?diocese of [a-z.\s'’-]+/i,
    label: "names the (arch)diocese it belongs to",
    weight: 3,
  },
  {
    re: /\b(arch)?eparchy of [a-z.\s'’-]+/i,
    label: "names the (arch)eparchy it belongs to",
    weight: 3,
  },
  {
    re: /\bcatholic (arch)?(diocese|eparchy)\b|\b(arch)?(diocese|eparchy) of the [a-z.\s'’-]+\bcatholic\b/i,
    label: "a Catholic (arch)diocese / (arch)eparchy",
    weight: 3,
  },
  { re: /\bsui iuris\b/i, label: "a sui iuris Catholic church", weight: 3 },
  { re: /\bholy see\b|\bvatican\.va\b|\bapostolic see\b/i, label: "Holy See / Vatican", weight: 2 },
  {
    re: /\b(the )?(holy father|supreme pontiff)\b|\bpope (francis|leo|benedict|john paul)\b/i,
    label: "names the Pope / Holy Father",
    weight: 2,
  },
  { re: /\bmagisterium\b/i, label: "the Magisterium", weight: 2 },
  {
    re: /\b(second vatican council|vatican ii|catechism of the catholic church)\b/i,
    label: "Catholic magisterial reference",
    weight: 2,
  },
  {
    re: /\bsacrament of (reconciliation|confession|the eucharist)\b/i,
    label: "Catholic sacraments",
    weight: 1,
  },
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

  for (const { re, label } of NEGATIVE_PATTERNS) if (re.test(text)) negative.push(label);
  // Ordinariate parishes are in full communion with Rome by definition; their
  // Anglican-heritage wording must not read as an Anglican identity.
  const ordinariate = ORDINARIATE_RE.test(text);
  const selfCatholic = SELF_IDENTIFIED_CATHOLIC_RE.test(text);
  const softened = negative.filter(
    (label) => SOFT_NEGATIVE_LABELS.has(label) && (ordinariate || selfCatholic),
  );
  const hardNegative = negative.filter((label) => !softened.includes(label));

  let positiveWeight = 0;
  for (const { re, label, weight } of POSITIVE_PATTERNS) {
    if (re.test(text)) {
      positive.push(label);
      positiveWeight += weight;
    }
  }

  // `review` is retained in the signal shape for backward compatibility; the
  // canonically-irregular bodies that once landed here (SSPX) are now
  // disqualifiers, so this is always empty.
  if (ordinariate) {
    positive.push("Personal Ordinariate (Anglican patrimony, in communion with Rome)");
    positiveWeight += 3;
  }
  const signals: CommunionSignals = { positive, negative: hardNegative, review: [] };

  // 1. Any disqualifying signal → not in communion. Never published. Checked
  //    FIRST so an Old-Catholic / Orthodox / Anglican "diocese" or "Catholic"
  //    can never be mistaken for a positive.
  if (hardNegative.length > 0) {
    return {
      status: "not-in-communion",
      confidence: Math.min(1, 0.7 + 0.1 * hardNegative.length),
      signals,
      reason: `Disqualifying signal(s): ${hardNegative.join("; ")}.`,
    };
  }

  // 2. A concrete Catholic signal (weight ≥ 3 — a named (arch)diocese/eparchy,
  //    any of the 24 rites/sui iuris churches, "Roman Catholic", a communion
  //    statement, or USCCB) → in communion. A lone weak signal (e.g. only the
  //    word "sacraments") is not enough on its own.
  if (positiveWeight >= 3) {
    return {
      status: "in-communion",
      confidence: Math.min(1, 0.6 + 0.1 * positiveWeight),
      signals,
      reason: `Catholic signal(s): ${positive.join("; ")}.`,
    };
  }

  // 3. Otherwise undetermined → not auto-published on a guess.
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
 * Best-effort contact + schedule details scraped from a parish website. Every
 * field is optional — a parish is publishable on just its name + address, so
 * anything we can't find is simply omitted (never a reason to block or stall).
 */
export interface ParishWebsiteDetails {
  phone?: string;
  massTimes?: string;
  confessionTimes?: string;
}

/** A time-of-day token: "8am", "10:30 a.m.", "5 pm", "12 noon". */
const TIME_TOKEN_RE = /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b|\bnoon\b/i;
/** A phone number: optional country/area code, 7+ digits with common separators. */
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{2,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/;

/** Pull a readable snippet that starts at `keyword` and contains a time token. */
function scheduleSnippetNear(text: string, keyword: RegExp, span = 240): string | undefined {
  const m = keyword.exec(text);
  if (!m) return undefined;
  const chunk = text
    .slice(m.index, m.index + span)
    .replace(/\s+/g, " ")
    .trim();
  if (!TIME_TOKEN_RE.test(chunk)) return undefined;
  // Keep it to a tidy one-liner: cut at a sentence break when there is one.
  const cut = chunk.search(/(?<=[a-z0-9)])\.\s+[A-Z]/);
  return (cut > 40 ? chunk.slice(0, cut + 1) : chunk).slice(0, 180).trim();
}

/**
 * Extract a parish's phone, Mass times, and confession/reconciliation times from
 * its website text. Pure + deterministic (unit-testable, no network). Returns
 * only what it is reasonably confident about — a schedule snippet is kept only
 * when a real clock time sits next to the heading, so we never store noise.
 */
export function extractParishDetailsFromText(rawText: string): ParishWebsiteDetails {
  const text = (rawText ?? "").replace(/\s+/g, " ");
  const details: ParishWebsiteDetails = {};

  const phoneContext = /(?:phone|tel|telephone|call|office|contact)[^0-9+(]{0,20}/i.exec(text);
  const phoneSource = phoneContext ? text.slice(phoneContext.index, phoneContext.index + 60) : text;
  const phone = PHONE_RE.exec(phoneSource)?.[0]?.trim();
  // Require at least 10 digits so we don't grab a year or a street number.
  if (phone && (phone.replace(/\D/g, "").length >= 10 || phoneContext)) {
    if (phone.replace(/\D/g, "").length >= 7) details.phone = phone;
  }

  const mass = scheduleSnippetNear(
    text,
    /\bmass (?:times|schedule|hours)\b|\b(?:weekend|sunday|daily|weekday|holy day) mass(?:es)?\b|\bmasses\b/i,
  );
  if (mass) details.massTimes = mass;

  const confession = scheduleSnippetNear(
    text,
    /\b(?:confession(?:s)?|reconciliation|sacrament of penance|penance)\b/i,
  );
  if (confession) details.confessionTimes = confession;

  return details;
}

/**
 * Fetch a parish website ONCE and return both the communion verdict and any
 * best-effort contact/schedule details found on it. A single fetch powers both
 * the publish gate and the monthly refresh. Returns an `unknown` verdict + empty
 * details when the site can't be read (the caller then trusts the OSM tag rather
 * than publishing on no evidence). Honours ADMIN_WORKER_SKIP_NETWORK.
 */
export async function inspectParishWebsite(
  website: string,
): Promise<{ verdict: CommunionVerdict; details: ParishWebsiteDetails }> {
  const empty: CommunionVerdict = {
    status: "unknown",
    confidence: 0,
    signals: { positive: [], negative: [], review: [] },
    reason: "Parish website could not be read.",
  };
  const none = (v: CommunionVerdict) => ({ verdict: v, details: {} as ParishWebsiteDetails });
  if (!website || process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return none(empty);

  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return none({ ...empty, reason: "Parish website URL did not parse." });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return none(empty);

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
    if (!res.ok) return none({ ...empty, reason: `Parish website returned HTTP ${res.status}.` });
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|xml|text\/plain/i.test(contentType)) {
      return none({ ...empty, reason: `Parish website is not HTML (${contentType}).` });
    }
    const text = htmlToText((await res.text()).slice(0, 1_500_000));
    return { verdict: assessCommunionFromText(text), details: extractParishDetailsFromText(text) };
  } catch (err) {
    return none({
      ...empty,
      reason: `Parish website fetch failed: ${err instanceof Error ? err.message : "error"}.`,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a parish website and assess ONLY its communion status. Thin wrapper over
 * `inspectParishWebsite` for callers that don't need the scraped details.
 */
export async function verifyParishCommunion(website: string): Promise<CommunionVerdict> {
  return (await inspectParishWebsite(website)).verdict;
}
