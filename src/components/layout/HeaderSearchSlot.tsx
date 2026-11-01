"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Pages that show no header search bar. The homepage is the only one. */
export function isSearchlessPath(pathname: string | null | undefined): boolean {
  return pathname === "/";
}

/**
 * Where the header's site search sits — the desktop tab row and the bar pinned
 * under the mobile header. On the homepage it renders nothing: the owner asked
 * for the search bar to come off the main page, and every content list page
 * now has a search of its own.
 *
 * Decided in the browser from the current path because the root layout that
 * renders the header is NOT re-rendered when the visitor moves between pages:
 * reading the path on the server would freeze whichever answer the first page
 * of the visit produced.
 */
export function HeaderSearchSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isSearchlessPath(pathname)) return null;
  return <>{children}</>;
}
