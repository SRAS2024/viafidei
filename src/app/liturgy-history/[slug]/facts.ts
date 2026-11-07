import type { FactItem } from "@/components/ui/FactList";
import { formatIssuedDate } from "@/components/ui/PublishedDetail";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * What a document is: "Encyclical", "Papal Bull", "Decree of an Ecumenical Council".
 * A council's own entry has no subtype and reads "Ecumenical Council". The wording
 * is the one the worker's subtitle uses, asked for without the issuer or the year.
 */
export function documentKind(payload: Record<string, unknown>): string {
  const type = clean(payload.documentType);
  const subtype = clean(payload.contentSubtype);
  return generateContentSubtitle({
    contentType: "CHURCH_DOCUMENT",
    contentSubtype: subtype,
    fields: { documentType: type === "council_document" && subtype ? subtype : type },
  });
}

/**
 * Who issued it, when the record says something more than "Catholic Church". A pope
 * is called one however the record wrote him: most say "Pope Pius XII", a few "Pius
 * XII", and the two side by side read as two different people.
 */
export function documentIssuer(payload: Record<string, unknown>): string | null {
  const authority = clean(payload.issuingAuthority);
  if (authority && authority.toLowerCase() !== "catholic church") {
    return /^(?!Pope )[A-Z][a-z]+(?: [A-Z][a-z]+)? [IVXL]+$/.test(authority)
      ? `Pope ${authority}`
      : authority;
  }
  const pope = clean(payload.pope) || clean(payload.popeName) || clean(payload.author);
  return pope ? `Pope ${pope}` : null;
}

/**
 * A Church document's facts: its date, what kind of document it is, who issued it.
 * The date says only what the record knows: a council's "-01-01" is a placeholder
 * and reads as the year, a genuine 1 January encyclical keeps its day.
 */
export function documentFactItems(payload: Record<string, unknown>): FactItem[] {
  const date = formatIssuedDate(payload.issuedDate, payload.documentType);
  const issuer = documentIssuer(payload);
  const items: Array<FactItem | null> = [
    date ? { label: "Date", value: date } : null,
    { label: "Type", value: documentKind(payload) },
    issuer ? { label: "Issued by", value: issuer } : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}

/** The commonest words of English prose, which make up a third or more of any page of it. */
const COMMON_ENGLISH = new Set(
  "the of and to in that is for with by as it be are which on not this we his her from our or an has have their who was were at".split(
    " ",
  ),
);

/**
 * Whether a stored excerpt can be shown on an English page. The ingest sometimes
 * kept the first text the Vatican served, which might be Portuguese with its accented
 * letters lost ("provid ncia s o cheios"), a Latin salutation in capitals, or Chinese
 * as raw "&#x6559;" codes. That is a wrong-looking page, not a quotation, so the
 * section is left out. A translated view is judged by the stored text too.
 */
export function excerptIsReadable(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  if (/&#x?[0-9a-f]+;|�/i.test(value)) return false;
  const words = value.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 8) return true;
  return words.filter((word) => COMMON_ENGLISH.has(word)).length / words.length >= 0.2;
}

/**
 * The one way out of a document's page, named for where it goes. A council's
 * entry links an encyclopedia article, and that is not "the full document".
 */
export function documentLinkLabel(url: string): string {
  return /^https?:\/\/[a-z-]+\.(?:m\.)?wikipedia\.org\//i.test(url)
    ? "Read more on Wikipedia"
    : "Read the full document";
}

/**
 * The parts of a liturgical entry's line. A celebration has a rank, a date and
 * sometimes a season ("Memorial · October 7 · Ordinary Time"); anything else (the
 * Order of Mass, a liturgical book, a glossary term) has only what kind of entry it
 * is. The title is part of that: the record files The Rite of Baptism under the
 * structure of the Mass. It files Good Friday and Divine Mercy Sunday as seasons too,
 * but only a real season is called one; the rest keep the page's plain "Liturgy"
 * label.
 */
export function liturgicalLine(
  payload: Record<string, unknown>,
  title: string = clean(payload.title),
): {
  kind: string;
  facts: FactItem[];
} {
  const [first = "", ...rest] = generateContentSubtitle({
    contentType: "LITURGICAL",
    title,
    fields: payload,
  }).split(" · ");
  if (rest.length === 0) {
    const isDayFiledAsSeason =
      clean(payload.kind) === "liturgical_season" && !clean(payload.slug).startsWith("season-");
    return { kind: isDayFiledAsSeason ? "" : first, facts: [] };
  }
  const season = rest.find((part) => /season|lent|advent|ordinary time|triduum/i.test(part));
  const date = rest.find((part) => part !== season);
  const items: Array<FactItem | null> = [
    { label: "Rank", value: first },
    date ? { label: "Date", value: date === "movable" ? "Movable" : date } : null,
    season ? { label: "Season", value: season } : null,
  ];
  return { kind: "", facts: items.filter((item): item is FactItem => item != null) };
}
