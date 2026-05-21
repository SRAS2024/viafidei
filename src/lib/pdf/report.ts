/**
 * Report layout engine for the Developer Audit PDF.
 *
 * A `ReportBuilder` accumulates content blocks — sections, headings,
 * paragraphs, key/value tables, data tables, status badges — and
 * `build()` flows them onto US-Letter pages, producing a polished,
 * readable PDF that mirrors the admin console's paper / serif
 * aesthetic.
 *
 * The engine handles the things a debugging report needs:
 *   • a generated table of contents on the first page, with real page
 *     numbers resolved by a two-pass layout;
 *   • a report masthead (title, period, environment, version, …);
 *   • running headers + "Page N of M" footers on every page;
 *   • tables that flow across many pages without splitting a row,
 *     repeating their header row on each new page;
 *   • status badges colour-matched to the admin diagnostics UI.
 *
 * It depends only on the dependency-free `pdf-writer` + `font-metrics`
 * modules in this folder.
 */

import { measureText, truncateToWidth, wrapText, type PdfFont } from "./font-metrics";
import {
  renderPdf,
  PDF_PAGE_HEIGHT,
  PDF_PAGE_WIDTH,
  type PdfColor,
  type PdfDrawOp,
} from "./pdf-writer";

// ─── Geometry ───────────────────────────────────────────────────────

const MARGIN = 56;
const HEADER_BAND = 34;
const FOOTER_BAND = 30;
const CONTENT_LEFT = MARGIN;
const CONTENT_RIGHT = PDF_PAGE_WIDTH - MARGIN;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
const CONTENT_TOP = MARGIN + HEADER_BAND;
const CONTENT_BOTTOM = PDF_PAGE_HEIGHT - MARGIN - FOOTER_BAND;

// ─── Palette (matches the admin email + diagnostics aesthetic) ──────

function hex(value: string): PdfColor {
  const v = value.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255,
  ];
}

const INK = hex("#111111");
const INK_SOFT = hex("#2a2a2a");
const INK_FAINT = hex("#4a4a4a");
const PAPER = hex("#fbf8f1");
const PAPER_WARM = hex("#f5efe3");
const RULE = hex("#d8d2c4");
const TABLE_HEAD = hex("#efe7d4");
const ZEBRA = hex("#f7f3ea");

export type ReportStatus = "pass" | "warn" | "fail" | "error" | "skipped" | "info";

const BADGE: Record<ReportStatus, { bg: PdfColor; fg: PdfColor; label: string }> = {
  pass: { bg: hex("#d1fae5"), fg: hex("#065f46"), label: "PASS" },
  warn: { bg: hex("#fef3c7"), fg: hex("#92400e"), label: "WARN" },
  fail: { bg: hex("#fee2e2"), fg: hex("#991b1b"), label: "FAIL" },
  error: { bg: hex("#fecaca"), fg: hex("#7f1d1d"), label: "ERROR" },
  skipped: { bg: hex("#eceae3"), fg: hex("#44403c"), label: "SKIPPED" },
  info: { bg: hex("#e0e7ff"), fg: hex("#3730a3"), label: "INFO" },
};

/** Normalise an arbitrary status-ish string to a known badge bucket. */
export function toReportStatus(value: string | null | undefined): ReportStatus {
  const v = (value ?? "").toLowerCase();
  if (v === "pass" || v === "ok" || v === "success" || v === "healthy") return "pass";
  if (v === "warn" || v === "warning" || v === "degraded") return "warn";
  if (v === "fail" || v === "failed" || v === "failing" || v === "critical") return "fail";
  if (v === "error") return "error";
  if (v === "skipped" || v === "skip" || v === "unknown") return "skipped";
  return "info";
}

// ─── Type sizes ─────────────────────────────────────────────────────

const SIZE = {
  mastheadTitle: 23,
  mastheadSub: 9,
  sectionEyebrow: 7.5,
  sectionTitle: 17,
  heading: 12,
  subheading: 10.5,
  body: 9.5,
  tableHead: 8.5,
  tableCell: 8.5,
  badge: 7.5,
  small: 7.5,
  toc: 10,
};
const LEADING = 1.38;

// ─── Block model ────────────────────────────────────────────────────

export type TableColumn = {
  header: string;
  /** Relative weight; columns are normalised to the content width. */
  weight: number;
  align?: "left" | "right";
};

/** A table cell is plain text or a coloured status badge. */
export type TableCell = string | { badge: string };

export type KeyValueRow = { label: string; value: string };

type Block =
  | { type: "sectionTitle"; id: string; title: string; eyebrow?: string }
  | { type: "subsectionTitle"; id: string; title: string }
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "note"; text: string }
  | { type: "keyValue"; rows: KeyValueRow[] }
  | { type: "statusLine"; label: string; status: ReportStatus; detail?: string }
  | { type: "table"; columns: TableColumn[]; rows: TableCell[][] }
  | { type: "spacer"; height: number }
  | { type: "divider" };

export type TocEntry = { id: string; title: string; level: 0 | 1 };

export type ReportMasthead = {
  reportTitle: string;
  period: string;
  generatedAt: string;
  environment: string;
  appName: string;
  dashboardSection: string;
  reportVersion: string;
};

// ─── Cursor ─────────────────────────────────────────────────────────

type Cursor = {
  pages: PdfDrawOp[][];
  index: number;
  y: number;
};

function freshCursor(): Cursor {
  return { pages: [[]], index: 0, y: CONTENT_TOP };
}

function ops(c: Cursor): PdfDrawOp[] {
  return c.pages[c.index];
}

function newPage(c: Cursor): void {
  c.pages.push([]);
  c.index += 1;
  c.y = CONTENT_TOP;
}

function ensureSpace(c: Cursor, height: number): void {
  if (c.y + height > CONTENT_BOTTOM && c.y > CONTENT_TOP) {
    newPage(c);
  }
}

// ─── Primitive drawing ──────────────────────────────────────────────

function drawText(
  c: Cursor,
  text: string,
  x: number,
  font: PdfFont,
  size: number,
  color: PdfColor,
): void {
  ops(c).push({ kind: "text", x, yTop: c.y, text, font, size, color });
}

function drawTextRight(
  c: Cursor,
  text: string,
  rightX: number,
  font: PdfFont,
  size: number,
  color: PdfColor,
): void {
  const w = measureText(text, font, size);
  ops(c).push({ kind: "text", x: rightX - w, yTop: c.y, text, font, size, color });
}

/**
 * Draw a wrapped paragraph starting at the cursor, breaking pages as
 * needed. Advances the cursor past the last line.
 */
function drawWrapped(
  c: Cursor,
  text: string,
  x: number,
  width: number,
  font: PdfFont,
  size: number,
  color: PdfColor,
): void {
  const lineHeight = size * LEADING;
  for (const line of wrapText(text, font, size, width)) {
    ensureSpace(c, lineHeight);
    c.y += size;
    drawText(c, line, x, font, size, color);
    c.y += lineHeight - size;
  }
}

/** Draw a status badge; returns its width. */
function drawBadge(c: Cursor, status: ReportStatus, x: number, topY: number): number {
  const spec = BADGE[status];
  const padX = 5;
  const textW = measureText(spec.label, "Helvetica-Bold", SIZE.badge);
  const w = textW + padX * 2;
  const h = SIZE.badge + 6;
  ops(c).push({ kind: "rect", x, yTop: topY, w, h, fill: spec.bg });
  ops(c).push({
    kind: "text",
    x: x + padX,
    yTop: topY + h - 4.5,
    text: spec.label,
    font: "Helvetica-Bold",
    size: SIZE.badge,
    color: spec.fg,
  });
  return w;
}

function drawRule(c: Cursor, color: PdfColor = RULE): void {
  ops(c).push({
    kind: "line",
    x1: CONTENT_LEFT,
    y1Top: c.y,
    x2: CONTENT_RIGHT,
    y2Top: c.y,
    color,
    lineWidth: 0.75,
  });
}

// ─── Block renderers ────────────────────────────────────────────────

function renderSectionTitle(
  c: Cursor,
  block: Extract<Block, { type: "sectionTitle" }>,
  anchors: Map<string, number>,
): void {
  // Top-level sections always start a fresh page for clean breaks.
  if (c.y > CONTENT_TOP) newPage(c);
  anchors.set(block.id, c.index);
  if (block.eyebrow) {
    c.y += SIZE.sectionEyebrow;
    drawText(
      c,
      block.eyebrow.toUpperCase(),
      CONTENT_LEFT,
      "Helvetica-Bold",
      SIZE.sectionEyebrow,
      INK_FAINT,
    );
    c.y += 8;
  }
  c.y += SIZE.sectionTitle;
  drawText(c, block.title, CONTENT_LEFT, "Helvetica-Bold", SIZE.sectionTitle, INK);
  c.y += 8;
  drawRule(c, INK);
  c.y += 16;
}

function renderSubsectionTitle(
  c: Cursor,
  block: Extract<Block, { type: "subsectionTitle" }>,
  anchors: Map<string, number>,
): void {
  // Keep a subsection heading with at least a little of its body.
  ensureSpace(c, SIZE.subheading * 3 + 24);
  c.y += 10;
  anchors.set(block.id, c.index);
  c.y += SIZE.heading;
  drawText(c, block.title, CONTENT_LEFT, "Helvetica-Bold", SIZE.heading, INK_SOFT);
  c.y += 5;
  drawRule(c);
  c.y += 12;
}

function renderHeading(c: Cursor, text: string): void {
  ensureSpace(c, SIZE.heading * 3);
  c.y += 6 + SIZE.heading;
  drawText(c, text, CONTENT_LEFT, "Helvetica-Bold", SIZE.heading, INK);
  c.y += 8;
}

function renderSubheading(c: Cursor, text: string): void {
  ensureSpace(c, SIZE.subheading * 3);
  c.y += 4 + SIZE.subheading;
  drawText(c, text, CONTENT_LEFT, "Helvetica-Bold", SIZE.subheading, INK_SOFT);
  c.y += 6;
}

function renderParagraph(c: Cursor, text: string): void {
  drawWrapped(c, text, CONTENT_LEFT, CONTENT_WIDTH, "Helvetica", SIZE.body, INK_SOFT);
  c.y += 4;
}

function renderNote(c: Cursor, text: string): void {
  const h = SIZE.body * LEADING + 8;
  ensureSpace(c, h);
  ops(c).push({ kind: "rect", x: CONTENT_LEFT, yTop: c.y, w: CONTENT_WIDTH, h, fill: PAPER_WARM });
  c.y += 4 + SIZE.body;
  drawText(c, text, CONTENT_LEFT + 8, "Helvetica", SIZE.body, INK_FAINT);
  c.y += h - SIZE.body;
}

function renderStatusLine(c: Cursor, block: Extract<Block, { type: "statusLine" }>): void {
  const badgeH = SIZE.badge + 6;
  ensureSpace(c, badgeH + 6);
  const topY = c.y;
  const badgeW = drawBadge(c, block.status, CONTENT_LEFT, topY);
  const labelX = CONTENT_LEFT + badgeW + 8;
  ops(c).push({
    kind: "text",
    x: labelX,
    yTop: topY + badgeH - 4.5,
    text: truncateToWidth(block.label, "Helvetica-Bold", SIZE.subheading, CONTENT_RIGHT - labelX),
    font: "Helvetica-Bold",
    size: SIZE.subheading,
    color: INK,
  });
  c.y = topY + badgeH + 4;
  if (block.detail) {
    drawWrapped(c, block.detail, CONTENT_LEFT, CONTENT_WIDTH, "Helvetica", SIZE.small, INK_FAINT);
  }
  c.y += 2;
}

function renderKeyValue(c: Cursor, rows: KeyValueRow[]): void {
  if (rows.length === 0) return;
  const labelW = 168;
  const valueX = CONTENT_LEFT + labelW + 10;
  const valueW = CONTENT_RIGHT - valueX;
  const rowPad = 5;
  for (const row of rows) {
    const valueLines = wrapText(row.value || "—", "Helvetica", SIZE.body, valueW);
    const rowH = Math.max(1, valueLines.length) * SIZE.body * LEADING + rowPad;
    ensureSpace(c, rowH);
    const topY = c.y;
    ops(c).push({
      kind: "rect",
      x: CONTENT_LEFT,
      yTop: topY,
      w: CONTENT_WIDTH,
      h: rowH,
      stroke: RULE,
      lineWidth: 0.5,
    });
    let lineY = topY + rowPad + SIZE.body;
    ops(c).push({
      kind: "text",
      x: CONTENT_LEFT + rowPad,
      yTop: lineY,
      text: truncateToWidth(row.label, "Helvetica-Bold", SIZE.body, labelW - rowPad),
      font: "Helvetica-Bold",
      size: SIZE.body,
      color: INK_SOFT,
    });
    for (const line of valueLines) {
      ops(c).push({
        kind: "text",
        x: valueX,
        yTop: lineY,
        text: line,
        font: "Helvetica",
        size: SIZE.body,
        color: INK,
      });
      lineY += SIZE.body * LEADING;
    }
    c.y = topY + rowH;
  }
  c.y += 4;
}

function cellText(cell: TableCell): string {
  return typeof cell === "string" ? cell : "";
}

function renderTable(c: Cursor, columns: TableColumn[], rows: TableCell[][]): void {
  const totalWeight = columns.reduce((s, col) => s + col.weight, 0) || 1;
  const colWidths = columns.map((col) => (col.weight / totalWeight) * CONTENT_WIDTH);
  const cellPad = 4;
  const headH = SIZE.tableHead + 10;
  const lineH = SIZE.tableCell * LEADING;

  const drawHeader = (): void => {
    const topY = c.y;
    ops(c).push({
      kind: "rect",
      x: CONTENT_LEFT,
      yTop: topY,
      w: CONTENT_WIDTH,
      h: headH,
      fill: TABLE_HEAD,
    });
    let x = CONTENT_LEFT;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const w = colWidths[i];
      const label = truncateToWidth(
        col.header.toUpperCase(),
        "Helvetica-Bold",
        SIZE.tableHead,
        w - cellPad * 2,
      );
      const textX =
        col.align === "right"
          ? x + w - cellPad - measureText(label, "Helvetica-Bold", SIZE.tableHead)
          : x + cellPad;
      ops(c).push({
        kind: "text",
        x: textX,
        yTop: topY + headH - 6,
        text: label,
        font: "Helvetica-Bold",
        size: SIZE.tableHead,
        color: INK_SOFT,
      });
      x += w;
    }
    c.y = topY + headH;
  };

  ensureSpace(c, headH + lineH + 6);
  drawHeader();

  let zebra = false;
  for (const row of rows) {
    // Measure the row: tallest wrapped cell.
    let maxLines = 1;
    const wrappedCells: string[][] = [];
    for (let i = 0; i < columns.length; i++) {
      const w = colWidths[i] - cellPad * 2;
      const text = cellText(row[i] ?? "");
      const lines =
        typeof row[i] === "object" ? [""] : wrapText(text, "Helvetica", SIZE.tableCell, w);
      wrappedCells.push(lines);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const rowH = maxLines * lineH + 6;

    // A row never splits across a page — break first if it will not fit.
    if (c.y + rowH > CONTENT_BOTTOM) {
      newPage(c);
      drawHeader();
      zebra = false;
    }

    const topY = c.y;
    if (zebra) {
      ops(c).push({
        kind: "rect",
        x: CONTENT_LEFT,
        yTop: topY,
        w: CONTENT_WIDTH,
        h: rowH,
        fill: ZEBRA,
      });
    }
    zebra = !zebra;

    let x = CONTENT_LEFT;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const w = colWidths[i];
      const cell = row[i];
      if (typeof cell === "object" && cell) {
        drawBadge(c, toReportStatus(cell.badge), x + cellPad, topY + 3);
      } else {
        let lineY = topY + 3 + SIZE.tableCell;
        for (const line of wrappedCells[i]) {
          const textX =
            col.align === "right"
              ? x + w - cellPad - measureText(line, "Helvetica", SIZE.tableCell)
              : x + cellPad;
          ops(c).push({
            kind: "text",
            x: textX,
            yTop: lineY,
            text: line,
            font: "Helvetica",
            size: SIZE.tableCell,
            color: INK,
          });
          lineY += lineH;
        }
      }
      x += w;
    }
    ops(c).push({
      kind: "line",
      x1: CONTENT_LEFT,
      y1Top: topY + rowH,
      x2: CONTENT_RIGHT,
      y2Top: topY + rowH,
      color: RULE,
      lineWidth: 0.5,
    });
    c.y = topY + rowH;
  }
  c.y += 6;
}

function renderBlock(c: Cursor, block: Block, anchors: Map<string, number>): void {
  switch (block.type) {
    case "sectionTitle":
      renderSectionTitle(c, block, anchors);
      break;
    case "subsectionTitle":
      renderSubsectionTitle(c, block, anchors);
      break;
    case "heading":
      renderHeading(c, block.text);
      break;
    case "subheading":
      renderSubheading(c, block.text);
      break;
    case "paragraph":
      renderParagraph(c, block.text);
      break;
    case "note":
      renderNote(c, block.text);
      break;
    case "keyValue":
      renderKeyValue(c, block.rows);
      break;
    case "statusLine":
      renderStatusLine(c, block);
      break;
    case "table":
      renderTable(c, block.columns, block.rows);
      break;
    case "spacer":
      c.y += block.height;
      break;
    case "divider":
      ensureSpace(c, 10);
      c.y += 5;
      drawRule(c);
      c.y += 5;
      break;
  }
}

// ─── Front matter (masthead + table of contents) ────────────────────

function renderFrontMatter(
  masthead: ReportMasthead,
  tocEntries: Array<TocEntry & { pageNumber: number }>,
): PdfDrawOp[][] {
  const c = freshCursor();

  // Masthead band.
  const bandH = 150;
  ops(c).push({
    kind: "rect",
    x: CONTENT_LEFT,
    yTop: c.y,
    w: CONTENT_WIDTH,
    h: bandH,
    fill: PAPER,
  });
  ops(c).push({
    kind: "rect",
    x: CONTENT_LEFT,
    yTop: c.y,
    w: CONTENT_WIDTH,
    h: bandH,
    stroke: RULE,
    lineWidth: 0.75,
  });
  const bandTop = c.y;
  c.y += 22;
  drawText(
    c,
    masthead.appName.toUpperCase(),
    CONTENT_LEFT + 18,
    "Helvetica-Bold",
    SIZE.sectionEyebrow,
    INK_FAINT,
  );
  c.y += 14 + SIZE.mastheadTitle;
  drawText(c, masthead.reportTitle, CONTENT_LEFT + 18, "Helvetica-Bold", SIZE.mastheadTitle, INK);
  c.y += 12;

  const facts: Array<[string, string]> = [
    ["Time period", masthead.period],
    ["Generated", masthead.generatedAt],
    ["Environment", masthead.environment],
    ["Application", masthead.appName],
    ["Dashboard section", masthead.dashboardSection],
    ["Report version", masthead.reportVersion],
  ];
  const colW = CONTENT_WIDTH / 2 - 18;
  for (let i = 0; i < facts.length; i++) {
    const [label, value] = facts[i];
    const col = i % 2;
    const rowY = c.y + Math.floor(i / 2) * 22;
    const fx = CONTENT_LEFT + 18 + col * (colW + 8);
    ops(c).push({
      kind: "text",
      x: fx,
      yTop: rowY + SIZE.small,
      text: label.toUpperCase(),
      font: "Helvetica-Bold",
      size: 6.8,
      color: INK_FAINT,
    });
    ops(c).push({
      kind: "text",
      x: fx,
      yTop: rowY + SIZE.small + 11,
      text: truncateToWidth(value, "Helvetica", SIZE.body, colW),
      font: "Helvetica",
      size: SIZE.body,
      color: INK,
    });
  }
  c.y = bandTop + bandH + 28;

  // Table of contents.
  c.y += SIZE.sectionTitle;
  drawText(c, "Table of Contents", CONTENT_LEFT, "Helvetica-Bold", SIZE.sectionTitle, INK);
  c.y += 8;
  drawRule(c, INK);
  c.y += 16;

  for (const entry of tocEntries) {
    const rowH = SIZE.toc * LEADING + 4;
    ensureSpace(c, rowH);
    c.y += SIZE.toc;
    const indent = entry.level === 1 ? 18 : 0;
    const font: PdfFont = entry.level === 0 ? "Helvetica-Bold" : "Helvetica";
    const color = entry.level === 0 ? INK : INK_SOFT;
    const title = entry.title;
    const pageLabel = String(entry.pageNumber);
    const pageW = measureText(pageLabel, "Helvetica", SIZE.toc);
    const titleMaxW = CONTENT_WIDTH - indent - pageW - 16;
    const shownTitle = truncateToWidth(title, font, SIZE.toc, titleMaxW);
    drawText(c, shownTitle, CONTENT_LEFT + indent, font, SIZE.toc, color);
    // Dotted leader.
    const titleW = measureText(shownTitle, font, SIZE.toc);
    const leaderStart = CONTENT_LEFT + indent + titleW + 4;
    const leaderEnd = CONTENT_RIGHT - pageW - 4;
    if (leaderEnd > leaderStart) {
      ops(c).push({
        kind: "line",
        x1: leaderStart,
        y1Top: c.y - 2,
        x2: leaderEnd,
        y2Top: c.y - 2,
        color: RULE,
        lineWidth: 0.5,
      });
    }
    drawTextRight(c, pageLabel, CONTENT_RIGHT, "Helvetica", SIZE.toc, color);
    c.y += rowH - SIZE.toc;
  }

  return c.pages;
}

// ─── Page decoration (running header + footer) ──────────────────────

function decoratePage(
  page: PdfDrawOp[],
  pageNumber: number,
  totalPages: number,
  masthead: ReportMasthead,
): PdfDrawOp[] {
  const header: PdfDrawOp[] = [
    {
      kind: "text",
      x: CONTENT_LEFT,
      yTop: MARGIN + 4,
      text: `${masthead.reportTitle} — ${masthead.period}`,
      font: "Helvetica-Bold",
      size: SIZE.small,
      color: INK_FAINT,
    },
    {
      kind: "text",
      x: CONTENT_RIGHT - measureText(masthead.appName, "Helvetica", SIZE.small),
      yTop: MARGIN + 4,
      text: masthead.appName,
      font: "Helvetica",
      size: SIZE.small,
      color: INK_FAINT,
    },
    {
      kind: "line",
      x1: CONTENT_LEFT,
      y1Top: MARGIN + 12,
      x2: CONTENT_RIGHT,
      y2Top: MARGIN + 12,
      color: RULE,
      lineWidth: 0.5,
    },
  ];
  const footerY = PDF_PAGE_HEIGHT - MARGIN - 8;
  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  const footer: PdfDrawOp[] = [
    {
      kind: "line",
      x1: CONTENT_LEFT,
      y1Top: footerY - 12,
      x2: CONTENT_RIGHT,
      y2Top: footerY - 12,
      color: RULE,
      lineWidth: 0.5,
    },
    {
      kind: "text",
      x: CONTENT_LEFT,
      yTop: footerY,
      text: masthead.appName,
      font: "Helvetica",
      size: SIZE.small,
      color: INK_FAINT,
    },
    {
      kind: "text",
      x: (PDF_PAGE_WIDTH - measureText(pageLabel, "Helvetica", SIZE.small)) / 2,
      yTop: footerY,
      text: pageLabel,
      font: "Helvetica",
      size: SIZE.small,
      color: INK_FAINT,
    },
    {
      kind: "text",
      x: CONTENT_RIGHT - measureText(masthead.generatedAt, "Helvetica", SIZE.small),
      yTop: footerY,
      text: masthead.generatedAt,
      font: "Helvetica",
      size: SIZE.small,
      color: INK_FAINT,
    },
  ];
  return [...header, ...page, ...footer];
}

// ─── Builder ────────────────────────────────────────────────────────

export class ReportBuilder {
  private readonly masthead: ReportMasthead;
  private readonly blocks: Block[] = [];
  private readonly toc: TocEntry[] = [];
  private anchorSeq = 0;

  constructor(masthead: ReportMasthead) {
    this.masthead = masthead;
  }

  /** Begin a top-level section (starts on a fresh page; TOC anchor). */
  section(title: string, eyebrow?: string): this {
    const id = `sec-${this.anchorSeq++}`;
    this.blocks.push({ type: "sectionTitle", id, title, eyebrow });
    this.toc.push({ id, title, level: 0 });
    return this;
  }

  /** Begin a subsection (flows inline; nested TOC anchor). */
  subsection(title: string): this {
    const id = `sub-${this.anchorSeq++}`;
    this.blocks.push({ type: "subsectionTitle", id, title });
    this.toc.push({ id, title, level: 1 });
    return this;
  }

  heading(text: string): this {
    this.blocks.push({ type: "heading", text });
    return this;
  }

  subheading(text: string): this {
    this.blocks.push({ type: "subheading", text });
    return this;
  }

  paragraph(text: string): this {
    this.blocks.push({ type: "paragraph", text });
    return this;
  }

  note(text: string): this {
    this.blocks.push({ type: "note", text });
    return this;
  }

  keyValue(rows: KeyValueRow[]): this {
    this.blocks.push({ type: "keyValue", rows });
    return this;
  }

  statusLine(label: string, status: ReportStatus, detail?: string): this {
    this.blocks.push({ type: "statusLine", label, status, detail });
    return this;
  }

  table(columns: TableColumn[], rows: TableCell[][]): this {
    this.blocks.push({ type: "table", columns, rows });
    return this;
  }

  spacer(height = 8): this {
    this.blocks.push({ type: "spacer", height });
    return this;
  }

  divider(): this {
    this.blocks.push({ type: "divider" });
    return this;
  }

  /** Number of TOC entries — exposed for tests. */
  get sectionCount(): number {
    return this.toc.length;
  }

  /** Lay everything out and return the finished PDF bytes. */
  build(): Buffer {
    // Pass 1 — flow the body, recording the page each section lands on.
    const bodyCursor = freshCursor();
    const anchors = new Map<string, number>();
    for (const block of this.blocks) {
      renderBlock(bodyCursor, block, anchors);
    }
    const bodyPages = bodyCursor.pages;

    // Pass 2 — flow the front matter once to learn its page count.
    const probeEntries = this.toc.map((e) => ({ ...e, pageNumber: 1 }));
    const probeFront = renderFrontMatter(this.masthead, probeEntries);
    const frontCount = probeFront.length;

    // Pass 3 — flow the front matter with the resolved page numbers.
    const finalEntries = this.toc.map((e) => ({
      ...e,
      pageNumber: frontCount + (anchors.get(e.id) ?? 0) + 1,
    }));
    const frontPages = renderFrontMatter(this.masthead, finalEntries);

    const allPages = [...frontPages, ...bodyPages];
    const total = allPages.length;
    const decorated = allPages.map((page, i) => decoratePage(page, i + 1, total, this.masthead));
    return renderPdf(decorated);
  }
}
