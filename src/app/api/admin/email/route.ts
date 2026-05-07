import { type NextRequest } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger } from "@/lib/observability";

/**
 * Diagnostic endpoint for the email pipeline. Returns:
 *   - whether RESEND_API_KEY is set in the runtime env
 *   - the configured `from` address the app would use for a real send
 *   - a redacted preview of the API key (first 4 chars + length)
 * so the operator can confirm the deployed environment matches the Resend
 * account they expect.
 *
 * Locked behind requireAdmin so the API key length / sender domain are
 * never exposed publicly. The key itself is never returned in full.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const env = getEnv();
  const apiKey = env.RESEND_API_KEY ?? "";
  const configured = apiKey.length > 0;
  return jsonOk({
    configured,
    fromAddress: appConfig.email.fromAddress,
    provider: appConfig.email.providerName,
    apiKeyPreview: configured ? `${apiKey.slice(0, 4)}…(${apiKey.length} chars)` : null,
  });
}

const testSendSchema = z.object({
  to: z.string().email().max(200),
});

/**
 * Sends a real test email through the configured Resend account so the
 * operator can verify the sender domain is verified end-to-end. Returns
 * the structured result from the Resend client (including any
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

  logger.info("admin.email.test_send", { actor: admin.username, to: parsed.data.to });

  const result = await sendTransactionalEmail({
    to: parsed.data.to,
    subject: "Via Fidei email diagnostic",
    textBody: [
      "This is a test email sent from the Via Fidei admin diagnostic.",
      "",
      `Sender domain: ${appConfig.email.fromAddress}`,
      `Triggered by: ${admin.username}`,
      `Time: ${new Date().toUTCString()}`,
      "",
      "If you received this message, Resend delivery is working.",
    ].join("\n"),
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
