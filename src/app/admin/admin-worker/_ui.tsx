/**
 * Shared presentational primitives for the Admin Worker Command Center, so every
 * card, badge, stat, and table looks the same. Built on the site design tokens
 * (vf-card, vf-eyebrow, vf-rule, the ink/paper/action-blue palette) for a clean,
 * consistent, modern admin surface. Pure presentational — no data access.
 */
import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

/**
 * The Admin Worker mark: a sketched, no-colour atom (three electron orbits + a
 * nucleus) with a crossed hammer and wrench inside the nucleus — "intelligence
 * that builds and maintains". Drawn entirely with `currentColor` strokes and no
 * fill, so it inherits whatever tone the surrounding banner/heading uses (ink,
 * emerald, amber, rose…) and stays monochrome/sketched everywhere. This is the
 * single canonical identity for the worker's intelligence layer — it replaces
 * the old 🧠 "brain" emoji across the console.
 */
export function AdminWorkerIcon({
  className,
  title = "Admin Worker",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{title}</title>
      {/* Electron orbits — three ellipses rotated about the centre. */}
      <ellipse cx="24" cy="24" rx="21" ry="7.6" />
      <ellipse cx="24" cy="24" rx="21" ry="7.6" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="21" ry="7.6" transform="rotate(120 24 24)" />
      {/* Nucleus. */}
      <circle cx="24" cy="24" r="10.5" />
      {/* Crossed tools inside the nucleus. Wrench on the "/" diagonal (open jaw
          top-right); hammer on the "\" diagonal (head top-left). */}
      <g strokeWidth={1.8}>
        {/* wrench handle + open jaw */}
        <line x1="19.4" y1="28.6" x2="26.6" y2="21.4" />
        <path d="M26.6 21.4a2.5 2.5 0 1 1 2.4-2.4l-2.1 2.1z" />
        {/* hammer handle + head */}
        <line x1="19.8" y1="19.8" x2="27.4" y2="27.4" />
        <path d="M17.2 22.4l5.2-5.2 2.2 2.2-5.2 5.2z" />
      </g>
    </svg>
  );
}

const PILL: Record<Tone, string> = {
  ok: "border-emerald-300 bg-emerald-100 text-emerald-900",
  warn: "border-amber-300 bg-amber-100 text-amber-900",
  bad: "border-rose-300 bg-rose-100 text-rose-900",
  info: "border-sky-300 bg-sky-100 text-sky-900",
  neutral: "border-ink/10 bg-ink/5 text-ink-soft",
};

/** A small status badge — one consistent look for every state in the console. */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[tone]}`}
    >
      {children}
    </span>
  );
}

/** A labelled section divider that groups the cards beneath it. */
export function SectionHeading({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mt-8 first:mt-0">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-sm uppercase tracking-liturgical text-ink-soft">
          {title}
        </h2>
        {right ? <div className="shrink-0 text-xs text-ink-faint">{right}</div> : null}
      </div>
      {description ? <p className="mt-1 max-w-3xl text-xs text-ink-faint">{description}</p> : null}
      <div className="vf-rule mt-2" />
    </div>
  );
}

/** The standard console card. `span` widens it to both grid columns. */
export function Card({
  title,
  eyebrow,
  right,
  span,
  children,
  className,
}: {
  title?: ReactNode;
  eyebrow?: string;
  right?: ReactNode;
  span?: 1 | 2;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`vf-card rounded-sm p-5 ${span === 2 ? "md:col-span-2" : ""} ${className ?? ""}`}
    >
      {title || right || eyebrow ? (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? <div className="vf-eyebrow">{eyebrow}</div> : null}
            {title ? (
              <h3 className="font-display text-lg leading-tight text-ink">{title}</h3>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      ) : null}
      {children}
    </article>
  );
}

/** A compact metric tile. */
export function Stat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: Tone;
  hint?: string;
}) {
  const color = {
    ok: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-rose-700",
    info: "text-sky-800",
    neutral: "text-ink",
  }[tone];
  return (
    <div className="rounded-sm border border-ink/10 bg-paper-bright px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-0.5 font-mono text-lg leading-none ${color}`}>{value}</div>
      {hint ? <div className="mt-1 text-[10px] leading-tight text-ink-faint">{hint}</div> : null}
    </div>
  );
}

/** A definition-list row helper for the key/value cards. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-mono text-ink">{children}</dd>
    </>
  );
}

/** A consistent table shell (scrolls on small screens). */
export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-ink/10 text-left uppercase tracking-wide text-ink-faint">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Empty-state line used when a card has no rows yet. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-1 font-serif text-sm text-ink-soft">{children}</p>;
}
