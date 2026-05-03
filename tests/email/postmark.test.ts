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

describe("sendTransactionalEmail", () => {
  it("returns ok=false reason=not_configured in production when env missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    const { sendTransactionalEmail } = await import("@/lib/email/postmark");
    const result = await sendTransactionalEmail({
      to: "x@example.com",
      subject: "s",
      textBody: "t",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_configured");
  });

  it("returns ok=true delivery=skipped in dev when env missing (no fetch call)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/postmark");
    const result = await sendTransactionalEmail({
      to: "x@example.com",
      subject: "s",
      textBody: "t",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to Postmark when configured and returns delivery=sent on 200", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "tok");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "from@example.com");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/postmark");
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
    expect(headers["X-Postmark-Server-Token"]).toBe("tok");
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body.From).toBe("from@example.com");
    expect(body.To).toBe("to@example.com");
    expect(body.Subject).toBe("Hello");
    expect(body.TextBody).toBe("Body");
    expect(body.HtmlBody).toBe("<p>Body</p>");
  });

  it("returns delivery_failed when Postmark responds non-2xx", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "tok");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "from@example.com");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { sendTransactionalEmail } = await import("@/lib/email/postmark");
    const result = await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Hello",
      textBody: "Body",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("delivery_failed");
  });
});
