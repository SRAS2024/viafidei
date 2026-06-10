/**
 * Dependency-free PDF text extraction for the Admin Worker.
 *
 * The runtime ships no PDF parser (only pdfkit, which *writes* PDFs), and the
 * environment can't add one. So this reads PDFs the worker fetches from the web
 * using only Node built-ins: it walks the file's content streams, inflates the
 * FlateDecode-compressed ones with `zlib`, and pulls the text out of the
 * text-showing operators (Tj / TJ / ' / "). That covers the common case —
 * the digitally-generated text PDFs the Holy See and the USCCB publish.
 *
 * It deliberately does NOT try to be a full PDF engine: encrypted PDFs, exotic
 * CID-font encodings, and scanned/image-only PDFs won't yield clean text. The
 * extractor reports that honestly (a low text yield / low printable ratio) so
 * the caller can fall back to filing an OCR capability request rather than
 * feeding the pipeline garbage.
 */

import { inflateRawSync, inflateSync } from "node:zlib";

export interface PdfExtractResult {
  text: string;
  pages: number;
  /** Streams we found vs. successfully decoded — useful for diagnostics. */
  streams: number;
  decoded: number;
  /** True when the output looks like real readable text (not binary noise). */
  ok: boolean;
}

const MAX_STREAMS = 4_000;
const MAX_TEXT = 4_000_000; // 4 MB of extracted text is plenty.

/** Inflate a FlateDecode stream, trying zlib-wrapped then raw deflate. */
function inflate(data: Buffer): Buffer | null {
  try {
    return inflateSync(data);
  } catch {
    try {
      return inflateRawSync(data);
    } catch {
      return null;
    }
  }
}

/** Pull every content stream out of the raw PDF bytes (with its filter flag). */
function collectStreams(latin1: string): Array<{ data: Buffer; flate: boolean }> {
  const out: Array<{ data: Buffer; flate: boolean }> = [];
  let idx = 0;
  while (out.length < MAX_STREAMS) {
    idx = latin1.indexOf("stream", idx);
    if (idx === -1) break;
    // Skip the "stream" inside "endstream".
    if (latin1.slice(idx - 3, idx) === "end") {
      idx += 6;
      continue;
    }
    const dictStart = latin1.lastIndexOf("<<", idx);
    const dict = dictStart !== -1 ? latin1.slice(dictStart, idx) : "";
    const flate = /\/FlateDecode/.test(dict);
    let start = idx + 6;
    if (latin1[start] === "\r") start += 1;
    if (latin1[start] === "\n") start += 1;
    const end = latin1.indexOf("endstream", start);
    if (end === -1) break;
    out.push({ data: Buffer.from(latin1.slice(start, end), "latin1"), flate });
    idx = end + 9;
  }
  return out;
}

/** Decode a PDF literal/hex string and the line-break operators in a stream. */
function extractStringsFromContent(c: string): string {
  let out = "";
  let i = 0;
  const n = c.length;
  while (i < n && out.length < MAX_TEXT) {
    const ch = c[i];
    if (ch === "(") {
      let depth = 1;
      i += 1;
      let str = "";
      while (i < n && depth > 0) {
        const d = c[i];
        if (d === "\\") {
          const e = c[i + 1];
          if (e === "n") {
            str += "\n";
            i += 2;
          } else if (e === "r") {
            str += "\r";
            i += 2;
          } else if (e === "t") {
            str += "\t";
            i += 2;
          } else if (e === "b" || e === "f") {
            i += 2;
          } else if (e === "(" || e === ")" || e === "\\") {
            str += e;
            i += 2;
          } else if (e >= "0" && e <= "7") {
            let oct = e;
            i += 2;
            for (let k = 0; k < 2 && c[i] >= "0" && c[i] <= "7"; k += 1) {
              oct += c[i];
              i += 1;
            }
            str += String.fromCharCode(parseInt(oct, 8) & 0xff);
          } else if (e === "\n") {
            i += 2;
          } else if (e === "\r") {
            i += 2;
            if (c[i] === "\n") i += 1;
          } else {
            str += e;
            i += 2;
          }
        } else if (d === "(") {
          depth += 1;
          str += d;
          i += 1;
        } else if (d === ")") {
          depth -= 1;
          if (depth > 0) str += d;
          i += 1;
        } else {
          str += d;
          i += 1;
        }
      }
      out += str;
    } else if (ch === "<" && c[i + 1] !== "<") {
      const j = c.indexOf(">", i);
      if (j === -1) break;
      const hex = c.slice(i + 1, j).replace(/[^0-9a-fA-F]/g, "");
      for (let k = 0; k + 1 < hex.length; k += 2) {
        out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16) & 0xff);
      }
      i = j + 1;
    } else if (
      ch === "T" &&
      (c.substr(i, 2) === "Td" || c.substr(i, 2) === "TD" || c.substr(i, 2) === "T*")
    ) {
      out += "\n";
      i += 2;
    } else if (ch === "'" || ch === '"') {
      out += "\n";
      i += 1;
    } else {
      i += 1;
    }
  }
  return out;
}

/** Fraction of characters that look like readable text (letters/space/punct). */
function printableRatio(s: string): number {
  if (!s) return 0;
  let good = 0;
  const sample = s.slice(0, 20_000);
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || code >= 160) {
      good += 1;
    }
  }
  return good / sample.length;
}

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Extract readable text from PDF bytes. Returns `ok:false` (and whatever text
 * it managed) when the document is encrypted / scanned / otherwise unreadable,
 * so the caller can route to OCR instead of trusting noise.
 */
export function extractPdfText(buffer: Buffer): PdfExtractResult {
  const head = buffer.subarray(0, 1024).toString("latin1");
  if (!head.startsWith("%PDF")) {
    return { text: "", pages: 0, streams: 0, decoded: 0, ok: false };
  }
  const latin1 = buffer.toString("latin1");
  const pages =
    (latin1.match(/\/Type\s*\/Page[^s]/g) ?? []).length ||
    (latin1.match(/\/Count\s+(\d+)/) ? 1 : 0);
  const streams = collectStreams(latin1);

  let decoded = 0;
  let text = "";
  for (const s of streams) {
    let content: string | null = null;
    if (s.flate) {
      const inflated = inflate(s.data);
      if (inflated) {
        content = inflated.toString("latin1");
        decoded += 1;
      }
    } else {
      // Only treat an unfiltered stream as content when it carries text
      // operators; image/binary streams are skipped.
      const raw = s.data.toString("latin1");
      if (/BT\s|\bTj\b|\bTJ\b/.test(raw)) {
        content = raw;
        decoded += 1;
      }
    }
    if (!content) continue;
    if (!/BT\s|\bTj\b|\bTJ\b|\(/.test(content)) continue;
    text += extractStringsFromContent(content) + "\n";
    if (text.length > MAX_TEXT) break;
  }

  const tidied = tidy(text);
  const ok = tidied.length >= 40 && printableRatio(tidied) >= 0.85;
  return { text: tidied, pages, streams: streams.length, decoded, ok };
}
