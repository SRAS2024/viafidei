import { type NextRequest } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import {
  findUserByEmail,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  requireAdmin,
} from "@/lib/auth";
import { readResendApiKey, sendTransactionalEmail } from "@/lib/email/resend";
import {
  buildEmailVerificationLink,
  buildPasswordResetLink,
  getAppBaseUrl,
} from "@/lib/email/links";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@/lib/email/send";
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
 * (`readResendApiKey`), which reads `RESEND_API_KEY` from process.env.
 * The diagnostic and the actual sender MUST agree; otherwise this UI
 * lies to the operator.
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

const TEMPLATE_KINDS = [
  "plain",
  "welcome",
  "password_reset",
  "verify_email",
  // "full_flow_*" exercises the same code path as a live account email,
  // including database token creation. The email is delivered to the
  // recipient's actual account row, so the operator can confirm that the
  // entire pipeline (DB write → Resend dispatch) works end-to-end.
  "full_flow_welcome",
  "full_flow_password_reset",
  "full_flow_verify_email",
] as const;
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
 * Run the live account email flow end-to-end against a real user row so
 * the operator can confirm the database token write succeeds AND Resend
 * accepts the message. This is the diagnostic that catches a class of
 * production bug the synthetic-token templates miss: a missing
 * PasswordResetToken / EmailVerificationToken table makes the Prisma
 * write throw long before the email helper is called, and a plain
 * Resend send wouldn't notice.
 *
 * Looks up the user by the requested email. Returns 404 if no user
 * exists — full-flow tests must hit a real account, otherwise the
 * tokens we issue cannot be cleaned up safely. Returns the same
 * structured result shape as the synthetic-template path so the admin
 * UI can render it identically.
 */
async function runFullFlow(
  template: "full_flow_welcome" | "full_flow_password_reset" | "full_flow_verify_email",
  to: string,
): Promise<
  | { ok: true; delivery: "sent" | "skipped"; reason: "not_configured" | null }
  | {
      ok: false;
      reason: string;
      errorName?: string;
      errorMessage?: string;
      statusCode?: number;
      stage: "user_lookup" | "token_creation" | "delivery";
    }
> {
  let user: Awaited<ReturnType<typeof findUserByEmail>>;
  try {
    user = await findUserByEmail(to);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    // The most common cause of this branch is a missing User table or
    // missing migration; surface the kind so the operator can see it
    // without having to grep logs.
    logger.error("admin.email.full_flow_user_lookup_failed", {
      to,
      message,
    });
    return {
      ok: false,
      stage: "user_lookup",
      reason: "user_lookup_failed",
      errorMessage: message,
    };
  }
  if (!user) {
    return {
      ok: false,
      stage: "user_lookup",
      reason: "user_not_found",
      errorMessage: "no account exists for that email — full-flow tests need a real user row",
    };
  }

  // Token creation is exactly what the live route does. Failures here
  // are operator-fixable (run migrations); the structured log line names
  // the missing piece so it's obvious from the deploy output.
  try {
    if (template === "full_flow_welcome") {
      const issued = await issueEmailVerificationToken(user.id);
      logger.info("admin.email.full_flow_token_issued", {
        actor_template: template,
        userId: user.id,
        kind: "EmailVerificationToken",
        expiresAt: issued.expiresAt.toISOString(),
      });
      const result = await sendWelcomeEmail({
        user,
        token: issued.token,
        expiresAt: issued.expiresAt,
      });
      return mapFlowResult(result);
    }
    if (template === "full_flow_password_reset") {
      const issued = await issuePasswordResetToken(user.id);
      logger.info("admin.email.full_flow_token_issued", {
        actor_template: template,
        userId: user.id,
        kind: "PasswordResetToken",
        expiresAt: issued.expiresAt.toISOString(),
      });
      const result = await sendPasswordResetEmail({
        user,
        token: issued.token,
        expiresAt: issued.expiresAt,
      });
      return mapFlowResult(result);
    }
    // full_flow_verify_email
    const issued = await issueEmailVerificationToken(user.id);
    logger.info("admin.email.full_flow_token_issued", {
      actor_template: template,
      userId: user.id,
      kind: "EmailVerificationToken",
      expiresAt: issued.expiresAt.toISOString(),
    });
    const result = await sendEmailVerificationEmail({
      user,
      token: issued.token,
      expiresAt: issued.expiresAt,
    });
    return mapFlowResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    // Translate the common Prisma error shapes ("relation does not
    // exist", "column does not exist") into a stage label so the
    // structured log says explicitly that a table or column is missing
    // — which is what the dashboard banner reads.
    const reason = /relation .* does not exist/i.test(message)
      ? "database_table_missing"
      : /column .* does not exist/i.test(message)
        ? "database_column_missing"
        : "token_creation_failed";
    logger.error("admin.email.full_flow_token_failed", {
      to,
      template,
      reason,
      message,
    });
    return {
      ok: false,
      stage: "token_creation",
      reason,
      errorMessage: message,
    };
  }
}

function mapFlowResult(result: Awaited<ReturnType<typeof sendWelcomeEmail>>):
  | { ok: true; delivery: "sent" | "skipped"; reason: "not_configured" | null }
  | {
      ok: false;
      reason: string;
      errorName?: string;
      errorMessage?: string;
      statusCode?: number;
      stage: "delivery";
    } {
  if (result.ok) {
    return {
      ok: true,
      delivery: result.delivery,
      reason: result.delivery === "skipped" ? result.reason : null,
    };
  }
  return {
    ok: false,
    stage: "delivery",
    reason: result.reason,
    errorName: result.errorName,
    errorMessage: result.errorMessage,
    statusCode: result.statusCode,
  };
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
 *                                 receives at registration (synthetic
 *                                 token; not written to the database).
 *   - "password_reset"          : the exact password-reset email (synthetic
 *                                 token).
 *   - "verify_email"            : the exact resend-verification email
 *                                 (synthetic token).
 *   - "full_flow_welcome"          : end-to-end welcome flow — looks up the
 *                                    real account, writes a real
 *                                    EmailVerificationToken row, then
 *                                    sends the welcome email.
 *   - "full_flow_password_reset"   : end-to-end password reset — writes a
 *                                    real PasswordResetToken row, then
 *                                    sends the reset email.
 *   - "full_flow_verify_email"     : end-to-end resend-verification flow.
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

  if (
    template === "full_flow_welcome" ||
    template === "full_flow_password_reset" ||
    template === "full_flow_verify_email"
  ) {
    const flow = await runFullFlow(template, parsed.data.to);
    if (flow.ok) {
      return jsonOk({
        sent: flow.delivery === "sent",
        delivery: flow.delivery,
        reason: flow.reason,
        fromAddress: appConfig.email.fromAddress,
        flow: template,
      });
    }
    return jsonError("server_error", {
      message: "delivery_failed",
      details: {
        reason: flow.reason,
        stage: flow.stage,
        errorName: flow.errorName,
        errorMessage: flow.errorMessage,
        statusCode: flow.statusCode,
        fromAddress: appConfig.email.fromAddress,
        flow: template,
      },
    });
  }

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
