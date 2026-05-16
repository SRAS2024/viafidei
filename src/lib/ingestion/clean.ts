import type { IngestedItem } from "./types";

/**
 * Strip non-content noise out of text fields without rejecting the
 * surrounding item. The ingestion pipeline historically refused
 * whole pages that contained newsletter / cookie / navigation
 * boilerplate; this module instead surgically removes those
 * paragraphs so the real content underneath can flow through to
 * validation.
 *
 * Three buckets of cleaning:
 *
 *   1. **Line-level boilerplate** — a single line that matches a
 *      navigation / cookie / share-this / footer pattern is dropped.
 *      The surrounding paragraphs survive.
 *   2. **Paragraph-level boilerplate** — an entire paragraph that
 *      reads as a source byline, donation appeal, or subscribe CTA
 *      is dropped (multi-line patterns).
 *   3. **Trailing tails** — common "Continue reading" / "Read more"
 *      / "Share this" / "Published in X" sentences appended at the
 *      end of an article are trimmed off.
 *
 * The cleaner is intentionally conservative: when in doubt, keep the
 * text. Better to send a slightly-noisy item to the validator (which
 * is also trained on these patterns) than to over-strip.
 */

const LINE_NOISE_RE: ReadonlyArray<RegExp> = [
  // Cookie / privacy banners.
  /\b(this site uses cookies|we use cookies|cookie policy|accept all cookies|manage preferences)\b/i,
  // Subscribe / newsletter calls to action.
  /\b(subscribe to (our|the) (newsletter|email|mailing list)|sign up for (our|the) (newsletter|updates|emails))\b/i,
  /\b(monthly newsletter|weekly newsletter|enter your email)\b/i,
  // Donation appeals.
  /\b(donate (now|today)|make a (donation|gift)|donation appeal|support our (mission|work)|your gift|tax[- ]deductible)\b/i,
  // Social share strips.
  /\b(share this( article| page)?|share on (facebook|twitter|x|whatsapp|linkedin|email)|print this( article| page)?|email this)\b/i,
  /^(facebook|twitter|instagram|youtube|whatsapp|telegram|tiktok)\s*$/i,
  // Navigation crumbs.
  /^home\s*[›>›]\s*/i,
  /^breadcrumb/i,
  // Bare social links.
  /^(follow us|connect with us|stay connected)\b/i,
  // "Back to top" affordances.
  /^(back to top|return to top|go to top|skip to (main )?content|jump to content)\b/i,
  // Site furniture.
  /^(menu|toggle menu|open menu|close menu|search this site)\b/i,
  // Comment counts / "leave a comment" hooks.
  /^(\d+\s+)?(comments?|replies?)\s*$/i,
  /\bleave a (comment|reply)\b/i,
  // Date-stamp / byline strips ("By John Doe | June 1, 2024").
  /^by\s+[\w.\-'\s]+\s*[|·-]\s*[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}\s*$/,
];

const PARAGRAPH_NOISE_RE: ReadonlyArray<RegExp> = [
  // Source-summary blurbs ("EWTN is the global Catholic Network…").
  /^(ewtn|catholic answers|catholic culture|catholic news agency|catholic world report|word on fire|ascension|the catholic thing|catholic australia)\s+(is|was)\s+/i,
  /^a (work|service|publication|website|programme|program|ministry|apostolate|initiative|outreach) of /i,
  // TV / radio / livestream descriptions + widget labels.
  /\b(live stream(?:ed)? (mass|liturgy|prayer)|broadcast schedule|on demand|episode \d+|series overview)\b/i,
  /\b(daily mass broadcast|catholic television|radio ministry|tv programs?|television programs?)\b/i,
  /\b(watch (?:on|live on) (?:youtube|vimeo|facebook|twitch|x|instagram)|livestream from)\b/i,
  // Event cards / listings / registration / RSVP.
  /\b(event listings?|upcoming events|schedule of events|conference registration|register (now|today)|rsvp(?:\s+by)?|tickets available|join us for (?:our|the))\b/i,
  // Related article blocks (sidebar / "see also" links).
  /\b(related (?:articles?|posts?|reading|content|prayers?|saints?)|see also|you (?:might|may) (?:also )?(?:like|enjoy)|recommended (?:reading|articles))\b/i,
  // Embedded media labels (figure / iframe / player captions).
  /^(figure|image|photo|video|audio|player|embedded\s+(?:from|by)|source[:.]\s+\w+|caption[:.]\s+\w+)\b/i,
  /\b(?:click to (?:play|watch|listen)|press play|download (?:the )?(?:video|audio|podcast))\b/i,
  // Shop pages.
  /\b(gift shop|online store|catholic bookstore|add to cart|order (now|today)|free shipping)\b/i,
  // 404 / access-denied page text.
  /\b(404 not found|page not found|access denied|sorry,? (the page|that page))\b/i,
  // Generic legal footer copy.
  /\b(privacy policy|terms of (use|service)|cookies policy|all rights reserved|copyright\s+©?\s*\d{4})\b/i,
];

/**
 * Lines that, when found at the very end of a body, are stripped
 * along with everything after them. Article footers commonly include
 * a string of these in series; one match collapses the whole tail.
 */
const TAIL_TRIM_RE: ReadonlyArray<RegExp> = [
  /^(continue reading|read more|read the (full|rest of the) article|click here to (read|learn|continue))\b/i,
  /^(the article (continues|appears)|excerpt from|originally published (in|on|by))\b/i,
  /^(this article was (originally|first) (published|posted))\b/i,
  /^(about the author|related (articles|posts|prayers|saints))\b/i,
];

function cleanText(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  // Split paragraphs (blank-line separated). Within each paragraph,
  // split lines and drop the ones that match LINE_NOISE_RE. Then drop
  // entire paragraphs whose remaining content matches PARAGRAPH_NOISE_RE.
  const paragraphs = trimmed.split(/\n{2,}/);
  const cleanedParagraphs: string[] = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split(/\n/)
      .map((line) => line.replace(/\s+$/, ""))
      .filter((line) => {
        const stripped = line.trim();
        if (stripped.length === 0) return false;
        return !LINE_NOISE_RE.some((re) => re.test(stripped));
      });
    if (lines.length === 0) continue;
    const merged = lines.join("\n").trim();
    if (PARAGRAPH_NOISE_RE.some((re) => re.test(merged))) continue;
    cleanedParagraphs.push(merged);
  }

  // Trim trailing boilerplate paragraphs ("Continue reading", "Share
  // this", "About the author"). We walk from the end and stop as soon
  // as a paragraph doesn't match a tail pattern.
  while (cleanedParagraphs.length > 0) {
    const last = cleanedParagraphs[cleanedParagraphs.length - 1];
    if (TAIL_TRIM_RE.some((re) => re.test(last))) {
      cleanedParagraphs.pop();
      continue;
    }
    break;
  }

  const out = cleanedParagraphs.join("\n\n").trim();
  return out.length > 0 ? out : undefined;
}

function cleanInline(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  // Strip trailing source / brand suffixes ("Hail Mary | USCCB",
  // "Saint Padre Pio - Vatican.va", "Lourdes - Wikipedia"). These
  // distort dedup and search but don't help anyone.
  const stripped = trimmed
    .replace(
      /\s*[|•·–]\s*(USCCB|CCCB|CBCEW|EWTN|Vatican\.va|Catholic Culture|OSV|New Advent|Wikipedia|National Catholic Register|Word on Fire)\s*$/i,
      "",
    )
    .replace(/\s*-\s*(Vatican|USCCB|CCCB|CBCEW|EWTN)\s*$/i, "")
    .trim();
  return stripped.length > 0 ? stripped : undefined;
}

/**
 * Surgically clean every text field on an ingested item: drop
 * navigation lines, footer boilerplate, share-this strips, and
 * trailing "continue reading" tails. The item structure is
 * preserved — only the text bodies are slimmed down.
 *
 * Returns a new object so callers can compare before / after. The
 * `kind` discriminator is preserved so the caller's type
 * narrowing keeps working.
 */
export function cleanIngestedItem(item: IngestedItem): IngestedItem {
  switch (item.kind) {
    case "prayer":
      return {
        ...item,
        defaultTitle: cleanInline(item.defaultTitle) ?? item.defaultTitle,
        body: cleanText(item.body) ?? item.body,
        category: cleanInline(item.category) ?? item.category,
      };
    case "saint":
      return {
        ...item,
        canonicalName: cleanInline(item.canonicalName) ?? item.canonicalName,
        biography: cleanText(item.biography) ?? item.biography,
        ...(typeof item.officialPrayer === "string"
          ? { officialPrayer: cleanText(item.officialPrayer) ?? item.officialPrayer }
          : {}),
      };
    case "apparition":
      return {
        ...item,
        title: cleanInline(item.title) ?? item.title,
        summary: cleanText(item.summary) ?? item.summary,
        ...(typeof item.location === "string"
          ? { location: cleanInline(item.location) ?? item.location }
          : {}),
        ...(typeof item.officialPrayer === "string"
          ? { officialPrayer: cleanText(item.officialPrayer) ?? item.officialPrayer }
          : {}),
      };
    case "parish":
      return {
        ...item,
        name: cleanInline(item.name) ?? item.name,
        ...(typeof item.address === "string"
          ? { address: cleanInline(item.address) ?? item.address }
          : {}),
        ...(typeof item.city === "string" ? { city: cleanInline(item.city) ?? item.city } : {}),
      };
    case "devotion":
      return {
        ...item,
        title: cleanInline(item.title) ?? item.title,
        summary: cleanText(item.summary) ?? item.summary,
        ...(typeof item.practiceText === "string"
          ? { practiceText: cleanText(item.practiceText) ?? item.practiceText }
          : {}),
      };
    case "liturgy":
      return {
        ...item,
        title: cleanInline(item.title) ?? item.title,
        ...(typeof item.summary === "string"
          ? { summary: cleanText(item.summary) ?? item.summary }
          : {}),
        body: cleanText(item.body) ?? item.body,
      };
    case "guide":
      return {
        ...item,
        title: cleanInline(item.title) ?? item.title,
        summary: cleanText(item.summary) ?? item.summary,
        ...(typeof item.bodyText === "string"
          ? { bodyText: cleanText(item.bodyText) ?? item.bodyText }
          : {}),
      };
  }
}

export function cleanIngestedItems(items: IngestedItem[]): IngestedItem[] {
  return items.map(cleanIngestedItem);
}
