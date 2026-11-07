/**
 * A value's JSON with every object's keys in one order, at every depth.
 *
 * jsonb hands an object back with its keys by length, not as they were written, so a
 * row and the content it was written from list their keys differently and are still the
 * same content. Whatever compares a jsonb column with what the worker would write, or
 * hashes content that must not change because a source file reordered its keys, goes
 * through here. Array order is left alone: the order of steps means something. A key
 * holding undefined is left out, as it is once stored.
 *
 * computeContentChecksum keeps its own stringify, which writes that undefined as null:
 * it is what every stored checksum was made with.
 */
export function canonicalJson(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}
