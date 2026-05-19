/**
 * Spec #2: "Add canonical URL normalization before saving discovered
 * items. Add duplicate URL filtering at discovery time."
 *
 * The canonicalizer:
 *   - strips fragments (#section)
 *   - strips UTM-style tracking parameters
 *   - lowercases the host
 *   - drops a trailing slash on the path (but not on the root path)
 *
 * Different surface forms of the same URL canonicalize to the same
 * string so that the DiscoveredSourceItem dedupe key collapses
 * them into one row.
 */

import { describe, expect, it } from "vitest";
import { canonicalizeDiscoveredUrl } from "@/lib/ingestion/queue/factory-native-discovery";

describe("canonicalizeDiscoveredUrl", () => {
  it("strips the fragment", () => {
    expect(canonicalizeDiscoveredUrl("https://example.org/prayer#section")).toBe(
      "https://example.org/prayer",
    );
  });

  it("strips utm_* tracking parameters", () => {
    expect(
      canonicalizeDiscoveredUrl(
        "https://example.org/prayer?utm_source=feed&utm_medium=rss&keep=this",
      ),
    ).toBe("https://example.org/prayer?keep=this");
  });

  it("strips fbclid / gclid", () => {
    expect(
      canonicalizeDiscoveredUrl("https://example.org/saint?fbclid=abc&gclid=def"),
    ).toBe("https://example.org/saint");
  });

  it("lowercases the host", () => {
    expect(canonicalizeDiscoveredUrl("https://Example.Org/Prayer")).toBe(
      "https://example.org/Prayer",
    );
  });

  it("drops a trailing slash on a non-root path", () => {
    expect(canonicalizeDiscoveredUrl("https://example.org/prayer/")).toBe(
      "https://example.org/prayer",
    );
  });

  it("keeps the root '/' path", () => {
    expect(canonicalizeDiscoveredUrl("https://example.org/")).toBe("https://example.org/");
  });

  it("collapses two surface forms of the same URL to the same canonical", () => {
    const a = canonicalizeDiscoveredUrl("https://Example.Org/prayer/?utm_source=feed#top");
    const b = canonicalizeDiscoveredUrl("https://example.org/prayer");
    expect(a).toBe(b);
  });

  it("returns the original string when URL parsing fails", () => {
    expect(canonicalizeDiscoveredUrl("not a url")).toBe("not a url");
  });
});
