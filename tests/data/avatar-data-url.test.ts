import { describe, expect, it } from "vitest";
import { MAX_AVATAR_DATA_URL_BYTES, validateAvatarDataUrl } from "@/lib/media/avatar-data-url";

const VALID_PNG_PREFIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADklEQVR4nGP4//8/AwAI/AL+XJ/lxQAAAABJRU5ErkJggg==";

describe("validateAvatarDataUrl", () => {
  it("accepts a small jpeg/png/webp data URL", () => {
    const result = validateAvatarDataUrl(VALID_PNG_PREFIX);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("image/png");
      expect(result.byteLength).toBeGreaterThan(0);
    }
  });

  it("rejects non-string input", () => {
    expect(validateAvatarDataUrl(undefined)).toMatchObject({
      ok: false,
      reason: "invalid_format",
    });
    expect(validateAvatarDataUrl(null)).toMatchObject({
      ok: false,
      reason: "invalid_format",
    });
    expect(validateAvatarDataUrl(123)).toMatchObject({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects unsupported mime types", () => {
    const svg =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=";
    expect(validateAvatarDataUrl(svg)).toMatchObject({
      ok: false,
      reason: "unsupported_mime",
    });
  });

  it("rejects payloads over the size cap", () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_AVATAR_DATA_URL_BYTES * 2 + 100);
    expect(validateAvatarDataUrl(huge)).toMatchObject({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects strings that lack the data URL prefix", () => {
    expect(validateAvatarDataUrl("not a data url")).toMatchObject({
      ok: false,
      reason: "invalid_format",
    });
  });
});
