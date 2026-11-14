import { copyrightNotice, translateEmail, type EmailLocale } from "./translations";
import { escapeHtml, formatEmailDateTime, renderEmail, type EmailBlock } from "./layout";

export { escapeHtml };

export const SITE_NAME = "Via Fidei";
export const SITE_URL_DEFAULT = "https://etviafidei.com";

export type RenderedEmail = {
  subject: string;
  textBody: string;
  htmlBody: string;
};

type AccountEmailParts = {
  locale: EmailLocale;
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  fineprint: string;
  siteUrl: string;
};

/**
 * Account emails (welcome, password reset, verification) share one shape: a
 * heading, a few lines, one button, a line of small print. The button is the
 * only place the link appears in the HTML — showing the same URL twice in two
 * formats is a known spam signal — while the plain-text copy spells it out for
 * anyone who prefers to paste it.
 */
function renderAccountEmail(parts: AccountEmailParts): RenderedEmail {
  const blocks: EmailBlock[] = [
    { type: "heading", text: parts.heading },
    ...parts.paragraphs.map((text): EmailBlock => ({ type: "paragraph", text })),
    { type: "button", label: parts.cta.label, url: parts.cta.url },
    { type: "fineprint", text: parts.fineprint },
  ];
  const { htmlBody, textBody } = renderEmail({
    locale: parts.locale,
    title: parts.subject,
    preheader: parts.preheader,
    blocks,
    // Centered at the foot: the site's address, then the copyright notice.
    footer: {
      link: { url: parts.siteUrl, label: new URL(parts.siteUrl).host },
      copyright: copyrightNotice(parts.locale),
    },
    siteUrl: parts.siteUrl,
  });
  return { subject: parts.subject, htmlBody, textBody };
}

export type WelcomeEmailParams = {
  firstName: string;
  fullName: string;
  siteUrl: string;
  locale: EmailLocale;
  /**
   * Verification URL embedded in the welcome email's CTA button. This
   * combines what used to be two separate emails (welcome + verify) into
   * a single onboarding message — the user sees one email after sign-up
   * with a "Verify my email" button instead of two near-duplicate
   * messages arriving back-to-back.
   */
  verifyUrl: string;
};

export function renderWelcomeEmail(params: WelcomeEmailParams): RenderedEmail {
  const t = translateEmail(params.locale);
  return renderAccountEmail({
    locale: params.locale,
    subject: t.welcome_subject,
    preheader: t.welcome_intro,
    heading: t.welcome_heading,
    paragraphs: [t.welcome_intro, t.welcome_required.replace("{name}", params.fullName)],
    // The CTA is the email-verification link: the part of onboarding that
    // actually needs a click, so one email does the work of two.
    cta: { label: t.verify_cta, url: params.verifyUrl },
    fineprint: t.welcome_fineprint,
    siteUrl: params.siteUrl,
  });
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
  return renderAccountEmail({
    locale: params.locale,
    subject: t.reset_subject,
    preheader: t.reset_intro,
    heading: t.reset_heading,
    // The 15-minute validity is in the body copy; the small print only says
    // what to do if the reader never asked for a reset.
    paragraphs: [t.reset_intro, t.reset_body],
    cta: { label: t.reset_cta.replace("{name}", params.fullName), url: params.resetUrl },
    fineprint: t.reset_fineprint,
    siteUrl: params.siteUrl,
  });
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
  return renderAccountEmail({
    locale: params.locale,
    subject: t.verify_subject,
    preheader: t.verify_body,
    heading: t.verify_heading,
    paragraphs: [t.verify_intro.replace("{name}", params.fullName), t.verify_body],
    cta: { label: t.verify_cta, url: params.verifyUrl },
    fineprint: t.verify_fineprint.replace(
      "{expiresAt}",
      formatEmailDateTime(params.expiresAt, params.locale),
    ),
    siteUrl: params.siteUrl,
  });
}
