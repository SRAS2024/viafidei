"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

// Import the leaf components directly, NOT through "@/components/ui".
// The barrel also re-exports PublishedDetail / PublishedList /
// RelatedContentLinks, which import values from "@/lib/data/published";
// that module uses Prisma.sql for search, so a client component pulling
// the barrel drags the Prisma client into the browser bundle and every
// page dies at hydration with "sqltag is unable to run in this browser
// environment". Caught by the e2e smoke suite.
import { SearchHighlight, spokenLine } from "@/components/ui/SearchHighlight";
import { pluralCategory } from "@/lib/i18n/plural";
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
  documents: "Church Document",
  rites: "Rite",
  spiritualLife: "Spiritual Life",
};

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

/** The words of the suggestions, in the reader's language. */
export type SuggestLabels = {
  locale: string;
  /** What each kind of content is called, by the server's English label for it. */
  types: Record<string, string>;
  searching: string;
  unavailable: string;
  /** Holds {query}. */
  none: string;
  /** How many suggestions, by plural form. Each holds {count}. */
  count: Partial<Record<Intl.LDMLPluralRule, string>>;
  /** The list's name. */
  list: string;
  keysSpoken: string;
  keysShown: string;
  /** Holds {query}. */
  all: string;
};

type Props = {
  placeholder: string;
  ariaLabel: string;
  labels: SuggestLabels;
  /**
   * "inline" expands in place beside the account link. "panel" is the phone's:
   * the icon stays in the bar and the field opens in a full-width row beneath it.
   */
  variant?: "inline" | "panel";
};

/**
 * Whether a click happened inside `element`, judged by the path the event
 * was dispatched along rather than by where its target is now.
 *
 * The tap that opens the search lands on the icon button, and React replaces
 * that button with the form before the click reaches the window listener (it
 * re-renders in a microtask, which runs between listeners). `contains(target)`
 * then saw a detached button, called the tap "outside", and shut the search
 * within the same tap — pressing the icon did nothing. The dispatch path is
 * fixed before any listener runs, so it still holds the wrapper.
 */
function eventIsInside(event: Event, element: Element): boolean {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  if (path.length > 0) return path.includes(element);
  const target = event.target;
  // No path to read: a target React has already removed was one of ours.
  return target instanceof Node && (element.contains(target) || !target.isConnected);
}

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

/**
 * Whether the reader has a keyboard to speak of, judged by a fine pointer. The arrow
 * keys are told of by this and not by the header's layout: enlarged text and a narrow
 * window on a Mac both bring the phone's bar, and the keys work there just the same.
 * Nothing on a touch screen should send a reader looking for them. The visible hint
 * follows the same media query in the stylesheet.
 */
function useFinePointer(): boolean {
  const [fine, setFine] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(pointer: fine)");
    const sync = () => setFine(mql.matches);
    sync();
    mql.addEventListener?.("change", sync);
    return () => mql.removeEventListener?.("change", sync);
  }, []);
  return fine;
}

export function HeaderSearchClient({ placeholder, ariaLabel, labels, variant = "inline" }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  // The search is a single icon by default; clicking it expands the bar.
  const [expanded, setExpanded] = useState(false);
  // Beside the masthead the field takes the icon's place. For the length of the swap
  // both are in the page; see openField.
  const [swapping, setSwapping] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Focus returning to the field from the panel must not reopen the panel.
  const keepPanelShut = useRef(false);
  // Only the arrow keys scroll the list: a row under a resting mouse must not.
  const movedByKey = useRef(false);
  const limit = useSuggestionLimit();
  const finePointer = useFinePointer();
  const listboxId = useId();
  const rowId = useId();

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
      if (!eventIsInside(event, wrapperRef.current)) {
        setOpen(false);
        // Collapse back to the icon when the field is empty.
        if (!q.trim()) setExpanded(false);
      }
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [q]);

  /**
   * Shows the field and puts focus in it. Focus moves while the icon is still there,
   * and only then does the icon go. Taking away the control that holds focus drops it
   * to the page, and in that gap the accessibility tree reports the whole page as
   * focused, which a screen reader can stop to announce.
   */
  function openField() {
    flushSync(() => {
      setSwapping(true);
      setExpanded(true);
      setOpen(true);
    });
    inputRef.current?.focus();
    setSwapping(false);
  }

  function pick(suggestion: Suggestion) {
    setOpen(false);
    setQ("");
    setActiveIndex(-1);
    setExpanded(false);
    router.push(hrefFor(suggestion));
  }

  function goToResults() {
    if (!trimmed) return;
    setOpen(false);
    setQ("");
    setActiveIndex(-1);
    setExpanded(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  /** Puts the search away altogether, with focus on the icon, as openField in reverse. */
  function closeSearch() {
    flushSync(() => setSwapping(true));
    toggleRef.current?.focus();
    setOpen(false);
    setQ("");
    setActiveIndex(-1);
    setExpanded(false);
    setSwapping(false);
  }

  // Group suggestions for the dropdown in the order of each group's best row, as on
  // the /search page: the server returns the rows best match first, with a saint the
  // query names ahead of the rest, so "james" opens on Saint James and not on the
  // litanies whose text mentions him. Parishes follow the site's own pages, as there.
  //
  // Rows gather under what each one is called, so a heading is true of every row
  // beneath it, as on the /search page: one group key can hold two kinds of thing
  // (Marian titles and apparitions; prayers and litanies), and a heading taken
  // from the first row would mislabel the rest.
  const grouped = useMemo(() => {
    const byLabel = new Map<
      string,
      { group: SuggestionGroup; label: string; items: Suggestion[] }
    >();
    for (const s of suggestions) {
      // The server's own label wins — it accounts for subtypes a group key
      // cannot express (a PRAYER whose prayerType is "litany" is a Litany). It is
      // English, so the shared cache can hold one reply for every language.
      const label = s.typeLabel ?? GROUP_LABEL[s.group];
      const entry = byLabel.get(label) ?? {
        group: s.group,
        label: labels.types[label] ?? label,
        items: [],
      };
      entry.items.push(s);
      byLabel.set(label, entry);
    }
    // A Map keeps the order its labels first arrived in: each group's best row.
    const groups = [...byLabel.values()];
    return [
      ...groups.filter((e) => e.group !== "parishes"),
      ...groups.filter((e) => e.group === "parishes"),
    ];
  }, [suggestions, labels.types]);

  // Flat list in render-order so the keyboard arrow keys can step through
  // every visible suggestion regardless of which group it sits in.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const showPanel = open && expanded && trimmed.length >= MIN_QUERY_LENGTH;
  const showList = showPanel && status === "ready" && flat.length > 0;
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  // Only while the list is there to point into: typing on hides it until the reply.
  const activeId =
    showList && activeIndex >= 0 && flat[activeIndex] ? optionId(activeIndex) : undefined;

  // The panel ends above the bottom of what can be seen, which on a phone means
  // above the keyboard, and never reaches past the window's left edge: its right
  // edge is fixed to the field's. `dvh` alone knows nothing of the keyboard.
  useEffect(() => {
    if (!showPanel) return;
    const panel = panelRef.current;
    const viewport = window.visualViewport;
    if (!panel || !viewport) return;
    const fit = () => {
      const { top, right } = panel.getBoundingClientRect();
      panel.style.maxHeight = `${Math.max(viewport.height + viewport.offsetTop - top - 12, 160)}px`;
      if (variant === "inline") panel.style.maxWidth = `${Math.max(right - 16, 240)}px`;
    };
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
    };
  }, [showPanel, variant]);

  useEffect(() => {
    if (!movedByKey.current || !activeId) return;
    movedByKey.current = false;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      // First the panel goes, keeping what was typed; then the search itself.
      // The browser's own clearing of a search field would lose the text at the
      // first press.
      e.preventDefault();
      if (showPanel) {
        setOpen(false);
        setActiveIndex(-1);
      } else {
        closeSearch();
      }
      return;
    }
    if (!showList) {
      if (e.key === "ArrowDown" && !showPanel) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      movedByKey.current = true;
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      movedByKey.current = true;
      setActiveIndex((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      // Only an explicitly highlighted row is opened; a bare Enter falls
      // through to the form and lands on the full /search page.
      e.preventDefault();
      pick(flat[activeIndex]);
    }
  }

  const panelVariant = variant === "panel";
  // A function, so a "$" in what was typed stays a "$".
  const withQuery = (text: string) => text.replace("{query}", () => trimmed);
  const noMatches = withQuery(labels.none);
  const countForm = labels.count[pluralCategory(labels.locale, flat.length)] ?? labels.count.other;
  const countText = (countForm ?? "").replace("{count}", String(flat.length));

  // A status region is only announced when its text changes, so it stays on the
  // page, empty, from the start. The rows themselves are reached with the arrow
  // keys through aria-activedescendant, or by swiping on a phone.
  const announcement = !showPanel
    ? ""
    : status === "loading"
      ? labels.searching
      : status === "error"
        ? labels.unavailable
        : status === "ready" && flat.length === 0
          ? noMatches
          : status === "ready"
            ? finePointer
              ? `${countText} ${labels.keysSpoken}`
              : countText
            : "";

  const toggle = (
    <button
      ref={toggleRef}
      type="button"
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={panelVariant ? rowId : undefined}
      onClick={() => {
        if (expanded) {
          closeSearch();
        } else {
          openField();
        }
      }}
      className="vf-header-search-toggle flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-sm text-ink-soft transition hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/5 aria-expanded:text-ink"
    >
      <SearchIcon size={18} />
    </button>
  );

  return (
    // Not a control: it only hears focus leaving the search as a whole.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={wrapperRef}
      className={
        panelVariant ? "flex items-center" : "relative flex min-w-0 flex-1 items-center justify-end"
      }
      onBlur={(e) => {
        // Tabbing out closes the panel; a click elsewhere has its own listener
        // above, and has no related target to go by here.
        const next = e.relatedTarget;
        if (next instanceof Node && !e.currentTarget.contains(next)) {
          setOpen(false);
          if (!q.trim()) setExpanded(false);
        }
      }}
    >
      {panelVariant || !expanded || swapping ? toggle : null}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
      {expanded ? (
        <div
          id={rowId}
          className={panelVariant ? "vf-header-search-row" : "vf-header-search-field"}
        >
          <form
            method="get"
            action="/search"
            role="search"
            aria-label={ariaLabel}
            className="vf-header-search relative flex min-w-0 items-center gap-2"
          >
            <SearchIcon size={16} className="shrink-0 text-ink-faint" />
            <input
              ref={inputRef}
              type="search"
              name="q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (keepPanelShut.current) {
                  keepPanelShut.current = false;
                  return;
                }
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-label={ariaLabel}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showList}
              aria-controls={listboxId}
              aria-activedescendant={activeId}
              autoComplete="off"
              enterKeyHint="search"
              className="vf-header-search-input min-w-0 flex-1"
            />
            {showPanel ? (
              // The panel's right edge meets the field's and it never leaves the
              // viewport; on a phone it spans the field's own full-width row.
              // A press inside it leaves focus in the field, which is what keeps the
              // arrow keys working and the panel open.
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions
              <div
                ref={panelRef}
                onMouseDown={(e) => e.preventDefault()}
                className={`vf-menu vf-suggest ${panelVariant ? "vf-suggest-full" : ""}`}
              >
                {status === "loading" ? (
                  <p aria-hidden="true" className="vf-suggest-status">
                    {labels.searching}
                  </p>
                ) : null}
                {status === "error" ? (
                  <p aria-hidden="true" className="vf-suggest-status">
                    {labels.unavailable}
                  </p>
                ) : null}
                {status === "ready" && flat.length === 0 ? (
                  <p aria-hidden="true" className="vf-suggest-status">
                    {noMatches}
                  </p>
                ) : null}
                {showList ? (
                  <div
                    id={listboxId}
                    role="listbox"
                    aria-label={labels.list}
                    tabIndex={-1}
                    className="vf-suggest-scroll"
                  >
                    {grouped.map(({ label, items }, groupIndex) => {
                      const groupId = `${listboxId}-group-${groupIndex}`;
                      return (
                        <div
                          key={label}
                          role="group"
                          aria-labelledby={groupId}
                          className="vf-suggest-group"
                        >
                          <div
                            id={groupId}
                            role="presentation"
                            className="vf-eyebrow vf-suggest-label"
                          >
                            {label}
                          </div>
                          {items.map((s) => {
                            const flatIndex = flat.indexOf(s);
                            return (
                              <button
                                key={`${s.group}:${s.id}`}
                                type="button"
                                id={optionId(flatIndex)}
                                role="option"
                                aria-selected={flatIndex === activeIndex}
                                aria-posinset={flatIndex + 1}
                                aria-setsize={flat.length}
                                // Written out rather than left to the row's text.
                                // VoiceOver reads a row alone, not its group's
                                // name, and where a line wraps just before a
                                // <mark> WebKit drops the space ("of theRosary").
                                aria-label={[
                                  s.label,
                                  s.subtitle ? spokenLine(s.subtitle) : null,
                                  label,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                                tabIndex={-1}
                                onMouseEnter={() => setActiveIndex(flatIndex)}
                                onClick={() => pick(s)}
                                className="vf-suggest-option"
                              >
                                <span className="vf-suggest-title">
                                  <SearchHighlight text={s.label} query={trimmed} />
                                </span>
                                {s.subtitle ? (
                                  <span className="vf-suggest-meta vf-clamp [--clamp:2]">
                                    <SearchHighlight text={s.subtitle} query={trimmed} />
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="vf-suggest-foot">
                  <button
                    type="button"
                    onClick={goToResults}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setOpen(false);
                        setActiveIndex(-1);
                        keepPanelShut.current = true;
                        inputRef.current?.focus();
                      }
                    }}
                    className="vf-link-action vf-suggest-all"
                  >
                    {withQuery(labels.all)}
                  </button>
                  {showList ? (
                    <p aria-hidden="true" className="vf-suggest-hint">
                      {labels.keysShown}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
