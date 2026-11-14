import { renderEmail, type EmailBlock } from "./layout";
import { type RenderedEmail, SITE_NAME, SITE_URL_DEFAULT } from "./templates";
import { copyrightNotice } from "./translations";

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

const OPERATIONAL_FOOTER = `${SITE_NAME} operational notification — generated automatically.`;

/**
 * Admin mail is drawn by the same layout as every other Via Fidei email (see
 * ./layout): the paper, the crucifix logo top-left, with "Admin" beside the
 * wordmark. Each section becomes a subheading, its paragraphs, and a real data
 * table with a header row.
 */
export function renderAdminEmail(params: AdminEmailParams): RenderedEmail {
  const subject = params.subject;
  const signoff = params.signoff ?? "No action required unless the report shows otherwise.";
  const blocks: EmailBlock[] = [
    { type: "heading", text: params.heading },
    { type: "paragraph", text: "Admin," },
    { type: "paragraph", text: params.intro },
  ];
  for (const section of params.sections ?? []) {
    if (section.title) blocks.push({ type: "subheading", text: section.title });
    for (const p of section.paragraphs ?? []) blocks.push({ type: "paragraph", text: p });
    if (section.table) {
      blocks.push({ type: "table", columns: section.table.columns, rows: section.table.rows });
    }
  }
  blocks.push({ type: "fineprint", text: signoff });

  const { htmlBody, textBody } = renderEmail({
    locale: "en",
    title: params.heading,
    preheader: params.intro,
    blocks,
    footer: { lines: [OPERATIONAL_FOOTER], copyright: copyrightNotice("en") },
    siteUrl: SITE_URL_DEFAULT,
    brandNote: "Admin",
  });
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
