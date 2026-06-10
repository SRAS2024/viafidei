/**
 * The dependency-free PDF text extractor lets the worker read PDFs from the web
 * (Holy See / USCCB text PDFs) without an external parser. These tests build
 * minimal PDFs — one with an uncompressed content stream, one FlateDecode-
 * compressed with Node's zlib — and confirm the text comes back; a non-PDF and
 * an image-only (no text) PDF are reported as not-ok so the caller can OCR.
 */
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { extractPdfText } from "@/lib/admin-worker/pdf-extract";

function uncompressedPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  return Buffer.from(
    `%PDF-1.4\n4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n%%EOF\n`,
    "latin1",
  );
}

function flatePdf(text: string): Buffer {
  const content = Buffer.from(`BT /F1 24 Tf 72 700 Td (${text}) Tj ET`, "latin1");
  const deflated = deflateSync(content);
  const header = Buffer.from(
    `%PDF-1.5\n4 0 obj\n<< /Length ${deflated.length} /Filter /FlateDecode >>\nstream\n`,
    "latin1",
  );
  const footer = Buffer.from(`\nendstream\nendobj\n%%EOF\n`, "latin1");
  return Buffer.concat([header, deflated, footer]);
}

describe("PDF text extraction", () => {
  it("reads text from an uncompressed content stream", () => {
    const r = extractPdfText(uncompressedPdf("Gaudium et Spes is a pastoral constitution."));
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Gaudium et Spes is a pastoral constitution");
  });

  it("inflates and reads a FlateDecode content stream", () => {
    const r = extractPdfText(flatePdf("Lumen Gentium, the dogmatic constitution on the Church."));
    expect(r.ok).toBe(true);
    expect(r.decoded).toBeGreaterThanOrEqual(1);
    expect(r.text).toContain("Lumen Gentium");
  });

  it("reports a non-PDF as not-ok", () => {
    const r = extractPdfText(Buffer.from("<html>not a pdf</html>", "latin1"));
    expect(r.ok).toBe(false);
    expect(r.text).toBe("");
  });

  it("reports an image-only PDF (no text operators) as not-ok", () => {
    const pdf = Buffer.from(
      `%PDF-1.4\n4 0 obj\n<< /Type /XObject /Subtype /Image /Width 100 /Height 100 >>\nstream\n\x00\x01\x02\x03binarybinarybinary\nendstream\nendobj\n%%EOF\n`,
      "latin1",
    );
    const r = extractPdfText(pdf);
    expect(r.ok).toBe(false);
  });
});
