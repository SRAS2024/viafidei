/**
 * Tests for the authority source validation gate.
 *
 * Covers:
 *   - Approved hosts pass.
 *   - Unapproved hosts are rejected by the fetcher.
 *   - The authority level is correctly inferred.
 *   - Subdomains of approved hosts are accepted.
 */

import { describe, it, expect } from "vitest";

import {
  authorityLevelForHost,
  isApprovedAuthorityHost,
  findAuthoritySource,
} from "@/lib/worker/sources/authority-registry";
import { fetchApprovedSource, UnapprovedSourceError } from "@/lib/worker/sources/fetcher";

describe("authority source registry", () => {
  it("accepts vatican.va as VATICAN authority", () => {
    expect(authorityLevelForHost("www.vatican.va")).toBe("VATICAN");
    expect(authorityLevelForHost("vatican.va")).toBe("VATICAN");
  });

  it("accepts usccb.org as USCCB authority", () => {
    expect(authorityLevelForHost("www.usccb.org")).toBe("USCCB");
  });

  it("rejects an unknown host", () => {
    expect(authorityLevelForHost("notapproved.example.com")).toBeNull();
    expect(isApprovedAuthorityHost("notapproved.example.com")).toBe(false);
  });

  it("treats subdomains of approved hosts as approved", () => {
    expect(authorityLevelForHost("subdomain.vatican.va")).toBe("VATICAN");
  });

  it("returns the full source record for a known host", () => {
    const src = findAuthoritySource("usccb.org");
    expect(src?.authorityLevel).toBe("USCCB");
    expect(src?.name).toMatch(/Catholic Bishops/i);
  });
});

describe("fetchApprovedSource", () => {
  it("throws UnapprovedSourceError for non-allowlisted hosts", async () => {
    await expect(
      fetchApprovedSource({
        citationId: "test",
        url: "https://not-on-allowlist.example.com/page",
      }),
    ).rejects.toBeInstanceOf(UnapprovedSourceError);
  });

  it("uses an injected fetcher for testability", async () => {
    const stubFetcher = async (_input: string | Request | URL, _init?: RequestInit) => {
      return new Response(
        "<html><head><title>Test</title></head><body><p>hello</p></body></html>",
        { status: 200 },
      );
    };
    const result = await fetchApprovedSource({
      citationId: "c1",
      url: "https://www.vatican.va/test",
      fetcher: stubFetcher as never,
    });
    expect(result.status).toBe(200);
    expect(result.authorityLevel).toBe("VATICAN");
    expect(result.title).toBe("Test");
    expect(result.checksum).toHaveLength(64);
  });
});
