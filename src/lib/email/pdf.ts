/**
 * Minimal PDF generator for the monthly Error Report.
 *
 * This module emits a valid PDF 1.4 document containing only text,
 * arranged into pages with a fixed-width Courier font and a header on
 * every page. No external dependencies — building a PDF this small is
 * cheaper and more auditable than pulling in jsPDF or pdfkit (both of
 * which transitively pull large amounts of font / image / canvas
 * machinery we don't need).
 *
 * The generated PDF passes the standard `pdfinfo` / Acrobat readers
 * because it follows the PDF spec for required objects:
 *
 *   1. Catalog (root)
 *   2. Pages tree
 *   3. One Page object per page, referencing a shared Font + content stream
 *   4. Content streams (text positioning + show operations)
 *   5. Font (Courier)
 *
 * Lines that contain `(`, `)`, or `\` are escaped because those have
 * special meaning inside PDF string literals; characters outside
 * Latin-1 are stripped so the PDF stays well-formed under the WinAnsi
 * encoding that Courier uses.
 */

const PAGE_WIDTH = 612; // 8.5"
const PAGE_HEIGHT = 792; // 11"
const MARGIN_LEFT = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const LINE_HEIGHT = 14;
const FONT_SIZE = 10;
const HEADER_FONT_SIZE = 14;
const HEADER_LINE_HEIGHT = 18;
const MAX_LINE_CHARS = 92; // 612 - 2*54 = 504pt; ~5.5pt per Courier glyph at 10pt → ~92
const LINES_PER_PAGE = Math.floor(
  (PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - HEADER_LINE_HEIGHT * 2) / LINE_HEIGHT,
);

function escapePdfString(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) {
      // Outside Latin-1 — replace with `?` so the WinAnsi encoding stays
      // valid. The raw bytes for non-Latin characters would otherwise
      // be interpreted incorrectly by Courier.
      out += "?";
      continue;
    }
    const ch = text[i];
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function wrapLine(line: string): string[] {
  if (line.length <= MAX_LINE_CHARS) return [line];
  const out: string[] = [];
  let remaining = line;
  while (remaining.length > MAX_LINE_CHARS) {
    out.push(remaining.slice(0, MAX_LINE_CHARS));
    remaining = remaining.slice(MAX_LINE_CHARS);
  }
  if (remaining.length > 0) out.push(remaining);
  return out;
}

function paginateLines(lines: string[]): string[][] {
  const wrapped: string[] = [];
  for (const raw of lines) {
    // PDF doesn't honor newlines inside a string literal — split first.
    for (const segment of raw.split(/\r?\n/)) {
      const expanded = wrapLine(segment);
      for (const w of expanded) wrapped.push(w);
    }
  }
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) {
    pages.push(wrapped.slice(i, i + LINES_PER_PAGE));
  }
  return pages.length > 0 ? pages : [[]];
}

function buildPageContent(header: string, lines: string[]): string {
  const headerY = PAGE_HEIGHT - MARGIN_TOP;
  const bodyStartY = headerY - HEADER_LINE_HEIGHT * 2;
  const headerCmd = [
    "BT",
    `/F2 ${HEADER_FONT_SIZE} Tf`,
    `${MARGIN_LEFT} ${headerY} Td`,
    `(${escapePdfString(header)}) Tj`,
    "ET",
  ].join("\n");
  const body = ["BT", `/F1 ${FONT_SIZE} Tf`, `${MARGIN_LEFT} ${bodyStartY} Td`];
  for (let i = 0; i < lines.length; i++) {
    const text = escapePdfString(lines[i]);
    if (i === 0) {
      body.push(`(${text}) Tj`);
    } else {
      body.push(`0 -${LINE_HEIGHT} Td`);
      body.push(`(${text}) Tj`);
    }
  }
  body.push("ET");
  return `${headerCmd}\n${body.join("\n")}\n`;
}

/**
 * Build a base64-encoded PDF containing the supplied lines under the
 * given title. Long lines wrap; large inputs flow across multiple
 * pages with the title repeated as a per-page header.
 */
export function buildTextPdfBase64(title: string, lines: string[]): string {
  const pages = paginateLines(lines);
  const objects: string[] = [];
  // 1: Catalog -> 2 (Pages)
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages -> kids = each Page object
  // We don't know the page object IDs yet, so fill in after.
  const pagesIndex = 1;
  // 3: Font (Courier, body)
  const fontIndex = 2;
  // 4: Font (Courier-Bold, header)
  const fontBoldIndex = 3;
  objects.push(""); // placeholder for Pages
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
  );

  const pageObjectIds: number[] = [];
  for (const lines of pages) {
    const content = buildPageContent(title, lines);
    const contentStreamId = objects.length + 1; // 1-indexed in PDF
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`,
    );
    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent ${pagesIndex + 1} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontIndex + 1} 0 R /F2 ${fontBoldIndex + 1} 0 R >> >> /Contents ${contentStreamId} 0 R >>`,
    );
  }

  // Backfill the Pages object now that we know each page's id.
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[pagesIndex] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`;

  // Assemble the PDF byte stream and an xref table.
  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) {
    pdf += `${o.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "binary").toString("base64");
}
