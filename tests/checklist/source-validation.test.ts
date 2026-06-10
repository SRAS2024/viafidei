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
  classifyHostAuthority,
  AUTHORITY_SOURCES,
} from "@/lib/checklist/sources/authority-registry";

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

  it("includes a large global registry of trusted Catholic sources", () => {
    expect(AUTHORITY_SOURCES.length).toBeGreaterThan(60);
    // A spread across the categories the worker pulls from.
    expect(authorityLevelForHost("dbk.de")).toBe("USCCB"); // bishops' conference (Germany)
    expect(authorityLevelForHost("celam.org")).toBe("USCCB"); // continental conference
    expect(authorityLevelForHost("ugcc.ua")).toBe("USCCB"); // Eastern Catholic Church
    expect(authorityLevelForHost("nd.edu")).toBe("ACADEMIC"); // Catholic university
    expect(authorityLevelForHost("marian.org")).toBe("RELIGIOUS_ORDER"); // religious order
    expect(authorityLevelForHost("catholicculture.org")).toBe("TRUSTED_PUBLISHER"); // reference db
  });

  it("approves every Holy See `.va` domain by pattern (the whole Vatican web)", () => {
    expect(authorityLevelForHost("laityfamilylife.va")).toBe("VATICAN");
    expect(authorityLevelForHost("any-future-dicastery.va")).toBe("VATICAN");
    expect(isApprovedAuthorityHost("synod.va")).toBe(true);
  });

  it("classifies the authority of lesser-known sources without auto-approving them to fetch", () => {
    // classifyHostAuthority lets the worker JUDGE a discovered source's quality;
    // it does NOT widen the fetch allow-list (isApprovedAuthorityHost stays strict).
    expect(classifyHostAuthority("diocese-of-springfield.org")).toBe("DIOCESAN");
    expect(classifyHostAuthority("erzbistum-koeln.de")).toBe("DIOCESAN");
    expect(classifyHostAuthority("abbey-of-gethsemani.org")).toBe("RELIGIOUS_ORDER");
    expect(classifyHostAuthority("randomblog.example")).toBe("COMMUNITY");
    // The explicit registry still wins for a listed host.
    expect(classifyHostAuthority("www.vatican.va")).toBe("VATICAN");
    // Quality-judged, but the fetch gate stays closed for unlisted hosts.
    expect(isApprovedAuthorityHost("diocese-of-springfield.org")).toBe(false);
  });
});
