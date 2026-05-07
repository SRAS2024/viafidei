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
  it("returns delivery=skipped when RESEND_API_KEY is missing — even in production", async () => {
    // Email features are intentionally optional. Without an API key, sends
    // are skipped cleanly so account flows do not 500.
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

  it("returns delivery=skipped in development when RESEND_API_KEY missing (no fetch call)", async () => {
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
    const body = JSON.parse(init.body as string) as Record<string, string>;
    // The from address comes from the hardcoded app config — there is no
    // EMAIL_FROM_ADDRESS environment variable any more.
    expect(body.from).toBe("notifications@etviafidei.com");
    expect(body.to).toBe("to@example.com");
    expect(body.subject).toBe("Hello");
    expect(body.text).toBe("Body");
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
      expect(logLine).toContain('"from":"notifications@etviafidei.com"');
    }
    errorSpy.mockRestore();
  });
});
