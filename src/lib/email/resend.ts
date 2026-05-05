import { appConfig } from "@/lib/config";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/observability";

export type SendEmailInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
};

export type SendEmailResult =
  | { ok: true; delivery: "sent" }
  | { ok: true; delivery: "skipped"; reason: "not_configured" }
  | { ok: false; reason: "not_configured" | "delivery_failed" };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type ResendConfig = { apiKey: string; from: string };

function readResendConfig(): ResendConfig | null {
  const env = getEnv();
  if (!env.RESEND_API_KEY) return null;
  return { apiKey: env.RESEND_API_KEY, from: appConfig.email.fromAddress };
}

export function isEmailConfigured(): boolean {
  return readResendConfig() !== null;
}

/**
 * Best-effort transactional email delivery via Resend.
 *
 * The function never throws. When RESEND_API_KEY is not configured the call
 * is logged and skipped with `delivery: "skipped"` — this lets reset-password,
 * welcome, and verification flows degrade gracefully (the rest of the
 * account flow still succeeds) instead of returning a 500 to the client.
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = readResendConfig();
  if (!config) {
    // No provider configured — log and skip cleanly. Auth flows treat this
    // as a non-fatal outcome.
    logger.warn("email.skipped_not_configured", {
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, delivery: "skipped", reason: "not_configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: input.to,
        subject: input.subject,
        text: input.textBody,
        html: input.htmlBody,
      }),
    });
    if (!res.ok) {
      // Log only the subject and status — never bodies or tokens.
      logger.error("email.delivery_failed", {
        status: res.status,
        subject: input.subject,
      });
      return { ok: false, reason: "delivery_failed" };
    }
    return { ok: true, delivery: "sent" };
  } catch (error) {
    // Log a sanitized error message — bodies, headers, and tokens are not logged.
    const message = error instanceof Error ? error.message : "unknown_error";
    logger.error("email.delivery_error", { message, subject: input.subject });
    return { ok: false, reason: "delivery_failed" };
  }
}
