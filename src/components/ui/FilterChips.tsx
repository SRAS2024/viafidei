"use client";

import Link from "next/link";

/**
 * One filter chip. A chip with `href` navigates (URL-driven filtering on a
 * server-rendered page); a chip without `href` is a client toggle handled by
 * the group's `onSelect`.
 */
export type FilterChipItem = {
  key: string;
  label: string;
  /** Optional trailing count (e.g. favorites per type). */
  count?: number;
  /** Link target. Omit for client (button) mode. */
  href?: string;
};

type Props = {
  items: FilterChipItem[];
  /** Key of the currently-selected chip. */
  activeKey: string;
  /** Accessible label for the chip group. */
  ariaLabel: string;
  /**
   * Client-mode handler. When provided, chips render as toggle buttons; when
   * omitted, chips render as links using each item's `href`.
   */
  onSelect?: (key: string) => void;
  className?: string;
};

// One calm grey "box" look for every filter on the site. The selected chip
// stays visible and highlighted (a darker grey box with a defined edge) — never
// hidden behind a dropdown.
const BASE =
  "inline-flex items-center gap-1.5 rounded-sm border px-4 py-1.5 text-xs font-medium uppercase tracking-liturgical transition";
const INACTIVE = "border-transparent bg-ink/5 text-ink-soft hover:bg-ink/10 hover:text-ink";
const ACTIVE = "border-ink/30 bg-ink/10 text-ink";

/**
 * Uniform filter chips used across the site (prayers, church documents,
 * history, favorites). Keeps the design consistent and the selection visible.
 */
export function FilterChips({ items, activeKey, ariaLabel, onSelect, className }: Props) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex flex-wrap justify-center gap-2 ${className ?? ""}`}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const cls = `${BASE} ${active ? ACTIVE : INACTIVE}`;
        const inner = (
          <>
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="tabular-nums font-semibold text-ink-faint">{item.count}</span>
            ) : null}
          </>
        );
        if (onSelect) {
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(item.key)}
              className={cls}
            >
              {inner}
            </button>
          );
        }
        return (
          <Link
            key={item.key}
            href={item.href ?? "#"}
            aria-current={active ? "page" : undefined}
            className={cls}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
