import { isProduction } from "@/lib/env";
import { logger } from "@/lib/observability";
import { buildEmailVerificationLink, buildPasswordResetLink } from "./links";
import { isEmailConfigured, sendTransactionalEmail, type SendEmailResult } from "./postmark";
import { renderEmailVerificationEmail, renderPasswordResetEmail } from "./templates";

export async function sendPasswordResetEmail(params: {
  to: string;
  token: string;
  expiresAt: Date;
}): Promise<SendEmailResult> {
  const link = buildPasswordResetLink(params.token);
  const rendered = renderPasswordResetEmail({ resetUrl: link, expiresAt: params.expiresAt });
  if (!isProduction() && !isEmailConfigured()) {
    logger.warn("auth.password_reset.dev_link_logged", {
      to: params.to,
      link,
      expiresAt: params.expiresAt.toISOString(),
    });
  }
  return sendTransactionalEmail({
    to: params.to,
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

export async function sendEmailVerificationEmail(params: {
  to: string;
  token: string;
  expiresAt: Date;
}): Promise<SendEmailResult> {
  const link = buildEmailVerificationLink(params.token);
  const rendered = renderEmailVerificationEmail({ verifyUrl: link, expiresAt: params.expiresAt });
  if (!isProduction() && !isEmailConfigured()) {
    logger.warn("auth.email_verification.dev_link_logged", {
      to: params.to,
      link,
      expiresAt: params.expiresAt.toISOString(),
    });
  }
  return sendTransactionalEmail({
    to: params.to,
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}
