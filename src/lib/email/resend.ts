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

type ResendErrorBody = {
  name?: string;
  message?: string;
  statusCode?: number;
};

/**
 * Pull a sanitized failure description out of Resend's JSON error body so
 * the operator log explains *why* delivery failed (unverified sender,
 * invalid recipient, bad API key, rate limit, …) instead of just "non-2xx".
 * Never returns the raw response body — only the keys we know are safe to
 * log (name + message + statusCode).
 */
async function describeResendError(res: Response): Promise<{
  name: string;
  message: string;
  statusCode: number;
}> {
  let parsed: ResendErrorBody = {};
  try {
    parsed = (await res.json()) as ResendErrorBody;
  } catch {
    // Resend returned non-JSON (rare). Fall through to the status-only path.
  }
  return {
    name: typeof parsed.name === "string" ? parsed.name : "unknown",
    message:
      typeof parsed.message === "string" && parsed.message.length > 0
        ? parsed.message
        : `HTTP ${res.status}`,
    statusCode:
      typeof parsed.statusCode === "number" && Number.isFinite(parsed.statusCode)
        ? parsed.statusCode
        : res.status,
  };
}

/**
 * Best-effort transactional email delivery via Resend.
 *
 * The function never throws. When RESEND_API_KEY is not configured the call
 * is logged and skipped with `delivery: "skipped"` — this lets reset-password,
 * welcome, and verification flows degrade gracefully (the rest of the
 * account flow still succeeds) instead of returning a 500 to the client.
 *
 * On a Resend 4xx/5xx the response JSON is parsed for `name`, `message`, and
 * `statusCode` (the three fields documented in the Resend error contract) and
 * those are emitted as a structured log line. Common operator-fixable cases
 * — a sender domain that has not been verified, an unverified API key, or a
 * blocked recipient — show up with a clear `name` (e.g. `validation_error`,
 * `restricted_api_key`) instead of an opaque "delivery_failed".
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
      const detail = await describeResendError(res);
      logger.error("email.delivery_failed", {
        status: res.status,
        subject: input.subject,
        from: config.from,
        // `name` is Resend's machine-readable error code (validation_error,
        // restricted_api_key, …). `message` is the human description.
        // Neither contains the email body or the API key.
        errorName: detail.name,
        errorMessage: detail.message,
      });
      return { ok: false, reason: "delivery_failed" };
    }
    return { ok: true, delivery: "sent" };
  } catch (error) {
    // Log a sanitized error message — bodies, headers, and tokens are not logged.
    const message = error instanceof Error ? error.message : "unknown_error";
    logger.error("email.delivery_error", {
      message,
      subject: input.subject,
      from: config.from,
    });
    return { ok: false, reason: "delivery_failed" };
  }
}
