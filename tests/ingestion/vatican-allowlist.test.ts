import { describe, expect, it } from "vitest";
import { gateUrl, isApprovedHost, isApprovedUrl } from "@/lib/ingestion/sources/vatican-allowlist";

describe("vatican-allowlist", () => {
  describe("isApprovedHost", () => {
    it("accepts the canonical Holy See host (case-insensitive)", () => {
      expect(isApprovedHost("vatican.va")).toBe(true);
      expect(isApprovedHost("VATICAN.VA")).toBe(true);
      expect(isApprovedHost("Vatican.Va")).toBe(true);
    });

    it("rejects an empty / null / undefined host", () => {
      expect(isApprovedHost(null)).toBe(false);
      expect(isApprovedHost(undefined)).toBe(false);
      expect(isApprovedHost("")).toBe(false);
    });

    it("rejects a lookalike sibling host (no startsWith/endsWith fuzziness)", () => {
      expect(isApprovedHost("evil-vatican.va")).toBe(false);
      expect(isApprovedHost("vatican.va.evil.com")).toBe(false);
      expect(isApprovedHost("notvatican.va")).toBe(false);
    });
  });

  describe("isApprovedUrl", () => {
    it("accepts an https url to an approved host", () => {
      expect(isApprovedUrl("https://www.vatican.va/some/path")).toBe(true);
    });

    it("rejects unsafe protocols even when the host is approved", () => {
      expect(isApprovedUrl("javascript:alert('x')")).toBe(false);
      expect(isApprovedUrl("data:text/html,<script>")).toBe(false);
      expect(isApprovedUrl("file:///etc/passwd")).toBe(false);
      expect(isApprovedUrl("ftp://www.vatican.va/x")).toBe(false);
    });

    it("rejects a malformed URL string", () => {
      expect(isApprovedUrl("not a url")).toBe(false);
      expect(isApprovedUrl("https://")).toBe(false);
      expect(isApprovedUrl("")).toBe(false);
      expect(isApprovedUrl(null)).toBe(false);
      expect(isApprovedUrl(undefined)).toBe(false);
    });

    it("rejects an unapproved host even on https", () => {
      expect(isApprovedUrl("https://example.com/path")).toBe(false);
      expect(isApprovedUrl("https://evil.com/path")).toBe(false);
    });
  });

  describe("gateUrl", () => {
    it("returns the input url unchanged when the host is approved", () => {
      const url = "https://www.vatican.va/news";
      expect(gateUrl(url)).toBe(url);
    });

    it("returns null for unapproved hosts so callers fail closed", () => {
      expect(gateUrl("https://example.com")).toBeNull();
    });

    it("returns null for unsafe protocols (defense in depth at every fetch site)", () => {
      expect(gateUrl("javascript:alert(1)")).toBeNull();
      expect(gateUrl("data:text/plain,hi")).toBeNull();
    });
  });
});
