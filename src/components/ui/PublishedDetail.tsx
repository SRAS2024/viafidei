/**
 * Generic detail renderer for any published checklist item.
 * Renders title, summary, body fields, structured fields, and citations.
 */

import type { PublishedItem } from "@/lib/data/published";
import { toDisclosureItems } from "@/lib/content-shared/structured-content";

import { Disclosure } from "./Disclosure";

export interface PublishedDetailProps {
  item: PublishedItem;
  primaryFields?: string[];
  secondaryFields?: string[];
  /** Optional header action (e.g. the Save/Add button) shown beside the title. */
  action?: React.ReactNode;
}

function renderValue(value: unknown): React.ReactNode {
  if (value == null) return null;
  if (typeof value === "string") {
    if (value.includes("\n")) {
      return <p className="whitespace-pre-line">{value}</p>;
    }
    return <p>{value}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (typeof value[0] === "string") {
      return (
        <ul className="ml-6 list-disc">
          {value.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="ml-6 list-decimal">
        {value.map((v, i) => (
          <li key={i} className="mt-2">
            {typeof v === "object" && v
              ? Object.entries(v).map(([k, vv]) => (
                  <div key={k}>
                    <span className="font-medium">{k}: </span>
                    <span>{String(vv)}</span>
                  </div>
                ))
              : String(v)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium text-ink-soft">{k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <p>{String(value)}</p>;
}

const HIDDEN_FIELDS = new Set(["slug", "title", "citations"]);

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

export function PublishedDetail({
  item,
  primaryFields,
  secondaryFields,
  action,
}: PublishedDetailProps) {
  const payload = item.payload;
  const summary = payload.summary as string | undefined;
  const citations = (payload.citations as string[] | undefined) ?? [];

  const keysShown = new Set<string>();
  const renderField = (key: string) => {
    if (HIDDEN_FIELDS.has(key)) return null;
    if (keysShown.has(key)) return null;
    keysShown.add(key);
    const value = payload[key];
    if (value == null) return null;
    if (typeof value === "string" && !value.trim()) return null;
    if (Array.isArray(value) && value.length === 0) return null;
    // Novena days / guide prayers / rosary mysteries → expandable dropdowns
    // (title + chevron → full text), so guides stay concise.
    const disclosures = toDisclosureItems(value);
    return (
      <section key={key} className="mt-6">
        <h2 className="font-display text-xl capitalize text-ink">
          {key.replace(/([A-Z])/g, " $1").trim()}
        </h2>
        {disclosures ? (
          <div className="mt-3 flex flex-col gap-3">
            {disclosures.map((d, i) => (
              <Disclosure key={`${key}-${i}`} title={d.title}>
                <p className="whitespace-pre-line">{d.body}</p>
              </Disclosure>
            ))}
          </div>
        ) : (
          <div className="mt-2 font-serif leading-relaxed text-ink">{renderValue(value)}</div>
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
            <p className="vf-eyebrow">{item.contentType}</p>
            <h1 className="mt-2 font-display text-4xl text-ink">{item.title}</h1>
          </div>
          {action ? <div className="shrink-0 pt-1">{action}</div> : null}
        </div>
        {summary && <p className="mt-3 font-serif leading-relaxed text-ink-soft">{summary}</p>}
      </header>

      {primary.map(renderField)}
      {secondary.map(renderField)}
      {remaining.map(renderField)}

      {citations.length > 0 && (
        <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-ink-faint">
          <p className="font-medium uppercase tracking-wide">Approved sources</p>
          <ul className="mt-2 space-y-1">
            {citations.map((url) => (
              <li key={url}>
                <a href={url} className="break-all underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] uppercase tracking-wide">
            Authority level: {item.authorityLevel} · v{item.version}
          </p>
        </footer>
      )}
    </article>
  );
}
