function escapeHtml(value: string): string {
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

export function renderPasswordResetEmail(params: {
  resetUrl: string;
  expiresAt: Date;
}): RenderedEmail {
  const subject = "Reset your Via Fidei password";
  const expiresText = params.expiresAt.toUTCString();
  const safeUrl = escapeHtml(params.resetUrl);

  const textBody = [
    "We received a request to reset your Via Fidei password.",
    "",
    `Reset link: ${params.resetUrl}`,
    "",
    `This link expires at ${expiresText}.`,
    "If you did not request a password reset, you can safely ignore this email.",
  ].join("\n");

  const htmlBody = `<!doctype html>
<html><body style="font-family: system-ui, sans-serif; color: #1a1a1a;">
  <h1 style="font-size: 20px;">Reset your Via Fidei password</h1>
  <p>We received a request to reset your password.</p>
  <p><a href="${safeUrl}" style="color: #6b1d1d; font-weight: 600;">Reset your password</a></p>
  <p>Or paste this link into your browser:<br><code>${safeUrl}</code></p>
  <p style="color: #555; font-size: 13px;">This link expires at ${escapeHtml(expiresText)}. If you did not request a password reset, you can ignore this email.</p>
</body></html>`;

  return { subject, textBody, htmlBody };
}

export function renderEmailVerificationEmail(params: {
  verifyUrl: string;
  expiresAt: Date;
}): RenderedEmail {
  const subject = "Verify your Via Fidei email";
  const expiresText = params.expiresAt.toUTCString();
  const safeUrl = escapeHtml(params.verifyUrl);

  const textBody = [
    "Please confirm your email address to finish setting up your Via Fidei account.",
    "",
    `Verification link: ${params.verifyUrl}`,
    "",
    `This link expires at ${expiresText}.`,
    "If you did not create a Via Fidei account, you can safely ignore this email.",
  ].join("\n");

  const htmlBody = `<!doctype html>
<html><body style="font-family: system-ui, sans-serif; color: #1a1a1a;">
  <h1 style="font-size: 20px;">Verify your Via Fidei email</h1>
  <p>Please confirm your email address to finish setting up your account.</p>
  <p><a href="${safeUrl}" style="color: #6b1d1d; font-weight: 600;">Verify your email</a></p>
  <p>Or paste this link into your browser:<br><code>${safeUrl}</code></p>
  <p style="color: #555; font-size: 13px;">This link expires at ${escapeHtml(expiresText)}. If you did not create an account, you can ignore this email.</p>
</body></html>`;

  return { subject, textBody, htmlBody };
}
