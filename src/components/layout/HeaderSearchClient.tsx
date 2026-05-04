"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "../icons/SearchIcon";

type Suggestion = {
  group:
    | "prayers"
    | "saints"
    | "apparitions"
    | "parishes"
    | "devotions"
    | "liturgy"
    | "spiritualLife";
  id: string;
  slug: string;
  label: string;
};

const PATH_FOR_GROUP: Record<Suggestion["group"], string> = {
  prayers: "/prayers",
  saints: "/saints",
  apparitions: "/saints",
  parishes: "/spiritual-guidance",
  devotions: "/devotions",
  liturgy: "/liturgy-history",
  spiritualLife: "/spiritual-life",
};

type Props = {
  placeholder: string;
  ariaLabel: string;
};

/**
 * Caps the number of suggestions visible while the user is typing.
 *
 *   mobile  (< 640px): 2 suggestions
 *   tablet  (≥ 640px): 3 suggestions
 *   desktop (≥ 1024px): 3 suggestions
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
  const wrapperRef = useRef<HTMLFormElement | null>(null);
  const limit = useSuggestionLimit();

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
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
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
      } catch {
        // swallow abort/network errors so the header never crashes
      }
    }, 180);
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
    const base = PATH_FOR_GROUP[suggestion.group];
    setOpen(false);
    setQ("");
    router.push(`${base}/${suggestion.slug}`);
  }

  // Final defensive cap on the client too — the server may have returned
  // more groups than we want to show on mobile.
  const visible = suggestions.slice(0, limit);

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
        type="search"
        name="q"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        className="vf-header-search-input"
      />
      {open && visible.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-md border border-ink/10 bg-paper shadow-paper"
        >
          {visible.map((s) => (
            <li key={`${s.group}:${s.id}`}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                <span className="truncate">{s.label}</span>
                <span className="text-[10px] uppercase tracking-liturgical text-ink-faint">
                  {s.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
