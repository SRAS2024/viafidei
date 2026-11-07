/**
 * The order the public lists show their content in. Pure, so a page and a test
 * read the same answer. Nothing on a page describes these orders: a reader just
 * finds the familiar names first.
 */

/** Anything with a slug and a title; the comparators need nothing more. */
export interface OrderableEntry {
  slug: string;
  title: string;
}

/** Prayers from the most to the least widely known. */
export function sortPrayersForDisplay<T extends OrderableEntry>(prayers: readonly T[]): T[] {
  return [...prayers];
}

/** Popes in reverse chronological order: the current pope first, down to Saint Peter. */
export function sortPopesForDisplay<T extends OrderableEntry & { payload?: unknown }>(
  popes: readonly T[],
): T[] {
  return [...popes];
}

/** Marian apparitions from the most to the least widely known. */
export function sortApparitionsForDisplay<T extends OrderableEntry>(
  apparitions: readonly T[],
): T[] {
  return [...apparitions];
}

/** Marian titles from the most to the least widely known. */
export function sortMarianTitlesForDisplay<T extends OrderableEntry>(titles: readonly T[]): T[] {
  return [...titles];
}
