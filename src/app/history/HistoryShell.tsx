"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  HISTORY_EVENT_ID_PREFIX,
  HISTORY_PATH,
  HISTORY_RESULTS_ID,
  HISTORY_STATUS_ID,
  HISTORY_YEAR_TARGET_ID,
} from "./historyUrl";

/**
 * What to do once the new view is on screen: bring the list up and give its first
 * heading the focus (a page link, whose own link may be gone); hand the focus to
 * the count (a search, whose field is replaced by the new one, or a way back that
 * is gone once followed); bring the row the slider stands on into view, leaving
 * the focus on the slider; or bring a row into view and hand it the focus (a typed
 * year, or a deep link).
 */
type Landing = "results" | "status" | "target" | "event" | null;

type HistoryNav = {
  pending: boolean;
  navigate: (href: string, options?: { landing?: Landing; replace?: boolean }) => void;
  /** Lands without moving: for a slider already standing on its year. */
  land: (where: Landing) => void;
};

const HistoryNavContext = createContext<HistoryNav>({
  pending: false,
  navigate: (href) => {
    window.location.assign(href);
  },
  land: () => {},
});

export function useHistoryNav(): HistoryNav {
  return useContext(HistoryNavContext);
}

const MENU_SELECTOR = "details[data-history-menu]";

function closeMenus(except?: Element | null) {
  document.querySelectorAll<HTMLDetailsElement>(`${MENU_SELECTOR}[open]`).forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
}

/**
 * Scrolls an element to the top of the page, unless it is already in easy view,
 * so that a year landing just below the slider leaves the slider where it is. The
 * allowance is for the era heading that may be stuck below the site's header. A
 * slider held in view (`dock`) takes the top of the page as well: the element comes
 * to rest below it, with room for the century label above a row, unless the foot of
 * the page has already left it lower than that.
 */
function bringIntoView(element: Element, dock?: Element | null) {
  const { top } = element.getBoundingClientRect();
  const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const clear = Math.max(headerBottom, dock?.getBoundingClientRect().bottom ?? 0);
  if (top >= clear + 56 && top <= window.innerHeight * 0.6) return;
  element.scrollIntoView({ block: "start" });
  if (!dock) return;
  const dockBottom = dock.getBoundingClientRect().bottom;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // The row itself matters more than the label: on a short window, what would cut its
  // foot off comes out of the room above it. The year's anchor comes just before it.
  const rowHeight = element.nextElementSibling?.getBoundingClientRect().height ?? 0;
  const room = Math.max(0, Math.min(2 * rem, window.innerHeight - dockBottom - rowHeight));
  const short = dockBottom + room - element.getBoundingClientRect().top;
  if (short > 0) window.scrollBy(0, -short);
}

/**
 * An opened menu can reach past the foot of the window, so that a press seems to do
 * nothing. It moves only as far as it has to, and all at once, so Reduce Motion has
 * nothing to stop. A menu too tall for the window starts from its own button.
 */
function bringMenuIntoView(menu: HTMLDetailsElement) {
  const summary = menu.querySelector("summary");
  const panel = menu.querySelector(":scope > :not(summary)");
  if (!summary || !panel) return;
  const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const height = panel.getBoundingClientRect().bottom - summary.getBoundingClientRect().top;
  if (height > window.innerHeight - headerBottom) summary.scrollIntoView({ block: "start" });
  else panel.scrollIntoView({ block: "nearest" });
}

/**
 * Carries out a landing, once the view it belongs to is on screen. The slider is
 * the one control that keeps the focus: the reader is still moving it, so it has to
 * stay on screen. Where it is held in view, the row comes up under it. Where it
 * could not be (see HistoryYearSlider), the page stays where it is, and the status
 * just below says where the list has gone.
 */
function carryOut(where: Landing) {
  if (where === "target") {
    const dock = document.querySelector(".vf-history-docked");
    const target = document.getElementById(HISTORY_YEAR_TARGET_ID);
    if (dock && target) bringIntoView(target, dock);
    return;
  }
  const row =
    where === "event"
      ? (document.querySelector<HTMLElement>(".vf-timeline-current") ??
        document.querySelector<HTMLElement>(".vf-timeline-summary"))
      : null;
  if (row) {
    row.focus({ preventScroll: true });
    bringIntoView(row);
    return;
  }
  // A year that found nothing has no row to land on, and says so in the status.
  if (where === "status" || where === "event") {
    const status = document.getElementById(HISTORY_STATUS_ID);
    status?.focus({ preventScroll: true });
    if (status) bringIntoView(status);
    return;
  }
  if (where !== "results") return;
  const results = document.getElementById(HISTORY_RESULTS_ID);
  results?.scrollIntoView({ block: "start" });
  const heading = results?.querySelector<HTMLElement>("h2");
  heading?.setAttribute("tabindex", "-1");
  heading?.focus({ preventScroll: true });
}

/**
 * Safari gives a <summary> no press action: on a closed row or menu, VoiceOver's
 * press through the accessibility API does nothing, though a mouse and the keyboard
 * both open it. Named a button, the same element takes a press, and VoiceOver is told
 * on that very element when it opens. This is done here rather than in the markup
 * because the state then has to be kept true by script: with none running, the plain
 * disclosure reports its own state correctly.
 */
function nameSummariesAsButtons(shell: Element) {
  shell.querySelectorAll("details > summary").forEach((summary) => {
    summary.setAttribute("role", "button");
    summary.setAttribute(
      "aria-expanded",
      String((summary.parentElement as HTMLDetailsElement).open),
    );
  });
}

/**
 * The one piece of script the timeline's rows and controls share. Everything
 * inside is rendered on the server as plain links and forms, and works as such
 * without JavaScript. With it, this single handler turns those links and forms
 * into navigations in a transition: the old list stays on screen, quietly marked
 * busy, until the new one is ready; focus stays where it was; and no row needs a
 * script of its own.
 */
export function HistoryShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const landing = useRef<Landing>(null);
  const shell = useRef<HTMLDivElement>(null);

  // New children mean a new view, with new rows in it.
  useEffect(() => {
    if (shell.current) nameSummariesAsButtons(shell.current);
  }, [children]);

  const navigate = useCallback<HistoryNav["navigate"]>(
    (href, options = {}) => {
      landing.current = options.landing ?? null;
      startTransition(() => {
        if (options.replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [router],
  );

  // A transition ends in the commit that shows the new view, so this runs with
  // the new rows in the document.
  useEffect(() => {
    if (pending || !landing.current) return;
    const where = landing.current;
    landing.current = null;
    carryOut(where);
  }, [pending]);

  // Old links name an event in the hash, which the server never sees. If its
  // row is not on this page, ask the server for the page that holds it. A link
  // that names the event in the query is opened by the server; here it only
  // needs bringing into view, and the focus, so a screen reader lands on it.
  // Only ever on arrival: the query is the server's to act on afterwards.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const url = new URL(window.location.href);
    const hash = url.hash.startsWith(`#${HISTORY_EVENT_ID_PREFIX}`)
      ? url.hash.slice(HISTORY_EVENT_ID_PREFIX.length + 1)
      : "";
    const slug = url.searchParams.get("event") || hash;
    if (!slug) return;
    const row = document.getElementById(`${HISTORY_EVENT_ID_PREFIX}${slug}`);
    if (row instanceof HTMLDetailsElement) {
      row.open = true;
      row.querySelector("summary")?.scrollIntoView({ block: "start" });
      row.querySelector("summary")?.focus({ preventScroll: true });
      return;
    }
    if (hash) {
      navigate(
        `${HISTORY_PATH}?event=${encodeURIComponent(hash)}#${HISTORY_EVENT_ID_PREFIX}${hash}`,
        { replace: true, landing: "event" },
      );
    }
  }, [navigate]);

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const element = event.target as Element;
    const inMenu = element.closest(MENU_SELECTOR);
    closeMenus(inMenu);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = element.closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;
    // Stops next/link inside too, so every link here takes this one path.
    event.preventDefault();
    event.stopPropagation();
    // Closing hides the link that has the focus, so the focus returns to the
    // menu's own summary rather than falling to the top of the page.
    if (inMenu instanceof HTMLDetailsElement) {
      inMenu.open = false;
      inMenu.querySelector("summary")?.focus();
    }
    const href = `${url.pathname}${url.search}${url.hash}`;
    if (url.pathname === HISTORY_PATH) {
      // A link to a row on this very view has nothing to fetch.
      if (
        url.search === window.location.search &&
        url.hash.startsWith(`#${HISTORY_EVENT_ID_PREFIX}`)
      ) {
        carryOut("event");
        return;
      }
      const landing =
        url.hash === `#${HISTORY_RESULTS_ID}`
          ? "results"
          : anchor.dataset.landing === "status"
            ? "status"
            : null;
      navigate(href, { landing });
    } else {
      startTransition(() => router.push(href));
    }
  };

  const onSubmitCapture = (event: FormEvent<HTMLDivElement>) => {
    const form = event.target as HTMLFormElement;
    if (form.tagName !== "FORM" || form.method.toLowerCase() !== "get") return;
    const url = new URL(form.action);
    if (url.pathname !== HISTORY_PATH) return;
    event.preventDefault();
    const search = new URLSearchParams();
    new FormData(form).forEach((value, name) => {
      if (typeof value === "string" && value.trim()) search.set(name, value.trim());
    });
    const qs = search.toString();
    // A typed year is finished with its field, and goes on to the row it found.
    navigate(`${HISTORY_PATH}${qs ? `?${qs}` : ""}${url.hash}`, {
      landing: url.hash === `#${HISTORY_YEAR_TARGET_ID}` ? "event" : "status",
    });
  };

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    const menu = (event.target as Element).closest<HTMLDetailsElement>(`${MENU_SELECTOR}[open]`);
    if (!menu) return;
    menu.open = false;
    menu.querySelector("summary")?.focus();
  };

  // Tabbing on from the last item leaves the floating menu behind; it closes then.
  // Only then: focus going to no element, or to one around the menu, comes from a
  // press in it and not from the reader tabbing on.
  const onBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const menu = (event.target as Element).closest<HTMLDetailsElement>(
      "details.vf-history-menu[open]",
    );
    const next = event.relatedTarget;
    if (menu && next && !menu.contains(next) && !next.contains(menu)) menu.open = false;
  };

  // A press on a menu's own link leaves the focus where it is. Safari does not focus
  // a link on press: it takes the focus to the nearest focusable thing around it, and
  // a menu that closes then has hidden the link before the click arrives.
  const onMouseDownCapture = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(`${MENU_SELECTOR} > :not(summary)`)) {
      event.preventDefault();
    }
  };

  // A menu closes when the reader presses anywhere else, on the page or off it. It
  // comes into view when it opens, and every disclosure's button says what state it
  // is in, however it got there: a toggle does not bubble, so this catches them all
  // on the way down.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      closeMenus((event.target as Element | null)?.closest?.(MENU_SELECTOR));
    };
    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !shell.current?.contains(details)) return;
      details
        .querySelector(":scope > summary")
        ?.setAttribute("aria-expanded", String(details.open));
      if (details.matches(MENU_SELECTOR) && details.open) bringMenuIntoView(details);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);

  const value = useMemo(() => ({ pending, navigate, land: carryOut }), [pending, navigate]);

  return (
    <HistoryNavContext.Provider value={value}>
      {/* Clicks and submits from the links and forms inside, delegated here so
          that no row or control has a handler of its own; the keyboard reaches
          those links and forms directly. */}
      <div
        ref={shell}
        onClickCapture={onClickCapture}
        onSubmitCapture={onSubmitCapture}
        onKeyDownCapture={onKeyDownCapture}
        onBlurCapture={onBlurCapture}
        onMouseDownCapture={onMouseDownCapture}
      >
        {children}
      </div>
    </HistoryNavContext.Provider>
  );
}

/** The list, marked busy while the next view is on its way. */
export function HistoryResults({ children }: { children: ReactNode }) {
  const { pending } = useHistoryNav();
  return (
    <div
      id={HISTORY_RESULTS_ID}
      aria-busy={pending}
      data-pending={pending ? "" : undefined}
      className="vf-timeline"
    >
      {children}
    </div>
  );
}
