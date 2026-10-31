/**
 * Generic detail renderer for a published checklist item: the title, then the
 * fields the page names and nothing else.
 *
 * A content page shows its title and the information that matters (the owner's
 * rule): no sources or citations, no field label where the content speaks for
 * itself, no internal metadata. That is why there is no catch-all any more. The
 * renderer used to print every payload key a page had not named, which is how
 * "Feast month: 11", "Wikidata qid: Q2123866", "Content subtype:
 * pope_biography", "Structure: nine_days" and a duplicated "Summary" reached
 * readers. A page now lists exactly the fields it shows, in order; a field the
 * worker adds later stays in the payload (and in search and structured data)
 * until a page decides it matters.
 */

import { contentTypeLabel, type PublishedItem } from "@/lib/data/published";
import { displayItem } from "@/lib/translation/display";
import { documentDatePrecision } from "@/lib/content-shared/church-history/timeline";
import { formatHistoryDate } from "@/lib/content-shared/church-history/types";
import { toDisclosureItems } from "@/lib/content-shared/structured-content";
import {
  fieldLabel,
  isChipList,
  presentValue,
  type PresentedValue,
} from "@/lib/content-shared/field-presenters";

import { Disclosure } from "./Disclosure";
import { PrayerLinkedText } from "./PrayerLinkedText";
import { ShareButton } from "./ShareButton";
import { WikipediaAttribution } from "./WikipediaAttribution";
import type { GuidePrayerData } from "./GuidePrayers";

export interface PublishedDetailProps {
  item: PublishedItem;
  /** The payload fields to show, in order. Nothing else in the payload is shown. */
  primaryFields?: string[];
  /** More fields to show after `primaryFields`, in order. */
  secondaryFields?: string[];
  /** Optional header action (e.g. the Save/Add button) shown beside the title. */
  action?: React.ReactNode;
  /**
   * Prayers this item uses (novenas, devotions, practices, Marian titles). When
   * provided, any of them named inside a disclosure body (a day) or a text field
   * (how to practise) becomes inline-expandable — tap the name to drop the full
   * prayer open in place, with its Latin / Greek chips. Omitted everywhere else,
   * so those pages render exactly as before.
   */
  linkedPrayers?: GuidePrayerData[];
  /**
   * Per-field renderers: override how a named payload field's value is rendered
   * (e.g. an address that opens native Maps, a phone as a tel: link). The
   * section heading is still shown; only the value body is replaced. Fields not
   * listed here render normally.
   */
  fieldRenderers?: Record<string, (value: unknown) => React.ReactNode>;
  /**
   * Optional footer content rendered left-aligned at the bottom of the card
   * (e.g. a related apparition). Omitted everywhere else.
   */
  footer?: React.ReactNode;
  /**
   * Overrides the eyebrow above the title. Defaults to the human content-type
   * label ("Our Lady", "Church Document") — never the raw enum. Pages with a
   * more specific word for the item (a saint's "Doctor of the Church", a
   * guide's "Rosary") pass it here, and `null` shows none: "Saint" over
   * "Saint Godeberta" only repeats the name.
   */
  eyebrow?: string | null;
  /**
   * Show the stored one-line subtitle under the title (default). Pages whose
   * `facts` already say what the subtitle says turn it off rather than show
   * the same feast day twice.
   */
  showSubtitle?: boolean;
  /**
   * Short lines directly under the title, in order — "Patron of …", "Feast day:
   * …", "1910 – 1946". The page writes them, so each reads as a sentence, not a
   * labelled form field.
   */
  facts?: ReadonlyArray<string | null | undefined>;
  /**
   * Show the payload's `summary` as a lede under the title (default). It is
   * left out anyway when a shown field already contains it, so a sacrament's
   * overview is not printed twice.
   */
  lede?: boolean;
  /**
   * Heading overrides by field. `null` shows the field with no heading at all —
   * a saint's biography is the page's prose, not a section called "Biography".
   */
  headings?: Readonly<Record<string, string | null>>;
}

/**
 * Renders a value the presenter layer has already humanised. Every label and
 * every leaf string comes from `presentValue`, so nothing here can print a
 * camelCase key, a raw enum, or "[object Object]" — a value that cannot be
 * presented arrives as `null` and the caller drops the section entirely.
 */
function renderPresented(value: PresentedValue, depth = 0): React.ReactNode {
  if (value.kind === "text") {
    return value.multiline ? (
      <p className="whitespace-pre-line">{value.text}</p>
    ) : (
      <p>{value.text}</p>
    );
  }
  if (value.kind === "list") {
    // Short single-line entries (patronages, "what you need") read better as
    // chips than as a bulleted column.
    if (isChipList(value)) {
      return (
        <ul className="flex flex-wrap gap-2">
          {value.items.map((item, i) => (
            <li
              key={i}
              className="rounded-full border border-ink/15 px-3 py-1 font-serif text-sm text-ink-soft"
            >
              {item.kind === "text" ? item.text : null}
            </li>
          ))}
        </ul>
      );
    }
    const ListTag = value.ordered ? "ol" : "ul";
    return (
      <ListTag className={`ml-6 ${value.ordered ? "list-decimal" : "list-disc"}`}>
        {value.items.map((item, i) => (
          <li key={i} className="mt-2">
            {renderPresented(item, depth + 1)}
          </li>
        ))}
      </ListTag>
    );
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
      {value.pairs.map((pair) => (
        <div key={pair.label} className="contents">
          <dt className="font-medium text-ink-soft">{pair.label}</dt>
          <dd>{renderPresented(pair.value, depth + 1)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Never rendered, even when a page lists them. These are pure internal
// references or sources with no place on a reader's page — slug/title are the
// header, `summary` is the lede, citations and catechism references are
// sources (structured data keeps them), and *Key fields (sacramentKey,
// riteKey) are routing links between content, not content — the "Sacrament
// Key: reconciliation" leak.
const HIDDEN_FIELDS = new Set([
  "slug",
  "title",
  "summary",
  "citations",
  "sources",
  "catechismReferences",
  "sacramentKey",
  "riteKey",
  // Worker bookkeeping on structured saints: the feast is shown once, from
  // `feastDay`; its month/day split and the Wikidata id ("Feast month 6",
  // "Wikidata qid Q78679") are internal.
  "feastMonth",
  "feastDayOfMonth",
  "wikidataQid",
  // Cross-content reference lists. They hold slugs, and a slug is never
  // content: printing them produced "apostles-creed, our-father" under a
  // "Related Prayers" heading. Pages that want them resolve the real titles
  // from the data layer (RelatedContentLinks, or the prayers themselves).
  "relatedPrayers",
  "associatedPrayers",
  "relatedDevotions",
  "relatedPractices",
  "relatedSaints",
  "relatedGuides",
  "relatedDocuments",
]);

/**
 * HIST-02: a curated council was seeded with a "-01-01" placeholder day, so the
 * raw ISO string asserted a precision the source never claimed ("0325-01-01").
 * Show the year for those, the full date for a genuine 1-January encyclical.
 * Fails open: anything unparseable returns null and renders as before.
 */
function formatIssuedDate(value: unknown, documentType: unknown): string | null {
  if (typeof value !== "string") return null;
  const placed = documentDatePrecision({
    issuedDate: value,
    documentType: typeof documentType === "string" ? documentType : undefined,
  });
  return placed ? formatHistoryDate(placed) : null;
}

/** Letters and digits only, for "does this field already say the summary?". */
function foldProse(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function PublishedDetail({
  item,
  primaryFields,
  secondaryFields,
  action,
  linkedPrayers,
  fieldRenderers,
  footer,
  eyebrow,
  showSubtitle = true,
  facts,
  lede = true,
  headings,
}: PublishedDetailProps) {
  // What is shown, and in what order, is decided on the stored fields; the
  // text comes from `shown`, the reader's language when the item carries a
  // translation overlay (src/lib/translation) and the item itself otherwise.
  // Its payload has the stored shape, with only the prose translated.
  const payload = item.payload;
  const shown = displayItem(item);
  const shownPayload = shown.payload;
  const summary =
    typeof payload.summary === "string" && payload.summary.trim() ? payload.summary : undefined;
  const shownSummary =
    typeof shownPayload.summary === "string" && shownPayload.summary.trim()
      ? shownPayload.summary
      : summary;
  // The eyebrow is a word, not an enum: "MARIAN_TITLE" used to print here.
  // `subtype` refines it (a PRAYER whose prayerType is "litany" reads "Litany").
  const eyebrowLabel =
    eyebrow === undefined
      ? contentTypeLabel(
          item.contentType,
          typeof payload.prayerType === "string" ? payload.prayerType : null,
        )
      : eyebrow;

  const primary = primaryFields ?? [];
  const secondary = secondaryFields ?? [];
  const factLines = (facts ?? []).filter((line): line is string => !!line && !!line.trim());
  // The summary is the lede unless a shown field already says it.
  const foldedSummary = summary ? foldProse(summary) : "";
  const ledeText =
    lede &&
    summary &&
    ![...primary, ...secondary].some(
      (key) =>
        !HIDDEN_FIELDS.has(key) &&
        typeof payload[key] === "string" &&
        foldProse(payload[key] as string).includes(foldedSummary),
    )
      ? shownSummary
      : null;

  const linked = linkedPrayers && linkedPrayers.length > 0 ? linkedPrayers : null;
  const keysShown = new Set<string>();

  /** A field's section heading, or null when the page shows it unheaded. */
  const headingFor = (key: string) =>
    headings && key in headings ? headings[key] : fieldLabel(key);
  /** A prayer opened inside a field sits one level under that field's heading. */
  const panelLevel = (key: string) => (headingFor(key) ? 3 : 2);

  /** The section around a field's content, headed unless the page said null. */
  const section = (key: string, body: React.ReactNode) => {
    const heading = headingFor(key);
    return (
      <section key={key} className="mt-6">
        {heading ? <h2 className="font-display text-xl text-ink">{heading}</h2> : null}
        {body}
      </section>
    );
  };

  const renderField = (key: string) => {
    if (HIDDEN_FIELDS.has(key)) return null;
    // Slug and URL fields are references, never prose: printed directly they
    // produce "associated-saint-slugs: st-gregory" or a naked https:// line.
    // A page that wants the target renders it as a resolved link or a button
    // instead (RelatedContentLinks / OfficialSourceLink).
    if (/(?:Slug|Slugs|Url)$/.test(key)) return null;
    if (keysShown.has(key)) return null;
    keysShown.add(key);
    const stored = payload[key];
    if (stored == null) return null;
    if (typeof stored === "string" && !stored.trim()) return null;
    if (Array.isArray(stored) && stored.length === 0) return null;
    // The reader's text, in the stored shape (the stored value when untranslated).
    const value = shownPayload[key] ?? stored;
    // Caller-supplied renderer for this field (e.g. address → Maps link).
    const custom = fieldRenderers?.[key];
    if (custom) {
      const rendered = custom(value);
      if (rendered == null) return null;
      return section(
        key,
        <div className="mt-2 font-serif leading-relaxed text-ink">{rendered}</div>,
      );
    }
    if (key === "issuedDate") {
      const formatted = formatIssuedDate(value, payload.documentType);
      if (formatted) {
        return section(
          key,
          <div className="mt-2 font-serif leading-relaxed text-ink">{formatted}</div>,
        );
      }
    }
    // Novena days / guide prayers / rosary mysteries → expandable dropdowns
    // (title + chevron → full text), so long pages stay concise.
    const disclosures = toDisclosureItems(value);
    if (disclosures) {
      return section(
        key,
        <div className="mt-3 flex flex-col gap-3">
          {disclosures.map((d, i) => (
            <Disclosure key={`${key}-${i}`} title={d.title} eyebrow={d.eyebrow}>
              {linked ? (
                // A day's text is itself prayer: only capitalised names link.
                <PrayerLinkedText
                  text={d.body}
                  prayers={linked}
                  matchCase
                  headingLevel={panelLevel(key)}
                />
              ) : (
                <p className="whitespace-pre-line">{d.body}</p>
              )}
            </Disclosure>
          ))}
        </div>,
      );
    }
    // Everything else goes through the presenter layer; a value it cannot
    // present honestly returns null and the whole section is dropped rather
    // than printing "[object Object]" or a bare flag.
    const presented = presentValue(key, value);
    if (!presented) return null;
    return section(
      key,
      <div className="mt-2 font-serif leading-relaxed text-ink">
        {linked && presented.kind === "text" ? (
          // Instructions name prayers in running prose ("pray the Our Father").
          <PrayerLinkedText text={presented.text} prayers={linked} headingLevel={panelLevel(key)} />
        ) : (
          renderPresented(presented)
        )}
      </div>,
    );
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrowLabel ? <p className="vf-eyebrow mb-2">{eyebrowLabel}</p> : null}
            <h1 className="break-words font-display text-4xl text-ink">{shown.title}</h1>
            {showSubtitle && shown.subtitle ? (
              <p className="mt-1 font-serif text-base italic text-ink-soft">{shown.subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ShareButton title={shown.title} text={shownSummary ?? shown.title} />
            {action}
          </div>
        </div>
        {factLines.length > 0 ? (
          <div className="mt-3 space-y-1">
            {factLines.map((line, i) => (
              <p key={`${i}:${line}`} className="font-serif leading-snug text-ink-soft">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {ledeText ? (
          <p className="mt-3 font-serif leading-relaxed text-ink-soft">{ledeText}</p>
        ) : null}
      </header>

      {primary.map(renderField)}
      {secondary.map(renderField)}

      {footer ? (
        <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-[rgba(17,17,17,0.12)] pt-6">
          {footer}
        </footer>
      ) : null}
      {/* Which article to credit is read from the stored record. */}
      <WikipediaAttribution contentType={item.contentType} payload={payload} />
    </article>
  );
}
