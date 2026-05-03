import { getEnv, isProduction } from "@/lib/env";
import { logger } from "@/lib/observability";

export type SendEmailInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  messageStream?: string;
};

export type SendEmailResult =
  | { ok: true; delivery: "sent" }
  | { ok: true; delivery: "skipped"; reason: "not_configured" }
  | { ok: false; reason: "not_configured" | "delivery_failed" };

const POSTMARK_ENDPOINT = "https://api.postmarkapp.com/email";

type PostmarkConfig = { token: string; from: string };

function readPostmarkConfig(): PostmarkConfig | null {
  const env = getEnv();
  if (!env.POSTMARK_SERVER_TOKEN || !env.EMAIL_FROM_ADDRESS) return null;
  return { token: env.POSTMARK_SERVER_TOKEN, from: env.EMAIL_FROM_ADDRESS };
}

export function isEmailConfigured(): boolean {
  return readPostmarkConfig() !== null;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = readPostmarkConfig();
  if (!config) {
    if (isProduction()) {
      logger.error("email.not_configured", { subject: input.subject });
      return { ok: false, reason: "not_configured" };
    }
    logger.warn("email.skipped_dev_no_config", {
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, delivery: "skipped", reason: "not_configured" };
  }

  try {
    const res = await fetch(POSTMARK_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": config.token,
      },
      body: JSON.stringify({
        From: config.from,
        To: input.to,
        Subject: input.subject,
        TextBody: input.textBody,
        HtmlBody: input.htmlBody,
        MessageStream: input.messageStream ?? "outbound",
      }),
    });
    if (!res.ok) {
      logger.error("email.delivery_failed", {
        status: res.status,
        subject: input.subject,
      });
      return { ok: false, reason: "delivery_failed" };
    }
    return { ok: true, delivery: "sent" };
  } catch (error) {
    logger.error("email.delivery_error", { error, subject: input.subject });
    return { ok: false, reason: "delivery_failed" };
  }
}
