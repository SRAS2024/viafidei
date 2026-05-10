import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("sendTransactionalEmail (Resend)", () => {
  it("returns delivery=skipped when RESEND_API_KEY is unset — even in production", async () => {
    // Email is a transport-layer optional. Without an API key, sends are
    // skipped cleanly and the calling routes surface
    // `email_not_configured` so the user knows delivery did not happen.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    const result = await sendTransactionalEmail({
      to: "x@example.com",
      subject: "s",
      textBody: "t",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns delivery=skipped in development when RESEND_API_KEY is unset (no fetch call)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    const result = await sendTransactionalEmail({
      to: "x@example.com",
      subject: "s",
      textBody: "t",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores the legacy RESEND env var — only RESEND_API_KEY is honored", async () => {
    // Earlier revisions of this code accepted both RESEND_API_KEY and
    // RESEND. The contract is now strict: only RESEND_API_KEY (the name
    // Resend documents) is read. A deployment that has only `RESEND` set
    // is treated as unconfigured, matching what the diagnostic reports.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND", "re_short_form_key");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail, isEmailConfigured } = await import("@/lib/email/resend");
    expect(isEmailConfigured()).toBe(false);
    const result = await sendTransactionalEmail({
      to: "to@example.com",
      subject: "s",
      textBody: "t",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses RESEND_API_KEY exactly as set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_canonical");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    await sendTransactionalEmail({ to: "to@example.com", subject: "s", textBody: "t" });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer re_canonical");
  });

  it("posts to Resend when configured and returns delivery=sent on 200", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    const result = await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Hello",
      textBody: "Body",
      htmlBody: "<p>Body</p>",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("sent");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-resend-key");
    const body = JSON.parse(init.body as string) as {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
      reply_to: string;
      headers: Record<string, string>;
    };
    // The from address comes from the hardcoded app config — there is no
    // EMAIL_FROM_ADDRESS environment variable. It MUST go out as
    // "Display Name <address>" so inbox providers show a friendly
    // sender column; bare emails dramatically increase spam-filter
    // false positives for new sender domains.
    expect(body.from).toBe("Via Fidei <notifications@viafidei.com>");
    expect(body.to).toBe("to@example.com");
    expect(body.subject).toBe("Hello");
    expect(body.text).toBe("Body");
    // Reply-To and List-Unsubscribe-Post headers ride on every send to
    // signal "transactional, not bulk" to inbox providers.
    expect(body.reply_to).toBe("notifications@viafidei.com");
    expect(body.headers["List-Unsubscribe"]).toContain("notifications@viafidei.com");
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(body.html).toBe("<p>Body</p>");
  });

  it("returns delivery_failed when Resend responds non-2xx", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    const result = await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Hello",
      textBody: "Body",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("delivery_failed");
  });

  it("logs Resend's structured error name + message on a 422 unverified-domain reply", async () => {
    // Verifies the diagnostic path operators rely on when a sender domain
    // hasn't been verified in Resend: the JSON body must be parsed for
    // `name` and `message` and surfaced in the structured log line so the
    // remediation ("verify the domain in Resend") is obvious from the log
    // alone — not an opaque "non-2xx".
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    const errorBody = JSON.stringify({
      name: "validation_error",
      message: "The example.com domain is not verified.",
      statusCode: 422,
    });
    const fetchSpy = vi.fn(async () => new Response(errorBody, { status: 422 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    const result = await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Hello",
      textBody: "Body",
    });
    expect(result.ok).toBe(false);
    const logLine = errorSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((s) => s.includes('"msg":"email.delivery_failed"'));
    expect(logLine).toBeTruthy();
    if (logLine) {
      expect(logLine).toContain('"errorName":"validation_error"');
      expect(logLine).toContain('"errorMessage":"The example.com domain is not verified."');
      expect(logLine).toContain('"from":"notifications@viafidei.com"');
      // The structured `category` field maps the free-form Resend name +
      // message into one of four operator-fixable buckets; a sender
      // domain that has not been verified must land in
      // sender_domain_rejected so a grep finds it.
      expect(logLine).toContain('"category":"sender_domain_rejected"');
    }
    errorSpy.mockRestore();
  });

  it("emits an `email.skipped_not_configured` log line when RESEND_API_KEY is missing", async () => {
    // The structured log line is the single source of truth that
    // operators search for when accounts are not getting verification
    // links. If this log changes shape or stops firing, the dashboard
    // banner is the user's only signal — make sure it's loud.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    await sendTransactionalEmail({ to: "to@example.com", subject: "s", textBody: "t" });
    const logLine = errorSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((s) => s.includes('"msg":"email.skipped_not_configured"'));
    expect(logLine).toBeTruthy();
    if (logLine) {
      expect(logLine).toContain('"reason":"RESEND_API_KEY missing"');
    }
    errorSpy.mockRestore();
  });

  it("classifies `restricted_api_key` errors into the operator-readable category", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    const errorBody = JSON.stringify({
      name: "restricted_api_key",
      message: "The API key is restricted to sending test emails only.",
      statusCode: 403,
    });
    const fetchSpy = vi.fn(async () => new Response(errorBody, { status: 403 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    await sendTransactionalEmail({ to: "to@example.com", subject: "s", textBody: "t" });
    const logLine = errorSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((s) => s.includes('"msg":"email.delivery_failed"'));
    expect(logLine).toContain('"category":"restricted_api_key"');
    errorSpy.mockRestore();
  });
});
