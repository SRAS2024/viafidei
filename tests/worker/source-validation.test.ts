/**
 * Tests for the authority source registry.
 *
 * Covers:
 *   - Approved hosts pass.
 *   - Unapproved hosts are rejected.
 *   - The authority level is correctly inferred.
 *   - Subdomains of approved hosts are accepted.
 */

import { describe, it, expect } from "vitest";

import {
  authorityLevelForHost,
  isApprovedAuthorityHost,
  findAuthoritySource,
} from "@/lib/worker/sources/authority-registry";

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
