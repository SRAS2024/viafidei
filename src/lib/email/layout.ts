/**
 * The one design every Via Fidei email shares: the site's paper and ink, the
 * crucifix logo top-left beside the VIA FIDEI wordmark, one reading column.
 *
 * It is written for the inboxes people actually use, not for a browser:
 *
 *  - Layout is tables with every style inline and colours as six-digit hex.
 *    Outlook for Windows draws mail with Word: it ignores rgba(), max-width and
 *    margins on <div>, so an MSO-only 600px "ghost" table keeps the column from
 *    sprawling there, and `mso-padding-alt` gives its button real padding.
 *  - The logo is a hosted PNG with width/height attributes. Gmail, Outlook and
 *    Yahoo drop inline <svg> entirely, which is why the old drawn cross never
 *    appeared for most readers.
 *  - The papyrus is a solid paper colour with a transparent grain image over it
 *    (the same grain the site's own page has). A client that blocks images shows
 *    plain paper; a client that inverts colours for dark mode inverts the paper
 *    and the ink together, and the transparent grain cannot hide the text.
 *  - "light" is declared as the colour scheme, so Apple Mail keeps the paper
 *    rather than darkening it on its own.
 *  - Real <h1>, <p>, <ul> and data <table> elements, with lang and dir on the
 *    message, so a screen reader announces the heading, the list and each table
 *    row ("Saints, 3,807") instead of reading layout cells.
 *  - Cormorant Garamond, the site's reading face, loads where a client allows
 *    web fonts (Apple Mail, iOS Mail, Thunderbird); everywhere else Georgia
 *    stands in, and Outlook is told so explicitly.
 *
 * Every string passed in is plain text and is escaped here.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* The site's own tokens (src/app/globals.css, tailwind.config.ts). */
export const EMAIL_COLORS = {
  /** Behind the sheet: the site's stone "whisper". */
  desk: "#efeadf",
  /** The sheet itself: the site's --paper. */
  paper: "#fbf8f1",
  /** Inset panels: the site's --paper-warm. */
  paperWarm: "#f5efe3",
  /** The sheet's edge and the strong rules: the site's stone "mist". */
  edge: "#d7cfbd",
  /** Hairlines between rows: the site's stone "ash". */
  hairline: "#e8e2d4",
  ink: "#111111",
  inkSoft: "#2a2a2a",
  inkFaint: "#4a4a4a",
  /** The site's affirmative action colour (buttons, links). */
  action: "#1f3a8a",
  onAction: "#ffffff",
} as const;

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
const C = EMAIL_COLORS;

/** Where the hosted email images live (served from the site's public/email). */
export function emailAssetUrl(siteUrl: string, file: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/email/${file}`;
}

export type EmailBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  /** A plain two-column table of named figures, one row each: "Saints — 3,807". */
  | { type: "figures"; rows: Array<{ label: string; value: string }> }
  /** A data table with a header row (admin reports). */
  | {
      type: "table";
      columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
      rows: Array<Record<string, string>>;
    }
  | { type: "button"; label: string; url: string }
  /** Closing lines, e.g. ["Blessings,", "The Via Fidei Team"]. */
  | { type: "signature"; lines: string[] }
  | { type: "fineprint"; text: string };

export type EmailDocument = {
  /** The site locale the message is written in (en, es, …, zh). */
  locale: string;
  /** The <title> and the message's accessible name; normally the subject. */
  title: string;
  /** The inbox preview line shown after the subject. */
  preheader: string;
  blocks: EmailBlock[];
  footer: { lines: string[]; link?: { url: string; label: string } };
  /** The site's base URL; the logo and the paper grain are served from it. */
  siteUrl: string;
  /** Shown after the wordmark, e.g. "Admin" on operational mail. */
  brandNote?: string;
};

export const BRAND_NAME = "Via Fidei";

/** BCP 47 tag for the html lang attribute: Simplified Chinese is the site's zh. */
export function htmlLangFor(locale: string): string {
  return locale === "zh" ? "zh-Hans" : locale;
}

/** The locale Intl should format numbers and dates with for a site locale. */
export function intlLocaleFor(locale: string): string {
  switch (locale) {
    case "zh":
      return "zh-Hans";
    case "tl":
      return "fil";
    case "la":
      // Intl has no Latin; English grouping (3,807) is the neutral choice.
      return "en";
    default:
      return locale;
  }
}

export function formatEmailCount(value: number, locale: string): string {
  const n = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  try {
    return new Intl.NumberFormat(intlLocaleFor(locale), { useGrouping: true }).format(n);
  } catch {
    return String(n);
  }
}

/** "1 January 2099, 00:00 UTC" in the reader's language (ISO-style for Latin). */
export function formatEmailDateTime(date: Date, locale: string): string {
  if (locale === "la") {
    const iso = date.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
  }
  try {
    const text = new Intl.DateTimeFormat(intlLocaleFor(locale), {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date);
    return `${text} UTC`;
  } catch {
    return date.toUTCString();
  }
}

/* ------------------------------------------------------------------------ */
/* HTML                                                                      */
/* ------------------------------------------------------------------------ */

const PAD_X = 40;

/** One row of the sheet: a cell with the column's side padding. */
function row(content: string, padTop: number, padBottom: number, extraStyle = ""): string {
  return `<tr><td class="vf-pad" style="padding:${padTop}px ${PAD_X}px ${padBottom}px ${PAD_X}px;${extraStyle}">${content}</td></tr>`;
}

function rule(color: string): string {
  return `<table role="presentation" aria-hidden="true" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${color};font-size:1px;line-height:1px;height:1px;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>`;
}

const BODY_TEXT = `font-family:${SERIF};font-size:19px;line-height:30px;color:${C.inkSoft};mso-line-height-rule:exactly;`;

/** Site locales whose script has no italic form. */
const UPRIGHT_SCRIPTS = new Set(["zh", "ko"]);

function renderBlock(block: EmailBlock, locale: string): string {
  switch (block.type) {
    case "heading":
      return row(
        `<h1 class="vf-h1" style="margin:0;font-family:${SERIF};font-size:34px;line-height:40px;font-weight:500;color:${C.ink};mso-line-height-rule:exactly;">${escapeHtml(block.text)}</h1>`,
        0,
        22,
      );
    case "subheading":
      return row(
        `<h2 style="margin:0;font-family:${SERIF};font-size:23px;line-height:30px;font-weight:600;color:${C.ink};mso-line-height-rule:exactly;">${escapeHtml(block.text)}</h2>`,
        8,
        10,
      );
    case "paragraph":
      return row(`<p style="margin:0;${BODY_TEXT}">${escapeHtml(block.text)}</p>`, 0, 18);
    case "list": {
      const items = block.items
        .map(
          (item, i) =>
            `<li style="margin:0 0 ${i === block.items.length - 1 ? 0 : 10}px 0;padding:0 0 0 6px;${BODY_TEXT}">${escapeHtml(item)}</li>`,
        )
        .join("");
      return row(`<ul style="margin:0 0 0 26px;padding:0;${BODY_TEXT}">${items}</ul>`, 0, 24);
    }
    case "figures": {
      const last = block.rows.length - 1;
      const cells = block.rows
        .map((r, i) => {
          const line = i === last ? "" : `border-bottom:1px solid ${C.edge};`;
          return (
            `<tr>` +
            `<th scope="row" align="left" style="padding:12px 0;${line}font-family:${SERIF};font-size:19px;line-height:24px;font-weight:500;color:${C.ink};text-align:left;mso-line-height-rule:exactly;">${escapeHtml(r.label)}</th>` +
            `<td align="right" style="padding:12px 0 12px 16px;${line}font-family:${SERIF};font-size:19px;line-height:24px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;font-variant-numeric:lining-nums tabular-nums;mso-line-height-rule:exactly;">${escapeHtml(r.value)}</td>` +
            `</tr>`
          );
        })
        .join("");
      // The panel is layout; the inner table is the data a reader hears row by row.
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.paperWarm}" style="background-color:${C.paperWarm};border:1px solid ${C.edge};border-radius:3px;"><tr><td style="padding:4px 22px;">` +
          `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">${cells}</table>` +
          `</td></tr></table>`,
        4,
        26,
      );
    }
    case "table": {
      const head = block.columns
        .map(
          (c) =>
            `<th scope="col" align="${c.align ?? "left"}" class="vf-sans" style="padding:8px;background-color:${C.paperWarm};border-bottom:1px solid ${C.edge};font-family:${SANS};font-size:13px;line-height:18px;font-weight:600;color:${C.inkSoft};text-align:${c.align ?? "left"};">${escapeHtml(c.label)}</th>`,
        )
        .join("");
      const body = block.rows
        .map((r) => {
          const cells = block.columns
            .map((c, i) => {
              const align = c.align ?? "left";
              const style = `padding:8px;border-bottom:1px solid ${C.hairline};font-family:${SANS};font-size:14px;line-height:20px;font-weight:400;color:${C.ink};text-align:${align};`;
              const value = escapeHtml(r[c.key] ?? "");
              // The first column names the row, so a screen reader can say which
              // row a number belongs to when moving down a column.
              return i === 0
                ? `<th scope="row" align="${align}" class="vf-sans" style="${style}">${value}</th>`
                : `<td align="${align}" class="vf-sans" style="${style}">${value}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return row(
        `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;border:1px solid ${C.edge};"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
        0,
        20,
      );
    }
    case "button": {
      const url = escapeHtml(block.url);
      return row(
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
          `<td align="center" bgcolor="${C.action}" style="background-color:${C.action};border-radius:3px;mso-padding-alt:15px 30px;">` +
          `<a href="${url}" target="_blank" class="vf-sans" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:14px;line-height:18px;letter-spacing:2px;text-transform:uppercase;font-weight:600;color:${C.onAction};text-decoration:none;border-radius:3px;mso-line-height-rule:exactly;">${escapeHtml(block.label)}</a>` +
          `</td></tr></table>`,
        6,
        26,
      );
    }
    case "signature": {
      const [first, ...rest] = block.lines;
      const tail = rest.map((l) => `<br>${escapeHtml(l)}`).join("");
      // Chinese and Korean have no true italic; a slanted fallback only smears them.
      const opening = UPRIGHT_SCRIPTS.has(locale)
        ? escapeHtml(first ?? "")
        : `<em style="font-style:italic;">${escapeHtml(first ?? "")}</em>`;
      return row(`<p style="margin:0;${BODY_TEXT}">${opening}${tail}</p>`, 6, 8);
    }
    case "fineprint":
      return row(
        `<p class="vf-sans" style="margin:0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.inkFaint};">${escapeHtml(block.text)}</p>`,
        0,
        16,
      );
  }
}

/** Invisible preview text, followed by spacers so the body never leaks into the preview. */
function preheaderHtml(text: string): string {
  const spacer = "&#847;&zwnj;&nbsp;".repeat(60);
  return (
    `<div aria-hidden="true" style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.desk};">${escapeHtml(text)}</div>` +
    `<div aria-hidden="true" style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;">${spacer}</div>`
  );
}

export function renderEmailHtml(doc: EmailDocument): string {
  const lang = htmlLangFor(doc.locale);
  const title = escapeHtml(doc.title);
  const logo = escapeHtml(emailAssetUrl(doc.siteUrl, "crucifix-logo.png"));
  const grain = escapeHtml(emailAssetUrl(doc.siteUrl, "paper-grain.png"));

  const note = doc.brandNote
    ? `<td valign="middle" class="vf-sans" style="padding:0 0 0 12px;font-family:${SANS};font-size:12px;line-height:22px;letter-spacing:2px;text-transform:uppercase;color:${C.inkFaint};mso-line-height-rule:exactly;">${escapeHtml(doc.brandNote)}</td>`
    : "";

  const header =
    row(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td valign="middle" style="padding:0 14px 0 0;font-size:0;line-height:0;">` +
        `<img src="${logo}" width="36" height="49" alt="" style="display:block;width:36px;height:49px;border:0;outline:none;text-decoration:none;">` +
        `</td>` +
        `<td valign="middle" style="font-family:${SERIF};font-size:18px;line-height:22px;letter-spacing:6px;text-transform:uppercase;font-weight:500;color:${C.ink};mso-line-height-rule:exactly;">${escapeHtml(BRAND_NAME)}</td>` +
        note +
        `</tr></table>`,
      30,
      0,
    ) + row(rule(C.edge), 22, 30);

  const body = doc.blocks.map((block) => renderBlock(block, doc.locale)).join("\n");

  const footerLines = doc.footer.lines
    .map(
      (l, i) =>
        `<p class="vf-sans" style="margin:${i === 0 ? 0 : 6}px 0 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.inkFaint};">${escapeHtml(l)}</p>`,
    )
    .join("");
  const footerLink = doc.footer.link
    ? `<p class="vf-sans" style="margin:6px 0 0 0;font-family:${SANS};font-size:14px;line-height:21px;"><a href="${escapeHtml(doc.footer.link.url)}" target="_blank" style="color:${C.action};text-decoration:underline;">${escapeHtml(doc.footer.link.label)}</a></p>`
    : "";
  const footer = row(rule(C.edge), 14, 0) + row(`${footerLines}${footerLink}`, 18, 30);

  return `<!doctype html>
<html lang="${lang}" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<!--[if mso]><style type="text/css">body, table, td, th, p, li, a, h1, h2 { font-family: Georgia, 'Times New Roman', serif !important; } .vf-sans, .vf-sans a { font-family: 'Segoe UI', Arial, sans-serif !important; }</style><![endif]-->
<!--[if !mso]><!--><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&amp;family=Inter:wght@400;600&amp;display=swap"><!--<![endif]-->
<style type="text/css">
:root { color-scheme: light; supported-color-schemes: light; }
body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
img { -ms-interpolation-mode: bicubic; }
a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
@media only screen and (max-width: 620px) {
  .vf-outer { padding: 12px 8px !important; }
  .vf-pad { padding-left: 24px !important; padding-right: 24px !important; }
  .vf-h1 { font-size: 30px !important; line-height: 36px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${C.desk};" bgcolor="${C.desk}">
<div role="article" aria-label="${title}" lang="${lang}" dir="ltr" style="background-color:${C.desk};">
${preheaderHtml(doc.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.desk}" style="background-color:${C.desk};">
<tr>
<td align="center" class="vf-outer" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td width="600"><![endif]-->
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">
<tr>
<td bgcolor="${C.paper}" background="${grain}" style="background-color:${C.paper};background-image:url('${grain}');background-repeat:repeat;border:1px solid ${C.edge};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${header}
${body}
${footer}
</table>
</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</div>
</body>
</html>`;
}

/* ------------------------------------------------------------------------ */
/* Plain text — every message carries one, for clients and readers that      */
/* prefer it, and as the fallback copy of every link.                         */
/* ------------------------------------------------------------------------ */

/**
 * A data table as plain sentences: "Prayer — Added: +5, Deleted: 0". Column-
 * aligned text loses which number is which when it is read aloud.
 */
function textTable(block: Extract<EmailBlock, { type: "table" }>): string {
  const [first, ...rest] = block.columns;
  if (!first) return "";
  return block.rows
    .map((r) => {
      const name = r[first.key] ?? "";
      // A plain "Field | Value" table reads best as "Severity: Error".
      if (rest.length === 1 && /^value$/i.test(rest[0]!.label)) {
        return `  ${name}: ${r[rest[0]!.key] ?? ""}`;
      }
      const values = rest.map((c) => `${c.label}: ${r[c.key] ?? ""}`).join(", ");
      return values ? `  ${name} — ${values}` : `  ${name}`;
    })
    .join("\n");
}

function textFigures(block: Extract<EmailBlock, { type: "figures" }>): string {
  const labelWidth = Math.max(...block.rows.map((r) => r.label.length));
  const valueWidth = Math.max(...block.rows.map((r) => r.value.length));
  return block.rows
    .map((r) => `  ${r.label.padEnd(labelWidth)}   ${r.value.padStart(valueWidth)}`)
    .join("\n");
}

export function renderEmailText(doc: EmailDocument): string {
  const out: string[] = [];
  const brand = doc.brandNote ? `${BRAND_NAME} — ${doc.brandNote}` : BRAND_NAME;
  // No "=====" or "-----" rules: a screen reader reads them out, character by character.
  out.push(brand, "");
  for (const block of doc.blocks) {
    switch (block.type) {
      case "heading":
        out.push(block.text, "");
        break;
      case "subheading":
        out.push(block.text);
        break;
      case "paragraph":
        out.push(block.text, "");
        break;
      case "list":
        for (const item of block.items) out.push(`  • ${item}`);
        out.push("");
        break;
      case "figures":
        out.push(textFigures(block), "");
        break;
      case "table":
        out.push(textTable(block), "");
        break;
      case "button":
        out.push(`${block.label}: ${block.url}`, "");
        break;
      case "signature":
        out.push(...block.lines, "");
        break;
      case "fineprint":
        out.push(block.text, "");
        break;
    }
  }
  out.push("--", ...doc.footer.lines);
  if (doc.footer.link) out.push(doc.footer.link.url);
  return out.join("\n");
}

export function renderEmail(doc: EmailDocument): { htmlBody: string; textBody: string } {
  return { htmlBody: renderEmailHtml(doc), textBody: renderEmailText(doc) };
}
