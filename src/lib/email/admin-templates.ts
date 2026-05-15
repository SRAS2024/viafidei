import { escapeHtml, type RenderedEmail, SITE_NAME } from "./templates";

/**
 * Admin email rendering — uses the same paper / serif aesthetic as the
 * account emails (welcome, verify, reset) so every message that leaves
 * Via Fidei looks the same in the recipient's inbox. Differences:
 *
 *   • The greeting always reads `Admin` (never the recipient's name).
 *     Operational alerts are sent to a single mailbox by definition;
 *     personalising them would only obscure the alert.
 *   • The body can carry a structured table (Content Management Report,
 *     Monthly Archive Cleanup) rendered in HTML with a plaintext
 *     fallback that also lays the same numbers out as a column table.
 *   • There is no CTA button — admin emails are pure status reports.
 *
 * Subjects are passed in by the caller because the requirements pin
 * them exactly:
 *   - "Biweekly Admin Report"
 *   - "Monthly Archive Cleaning Up"
 *   - "Critical Failure"
 *   - "Security Breach"
 *   - "Error Report"
 *   - "<Content Type> Threshold Reached" (per-milestone)
 */

const COLOR_INK = "#111111";
const COLOR_INK_SOFT = "#2a2a2a";
const COLOR_INK_FAINT = "#4a4a4a";
const COLOR_PAPER = "#fbf8f1";
const COLOR_PAPER_WARM = "#f5efe3";
const COLOR_RULE = "rgba(17,17,17,0.18)";
const COLOR_TABLE_HEAD = "#efe7d4";

function crossLogoSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="70" viewBox="0 0 64 80" role="img" aria-label="Via Fidei">',
    `<path d="M28 4 Q32 3.4 36 4 L36 23 L60 23 Q60.4 24 60 25 L60 31 Q60.4 32 60 33 L36 33 L36 75 Q36.4 77 36 77.6 Q34 78.4 32 78.4 Q30 78.4 28 77.6 Q27.6 77 28 75 L28 33 L4 33 Q3.6 32 4 31 L4 25 Q3.6 24 4 23 L28 23 Z" fill="none" stroke="${COLOR_INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`,
    "</svg>",
  ].join("");
}

export type AdminTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type AdminTableRow = Record<string, string>;

export type AdminEmailSection = {
  /** Optional heading rendered above the body / table for this section. */
  title?: string;
  /** Free-text paragraphs rendered inside the section. */
  paragraphs?: string[];
  /** Optional table; when present, columns + rows are rendered as <table>. */
  table?: {
    columns: AdminTableColumn[];
    rows: AdminTableRow[];
  };
};

export type AdminEmailParams = {
  /** Email subject line. */
  subject: string;
  /** Heading shown at the top of the email body (often matches subject). */
  heading: string;
  /**
   * The lead paragraph after `Admin,`. Keep it to a sentence — the
   * detail belongs in the structured sections below.
   */
  intro: string;
  /** Structured body — paragraphs / tables below the intro. */
  sections?: AdminEmailSection[];
  /** Tail-line that closes the message. Defaults to a "no action required" note. */
  signoff?: string;
};

/**
 * Format a signed integer for the Content Management Report tables.
 * A positive number gets a leading `+`; zero is just `0`. The "deleted"
 * column instead uses a leading `-`; we keep both formatters explicit
 * so the call sites stay readable.
 */
export function formatAdded(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return `+${n}`;
}

export function formatDeleted(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return `-${n}`;
}

export function formatPlain(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return String(n);
}

function renderHtmlTable(table: NonNullable<AdminEmailSection["table"]>): string {
  const head = table.columns
    .map(
      (c) =>
        `<th style="padding: 8px 12px; text-align: ${c.align ?? "left"}; font-family: 'Inter', Arial, sans-serif; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: ${COLOR_INK_SOFT}; background: ${COLOR_TABLE_HEAD}; border-bottom: 1px solid ${COLOR_RULE};">${escapeHtml(c.label)}</th>`,
    )
    .join("");

  const body = table.rows
    .map((row) => {
      const cells = table.columns
        .map((c) => {
          const value = row[c.key] ?? "";
          return `<td style="padding: 8px 12px; text-align: ${c.align ?? "left"}; font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: ${COLOR_INK}; border-bottom: 1px solid ${COLOR_RULE};">${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return [
    '<table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid ',
    COLOR_RULE,
    ';">',
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    "</table>",
  ].join("");
}

function renderHtmlSection(section: AdminEmailSection): string {
  const heading = section.title
    ? `<h2 style="margin: 24px 0 8px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 20px; color: ${COLOR_INK};">${escapeHtml(section.title)}</h2>`
    : "";
  const paragraphs = (section.paragraphs ?? [])
    .map(
      (p) =>
        `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.55; color: ${COLOR_INK_SOFT};">${escapeHtml(p)}</p>`,
    )
    .join("");
  const table = section.table ? renderHtmlTable(section.table) : "";
  return `${heading}${paragraphs}${table}`;
}

function renderTextTable(table: NonNullable<AdminEmailSection["table"]>): string {
  const headers = table.columns.map((c) => c.label);
  const rows = table.rows.map((r) => table.columns.map((c) => r[c.key] ?? ""));
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const renderRow = (cells: string[]) =>
    cells
      .map((cell, i) =>
        (table.columns[i].align ?? "left") === "right"
          ? cell.padStart(widths[i])
          : cell.padEnd(widths[i]),
      )
      .join("  ");
  const divider = widths.map((w) => "-".repeat(w)).join("  ");
  return [renderRow(headers), divider, ...rows.map(renderRow)].join("\n");
}

function renderTextSection(section: AdminEmailSection): string {
  const lines: string[] = [];
  if (section.title) {
    lines.push("");
    lines.push(section.title);
    lines.push("-".repeat(section.title.length));
  }
  for (const p of section.paragraphs ?? []) {
    lines.push(p);
    lines.push("");
  }
  if (section.table) {
    lines.push(renderTextTable(section.table));
    lines.push("");
  }
  return lines.join("\n");
}

export function renderAdminEmail(params: AdminEmailParams): RenderedEmail {
  const subject = params.subject;
  const signoff = params.signoff ?? "No action required unless the report shows otherwise.";
  const sectionsHtml = (params.sections ?? []).map(renderHtmlSection).join("\n");
  const sectionsText = (params.sections ?? []).map(renderTextSection).join("\n");

  const htmlBody = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(params.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${COLOR_PAPER_WARM}; color: ${COLOR_INK}; font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">${escapeHtml(subject)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLOR_PAPER_WARM};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width: 640px; width: 100%; background: ${COLOR_PAPER}; border: 1px solid ${COLOR_RULE};">
          <tr>
            <td align="center" style="padding: 36px 32px 8px;">
              <div style="margin: 0 auto;">${crossLogoSvg()}</div>
              <p style="margin: 14px 0 0; font-family: 'Inter', Arial, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: ${COLOR_INK_FAINT};">${escapeHtml(SITE_NAME)} — Admin</p>
              <hr style="border: 0; border-top: 1px solid ${COLOR_RULE}; width: 60px; margin: 16px auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 40px 32px;">
              <h1 style="margin: 0 0 12px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 26px; color: ${COLOR_INK}; text-align: left;">${escapeHtml(params.heading)}</h1>
              <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.55; color: ${COLOR_INK_SOFT};">Admin,</p>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.55; color: ${COLOR_INK_SOFT};">${escapeHtml(params.intro)}</p>
              ${sectionsHtml}
              <p style="margin: 24px 0 0; font-size: 14px; color: ${COLOR_INK_FAINT};">${escapeHtml(signoff)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 32px 32px; border-top: 1px solid ${COLOR_RULE};">
              <p style="margin: 0; font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: ${COLOR_INK_FAINT};">${escapeHtml(SITE_NAME)} operational notification — generated automatically.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines: string[] = [];
  textLines.push(`${SITE_NAME} — Admin`);
  textLines.push("=".repeat(SITE_NAME.length + 8));
  textLines.push("");
  textLines.push(params.heading);
  textLines.push("");
  textLines.push("Admin,");
  textLines.push("");
  textLines.push(params.intro);
  if (sectionsText.trim().length > 0) {
    textLines.push("");
    textLines.push(sectionsText);
  }
  textLines.push("");
  textLines.push(signoff);
  textLines.push("");
  textLines.push("--");
  textLines.push(`${SITE_NAME} operational notification — generated automatically.`);
  const textBody = textLines.join("\n");

  return { subject, textBody, htmlBody };
}

/**
 * Discrete content-type rows used in the Content Management Report and
 * the Monthly Archive Cleanup tables. The order matters — both tables
 * list the rows top-to-bottom in the same sequence so an admin can
 * compare them side-by-side without re-sorting.
 */
export const CONTENT_TYPE_ROWS = [
  { key: "Prayer", label: "Prayer" },
  { key: "Saint", label: "Saint" },
  { key: "MarianApparition", label: "Marian Apparition" },
  { key: "Devotion", label: "Devotion" },
  { key: "LiturgyEntry", label: "Liturgy / Church Document" },
  { key: "SpiritualLifeGuide", label: "Spiritual Life / Sacrament" },
  { key: "Parish", label: "Parish" },
] as const;

export type ContentTypeKey = (typeof CONTENT_TYPE_ROWS)[number]["key"];
