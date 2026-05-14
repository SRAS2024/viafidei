"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type FilterOption = {
  /** Query-string value for `?filter=`; `null` means "All". */
  value: string | null;
  label: string;
};

type Props = {
  options: FilterOption[];
  /** Currently-selected filter value (null = All). */
  selected: string | null;
};

/**
 * Filter selector for the /prayers tab.
 *
 * Renders a single "Filter" button on every breakpoint. Clicking the
 * button opens a dropdown panel that lists every canonical Catholic
 * prayer category as a real link, so selecting an option is a normal
 * server navigation and the URL stays shareable. The closed state keeps
 * the page calm even when the catalog grows into many categories —
 * the chip cluster used previously had become visually noisy.
 */
export function PrayerFilterDropdown({ options, selected }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLabel =
    options.find((o) => o.value === selected)?.label ?? options[0]?.label ?? "All";

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative mx-auto flex w-full justify-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="vf-btn vf-btn-ghost inline-flex items-center gap-2 !py-2 !px-4 text-xs"
      >
        <span aria-hidden="true">⌕</span>
        <span>Filter</span>
        <span className="text-ink-faint">·</span>
        <span className="font-medium text-ink-soft">{activeLabel}</span>
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute top-full z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-sm border border-ink/15 bg-parchment shadow-lg"
        >
          {options.map((option) => {
            const isActive = option.value === selected;
            const href =
              option.value === null
                ? "/prayers"
                : `/prayers?filter=${encodeURIComponent(option.value)}`;
            return (
              <li key={option.value ?? "__all__"}>
                <Link
                  href={href}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2 font-serif text-sm transition ${
                    isActive
                      ? "bg-ink/5 font-medium text-ink"
                      : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  {option.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
