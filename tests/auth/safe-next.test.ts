/**
 * `next` comes from a query string or a form field and decides where a sign-in lands, so
 * it may only ever name a path on this site. A list of bad prefixes kept missing forms the
 * URL parser reads differently from how they look: the parser drops tabs and newlines
 * anywhere, reads a backslash as a slash and resolves dot segments.
 */
import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/safe-next";

/** Where the redirect would really go, the way redirectTo() resolves it. */
const resolved = (path: string) => new URL(path, "https://etviafidei.com");

describe("safeNextPath", () => {
  it.each([
    "/",
    "/profile",
    "/prayers/hail-mary",
    "/prayers?lang=la",
    "/saints?filter=virgins&page=2#top",
    "/search?q=st%20peter",
    "/parishes/saint-mary's",
    "/%5Cescaped-but-only-a-path",
    "/a//b",
  ])("keeps the site's own path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
    expect(resolved(path).origin).toBe("https://etviafidei.com");
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["two backslashes", "\\\\evil.example"],
    ["a tab between the slashes", "/\t/evil.example"],
    ["a newline between the slashes", "/\n/evil.example"],
    ["a carriage return between the slashes", "/\r/evil.example"],
    ["a tab and a backslash", "/\t\\evil.example"],
    ["a null byte", "/\0/evil.example"],
    ["a dot segment before the slashes", "/.//evil.example"],
    ["a parent segment before the slashes", "/..//evil.example"],
    ["dot segments further along", "/a/..//evil.example"],
    ["an encoded dot segment", "/%2e//evil.example"],
    ["an absolute URL", "https://evil.example/"],
    ["a scheme alone", "https:evil.example"],
    ["a javascript URL", "javascript:alert(1)"],
    ["no leading slash", "evil.example"],
    ["a leading space", " /profile"],
    ["empty", ""],
  ])("refuses %s", (_label, value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("whatever it keeps resolves to this site, even after another round", () => {
    for (const value of ["/\t/evil.example", "/.//evil.example", "/profile", "/a//b"]) {
      const kept = safeNextPath(value);
      if (kept === null) continue;
      const once = resolved(kept);
      expect(once.origin).toBe("https://etviafidei.com");
      expect(resolved(once.pathname).origin).toBe("https://etviafidei.com");
    }
  });

  it("refuses a value too long to be one of our paths", () => {
    expect(safeNextPath(`/${"a".repeat(3000)}`)).toBeNull();
  });

  it("takes the first of a repeated parameter", () => {
    expect(safeNextPath(["/prayers", "/saints"])).toBe("/prayers");
    expect(safeNextPath(["//evil.example", "/saints"])).toBeNull();
  });

  it("refuses anything that is not text", () => {
    for (const value of [null, undefined, 7, {}, [], new Blob(["/profile"])]) {
      expect(safeNextPath(value)).toBeNull();
    }
  });
});
