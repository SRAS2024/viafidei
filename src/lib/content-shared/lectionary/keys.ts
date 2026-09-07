/**
 * Small, dependency-free helpers shared by the lectionary tables, the build
 * script and the runtime loader. Kept apart from index.ts so the build script
 * can import them without pulling the (large) JSON tables into scope.
 */

import type { ReadingKind } from "../daily-readings";

/** Proclamation order. Sections are stored and returned in this order. */
export const READING_ORDER: readonly ReadingKind[] = [
  "FIRST_READING",
  "PSALM",
  "SECOND_READING",
  "ACCLAMATION",
  "GOSPEL",
];

const READING_RANK = new Map<ReadingKind, number>(
  READING_ORDER.map((kind, index) => [kind, index]),
);

export function readingOrderIndex(kind: ReadingKind): number {
  return READING_RANK.get(kind) ?? READING_ORDER.length;
}

/**
 * Lectionary numbers sort numerically, then by suffix: 21, 21A, 22, 510, 510/1,
 * 510A. A plain string sort would file 510A before 61.
 */
export function compareLectionaryNumbers(a: string, b: string): number {
  const left = Number.parseInt(a, 10);
  const right = Number.parseInt(b, 10);
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
  return a.localeCompare(b);
}

/** Stable slug of a day label, used as the key of the per-kind indexes. */
export function labelSlug(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
