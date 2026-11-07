/** A value as Postgres hands it back from a jsonb column: each object's keys shortest first. */
export function asStoredInJsonb<T>(value: T): T {
  if (Array.isArray(value)) return value.map(asStoredInJsonb) as T;
  if (value === null || typeof value !== "object") return value;
  const keys = Object.keys(value).sort(
    (a, b) => a.length - b.length || Buffer.compare(Buffer.from(a), Buffer.from(b)),
  );
  return Object.fromEntries(
    keys.map((key) => [key, asStoredInJsonb((value as Record<string, unknown>)[key])]),
  ) as T;
}
