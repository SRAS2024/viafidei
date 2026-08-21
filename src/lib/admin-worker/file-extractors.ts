/**
 * Local file text extraction for operator-supplied files (spec §13).
 *
 * Files handed to the Admin Worker are UNTRUSTED DATA. Nothing in here
 * executes anything a file contains: no macros, no scripts, no embedded
 * programs, no external references are followed, and any instruction-looking
 * prose inside a document is treated as source material, never as authority
 * over the worker. Extraction is pure parsing with hard resource ceilings.
 *
 * Formats handled with Node built-ins only (no new dependency):
 *
 *   text/markdown/structured text  read as UTF-8
 *   HTML/XHTML                     tag-stripped, script/style dropped
 *   JSON / JSON-LD                 pretty-flattened to readable key: value text
 *   XML / RSS / Atom / sitemaps    tag-stripped with element names kept
 *   CSV / TSV                      parsed to rows (quoted fields honoured)
 *   PDF                            existing dependency-free extractor
 *   DOCX / PPTX / XLSX / ODT       ZIP + XML parsed with a bounded reader
 *
 * Safety ceilings (all enforced here, not by the caller):
 *   - MAX_FILE_BYTES per file
 *   - MAX_TEXT_CHARS of extracted text
 *   - MAX_ZIP_ENTRIES / MAX_ZIP_TOTAL_BYTES / MAX_COMPRESSION_RATIO (zip bombs)
 *   - malformed input degrades to "unsupported", never throws out of `extract`
 */

import { inflateRawSync } from "node:zlib";

import { extractPdfText } from "./pdf-extract";

export const MAX_FILE_BYTES = 64 * 1024 * 1024; // 64 MB
export const MAX_TEXT_CHARS = 4_000_000;
const MAX_ZIP_ENTRIES = 512;
const MAX_ZIP_TOTAL_BYTES = 128 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200; // uncompressed / compressed

export type FileKind =
  | "text"
  | "markdown"
  | "html"
  | "json"
  | "xml"
  | "csv"
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "odt"
  | "unsupported";

export interface FileExtraction {
  kind: FileKind;
  /** Human-readable text the pipeline can classify and extract from. */
  text: string;
  /** Best-effort document title (first heading / filename fallback). */
  title: string | null;
  /** Headings discovered in the document, in order. */
  headings: string[];
  /** Structured rows for tabular inputs. */
  rows?: string[][];
  /** Parsed object for JSON inputs (safe — parsed, never evaluated). */
  data?: unknown;
  /** True when extraction produced usable prose. */
  ok: boolean;
  /** Why extraction failed or degraded, when it did. */
  note: string | null;
  byteSize: number;
  /** Notable safety observations (macros present, truncation, …). */
  safetyNotes: string[];
}

/* ------------------------------------------------------------------ */
/* type detection                                                      */
/* ------------------------------------------------------------------ */

const EXT_KIND: Record<string, FileKind> = {
  txt: "text",
  text: "text",
  log: "text",
  md: "markdown",
  markdown: "markdown",
  htm: "html",
  html: "html",
  xhtml: "html",
  json: "json",
  jsonld: "json",
  geojson: "json",
  xml: "xml",
  rss: "xml",
  atom: "xml",
  csv: "csv",
  tsv: "csv",
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  xlsx: "xlsx",
  odt: "odt",
};

/**
 * Detect the file kind from magic bytes first, then the extension. Magic bytes
 * win so a mislabelled `.txt` that is really a ZIP is not mis-parsed.
 */
export function detectFileKind(filename: string, buffer: Buffer): FileKind {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";

  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    // ZIP container — decide by the extension, defaulting to docx-style parsing.
    if (ext === "pptx") return "pptx";
    if (ext === "xlsx") return "xlsx";
    if (ext === "odt") return "odt";
    if (ext === "docx") return "docx";
    return "unsupported";
  }

  const head = buffer.subarray(0, 2048).toString("utf8").trimStart();
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (head.startsWith("<?xml")) return "xml";
  if (/^<(!doctype html|html)/i.test(head)) return "html";

  return EXT_KIND[ext] ?? (isProbablyText(buffer) ? "text" : "unsupported");
}

function isProbablyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 4096);
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 160) {
      printable += 1;
    }
  }
  return sample.length === 0 ? false : printable / sample.length > 0.85;
}

/* ------------------------------------------------------------------ */
/* bounded ZIP reader (docx / pptx / xlsx / odt)                        */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string;
  data: Buffer;
}

/**
 * Minimal, bounded ZIP reader: walks local file headers, inflates STORED and
 * DEFLATE entries only, and refuses anything that looks like a decompression
 * bomb or a path-traversal name. Encrypted entries are skipped.
 */
function readZipEntries(buffer: Buffer, wanted: (name: string) => boolean): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  let totalOut = 0;

  while (offset + 30 <= buffer.length && entries.length < MAX_ZIP_ENTRIES) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break; // no more local headers
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    if (dataStart + compressedSize > buffer.length) break;

    const name = buffer.subarray(nameStart, nameStart + nameLen).toString("utf8");
    const encrypted = (flags & 0x1) !== 0;
    // General-purpose bit 3: the sizes live in a trailing data descriptor, so
    // the local header carries zeros. Plenty of real .docx/.xlsx files are
    // written this way by streaming writers, and skipping them made perfectly
    // valid documents extract to nothing. Read to the next header instead.
    const streamed = (flags & 0x8) !== 0;

    const unsafeName = name.includes("..") || name.startsWith("/");
    let end = dataStart + compressedSize;
    let declaredUncompressed = uncompressedSize;

    if (streamed) {
      // The member ends at the data descriptor / next local header, whichever
      // comes first. Search from dataStart so an empty member is handled too.
      const nextHeader = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart);
      const descriptor = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), dataStart);
      const central = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart);
      const stops = [nextHeader, descriptor, central].filter((n) => n > dataStart);
      end = stops.length > 0 ? Math.min(...stops) : buffer.length;
      // A data descriptor states the real sizes; use them for the bomb guard.
      if (descriptor === end && descriptor + 16 <= buffer.length) {
        declaredUncompressed = buffer.readUInt32LE(descriptor + 12);
      } else {
        declaredUncompressed = 0; // unknown — the output cap below still applies
      }
    }

    // Bomb + traversal guards.
    const compressed = Math.max(0, end - dataStart);
    const ratio = compressed > 0 ? declaredUncompressed / compressed : 0;
    const oversized = totalOut + declaredUncompressed > MAX_ZIP_TOTAL_BYTES;

    if (!encrypted && !unsafeName && !oversized && ratio <= MAX_COMPRESSION_RATIO && wanted(name)) {
      const raw = buffer.subarray(dataStart, end);
      try {
        const data = method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
        // Hard output cap: protects against a bomb whose declared sizes lie.
        if (totalOut + data.length <= MAX_ZIP_TOTAL_BYTES) {
          totalOut += data.length;
          entries.push({ name, data });
        }
      } catch {
        // Unreadable member — skip it rather than failing the whole document.
      }
    }

    offset = end;
    if (streamed) {
      // Skip a data descriptor if that is where we stopped (signature + 3 words).
      if (
        offset + 4 <= buffer.length &&
        buffer.readUInt32LE(offset) === 0x08074b50 &&
        offset + 16 <= buffer.length
      ) {
        offset += 16;
      }
      const next = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset);
      if (next < 0) break;
      offset = next;
    }
  }
  return entries;
}

/** Does this office document carry macros / active content? (Reported, never run.) */
function zipHasActiveContent(buffer: Buffer): boolean {
  const asText = buffer.subarray(0, Math.min(buffer.length, 2_000_000)).toString("latin1");
  return (
    asText.includes("vbaProject.bin") ||
    asText.includes("macros/") ||
    asText.includes("Basic/Standard") // ODF Basic macros
  );
}

/* ------------------------------------------------------------------ */
/* per-format text extraction                                          */
/* ------------------------------------------------------------------ */

function stripXmlTags(xml: string, keepBreaks = true): string {
  return xml
    .replace(/<\?xml[\s\S]*?\?>/g, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|br|h[1-6]|li|tr|w:p|a:p|text:p|text:h)>/gi, keepBreaks ? "\n" : " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlHeadings(html: string): string[] {
  return Array.from(html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi))
    .map((m) => stripXmlTags(m[1], false))
    .filter(Boolean)
    .slice(0, 60);
}

function markdownHeadings(md: string): string[] {
  return md
    .split("\n")
    .filter((l) => /^#{1,6}\s+/.test(l))
    .map((l) => l.replace(/^#{1,6}\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 60);
}

/** Flatten arbitrary JSON into readable "path: value" lines. */
function jsonToText(value: unknown, prefix = "", depth = 0, out: string[] = []): string[] {
  if (depth > 12 || out.length > 20_000) return out;
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.slice(0, 500).forEach((v, i) => jsonToText(v, `${prefix}[${i}]`, depth + 1, out));
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
      jsonToText(v, prefix ? `${prefix}.${k}` : k, depth + 1, out);
    }
    return out;
  }
  out.push(`${prefix}: ${String(value)}`);
  return out;
}

/** RFC4180-ish CSV/TSV parser (quoted fields, embedded newlines). */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (rows.length > 100_000) break;
    } else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function officeTextFromZip(
  buffer: Buffer,
  wanted: (name: string) => boolean,
): { text: string; parts: number } {
  const entries = readZipEntries(buffer, wanted);
  const text = entries
    .map((e) => stripXmlTags(e.data.toString("utf8")))
    .filter(Boolean)
    .join("\n\n");
  return { text, parts: entries.length };
}

/** Shared-strings-aware XLSX text (values + sheet text, bounded). */
function xlsxText(buffer: Buffer): string {
  const entries = readZipEntries(
    buffer,
    (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n),
  );
  const shared = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const sharedValues = shared
    ? Array.from(shared.data.toString("utf8").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) =>
        stripXmlTags(m[1], false),
      )
    : [];

  const sheets = entries.filter((e) => e.name.startsWith("xl/worksheets/"));
  const lines: string[] = [];
  for (const sheet of sheets) {
    const xml = sheet.data.toString("utf8");
    for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of rowMatch[1].matchAll(/<c[^>]*?(?:\st="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
        const type = cell[1];
        const inner = cell[2];
        const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
        if (type === "s") {
          const idx = Number(raw);
          cells.push(sharedValues[idx] ?? "");
        } else if (type === "inlineStr") {
          cells.push(stripXmlTags(inner, false));
        } else cells.push(raw);
      }
      if (cells.some((c) => c.trim())) lines.push(cells.join("\t"));
      if (lines.length > 20_000) break;
    }
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Extract readable text from an operator-supplied file. Never throws: a
 * malformed or unsupported document comes back with `ok: false` and a note.
 */
export function extractFile(filename: string, buffer: Buffer): FileExtraction {
  const safetyNotes: string[] = [];
  const base: Omit<FileExtraction, "kind" | "text" | "ok"> = {
    title: null,
    headings: [],
    note: null,
    byteSize: buffer.length,
    safetyNotes,
  };

  if (buffer.length === 0) {
    return { ...base, kind: "unsupported", text: "", ok: false, note: "file is empty" };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return {
      ...base,
      kind: "unsupported",
      text: "",
      ok: false,
      note: `file exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB ingestion limit`,
    };
  }

  const kind = detectFileKind(filename, buffer);
  const fallbackTitle =
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || null;

  const finish = (text: string, extra: Partial<FileExtraction> = {}): FileExtraction => {
    let out = text;
    if (out.length > MAX_TEXT_CHARS) {
      out = out.slice(0, MAX_TEXT_CHARS);
      safetyNotes.push(`extracted text truncated at ${MAX_TEXT_CHARS} characters`);
    }
    const ok = out.replace(/\s+/g, "").length >= 40;
    return {
      ...base,
      kind,
      text: out,
      ok,
      title: extra.title ?? fallbackTitle,
      headings: extra.headings ?? [],
      rows: extra.rows,
      data: extra.data,
      // A supplied note (malformed document, low-yield PDF) is kept even when
      // the extraction still produced usable text — it is provenance, not just
      // an error message.
      note: extra.note ?? (ok ? null : "no usable text could be extracted"),
      safetyNotes,
    };
  };

  try {
    switch (kind) {
      case "text":
        return finish(buffer.toString("utf8"));

      case "markdown": {
        const md = buffer.toString("utf8");
        const headings = markdownHeadings(md);
        return finish(md, { headings, title: headings[0] ?? fallbackTitle });
      }

      case "html": {
        const html = buffer.toString("utf8");
        if (/<script[\s>]/i.test(html)) {
          safetyNotes.push("document contained <script> blocks — stripped, never executed");
        }
        const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
        const headings = htmlHeadings(html);
        return finish(stripXmlTags(html), {
          title: title || headings[0] || fallbackTitle,
          headings,
        });
      }

      case "json": {
        const raw = buffer.toString("utf8");
        let data: unknown = null;
        try {
          data = JSON.parse(raw);
        } catch {
          return finish(raw, { note: "malformed JSON — ingested as plain text" });
        }
        const lines = jsonToText(data);
        const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const title =
          typeof rec.title === "string"
            ? rec.title
            : typeof rec.name === "string"
              ? rec.name
              : fallbackTitle;
        return finish(lines.join("\n"), { data, title });
      }

      case "xml": {
        const xml = buffer.toString("utf8");
        const title =
          /<title[^>]*>([\s\S]*?)<\/title>/i.exec(xml)?.[1]?.trim() ??
          /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(xml)?.[1]?.trim() ??
          null;
        return finish(stripXmlTags(xml), { title: title || fallbackTitle });
      }

      case "csv": {
        const raw = buffer.toString("utf8");
        const delimiter = filename.toLowerCase().endsWith(".tsv")
          ? "\t"
          : (raw.split("\n")[0]?.includes("\t") ?? false)
            ? "\t"
            : ",";
        const rows = parseDelimited(raw, delimiter);
        const text = rows
          .slice(0, 20_000)
          .map((r) => r.join(" | "))
          .join("\n");
        return finish(text, { rows, headings: rows[0]?.slice(0, 30) ?? [] });
      }

      case "pdf": {
        const pdf = extractPdfText(buffer);
        if (!pdf.ok) {
          return finish(pdf.text, {
            note:
              `PDF text extraction yielded little readable text (${pdf.decoded}/${pdf.streams} streams, ` +
              `${pdf.pages} page(s)) — likely a scanned or image-only document`,
          });
        }
        const firstLine =
          pdf.text
            .split("\n")
            .find((l) => l.trim().length > 8)
            ?.trim() ?? null;
        return finish(pdf.text, { title: firstLine ?? fallbackTitle });
      }

      case "docx": {
        if (zipHasActiveContent(buffer)) {
          safetyNotes.push("document contains macros — extracted as data only, never executed");
        }
        const { text } = officeTextFromZip(
          buffer,
          (n) =>
            n === "word/document.xml" ||
            /^word\/(header|footer)\d*\.xml$/.test(n) ||
            n === "docProps/core.xml",
        );
        return finish(text);
      }

      case "pptx": {
        if (zipHasActiveContent(buffer)) {
          safetyNotes.push("presentation contains macros — extracted as data only, never executed");
        }
        const { text } = officeTextFromZip(buffer, (n) =>
          /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(n),
        );
        return finish(text);
      }

      case "xlsx": {
        if (zipHasActiveContent(buffer)) {
          safetyNotes.push("workbook contains macros — extracted as data only, never executed");
        }
        const text = xlsxText(buffer);
        const rows = text.split("\n").map((l) => l.split("\t"));
        return finish(text, { rows });
      }

      case "odt": {
        if (zipHasActiveContent(buffer)) {
          safetyNotes.push("document contains macros — extracted as data only, never executed");
        }
        const { text } = officeTextFromZip(buffer, (n) => n === "content.xml" || n === "meta.xml");
        return finish(text);
      }

      default:
        return {
          ...base,
          kind: "unsupported",
          text: "",
          ok: false,
          note: `unsupported file type for "${filename}"`,
        };
    }
  } catch (err) {
    return {
      ...base,
      kind,
      text: "",
      ok: false,
      note: `extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
