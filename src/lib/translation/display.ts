/**
 * Display overlays: the translated face of a published item.
 *
 * Pages run logic on an item's English fields — prayer categories from title
 * keywords, filters matched against stored titles, sorting — so translation
 * must never replace those fields. The data layer instead hands pages a
 * shallow copy of each item with an overlay attached (a WeakMap entry, so it
 * is invisible to logic and to serialization), and the rendering components
 * swap the overlay in at the last moment (`displayItem`). An item without an
 * overlay renders exactly as before.
 */

import type { Locale } from "@/lib/i18n/locales";

export interface DisplayOverlay {
  locale: Locale;
  title: string;
  subtitle: string | null;
  /** The payload with its translated prose; undefined when only the title changed. */
  payload?: Record<string, unknown>;
  /** At least one unit came from the machine-translation engine. */
  machineTranslated: boolean;
  /** Units still waiting for the translator (shown in English meanwhile). */
  pendingUnits: number;
}

const OVERLAYS = new WeakMap<object, DisplayOverlay>();

/** Attach `overlay` to `item` (normally a fresh shallow copy) and return it. */
export function attachDisplay<T extends object>(item: T, overlay: DisplayOverlay): T {
  OVERLAYS.set(item, overlay);
  return item;
}

export function displayOverlay(item: unknown): DisplayOverlay | undefined {
  return item && typeof item === "object" ? OVERLAYS.get(item) : undefined;
}

type Displayable = { title: string; subtitle?: string | null; payload?: Record<string, unknown> };

/**
 * The item as it should be shown: the overlay's title, subtitle and payload
 * when there is one, otherwise the item itself (same object).
 */
export function displayItem<T extends Displayable>(item: T): T {
  const overlay = displayOverlay(item);
  if (!overlay) return item;
  const shown = { ...item, title: overlay.title } as T;
  if ("subtitle" in item) (shown as Displayable).subtitle = overlay.subtitle;
  if (overlay.payload && "payload" in item) (shown as Displayable).payload = overlay.payload;
  return shown;
}
