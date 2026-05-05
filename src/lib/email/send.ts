import { isProduction } from "@/lib/env";
import { logger } from "@/lib/observability";
import { buildEmailVerificationLink, buildPasswordResetLink, getAppBaseUrl } from "./links";
import { isEmailConfigured, sendTransactionalEmail, type SendEmailResult } from "./resend";
import {
  renderEmailVerificationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  type RenderedEmail,
} from "./templates";
import { resolveEmailLocale, type EmailLocale } from "./translations";

type AccountUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  language?: string | null;
};

function fullNameOf(user: AccountUser): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

function localeOf(user: AccountUser): EmailLocale {
  return resolveEmailLocale(user.language);
}

/**
 * Reusable sender used by all account email flows. Centralizes:
 *  - delivery (Resend, or skipped when no provider is configured)
 *  - structured logging
 *  - safe failure semantics (no thrown errors leak to callers)
 */
export async function sendAccountEmail(params: {
  user: AccountUser;
  rendered: RenderedEmail;
  flow: "welcome" | "password_reset" | "email_verification";
}): Promise<SendEmailResult> {
  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: params.rendered.subject,
    textBody: params.rendered.textBody,
    htmlBody: params.rendered.htmlBody,
  });
  if (!result.ok) {
    // Never log raw bodies/tokens — only the failure reason and userId.
    logger.error(`auth.${params.flow}.email_failed`, {
      userId: params.user.id,
      reason: result.reason,
    });
  } else {
    logger.info(`auth.${params.flow}.email_sent`, {
      userId: params.user.id,
      delivery: result.delivery,
    });
  }
  return result;
}

export async function sendWelcomeEmail(user: AccountUser): Promise<SendEmailResult> {
  const rendered = renderWelcomeEmail({
    firstName: user.firstName,
    fullName: fullNameOf(user),
    siteUrl: getAppBaseUrl(),
    locale: localeOf(user),
  });
  return sendAccountEmail({ user, rendered, flow: "welcome" });
}

export async function sendPasswordResetEmail(params: {
  user: AccountUser;
  token: string;
  expiresAt: Date;
}): Promise<SendEmailResult> {
  const link = buildPasswordResetLink(params.token);
  const rendered = renderPasswordResetEmail({
    firstName: params.user.firstName,
    fullName: fullNameOf(params.user),
    resetUrl: link,
    expiresAt: params.expiresAt,
    siteUrl: getAppBaseUrl(),
    locale: localeOf(params.user),
  });
  if (!isProduction() && !isEmailConfigured()) {
    // Dev-only convenience so local QA can click the link from the console.
    // Production never logs the raw token.
    logger.warn("auth.password_reset.dev_link_logged", {
      userId: params.user.id,
      link,
      expiresAt: params.expiresAt.toISOString(),
    });
  }
  return sendAccountEmail({ user: params.user, rendered, flow: "password_reset" });
}

export async function sendEmailVerificationEmail(params: {
  user: AccountUser;
  token: string;
  expiresAt: Date;
}): Promise<SendEmailResult> {
  const link = buildEmailVerificationLink(params.token);
  const rendered = renderEmailVerificationEmail({
    firstName: params.user.firstName,
    fullName: fullNameOf(params.user),
    verifyUrl: link,
    expiresAt: params.expiresAt,
    siteUrl: getAppBaseUrl(),
    locale: localeOf(params.user),
  });
  if (!isProduction() && !isEmailConfigured()) {
    // Dev-only convenience so local QA can click the link from the console.
    // Production never logs the raw token.
    logger.warn("auth.email_verification.dev_link_logged", {
      userId: params.user.id,
      link,
      expiresAt: params.expiresAt.toISOString(),
    });
  }
  return sendAccountEmail({ user: params.user, rendered, flow: "email_verification" });
}
