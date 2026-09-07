/**
 * Generic detail renderer for any published checklist item.
 * Renders title, summary, body fields, structured fields, and citations.
 */

import { contentTypeLabel, type PublishedItem } from "@/lib/data/published";
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
import type { GuidePrayerData } from "./GuidePrayers";

export interface PublishedDetailProps {
  item: PublishedItem;
  primaryFields?: string[];
  secondaryFields?: string[];
  /** Optional header action (e.g. the Save/Add button) shown beside the title. */
  action?: React.ReactNode;
  /**
   * Prayers this item uses (guides / novenas). When provided, any prayer named
   * inside a disclosure body (a step or a day) becomes inline-expandable — tap
   * the name to drop the full prayer open in place. Omitted everywhere else, so
   * those pages render exactly as before.
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
   * (e.g. a parish's "Go to site" button). Omitted everywhere else.
   */
  footer?: React.ReactNode;
  /**
   * Overrides the eyebrow above the title. Defaults to the human content-type
   * label ("Our Lady", "Church Document") — never the raw enum. Pages with a
   * more specific word for the item (a saint's "Martyr", a guide's "Rosary")
   * pass it here.
   */
  eyebrow?: string;
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

// Never rendered, even when a page lists them explicitly in primary/secondary
// fields. These are pure internal references with no user-facing meaning —
// slug/title/citations are handled elsewhere, and *Key fields (e.g.
// sacramentKey, riteKey) are routing links between content, not content. This
// is the hard guard behind isMetaField: isMetaField only filters the catch-all
// "remaining" section, so an internal key a page named directly (the
// "Sacrament Key: reconciliation" leak) still needs blocking here.
const HIDDEN_FIELDS = new Set([
  "slug",
  "title",
  "citations",
  "sacramentKey",
  "riteKey",
  // Cross-content reference lists. They hold slugs, and a slug is never
  // content: printing them produced "apostles-creed, our-father" under a
  // "Related Prayers" heading. Pages that want them resolve the real titles
  // from the data layer and render them as links (see RelatedContentLinks).
  "relatedPrayers",
  "relatedDevotions",
  "relatedPractices",
  "relatedSaints",
  "relatedGuides",
]);

// Structural / worker-metadata keys that must never auto-render in the
// catch-all "remaining" section (they would surface as stray headings like
// "Rite Key", "Approved Status", or "Requires Human Review"). A page that
// genuinely wants one of these still lists it explicitly in primary/secondary
// fields, which bypasses this filter.
const META_FIELDS = new Set([
  "summary", // rendered in the header
  "contentType",
  "type",
  "kind",
  "subtype",
  "language",
  "locale",
  "canonicalName",
  "canonicalSlug",
  "canonicalUrl",
  "officialDocumentUrl",
  "approvalStatus",
  "approvedStatus",
  "authorityLevel",
  "titleLabel",
  "order",
  "orderRank",
  "rank",
  "confidence",
  "confidenceScore",
  "provenance",
  "sourceEvidence",
  "qualityScore",
  "score",
  "checksum",
  "ok",
  "errors",
  "schema",
  "payload",
  "optionalFields",
  "requiredFields",
  "requiresHumanReview",
  "minCitations",
  "preferredSourceHosts",
  "accuracyRules",
  "claimed",
  "dropdownMetadata",
  "machineTranslated",
  "version",
  "status",
  "id",
  "createdAt",
  "updatedAt",
  "publishedAt",
]);

/**
 * Whether a payload key is structural metadata (not user-facing prose) and so
 * should be skipped by the catch-all renderer. Covers the explicit META_FIELDS
 * plus, by suffix:
 *   - Key / Slug / Slugs / Url — internal references (riteKey, associatedSaintSlug, canonicalUrl)
 *   - Title / Name — the worker's name fields (saintName, devotionTitle) that just duplicate the page title
 *   - Type — classification metadata (saintType, devotionType, liturgyType)
 * A page that genuinely wants one of these (e.g. a Doctor's `doctorTitle` or a
 * Pope's `birthName`) lists it explicitly in primary/secondary fields, which
 * bypasses this filter. Content fields like `keyThemes`, `mysterySets`,
 * `openingPrayers`, or `practiceKind` don't match these suffixes and still render.
 */
function isMetaField(key: string): boolean {
  return META_FIELDS.has(key) || /(?:Key|Slug|Slugs|Url|Title|Name|Type)$/.test(key);
}

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

export function PublishedDetail({
  item,
  primaryFields,
  secondaryFields,
  action,
  linkedPrayers,
  fieldRenderers,
  footer,
  eyebrow,
}: PublishedDetailProps) {
  const payload = item.payload;
  const summary = payload.summary as string | undefined;
  // The eyebrow is a word, not an enum: "MARIAN_TITLE" used to print here.
  // `subtype` refines it (a PRAYER whose prayerType is "litany" reads "Litany").
  const eyebrowLabel =
    eyebrow ??
    contentTypeLabel(
      item.contentType,
      typeof payload.prayerType === "string" ? payload.prayerType : null,
    );

  const keysShown = new Set<string>();
  const renderField = (key: string) => {
    if (HIDDEN_FIELDS.has(key)) return null;
    // Slug and URL fields are references, never prose: printed directly they
    // produce "associated-saint-slugs: st-gregory" or a naked https:// line.
    // Unlike the Key/Title/Name/Type suffixes this guard is unconditional —
    // a page that wants the target renders it as a resolved link or a source
    // button instead (RelatedContentLinks / OfficialSourceLink).
    if (/(?:Slug|Slugs|Url)$/.test(key)) return null;
    if (keysShown.has(key)) return null;
    keysShown.add(key);
    const value = payload[key];
    if (value == null) return null;
    if (typeof value === "string" && !value.trim()) return null;
    if (Array.isArray(value) && value.length === 0) return null;
    // Caller-supplied renderer for this field (e.g. address → Maps link).
    const custom = fieldRenderers?.[key];
    if (custom) {
      const rendered = custom(value);
      if (rendered == null) return null;
      return (
        <section key={key} className="mt-6">
          <h2 className="font-display text-xl text-ink">{fieldLabel(key)}</h2>
          <div className="mt-2 font-serif leading-relaxed text-ink">{rendered}</div>
        </section>
      );
    }
    if (key === "issuedDate") {
      const formatted = formatIssuedDate(value, payload.documentType);
      if (formatted) {
        return (
          <section key={key} className="mt-6">
            <h2 className="font-display text-xl text-ink">{fieldLabel(key)}</h2>
            <div className="mt-2 font-serif leading-relaxed text-ink">{formatted}</div>
          </section>
        );
      }
    }
    // Novena days / guide prayers / rosary mysteries → expandable dropdowns
    // (title + chevron → full text), so guides stay concise.
    const disclosures = toDisclosureItems(value);
    // Everything else goes through the presenter layer; a value it cannot
    // present honestly returns null and the whole section is dropped rather
    // than printing "[object Object]" or a bare flag.
    const presented = disclosures ? null : presentValue(key, value);
    if (!disclosures && !presented) return null;
    return (
      <section key={key} className="mt-6">
        <h2 className="font-display text-xl text-ink">{fieldLabel(key)}</h2>
        {disclosures ? (
          <div className="mt-3 flex flex-col gap-3">
            {disclosures.map((d, i) => (
              <Disclosure key={`${key}-${i}`} title={d.title}>
                {linkedPrayers && linkedPrayers.length > 0 ? (
                  <PrayerLinkedText text={d.body} prayers={linkedPrayers} />
                ) : (
                  <p className="whitespace-pre-line">{d.body}</p>
                )}
              </Disclosure>
            ))}
          </div>
        ) : (
          <div className="mt-2 font-serif leading-relaxed text-ink">
            {renderPresented(presented as PresentedValue)}
          </div>
        )}
      </section>
    );
  };

  const primary = primaryFields ?? [];
  const secondary = secondaryFields ?? [];
  const remaining = Object.keys(payload).filter(
    (k) =>
      !primary.includes(k) && !secondary.includes(k) && !HIDDEN_FIELDS.has(k) && !isMetaField(k),
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="vf-eyebrow">{eyebrowLabel}</p>
            <h1 className="mt-2 font-display text-4xl text-ink">{item.title}</h1>
            {item.subtitle ? (
              <p className="mt-1 font-serif text-base italic text-ink-soft">{item.subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ShareButton title={item.title} text={summary ?? item.title} />
            {action}
          </div>
        </div>
        {summary && <p className="mt-3 font-serif leading-relaxed text-ink-soft">{summary}</p>}
      </header>

      {primary.map(renderField)}
      {secondary.map(renderField)}
      {remaining.map(renderField)}

      {footer ? (
        <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-[rgba(17,17,17,0.12)] pt-6">
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
