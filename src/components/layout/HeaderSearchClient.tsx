"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchHighlight } from "@/components/ui";
import { SearchIcon } from "../icons/SearchIcon";

type SuggestionGroup =
  | "prayers"
  | "saints"
  | "apparitions"
  | "popes"
  | "doctors"
  | "parishes"
  | "devotions"
  | "novenas"
  | "guides"
  | "sacraments"
  | "liturgy"
  | "documents"
  | "rites"
  | "spiritualLife";

export type Suggestion = {
  group: SuggestionGroup;
  id: string;
  slug: string;
  label: string;
  /**
   * Second line of the row ("Bishop, Doctor of the Church", "Chicago,
   * Illinois") — what tells two saints with the same name apart. Optional
   * because an older cached API response may not carry it.
   */
  subtitle?: string;
  /** Human content-type label, e.g. "Our Lady". Never the raw enum. */
  typeLabel?: string;
  /** Canonical public path computed by the data layer. */
  href?: string;
};

const GROUP_LABEL: Record<SuggestionGroup, string> = {
  prayers: "Prayer",
  saints: "Saint",
  apparitions: "Our Lady",
  popes: "Pope",
  doctors: "Doctor of the Church",
  parishes: "Parish",
  devotions: "Devotion",
  novenas: "Novena",
  guides: "Guide",
  sacraments: "Sacrament",
  liturgy: "Liturgy",
  documents: "Church document",
  rites: "Rite",
  spiritualLife: "Spiritual life",
};

const GROUP_ORDER: SuggestionGroup[] = [
  "prayers",
  "saints",
  "apparitions",
  "popes",
  "doctors",
  "guides",
  "devotions",
  "novenas",
  "sacraments",
  "spiritualLife",
  "liturgy",
  "documents",
  "rites",
  "parishes",
];

/**
 * Resolves the public route a suggestion should link to.
 *
 * The suggest API now returns a canonical `href` per row, which is what the
 * dropdown uses; this stays as the fallback for a response that predates it
 * (a cached one, or a test fixture) so a suggestion can never become a dead
 * click.
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
export function pathForSuggestion(s: Suggestion): string {
  if (s.group === "prayers") return `/prayers/${s.slug}`;
  if (s.group === "saints") return `/saints/${s.slug}`;
  if (s.group === "apparitions") return `/our-lady/${s.slug}`;
  if (s.group === "popes") return `/popes/${s.slug}`;
  if (s.group === "doctors") return `/doctors/${s.slug}`;
  if (s.group === "parishes") return `/parishes/${s.slug}`;
  if (s.group === "devotions") return `/devotions/${s.slug}`;
  if (s.group === "novenas") return `/novenas/${s.slug}`;
  if (s.group === "guides") return `/guides/${s.slug}`;
  if (s.group === "sacraments") return `/sacraments/${s.slug}`;
  if (s.group === "rites") return `/rites/${s.slug}`;
  // Church documents and other liturgy/history content share the detail route.
  if (s.group === "liturgy" || s.group === "documents") return `/liturgy-history/${s.slug}`;
  if (s.group === "spiritualLife") {
    if (s.slug.startsWith("sacrament-") || s.slug.startsWith("consecration-")) {
      return `/sacraments/${s.slug}`;
    }
    return `/spiritual-life/${s.slug}`;
  }
  return "/search";
}

/** Where a row navigates: the server's canonical href, else the local map. */
function hrefFor(s: Suggestion): string {
  return s.href && s.href.startsWith("/") ? s.href : pathForSuggestion(s);
}

type Props = {
  placeholder: string;
  ariaLabel: string;
};

/** Below this length the dropdown stays shut — one letter matches everything. */
const MIN_QUERY_LENGTH = 2;
/**
 * Keystroke-to-request delay. Long enough that typing a word costs one
 * request, short enough that the list feels live under the fingers.
 */
const DEBOUNCE_MS = 180;

type Status = "idle" | "loading" | "ready" | "error";

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
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  // The search is a single icon by default; clicking it expands the bar.
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const limit = useSuggestionLimit();
  const listboxId = useId();

  const trimmed = q.trim();

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus("idle");
      setActiveIndex(-1);
      return;
    }
    setStatus("loading");
    // One AbortController per keystroke: the cleanup below aborts the request
    // this render started, so an earlier, slower reply can never overwrite the
    // list for a query the user has already moved past.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        if (controller.signal.aborted) return;
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setStatus("ready");
        setActiveIndex(-1);
      } catch {
        // An abort is the expected path when the user keeps typing — only a
        // real failure should surface as an error row.
        if (!controller.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, limit]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        // Collapse back to the icon when the field is empty.
        if (!q.trim()) setExpanded(false);
      }
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [q]);

  // Focus the field as soon as the search expands.
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  function pick(suggestion: Suggestion) {
    setOpen(false);
    setQ("");
    setActiveIndex(-1);
    router.push(hrefFor(suggestion));
  }

  function goToResults() {
    if (!trimmed) return;
    setOpen(false);
    setActiveIndex(-1);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  // Group suggestions for the dropdown — prayers / saints / devotions
  // first, then spiritual life, then liturgy and history, then parishes
  // last. Within each group, the server already returns them ordered by
  // relevance.
  const grouped = useMemo(() => {
    const byGroup = new Map<SuggestionGroup, Suggestion[]>();
    for (const s of suggestions) {
      const arr = byGroup.get(s.group) ?? [];
      arr.push(s);
      byGroup.set(s.group, arr);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => {
      const items = byGroup.get(g) ?? [];
      return {
        group: g,
        // The server's own label wins — it accounts for subtypes a group key
        // cannot express (a PRAYER whose prayerType is "litany" is a Litany).
        label: items[0]?.typeLabel ?? GROUP_LABEL[g],
        items,
      };
    });
  }, [suggestions]);

  // Flat list in render-order so the keyboard arrow keys can step through
  // every visible suggestion regardless of which group it sits in.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const showPanel = open && expanded && trimmed.length >= MIN_QUERY_LENGTH;
  const showList = showPanel && status === "ready" && flat.length > 0;
  const activeId =
    activeIndex >= 0 && flat[activeIndex] ? `vf-suggestion-${activeIndex}` : undefined;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      if (!q.trim()) setExpanded(false);
      inputRef.current?.blur();
      return;
    }
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      // Only an explicitly highlighted row is opened; a bare Enter falls
      // through to the form and lands on the full /search page.
      e.preventDefault();
      pick(flat[activeIndex]);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex w-full min-w-0 items-center justify-end sm:w-auto"
    >
      {!expanded ? (
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={false}
          onClick={() => {
            setExpanded(true);
            setOpen(true);
          }}
          className="vf-header-search-toggle flex h-9 w-9 items-center justify-center rounded-full text-ink-faint transition hover:text-ink"
        >
          <SearchIcon size={16} />
        </button>
      ) : (
        <form
          method="get"
          action="/search"
          role="search"
          className="vf-header-search relative flex w-full min-w-0 items-center gap-2 sm:w-64"
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
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-activedescendant={activeId}
            autoComplete="off"
            className="vf-header-search-input min-w-0 flex-1"
          />
          {showPanel ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[28rem] overflow-auto rounded-md border border-ink/10 bg-paper shadow-paper sm:left-auto sm:right-0 sm:w-80">
              {status === "loading" ? (
                <p aria-live="polite" className="px-3 py-3 font-serif text-sm text-ink-faint">
                  Searching…
                </p>
              ) : null}
              {status === "error" ? (
                <p aria-live="polite" className="px-3 py-3 font-serif text-sm text-ink-faint">
                  Search is unavailable right now.
                </p>
              ) : null}
              {status === "ready" && flat.length === 0 ? (
                <p aria-live="polite" className="px-3 py-3 font-serif text-sm text-ink-faint">
                  No matches for &ldquo;{trimmed}&rdquo;.
                </p>
              ) : null}
              {showList ? (
                <div id={listboxId} role="listbox" aria-label="Search suggestions">
                  {grouped.map(({ group, label, items }) => (
                    <div key={group} className="border-b border-ink/5 last:border-b-0">
                      <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-liturgical text-ink-faint">
                        {label}
                      </p>
                      <ul>
                        {items.map((s) => {
                          const flatIndex = flat.indexOf(s);
                          const active = flatIndex === activeIndex;
                          return (
                            <li key={`${s.group}:${s.id}`}>
                              <button
                                type="button"
                                id={`vf-suggestion-${flatIndex}`}
                                role="option"
                                aria-selected={active}
                                onMouseEnter={() => setActiveIndex(flatIndex)}
                                onClick={() => pick(s)}
                                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${active ? "bg-ink/[0.07]" : "hover:bg-ink/5"}`}
                              >
                                <span className="w-full truncate text-ink">
                                  <SearchHighlight text={s.label} query={trimmed} />
                                </span>
                                {s.subtitle ? (
                                  <span className="w-full truncate font-serif text-xs text-ink-faint">
                                    <SearchHighlight text={s.subtitle} query={trimmed} />
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="border-t border-ink/10">
                <button
                  type="button"
                  onClick={goToResults}
                  className="w-full px-3 py-2 text-left font-serif text-xs text-ink-soft hover:bg-ink/5"
                >
                  See all results for &ldquo;{trimmed}&rdquo;
                </button>
                {showList ? (
                  <p className="px-3 pb-2 font-serif text-[11px] text-ink-faint">
                    ↑↓ navigate &middot; ↵ open &middot; esc close
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
