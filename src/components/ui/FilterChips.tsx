"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

import { focusLeftMenu } from "./menuFocus";

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
// uniform across the whole app; the unselected chips stay outlined and neutral.
const chipClass = (active: boolean) => `vf-chip ${active ? "vf-filter-active" : ""}`.trim();

function ChipInner({ item }: { item: FilterChipItem }) {
  return (
    <>
      <span className="min-w-0">{item.label}</span>
      {typeof item.count === "number" ? <span className="vf-chip-count">{item.count}</span> : null}
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
      className={`flex flex-wrap justify-center gap-1.5 ${className ?? ""}`}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const cls = chipClass(active);
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

/** How close to the edge of the screen an open panel may come. */
const MENU_GUTTER = 16;

/**
 * The open panel: centred under its trigger, unless that would carry it off the
 * edge of the screen, as it would for a trigger at the end of a line. Mounted only
 * while open, so its layout effect never runs on the server.
 */
function FilterMenu({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    function place() {
      const panel = ref.current;
      const screen = document.documentElement.clientWidth;
      if (!panel || !screen) return;
      const { left, right } = panel.getBoundingClientRect();
      setShift((current) => {
        const over = right - (screen - MENU_GUTTER);
        const under = MENU_GUTTER - left;
        if (over > 0) return current - over;
        if (under > 0) return current + under;
        return current;
      });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  // Opened low on the screen, or at enlarged text, the panel would begin below the
  // fold, and a press on the trigger would seem to do nothing. Its height leaves room
  // for the trigger under the header, so both stay in view. A smooth move begun in the
  // frame the panel first paints stops part of the way in WebKit, at a different place
  // each time, so it waits for the next one.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      ref.current?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    // role="list": Safari drops a list's role where its markers are removed.
    <ul
      id={id}
      ref={ref}
      role="list"
      aria-label={label}
      style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
      className="vf-menu vf-filter-panel absolute left-1/2 top-full z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto"
    >
      {children}
    </ul>
  );
}

/**
 * How long a link's choice names the trigger with no sign of its page: longer than a
 * slow server takes, and than the wait before a lost navigation is made a full page load.
 */
const CHOICE_PATIENCE_MS = 10_000;

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
  // A link's choice, until the page it leads to arrives with the new activeKey.
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => setChosenKey(null), [activeKey]);

  // A navigation can be lost, and the trigger must not go on naming a filter the list
  // beneath it does not show.
  useEffect(() => {
    if (chosenKey === null) return;
    const timer = setTimeout(() => setChosenKey(null), CHOICE_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [chosenKey]);

  // In a very short window the open panel takes the room up to the header and pushes
  // its trigger part way under it. Once the panel has gone there is room again, and
  // focus should not be left half hidden.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    return () => {
      if (document.activeElement === trigger) trigger?.scrollIntoView?.({ block: "nearest" });
    };
  }, [open]);

  // The option holding focus is about to leave the page, and focus would fall to
  // the top of the document, so a screen reader would start over. It goes back to
  // the trigger before the option goes.
  const closeToTrigger = useCallback(() => {
    triggerRef.current?.focus();
    setOpen(false);
  }, []);

  // Choosing commits the trigger's new name first, whatever the new page's own
  // timing, so what a screen reader reads as focus lands is the filter chosen.
  const chooseThenClose = (choose: () => void) => {
    flushSync(choose);
    closeToTrigger();
  };

  // Close on a pointer outside, Escape, or focus really moving elsewhere.
  useEffect(() => {
    if (!open) return;
    function onPointerOutside(event: Event) {
      const target = event.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) setOpen(false);
    }
    function onFocusMoved(event: Event) {
      if (ref.current && focusLeftMenu(event.target, ref.current)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeToTrigger();
    }
    document.addEventListener("pointerdown", onPointerOutside);
    document.addEventListener("focusin", onFocusMoved);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerOutside);
      document.removeEventListener("focusin", onFocusMoved);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeToTrigger]);

  const shownKey = chosenKey ?? activeKey;
  const activeItem = items.find((i) => i.key === shownKey);
  const isFiltered = shownKey !== resetKey && activeItem != null;
  const resetItem = items.find((i) => i.key === resetKey);

  // Re-selecting the active filter deselects it (→ reset/all); anything else
  // selects it. The reset option itself always just resets.
  const selectKeyFor = (item: FilterChipItem) =>
    item.key === activeKey && item.key !== resetKey ? resetKey : item.key;
  const hrefFor = (item: FilterChipItem) =>
    item.key === activeKey && item.key !== resetKey
      ? (resetItem?.href ?? item.href ?? "#")
      : (item.href ?? "#");
  const currentLabel = activeItem?.label ?? triggerLabel;

  return (
    <div className={`flex justify-center ${className ?? ""}`}>
      <div className="relative" ref={ref}>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${ariaLabel}: ${currentLabel}`}
          onClick={() => setOpen((o) => !o)}
          className={`${chipClass(isFiltered)} min-h-[var(--control-h)]`}
        >
          <span>{isFiltered ? activeItem!.label : triggerLabel}</span>
          {isFiltered && typeof activeItem!.count === "number" ? (
            <span className="vf-chip-count">{activeItem!.count}</span>
          ) : null}
          <Chevron open={open} />
        </button>

        {open ? (
          <FilterMenu id={panelId} label={ariaLabel}>
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <li key={item.key}>
                  {onSelect ? (
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => chooseThenClose(() => onSelect(selectKeyFor(item)))}
                      className={`vf-menu-item ${active ? "vf-menu-item-active" : ""}`}
                    >
                      <ChipInner item={item} />
                    </button>
                  ) : (
                    <Link
                      href={hrefFor(item)}
                      aria-current={active ? "page" : undefined}
                      onClick={(event) => {
                        // A modified click opens another tab; this page stays as it is.
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                          closeToTrigger();
                        } else {
                          chooseThenClose(() => setChosenKey(selectKeyFor(item)));
                        }
                      }}
                      className="vf-menu-item"
                    >
                      <ChipInner item={item} />
                    </Link>
                  )}
                </li>
              );
            })}
          </FilterMenu>
        ) : null}
      </div>
    </div>
  );
}
