import { translateEmail, type EmailLocale } from "./translations";

export const SITE_NAME = "Via Fidei";
export const SITE_URL_DEFAULT = "https://etviafidei.com";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RenderedEmail = {
  subject: string;
  textBody: string;
  htmlBody: string;
};

const COLOR_INK = "#111111";
const COLOR_INK_SOFT = "#2a2a2a";
const COLOR_INK_FAINT = "#4a4a4a";
const COLOR_PAPER = "#fbf8f1";
const COLOR_PAPER_WARM = "#f5efe3";
const COLOR_RULE = "rgba(17,17,17,0.18)";
const COLOR_BUTTON = "#1f3a8a";
const COLOR_BUTTON_TEXT = "#ffffff";

// SVG mark of the Via Fidei cross. Inlined so email clients that block
// remote images still render the brand. The width/height are set on the
// outer wrapper for downstream styling.
function crossLogoSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="70" viewBox="0 0 64 80" role="img" aria-label="Via Fidei">',
    `<path d="M28 4 Q32 3.4 36 4 L36 23 L60 23 Q60.4 24 60 25 L60 31 Q60.4 32 60 33 L36 33 L36 75 Q36.4 77 36 77.6 Q34 78.4 32 78.4 Q30 78.4 28 77.6 Q27.6 77 28 75 L28 33 L4 33 Q3.6 32 4 31 L4 25 Q3.6 24 4 23 L28 23 Z" fill="none" stroke="${COLOR_INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`,
    "</svg>",
  ].join("");
}

type ShellOptions = {
  preheader: string;
  heading: string;
  intro: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  fineprint?: string;
  footerLine: string;
  siteUrl: string;
  siteLabel: string;
};

function htmlShell(opts: ShellOptions): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `
        <p style="margin: 24px 0; text-align: center;">
          <a href="${escapeHtml(opts.ctaUrl)}"
             style="display: inline-block; padding: 12px 24px; background: ${COLOR_BUTTON}; color: ${COLOR_BUTTON_TEXT}; text-decoration: none; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; letter-spacing: 0.04em; border-radius: 2px;">
            ${escapeHtml(opts.ctaLabel)}
          </a>
        </p>
        <p style="margin: 16px 0 0; font-size: 13px; color: ${COLOR_INK_FAINT}; word-break: break-all;">
          <code style="font-family: 'SFMono-Regular', Menlo, Consolas, monospace;">${escapeHtml(opts.ctaUrl)}</code>
        </p>`
      : "";

  const fineprint = opts.fineprint
    ? `<p style="margin: 24px 0 0; font-size: 13px; color: ${COLOR_INK_FAINT};">${escapeHtml(opts.fineprint)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${COLOR_PAPER_WARM}; color: ${COLOR_INK}; font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">${escapeHtml(opts.preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLOR_PAPER_WARM};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px; width: 100%; background: ${COLOR_PAPER}; border: 1px solid ${COLOR_RULE};">
          <tr>
            <td align="center" style="padding: 36px 32px 8px;">
              <div style="margin: 0 auto;">${crossLogoSvg()}</div>
              <p style="margin: 14px 0 0; font-family: 'Inter', Arial, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: ${COLOR_INK_FAINT};">${escapeHtml(SITE_NAME)}</p>
              <hr style="border: 0; border-top: 1px solid ${COLOR_RULE}; width: 60px; margin: 16px auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 40px 32px; text-align: center;">
              <h1 style="margin: 0 0 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 28px; color: ${COLOR_INK};">${escapeHtml(opts.heading)}</h1>
              <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.55; color: ${COLOR_INK_SOFT};">${escapeHtml(opts.intro)}</p>
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.55; color: ${COLOR_INK_SOFT};">${escapeHtml(opts.body)}</p>
              ${cta}
              ${fineprint}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 32px 32px; border-top: 1px solid ${COLOR_RULE};">
              <p style="margin: 0; font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: ${COLOR_INK_FAINT};">${escapeHtml(opts.footerLine)}</p>
              <p style="margin: 8px 0 0; font-family: 'Inter', Arial, sans-serif; font-size: 12px;">
                <a href="${escapeHtml(opts.siteUrl)}" style="color: ${COLOR_INK_SOFT}; text-decoration: underline;">${escapeHtml(opts.siteLabel)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textShell(opts: {
  heading: string;
  intro: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  fineprint?: string;
  footerLine: string;
  siteUrl: string;
}): string {
  const lines: string[] = [];
  lines.push(SITE_NAME);
  lines.push("=".repeat(SITE_NAME.length));
  lines.push("");
  lines.push(opts.heading);
  lines.push("");
  lines.push(opts.intro);
  lines.push("");
  lines.push(opts.body);
  if (opts.ctaLabel && opts.ctaUrl) {
    lines.push("");
    lines.push(`${opts.ctaLabel}: ${opts.ctaUrl}`);
  }
  if (opts.fineprint) {
    lines.push("");
    lines.push(opts.fineprint);
  }
  lines.push("");
  lines.push("--");
  lines.push(opts.footerLine);
  lines.push(opts.siteUrl);
  return lines.join("\n");
}

export type WelcomeEmailParams = {
  firstName: string;
  fullName: string;
  siteUrl: string;
  locale: EmailLocale;
};

export function renderWelcomeEmail(params: WelcomeEmailParams): RenderedEmail {
  const t = translateEmail(params.locale);
  const subject = t.welcome_subject;
  const heading = t.welcome_heading;
  const requiredMessage = t.welcome_required.replace("{name}", params.fullName);
  const intro = t.welcome_intro;
  const body = requiredMessage;
  const ctaLabel = t.welcome_cta;
  const fineprint = t.welcome_fineprint;
  const footerLine = t.shared_footerLine;
  const siteLabel = t.shared_siteLabel;

  const htmlBody = htmlShell({
    preheader: subject,
    heading,
    intro,
    body,
    ctaLabel,
    ctaUrl: params.siteUrl,
    fineprint,
    footerLine,
    siteUrl: params.siteUrl,
    siteLabel,
  });

  const textBody = textShell({
    heading,
    intro,
    body,
    ctaLabel,
    ctaUrl: params.siteUrl,
    fineprint,
    footerLine,
    siteUrl: params.siteUrl,
  });

  return { subject, textBody, htmlBody };
}

export type PasswordResetParams = {
  firstName: string;
  fullName: string;
  resetUrl: string;
  expiresAt: Date;
  siteUrl: string;
  locale: EmailLocale;
};

export function renderPasswordResetEmail(params: PasswordResetParams): RenderedEmail {
  const t = translateEmail(params.locale);
  const subject = t.reset_subject;
  const heading = t.reset_heading;
  const intro = t.reset_intro;
  const body = t.reset_body;
  const ctaLabel = t.reset_cta.replace("{name}", params.fullName);
  const fineprint = t.reset_fineprint.replace("{expiresAt}", params.expiresAt.toUTCString());
  const footerLine = t.shared_footerLine;
  const siteLabel = t.shared_siteLabel;

  const htmlBody = htmlShell({
    preheader: subject,
    heading,
    intro,
    body,
    ctaLabel,
    ctaUrl: params.resetUrl,
    fineprint,
    footerLine,
    siteUrl: params.siteUrl,
    siteLabel,
  });

  const textBody = textShell({
    heading,
    intro,
    body,
    ctaLabel,
    ctaUrl: params.resetUrl,
    fineprint,
    footerLine,
    siteUrl: params.siteUrl,
  });

  return { subject, textBody, htmlBody };
}

export type EmailVerificationParams = {
  firstName: string;
  fullName: string;
  verifyUrl: string;
  expiresAt: Date;
  siteUrl: string;
  locale: EmailLocale;
};

export function renderEmailVerificationEmail(params: EmailVerificationParams): RenderedEmail {
  const t = translateEmail(params.locale);
  const subject = t.verify_subject;
  const heading = t.verify_heading;
  const intro = t.verify_intro.replace("{name}", params.fullName);
  const body = t.verify_body;
  const ctaLabel = t.verify_cta;
  const fineprint = t.verify_fineprint.replace("{expiresAt}", params.expiresAt.toUTCString());
  const footerLine = t.shared_footerLine;
  const siteLabel = t.shared_siteLabel;

  const htmlBody = htmlShell({
    preheader: subject,
    heading,
    intro,
    body,
    ctaLabel,
    ctaUrl: params.verifyUrl,
    fineprint,
    footerLine,
    siteUrl: params.siteUrl,
    siteLabel,
  });

  const textBody = textShell({
    heading,
    intro,
    body,
    ctaLabel,
    ctaUrl: params.verifyUrl,
    fineprint,
    footerLine,
    siteUrl: params.siteUrl,
  });

  return { subject, textBody, htmlBody };
}
