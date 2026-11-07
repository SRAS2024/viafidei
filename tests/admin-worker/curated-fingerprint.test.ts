/**
 * The corpus fingerprint decides whether the worker looks at the curated knowledge at
 * all, so whatever it cannot see never reaches a live row. It used to drop every nested
 * key whose name was not also a top-level key: the body of a guide's step, a novena's
 * prayer, a sacrament's matter and form. Pinned here against the REAL corpus: in every
 * content type, a change to any field at any depth changes it.
 */
import { describe, expect, it } from "vitest";

import { curatedKnowledgeFingerprint } from "@/lib/admin-worker/seed-curated-content";
import { ALL_CURATED_ENTRIES } from "@/lib/checklist";
import type { CuratedEntry } from "@/lib/checklist/knowledge";

type Path = Array<string | number>;

/** Every leaf of a JSON value, with its path. */
function leaves(value: unknown, path: Path = []): Path[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, [...path, i]));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]));
  }
  return [path];
}

/** The payload with one leaf changed. A deep copy, so the corpus is left as it is. */
function withLeafChanged(payload: Record<string, unknown>, path: Path): Record<string, unknown> {
  const copy = structuredClone(payload) as Record<string, unknown>;
  let at = copy as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
  const last = path[path.length - 1]!;
  const leaf = at[last];
  at[last] =
    typeof leaf === "string"
      ? `${leaf} (corrected)`
      : typeof leaf === "number"
        ? leaf + 1
        : typeof leaf === "boolean"
          ? !leaf
          : "was null";
  return copy;
}

/** The same value with every object's keys written in reverse. */
function withKeysReversed<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withKeysReversed) as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([k, v]) => [k, withKeysReversed(v)]),
  ) as T;
}

const entries = ALL_CURATED_ENTRIES as readonly CuratedEntry[];
const types = [...new Set(entries.map((e) => e.contentType))];

/** One place in the corpus for every field a content type has anywhere, keyed by the field. */
function oneOfEachField(contentType: string): Map<string, { entry: CuratedEntry; path: Path }> {
  const found = new Map<string, { entry: CuratedEntry; path: Path }>();
  for (const entry of entries.filter((e) => e.contentType === contentType)) {
    for (const path of leaves(entry.payload)) {
      const field = path.map((p) => (typeof p === "number" ? "*" : p)).join(".");
      if (!found.has(field)) found.set(field, { entry, path });
    }
  }
  return found;
}

describe("curatedKnowledgeFingerprint over the real corpus", () => {
  it.each(types)("%s: a change to any field at any depth changes it", (contentType) => {
    for (const [field, { entry, path }] of oneOfEachField(contentType)) {
      const changed = { ...entry, payload: withLeafChanged(entry.payload, path) };
      expect(curatedKnowledgeFingerprint([changed]), `${entry.slug} ${field}`).not.toBe(
        curatedKnowledgeFingerprint([entry]),
      );
    }
  });

  it("walks the nested text that used to be invisible", () => {
    // Without these the test above could pass by having nothing nested to walk.
    const fields = (contentType: string) => [...oneOfEachField(contentType).keys()];
    expect(fields("GUIDE")).toContain("steps.*.body");
    expect(fields("NOVENA")).toContain("days.*.prayerText");
    expect(fields("SACRAMENT")).toContain("matterAndForm.form");
    expect(fields("DEVOTION")).toContain("indulgences.citation");
  });

  it("does not change when every key in the corpus is written in another order", () => {
    const reordered = entries.map((e) => ({ ...e, payload: withKeysReversed(e.payload) }));
    expect(curatedKnowledgeFingerprint(reordered)).toBe(curatedKnowledgeFingerprint(entries));
  });
});
