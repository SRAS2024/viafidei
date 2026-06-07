/**
 * Shared payload-filter primitives for the content pages.
 *
 * Every content tab that splits its published items into categories (saints by
 * type, guides by kind, rites by family, liturgy by kind, spiritual life by
 * practice) uses the same small shape: a list of {key,label,matches} filters
 * where the first entry is always "All". This module is the single source of
 * truth for resolving + applying those filters so the pages and their tests
 * stay consistent (mirrors the church-documents / our-lady pattern).
 */

export interface PayloadFilter {
  key: string;
  label: string;
  /** True when a published item's payload belongs in this filter. */
  matches: (payload: Record<string, unknown>) => boolean;
}

/** Resolve a filter key to its definition; unknown/undefined → the first ("All"). */
export function resolvePayloadFilter(
  filters: readonly PayloadFilter[],
  key: string | undefined,
): PayloadFilter {
  return filters.find((f) => f.key === key) ?? filters[0];
}

/** Apply a filter key to a list of published items (resolves once, then filters). */
export function applyPayloadFilter<T extends { payload: Record<string, unknown> }>(
  filters: readonly PayloadFilter[],
  items: T[],
  key: string | undefined,
): T[] {
  const f = resolvePayloadFilter(filters, key);
  return items.filter((i) => f.matches(i.payload));
}

/** payload[field] is a string in `values`. */
export function fieldIn(
  payload: Record<string, unknown>,
  field: string,
  values: readonly string[],
): boolean {
  const v = payload[field];
  return typeof v === "string" && values.includes(v);
}

/** payload.title matches a regex (case-insensitive helper for the caller). */
export function titleMatches(payload: Record<string, unknown>, re: RegExp): boolean {
  return typeof payload.title === "string" && re.test(payload.title);
}
