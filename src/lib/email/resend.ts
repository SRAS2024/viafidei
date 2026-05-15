import { appConfig } from "@/lib/config";
import { logger } from "@/lib/observability";

export type SendEmailInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  /**
   * Optional file attachments. Resend accepts a `content` field that is
   * a base64-encoded payload for binary attachments (PDFs, etc.). The
   * monthly Error Report uses this to ship a generated PDF without
   * needing an S3 bucket or external file host.
   */
  attachments?: Array<{
    filename: string;
    /** Base64-encoded binary contents. */
    content: string;
    contentType?: string;
  }>;
};

export type SendEmailResult =
  | { ok: true; delivery: "sent" }
  | { ok: true; delivery: "skipped"; reason: "not_configured" }
  | {
      ok: false;
      reason: "not_configured" | "delivery_failed";
      // Populated on a Resend 4xx/5xx so the admin diagnostic UI can
      // render the actual cause (unverified sender, restricted API key,
      // …) without exposing the raw response or the API key.
      errorName?: string;
      errorMessage?: string;
      statusCode?: number;
    };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type ResendConfig = { apiKey: string; from: string };

/**
 * Read the Resend API key from `process.env.RESEND_API_KEY` — the canonical
 * variable name documented by Resend. The diagnostic page and every
 * account email flow (welcome, password reset, verification) read the
 * same value through this helper so they cannot disagree about whether
 * email is configured. Returns the trimmed key, or null when the variable
 * is unset or empty.
 */
export function readResendApiKey(): string | null {
  const candidate = process.env.RESEND_API_KEY;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve the Resend configuration on every call from `process.env`
 * directly. Reading it through the cached `getEnv()` validator works in
 * theory, but in practice we have hit deployments where the env value was
 * present at runtime but not in the cached snapshot, so any send issued
 * before the first explicit `getEnv()` call would silently skip. Going
 * straight to `process.env` removes that timing dependency entirely —
 * Node refreshes `process.env` on every read and PaaS hosts (Railway,
 * Vercel) inject env values before the first request is served.
 */
function readResendConfig(): ResendConfig | null {
  const apiKey = readResendApiKey();
  if (!apiKey) return null;
  return { apiKey, from: appConfig.email.fromAddress };
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
 * Bucket Resend's free-form error names + messages into the four
 * operator-fixable failure categories that show up in production:
 *   - `sender_domain_rejected` — the From domain has not been verified
 *   - `restricted_api_key`     — the key is sandboxed or scoped wrong
 *   - `invalid_recipient`      — the To address was rejected
 *   - `other`                  — anything else (network error, throttling)
 * The category lands in the structured log so a grep finds the bucket
 * before the operator opens the Resend dashboard.
 */
function classifyResendError(name: string, message: string): string {
  const haystack = `${name} ${message}`.toLowerCase();
  if (
    name === "restricted_api_key" ||
    /restricted\s+api\s+key|api\s+key.*(restricted|invalid|expired)/i.test(haystack)
  ) {
    return "restricted_api_key";
  }
  if (
    /domain.*(not\s+verified|unverified|not\s+found)/i.test(haystack) ||
    /verify.*domain/i.test(haystack)
  ) {
    return "sender_domain_rejected";
  }
  if (
    /invalid.*(to|recipient|email)|recipient.*invalid|to.*invalid/i.test(haystack) ||
    /bounce|rejected.*recipient/i.test(haystack)
  ) {
    return "invalid_recipient";
  }
  return "other";
}

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
    // as a non-fatal outcome at the transport layer; the calling routes
    // surface it to the user as `email_not_configured` so they can
    // contact support instead of staring at an empty inbox.
    logger.warn("email.skipped_not_configured", {
      to: input.to,
      subject: input.subject,
      reason: "RESEND_API_KEY missing",
    });
    return { ok: true, delivery: "skipped", reason: "not_configured" };
  }

  try {
    // Use a "Display Name <address>" format for the from address so
    // inbox providers show a recognizable sender column. New sender
    // domains delivering to Gmail / Outlook / Apple Mail land in spam
    // far more often when the From column shows a bare email; a
    // friendly display name is one of the strongest single-knob
    // deliverability improvements available.
    const fromHeader = `${appConfig.email.fromName} <${config.from}>`;
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        from: fromHeader,
        to: input.to,
        subject: input.subject,
        text: input.textBody,
        html: input.htmlBody,
        ...(input.attachments && input.attachments.length > 0
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                content_type: a.contentType ?? "application/octet-stream",
              })),
            }
          : {}),
        // Reply-To set on every transactional message: signals to
        // mailbox providers that this is a real conversational
        // message (not bulk marketing), nudging it toward the inbox.
        reply_to: appConfig.email.replyToAddress,
        // Headers chosen specifically to keep transactional account
        // mail (welcome, verify, reset) in the inbox rather than the
        // spam folder. We learned this the hard way: the plain
        // diagnostic landed in the inbox while the HTML templates
        // landed in spam. The fix is two parts:
        //
        //   1. DROP `List-Unsubscribe` / `List-Unsubscribe-Post`. Those
        //      headers tell Gmail / Yahoo "this is bulk marketing" —
        //      they're required only for senders exceeding 5000
        //      messages/day. On a new sender domain with low volume,
        //      adding them paints transactional account mail as
        //      bulk-marketing and nudges it toward spam. Account email
        //      is one-to-one transactional; no unsubscribe is possible.
        //
        //   2. ADD `Auto-Submitted: auto-generated` (RFC 3834). This
        //      is the canonical "system-generated, not bulk" marker.
        //      Receivers use it to route the message into the inbox's
        //      transactional bucket rather than the marketing bucket.
        //      Combined with `Precedence: bulk`'s absence, this puts
        //      the message in the same class as password-reset emails
        //      from major providers.
        //
        //   3. ADD `X-Auto-Response-Suppress: All` (Microsoft) to stop
        //      Exchange / Outlook from generating auto-replies that
        //      bounce against the noreply address.
        headers: {
          "Auto-Submitted": "auto-generated",
          "X-Auto-Response-Suppress": "All",
        },
      }),
    });
    if (!res.ok) {
      const detail = await describeResendError(res);
      // Map common Resend error names to operator-readable categories so
      // the structured log line names the remediation directly: an
      // unverified sender domain, a restricted API key, or an invalid
      // recipient address each have different fixes.
      const category = classifyResendError(detail.name, detail.message);
      logger.error("email.delivery_failed", {
        status: res.status,
        subject: input.subject,
        from: config.from,
        // `name` is Resend's machine-readable error code (validation_error,
        // restricted_api_key, …). `message` is the human description.
        // Neither contains the email body or the API key.
        errorName: detail.name,
        errorMessage: detail.message,
        category,
      });
      return {
        ok: false,
        reason: "delivery_failed",
        errorName: detail.name,
        errorMessage: detail.message,
        statusCode: detail.statusCode,
      };
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
    return {
      ok: false,
      reason: "delivery_failed",
      errorName: "transport_error",
      errorMessage: message,
    };
  }
}
