import { vi } from "vitest";

// Minimal in-memory cookie store that implements just enough of the
// next/headers `cookies()` interface for iron-session to read & write
// session cookies in tests.

type CookieEntry = { name: string; value: string };

export type FakeCookieJar = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  getAll: ReturnType<typeof vi.fn>;
  has: ReturnType<typeof vi.fn>;
  __entries: Map<string, string>;
};

export function createCookieJar(initial: Record<string, string> = {}): FakeCookieJar {
  const entries = new Map<string, string>(Object.entries(initial));
  const jar: FakeCookieJar = {
    __entries: entries,
    get: vi.fn((name: string): CookieEntry | undefined => {
      const value = entries.get(name);
      return value === undefined ? undefined : { name, value };
    }),
    set: vi.fn((arg1: string | { name: string; value: string }, arg2?: string) => {
      if (typeof arg1 === "string") {
        entries.set(arg1, arg2 ?? "");
      } else {
        entries.set(arg1.name, arg1.value);
      }
    }),
    delete: vi.fn((name: string) => {
      entries.delete(name);
    }),
    getAll: vi.fn((): CookieEntry[] =>
      Array.from(entries.entries()).map(([name, value]) => ({ name, value })),
    ),
    has: vi.fn((name: string) => entries.has(name)),
  };
  return jar;
}
