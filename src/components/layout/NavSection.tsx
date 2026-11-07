"use client";

import { useEffect, useSyncExternalStore } from "react";

let current: string | null = null;
const listeners = new Set<() => void>();

function publish(href: string | null) {
  current = href;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The tab a page has claimed for itself, for the menus to light. */
export function useNavSection(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/**
 * Names the tab a page belongs to, where its address cannot. /liturgy-history holds
 * both liturgical entries, whose list is under Liturgy, and Church documents, whose
 * list is under History, so only the page knows which it is. The header is drawn once
 * and outlives the page, so the page tells it from here.
 */
export function NavSection({ href }: { href: string }) {
  useEffect(() => {
    publish(href);
    return () => publish(null);
  }, [href]);
  return null;
}
