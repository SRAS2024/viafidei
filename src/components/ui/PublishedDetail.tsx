/**
 * Generic detail renderer for any published checklist item.
 * Renders title, summary, body fields, structured fields, and citations.
 */

import type { PublishedItem } from "@/lib/data/published";

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
    return (
      <section key={key} className="mt-6">
        <h2 className="font-display text-xl text-ink capitalize">
          {key.replace(/([A-Z])/g, " $1").trim()}
        </h2>
        <div className="mt-2 font-serif leading-relaxed text-ink">{renderValue(value)}</div>
      </section>
    );
  };

  const primary = primaryFields ?? [];
  const secondary = secondaryFields ?? [];
  const remaining = Object.keys(payload).filter(
    (k) =>
      !primary.includes(k) && !secondary.includes(k) && !HIDDEN_FIELDS.has(k) && k !== "summary",
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
