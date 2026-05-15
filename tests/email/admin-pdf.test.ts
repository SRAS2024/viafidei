import { describe, expect, it } from "vitest";
import { buildTextPdfBase64 } from "@/lib/email/pdf";

describe("buildTextPdfBase64", () => {
  it("produces a valid-looking PDF document", () => {
    const base64 = buildTextPdfBase64("Error Report — 2026-05", [
      "Total errors: 0",
      "No errors were logged during this period.",
    ]);
    const decoded = Buffer.from(base64, "base64").toString("binary");
    expect(decoded.startsWith("%PDF-1.4")).toBe(true);
    expect(decoded).toContain("/Type /Catalog");
    expect(decoded).toContain("/Type /Pages");
    expect(decoded).toContain("/Type /Page");
    expect(decoded.endsWith("%%EOF")).toBe(true);
  });

  it("escapes parentheses and backslashes inside content", () => {
    const base64 = buildTextPdfBase64("Title", ["a (b) c \\ d"]);
    const decoded = Buffer.from(base64, "base64").toString("binary");
    expect(decoded).toContain("a \\(b\\) c \\\\ d");
  });

  it("paginates long inputs", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Error ${i}: example message line ${i}`);
    const base64 = buildTextPdfBase64("Stress test", lines);
    const decoded = Buffer.from(base64, "base64").toString("binary");
    // More than one page object should be present.
    const pageObjects = decoded.match(/\/Type \/Page\b/g) ?? [];
    expect(pageObjects.length).toBeGreaterThan(2);
  });
});
