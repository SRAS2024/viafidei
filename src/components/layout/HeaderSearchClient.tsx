"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "../icons/SearchIcon";

type SuggestionGroup =
  | "prayers"
  | "saints"
  | "apparitions"
  | "parishes"
  | "devotions"
  | "liturgy"
  | "spiritualLife";

type Suggestion = {
  group: SuggestionGroup;
  id: string;
  slug: string;
  label: string;
};

const GROUP_LABEL: Record<SuggestionGroup, string> = {
  prayers: "Prayer",
  saints: "Saint",
  apparitions: "Marian apparition",
  parishes: "Parish",
  devotions: "Devotion",
  liturgy: "Liturgy & History",
  spiritualLife: "Spiritual life",
};

const GROUP_ORDER: SuggestionGroup[] = [
  "prayers",
  "saints",
  "apparitions",
  "devotions",
  "spiritualLife",
  "liturgy",
  "parishes",
];

/**
 * Resolves the public route a suggestion should link to.
 *
 * Liturgy/history content is split between two URL spaces:
 *   - `/history/...` (was `/liturgy-history/timeline`) for council /
 *     timeline / encyclical / catechism / canon-law slugs.
 *   - `/liturgy/...` for everything else under the LiturgyEntry table.
 *   - The existing `/liturgy-history/[slug]` detail route stays in place
 *     so deep-links keep working; both the new history and liturgy tabs
 *     link to it for individual document pages.
 *
 * Sacrament / consecration slugs live under `/sacraments/[slug]` (not
 * `/spiritual-life/`) because they have their own dedicated tab.
 */
function pathForSuggestion(s: Suggestion): string {
  if (s.group === "prayers") return `/prayers/${s.slug}`;
  if (s.group === "saints") return `/saints/${s.slug}`;
  if (s.group === "apparitions") return `/saints/${s.slug}`;
  if (s.group === "parishes") return `/spiritual-guidance/${s.slug}`;
  if (s.group === "devotions") return `/devotions/${s.slug}`;
  if (s.group === "liturgy") return `/liturgy-history/${s.slug}`;
  if (s.group === "spiritualLife") {
    if (s.slug.startsWith("sacrament-") || s.slug.startsWith("consecration-")) {
      return `/sacraments/${s.slug}`;
    }
    return `/spiritual-life/${s.slug}`;
  }
  return "/search";
}

type Props = {
  placeholder: string;
  ariaLabel: string;
};

/**
 * Caps the number of suggestions visible while the user is typing.
 *
 *   mobile  (< 640px): 2 per group
 *   tablet  (≥ 640px): 3 per group
 *
 * The cap is computed from the `matchMedia` API so the count updates live
 * if the user rotates / resizes. It also drives the `limit` parameter on
 * the suggest API call so the server doesn't return more than we display.
 */
function useSuggestionLimit(): number {
  const [limit, setLimit] = useState(3);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 640px)");
    const sync = () => setLimit(mql.matches ? 3 : 2);
    sync();
    mql.addEventListener?.("change", sync);
    return () => mql.removeEventListener?.("change", sync);
  }, []);
  return limit;
}

export function HeaderSearchClient({ placeholder, ariaLabel }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const limit = useSuggestionLimit();

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        if (Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
          setActiveIndex(-1);
        }
      } catch {
        // swallow abort/network errors so the header never crashes
      }
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, limit]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  function pick(suggestion: Suggestion) {
    setOpen(false);
    setQ("");
    setActiveIndex(-1);
    router.push(pathForSuggestion(suggestion));
  }

  // Group suggestions for the dropdown — prayers / saints / devotions
  // first, then spiritual life, then liturgy and history, then parishes
  // last. Within each group, the server already returns them ordered by
  // fuzzy score.
  const grouped = useMemo(() => {
    const byGroup = new Map<SuggestionGroup, Suggestion[]>();
    for (const s of suggestions) {
      const arr = byGroup.get(s.group) ?? [];
      arr.push(s);
      byGroup.set(s.group, arr);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      group: g,
      items: byGroup.get(g) ?? [],
    }));
  }, [suggestions]);

  // Flat list in render-order so the keyboard arrow keys can step through
  // every visible suggestion regardless of which group it sits in.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(flat[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  }

  return (
    <form
      ref={wrapperRef}
      method="get"
      action="/search"
      role="search"
      className="vf-header-search relative flex w-full items-center gap-2 sm:w-auto sm:max-w-xs"
    >
      <SearchIcon size={14} className="shrink-0 text-ink-faint" />
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open && flat.length > 0}
        autoComplete="off"
        className="vf-header-search-input"
      />
      {open && flat.length > 0 ? (
        <div
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[28rem] overflow-auto rounded-md border border-ink/10 bg-paper shadow-paper"
        >
          {grouped.map(({ group, items }) => (
            <div key={group} className="border-b border-ink/5 last:border-b-0">
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-liturgical text-ink-faint">
                {GROUP_LABEL[group]}
              </p>
              <ul>
                {items.map((s) => {
                  const flatIndex = flat.findIndex(
                    (x) => x.group === s.group && x.id === s.id,
                  );
                  const active = flatIndex === activeIndex;
                  return (
                    <li key={`${s.group}:${s.id}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => pick(s)}
                        className={`flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm ${active ? "bg-ink/[0.07]" : "hover:bg-ink/5"}`}
                      >
                        <span className="truncate">{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="border-t border-ink/10 px-3 py-2 text-[11px] font-serif text-ink-faint">
            ↑↓ navigate &middot; ↵ open &middot; esc close
          </div>
        </div>
      ) : null}
    </form>
  );
}
