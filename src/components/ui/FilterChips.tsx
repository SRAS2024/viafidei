"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  /**
   * The "show all" / cleared key. It is the default (unfiltered) view, so it is
   * NOT counted as a filter when deciding whether to collapse, and selecting an
   * already-active filter falls back to it (deselect). Default `"all"`.
   */
  resetKey?: string;
  /** Trigger label shown when nothing is filtered (collapsed mode). Default `"Filter"`. */
  triggerLabel?: string;
  /**
   * Collapse the chips into a single dropdown button once there are MORE than
   * this many real filters (everything except `resetKey`), so a long filter row
   * never clutters a page. Three or fewer filters stay as inline chips. Default 3.
   */
  collapseAfter?: number;
};

// One consistent look for every filter on the site. The selected chip fills
// with the action/Marian blue (`vf-filter-active`) so "selected = blue" is
// uniform across the whole app; the unselected chips stay a calm grey box.
const BASE =
  "inline-flex items-center gap-1.5 rounded-sm border px-4 py-1.5 text-xs font-medium uppercase tracking-liturgical transition";
const INACTIVE = "border-transparent bg-ink/5 text-ink-soft hover:bg-ink/10 hover:text-ink";
const ACTIVE = "vf-filter-active";

function ChipInner({ item }: { item: FilterChipItem }) {
  return (
    <>
      <span>{item.label}</span>
      {typeof item.count === "number" ? (
        <span className="font-semibold tabular-nums opacity-70">{item.count}</span>
      ) : null}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Uniform filter chips used across the site (prayers, saints, guides, church
 * documents, history, favorites). Keeps the design consistent and the selection
 * visible. When a page offers more than three filters the row collapses into a
 * single dropdown button (`collapseAfter`) so it never clutters the page.
 */
export function FilterChips({
  items,
  activeKey,
  ariaLabel,
  onSelect,
  className,
  resetKey = "all",
  triggerLabel = "Filter",
  collapseAfter = 3,
}: Props) {
  const filterCount = items.filter((i) => i.key !== resetKey).length;
  if (filterCount > collapseAfter) {
    return (
      <CollapsedFilter
        items={items}
        activeKey={activeKey}
        ariaLabel={ariaLabel}
        onSelect={onSelect}
        className={className}
        resetKey={resetKey}
        triggerLabel={triggerLabel}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex flex-wrap justify-center gap-2 ${className ?? ""}`}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const cls = `${BASE} ${active ? ACTIVE : INACTIVE}`;
        if (onSelect) {
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(item.key)}
              className={cls}
            >
              <ChipInner item={item} />
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
            <ChipInner item={item} />
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The dropdown form of the filter row, used when there are more than three
 * filters. A single trigger button (blue when a filter is active, showing that
 * filter's label) opens a panel of every option; choosing one fills it blue and
 * closes the panel. Re-opening keeps the choice blue, and selecting the active
 * filter again deselects it (back to the reset/all view); any other switches.
 */
function CollapsedFilter({
  items,
  activeKey,
  ariaLabel,
  onSelect,
  className,
  resetKey,
  triggerLabel,
}: {
  items: FilterChipItem[];
  activeKey: string;
  ariaLabel: string;
  onSelect?: (key: string) => void;
  className?: string;
  resetKey: string;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside pointer / Escape (mirrors the header nav dropdown).
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeItem = items.find((i) => i.key === activeKey);
  const isFiltered = activeKey !== resetKey && activeItem != null;
  const resetItem = items.find((i) => i.key === resetKey);

  // Re-selecting the active filter deselects it (→ reset/all); anything else
  // selects it. The reset option itself always just resets.
  const selectKeyFor = (item: FilterChipItem) =>
    item.key === activeKey && item.key !== resetKey ? resetKey : item.key;
  const hrefFor = (item: FilterChipItem) =>
    item.key === activeKey && item.key !== resetKey
      ? (resetItem?.href ?? item.href ?? "#")
      : (item.href ?? "#");

  return (
    <div className={`flex justify-center ${className ?? ""}`}>
      <div className="relative" ref={ref}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => setOpen((o) => !o)}
          className={`${BASE} ${isFiltered ? ACTIVE : INACTIVE}`}
        >
          <span>{isFiltered ? activeItem!.label : triggerLabel}</span>
          {isFiltered && typeof activeItem!.count === "number" ? (
            <span className="font-semibold tabular-nums opacity-70">{activeItem!.count}</span>
          ) : null}
          <Chevron open={open} />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label={ariaLabel}
            className="absolute left-1/2 top-full z-50 mt-2 max-h-72 w-56 -translate-x-1/2 overflow-auto rounded-sm border border-ink/10 bg-paper-bright p-1 shadow-paper"
          >
            {items.map((item) => {
              const active = item.key === activeKey;
              const cls = `${BASE} w-full justify-between ${active ? ACTIVE : INACTIVE}`;
              if (onSelect) {
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(selectKeyFor(item));
                      setOpen(false);
                    }}
                    className={cls}
                  >
                    <ChipInner item={item} />
                  </button>
                );
              }
              return (
                <Link
                  key={item.key}
                  href={hrefFor(item)}
                  role="option"
                  aria-selected={active}
                  onClick={() => setOpen(false)}
                  className={cls}
                >
                  <ChipInner item={item} />
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
