"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The address a press on a page link asked for, until that page is on screen, and what
 * held focus once the press was done. Held outside the component because the list's
 * next page may arrive as a new instance.
 */
let awaited: { href: string; focus: Element | null } | null = null;

const ITEMS = "main .vf-grid, main .vf-result-group";
const OWN_HEADING = ":scope > .vf-section-head h2, :scope > .vf-result-head h2";

/**
 * Where this pager's new items begin: the first list after any pager before it, or
 * the heading that list stands under, since a heading says what the items are.
 */
function startOfItems(pager: HTMLElement): HTMLElement | null {
  const pagers = Array.from(document.querySelectorAll("main [data-pager]"));
  const before = pagers[pagers.indexOf(pager) - 1];
  const follows = (a: Node, b: Node) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
  const first = Array.from(document.querySelectorAll<HTMLElement>(ITEMS)).find(
    (items) => follows(items, pager) && (!before || follows(before, items)),
  );
  if (!first) return null;
  return first.closest("section")?.querySelector<HTMLElement>(OWN_HEADING) ?? first;
}

/**
 * Gives a landing place focus for as long as it holds it. An element left focusable
 * would take focus on every click inside it, which in Safari closes an open menu
 * before its link receives the click, and sends Tab back to the top of the list.
 */
function land(target: HTMLElement) {
  target.tabIndex = -1;
  target.setAttribute("data-focus-landing", "");
  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ block: "start" });
  target.addEventListener(
    "blur",
    () => {
      target.removeAttribute("tabindex");
      target.removeAttribute("data-focus-landing");
    },
    { once: true },
  );
}

/**
 * The pager's landmark, and what turning a page does to focus. The link that was
 * pressed stays behind at the foot of the page while the page goes back to its top,
 * so a screen reader and a keyboard would both go on from past the end of the new
 * list. Once the new page has committed, focus lands where its items start, as
 * /history does. The new page's title says which page it is. Back and Forward are
 * left alone: only a press asks for this, and the browser restores those itself.
 *
 * A slow page can arrive after the reader has gone on to something else, the search
 * field say, and landing then would take their next keystrokes. So focus only lands if
 * it is still where the press left it, which may be somewhere other than the link, as
 * a press that moves no focus does, or has fallen to the page.
 */
export function PaginationNav({
  page,
  label,
  className,
  children,
}: {
  page: number;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    function onClick(event: MouseEvent) {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!link || modified || link.hasAttribute("aria-current")) return;
      awaited = { href: link.href, focus: document.activeElement };
    }
    nav.addEventListener("click", onClick);
    return () => nav.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!awaited) return;
    const { href, focus } = awaited;
    awaited = null;
    const now = document.activeElement;
    const stayed = !now || now === document.body || now === focus;
    if (!stayed || href !== window.location.href || !ref.current) return;
    const start = startOfItems(ref.current);
    if (start) land(start);
  }, [page]);

  return (
    <nav ref={ref} data-pager="" className={className} aria-label={label}>
      {children}
    </nav>
  );
}
