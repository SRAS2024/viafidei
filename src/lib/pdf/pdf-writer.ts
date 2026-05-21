/**
 * Low-level PDF 1.4 writer. Turns a list of pages — each a list of
 * primitive draw operations — into a valid PDF byte buffer.
 *
 * No external dependencies. The three standard Type-1 fonts used
 * (Helvetica, Helvetica-Bold, Courier) need no embedding: every
 * conformant PDF reader ships them. This keeps the Developer Audit
 * report self-contained and auditable, the same trade-off the existing
 * monthly Error Report generator (`src/lib/email/pdf.ts`) makes.
 *
 * All coordinates passed in use a TOP-LEFT origin with y growing
 * downward — the natural frame for a flowing report. The writer
 * converts to PDF's bottom-left origin internally.
 */

import type { PdfFont } from "./font-metrics";

/** RGB colour, each channel 0..1. */
export type PdfColor = [number, number, number];

export type PdfDrawOp =
  | {
      kind: "text";
      x: number;
      /** Baseline distance from the top of the page. */
      yTop: number;
      text: string;
      font: PdfFont;
      size: number;
      color?: PdfColor;
    }
  | {
      kind: "rect";
      x: number;
      /** Top edge distance from the top of the page. */
      yTop: number;
      w: number;
      h: number;
      fill?: PdfColor;
      stroke?: PdfColor;
      lineWidth?: number;
    }
  | {
      kind: "line";
      x1: number;
      y1Top: number;
      x2: number;
      y2Top: number;
      color?: PdfColor;
      lineWidth?: number;
    };

export const PDF_PAGE_WIDTH = 612; // US Letter, 8.5in
export const PDF_PAGE_HEIGHT = 792; // US Letter, 11in

const FONT_RESOURCE: Record<PdfFont, string> = {
  Helvetica: "F1",
  "Helvetica-Bold": "F2",
  Courier: "F3",
};

/** Round to 2dp and drop a trailing `.00` so the stream stays compact. */
function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/**
 * Common Unicode punctuation transliterated to its closest WinAnsi
 * equivalent. The standard fonts only encode Latin-1, so an em dash,
 * smart quote, or ellipsis would otherwise be dropped — these are
 * frequent in report copy, so they are mapped rather than lost.
 */
const UNICODE_FALLBACK: Record<string, string> = {
  "—": "-", // em dash
  "–": "-", // en dash
  "‒": "-", // figure dash
  "‘": "'", // left single quote
  "’": "'", // right single quote
  "‚": "'",
  "′": "'", // prime
  "“": '"', // left double quote
  "”": '"', // right double quote
  "„": '"',
  "″": '"', // double prime
  "…": "...", // ellipsis
  " ": " ", // non-breaking space
  "•": "·", // bullet -> middle dot (Latin-1)
  "→": "->", // rightwards arrow
};

/**
 * Escape a string for a PDF literal. Parentheses and backslashes carry
 * structural meaning and must be escaped; common Unicode punctuation is
 * transliterated to WinAnsi; any remaining character outside Latin-1 is
 * replaced with `?` so the WinAnsi encoding the fonts declare stays
 * well-formed.
 */
function escapePdfText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    if (code > 0xff) {
      out += UNICODE_FALLBACK[ch] ?? "?";
      continue;
    }
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += `\\${ch}`;
    } else if (ch === "\n" || ch === "\r" || ch === "\t") {
      out += " ";
    } else {
      out += ch;
    }
  }
  return out;
}

function colorOp(color: PdfColor, stroke: boolean): string {
  const [r, g, b] = color;
  return `${num(r)} ${num(g)} ${num(b)} ${stroke ? "RG" : "rg"}`;
}

/** Build the content stream for a single page. */
function buildPageStream(ops: PdfDrawOp[], pageHeight: number): string {
  const lines: string[] = [];
  for (const op of ops) {
    if (op.kind === "text") {
      const color = op.color ?? [0, 0, 0];
      lines.push("BT");
      lines.push(colorOp(color, false));
      lines.push(`/${FONT_RESOURCE[op.font]} ${num(op.size)} Tf`);
      lines.push(`1 0 0 1 ${num(op.x)} ${num(pageHeight - op.yTop)} Tm`);
      lines.push(`(${escapePdfText(op.text)}) Tj`);
      lines.push("ET");
    } else if (op.kind === "rect") {
      const bottomY = pageHeight - (op.yTop + op.h);
      const rect = `${num(op.x)} ${num(bottomY)} ${num(op.w)} ${num(op.h)} re`;
      if (op.fill && op.stroke) {
        lines.push(colorOp(op.fill, false));
        lines.push(colorOp(op.stroke, true));
        lines.push(`${num(op.lineWidth ?? 1)} w`);
        lines.push(`${rect} B`);
      } else if (op.fill) {
        lines.push(colorOp(op.fill, false));
        lines.push(`${rect} f`);
      } else if (op.stroke) {
        lines.push(colorOp(op.stroke, true));
        lines.push(`${num(op.lineWidth ?? 1)} w`);
        lines.push(`${rect} S`);
      }
    } else {
      const color = op.color ?? [0, 0, 0];
      lines.push(colorOp(color, true));
      lines.push(`${num(op.lineWidth ?? 1)} w`);
      lines.push(`${num(op.x1)} ${num(pageHeight - op.y1Top)} m`);
      lines.push(`${num(op.x2)} ${num(pageHeight - op.y2Top)} l`);
      lines.push("S");
    }
  }
  return lines.join("\n");
}

/**
 * Render the supplied pages to a PDF byte buffer. Each page is a flat
 * list of draw operations in top-left coordinates.
 */
export function renderPdf(
  pages: PdfDrawOp[][],
  options: { width?: number; height?: number } = {},
): Buffer {
  const width = options.width ?? PDF_PAGE_WIDTH;
  const height = options.height ?? PDF_PAGE_HEIGHT;
  const safePages = pages.length > 0 ? pages : [[]];

  // Fixed object layout:
  //   1 Catalog, 2 Pages, 3 Font Helvetica, 4 Font Helvetica-Bold,
  //   5 Font Courier, then (content, page) pairs.
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>"); // 1
  objects.push(""); // 2 — Pages, backfilled once page ids are known
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); // 3
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ); // 4
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"); // 5

  const pageObjectIds: number[] = [];
  for (const ops of safePages) {
    const stream = buildPageStream(ops, height);
    const contentId = objects.length + 1;
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`,
    );
  }

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "binary");
}
