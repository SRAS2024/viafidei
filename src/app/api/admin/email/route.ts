import { type NextRequest } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { requireAdmin } from "@/lib/auth";
import { readResendApiKey, sendTransactionalEmail } from "@/lib/email/resend";
import {
  buildEmailVerificationLink,
  buildPasswordResetLink,
  getAppBaseUrl,
} from "@/lib/email/links";
import {
  renderEmailVerificationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  type RenderedEmail,
} from "@/lib/email/templates";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger } from "@/lib/observability";

/**
 * Diagnostic endpoint for the email pipeline. Returns:
 *   - whether a Resend API key is set in the runtime env
 *   - the configured `from` address the app would use for a real send
 *   - a redacted preview of the API key (first 4 chars + length)
 * so the operator can confirm the deployed environment matches the Resend
 * account they expect.
 *
 * Resolves the API key through the same helper the sender uses
 * (`readResendApiKey`), which accepts either `RESEND_API_KEY` or
 * `RESEND`. The diagnostic and the actual sender MUST agree; otherwise
 * this UI lies to the operator.
 *
 * Locked behind requireAdmin so the API key length / sender domain are
 * never exposed publicly. The key itself is never returned in full.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const apiKey = readResendApiKey();
  return jsonOk({
    configured: apiKey !== null,
    fromAddress: appConfig.email.fromAddress,
    provider: appConfig.email.providerName,
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 4)}…(${apiKey.length} chars)` : null,
  });
}

const TEMPLATE_KINDS = ["plain", "welcome", "password_reset", "verify_email"] as const;
type TemplateKind = (typeof TEMPLATE_KINDS)[number];

const testSendSchema = z.object({
  to: z.string().email().max(200),
  template: z.enum(TEMPLATE_KINDS).optional(),
});

function buildTestPayload(template: TemplateKind, to: string): RenderedEmail {
  switch (template) {
    case "welcome":
      return renderWelcomeEmail({
        firstName: "Test",
        fullName: "Test Recipient",
        siteUrl: getAppBaseUrl(),
        verifyUrl: buildEmailVerificationLink(
          // Synthetic 32-char token — the link won't actually validate
          // server-side, but the email body is identical to a real
          // welcome message so deliverability behaves the same.
          "diagnostic-token-32-characters-long-xx",
        ),
        locale: "en",
      });
    case "password_reset":
      return renderPasswordResetEmail({
        firstName: "Test",
        fullName: "Test Recipient",
        resetUrl: buildPasswordResetLink("diagnostic-token-32-characters-long-xx"),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        siteUrl: getAppBaseUrl(),
        locale: "en",
      });
    case "verify_email":
      return renderEmailVerificationEmail({
        firstName: "Test",
        fullName: "Test Recipient",
        verifyUrl: buildEmailVerificationLink("diagnostic-token-32-characters-long-xx"),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        siteUrl: getAppBaseUrl(),
        locale: "en",
      });
    case "plain":
    default:
      return {
        subject: "Via Fidei email diagnostic",
        textBody: [
          "This is a test email sent from the Via Fidei admin diagnostic.",
          "",
          `Sender domain: ${appConfig.email.fromAddress}`,
          `Recipient: ${to}`,
          `Time: ${new Date().toUTCString()}`,
          "",
          "If you received this message, Resend delivery is working.",
        ].join("\n"),
        htmlBody: "",
      };
  }
}

/**
 * Sends a real test email through the configured Resend account so the
 * operator can verify the sender domain is verified end-to-end.
 *
 * The optional `template` field selects which body to send:
 *   - "plain"          (default): minimal text-only message — proves the
 *                                 Resend account + API key + sender domain
 *                                 are connected.
 *   - "welcome"                 : the *exact* welcome email a new user
 *                                 receives at registration. Use this when
 *                                 plain works but production emails don't
 *                                 arrive — it isolates whether the issue
 *                                 is the template (deliverability filter)
 *                                 vs. the auth flow (never reaching
 *                                 sendTransactionalEmail).
 *   - "password_reset"          : the exact password-reset email.
 *   - "verify_email"            : the exact resend-verification email.
 *
 * Returns the structured result from the Resend client (including any
 * `errorName` / `errorMessage` Resend gave us back) so a misconfiguration
 * is obvious from the response — without exposing the API key.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = testSendSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const template: TemplateKind = parsed.data.template ?? "plain";
  logger.info("admin.email.test_send", {
    actor: admin.username,
    to: parsed.data.to,
    template,
  });

  const rendered = buildTestPayload(template, parsed.data.to);
  const result = await sendTransactionalEmail({
    to: parsed.data.to,
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody.length > 0 ? rendered.htmlBody : undefined,
  });

  if (result.ok) {
    return jsonOk({
      sent: result.delivery === "sent",
      delivery: result.delivery,
      reason: result.delivery === "skipped" ? result.reason : null,
      fromAddress: appConfig.email.fromAddress,
    });
  }
  // Surface the failure reason so the admin UI can render it directly.
  return jsonError("server_error", {
    message: "delivery_failed",
    details: {
      reason: result.reason,
      errorName: result.errorName,
      errorMessage: result.errorMessage,
      statusCode: result.statusCode,
      fromAddress: appConfig.email.fromAddress,
    },
  });
}
