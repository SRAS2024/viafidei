import * as React from "react";

import type { Locale } from "./locales";

type Box = { locale?: Locale };

// Next renders server components with its own React, whose cache() keeps one value
// for the whole of a request. The tests' React 18 has no cache(); there each call
// gets a fresh box, nothing is remembered, and the reader says its words in English.
const perRequest =
  (React as unknown as { cache?: (fn: () => Box) => () => Box }).cache ?? ((fn: () => Box) => fn);

const box = perRequest(() => ({}));

/** Called by getLocale, so that the rest of this request's render knows its language. */
export function rememberRequestLocale(locale: Locale): void {
  box().locale = locale;
}

/**
 * The language getLocale chose for this request, for the few server components whose
 * parent hands them no translator (the source lines at the foot of a detail page), or
 * undefined when none was chosen in this render.
 */
export function requestLocale(): Locale | undefined {
  return box().locale;
}
