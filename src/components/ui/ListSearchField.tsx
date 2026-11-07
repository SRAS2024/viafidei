"use client";

import Link from "next/link";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

import { MAX_QUERY_LENGTH } from "@/lib/content-shared/list-search";

/**
 * The search field of a list page. It stays in the page while chips, page links and
 * "Clear search" navigate in the browser, because "Clear search" sends focus here and
 * a field that was rebuilt would drop it. So it writes in the new search itself: an
 * uncontrolled field reads its default only when it mounts.
 *
 * It never writes over a reader at work. "Clear search" invites a new search at once,
 * and the page it asked for may arrive mid-word: letters typed since the page last set
 * the field stay, for as long as the reader is in the field.
 */
export function ListSearchField({
  id,
  query,
  placeholder,
}: {
  id: string;
  query: string;
  placeholder: string;
}) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const shownQuery = useRef(query);
  const typedSinceShown = useRef(false);

  useEffect(() => {
    if (shownQuery.current === query) return;
    shownQuery.current = query;
    const field = fieldRef.current;
    if (!field) return;
    if (field.value === query) {
      typedSinceShown.current = false;
    } else if (!typedSinceShown.current || document.activeElement !== field) {
      typedSinceShown.current = false;
      field.value = query;
    }
  }, [query]);

  // 16px text: anything smaller makes iOS zoom the page on focus.
  return (
    <input
      ref={fieldRef}
      id={id}
      type="search"
      name="q"
      defaultValue={query}
      onInput={() => {
        typedSinceShown.current = true;
      }}
      placeholder={placeholder}
      maxLength={MAX_QUERY_LENGTH}
      autoComplete="off"
      enterKeyHint="search"
      className="vf-input min-w-0 flex-1"
    />
  );
}

/**
 * "Clear search". The link leaves the page with the search it clears, and focus would
 * fall to the top of the document, so a screen reader would start over. It goes to the
 * field instead, which stays and is already empty when a screen reader reads it out.
 */
export function ClearSearchLink({
  href,
  fieldId,
  className,
  children,
}: {
  href: string;
  fieldId: string;
  className?: string;
  children: ReactNode;
}) {
  function moveToField(event: MouseEvent<HTMLAnchorElement>) {
    // A modified click opens elsewhere, and this page stays as it is.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const field = document.getElementById(fieldId);
    if (field instanceof HTMLInputElement) {
      field.value = "";
      field.focus();
    }
  }
  return (
    <Link href={href} className={className} onClick={moveToField}>
      {children}
    </Link>
  );
}
