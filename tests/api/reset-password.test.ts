import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitMock = vi.fn();
const consumePasswordResetTokenMock = vi.fn();

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return {
    ...actual,
    rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  };
});

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/schemas")>("@/lib/auth/schemas");
  return {
    ...actual,
    consumePasswordResetToken: (...args: unknown[]) => consumePasswordResetTokenMock(...args),
  };
});

import { POST } from "@/app/api/auth/reset-password/route";
import type { NextRequest } from "next/server";

function buildRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.2" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_TOKEN = "a".repeat(40);
const VALID_PASSWORD = "Newp4ss!Strong";

function buildFormPost(fields: Record<string, string>): NextRequest {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "203.0.113.2",
    },
    body: new URLSearchParams(fields).toString(),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  rateLimitMock.mockReset();
  consumePasswordResetTokenMock.mockReset();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 2, resetAt: Date.now() + 60_000 });
});

afterEach(() => {
  vi.useRealTimers();
});

// Pressed before its script has run, or where script never runs, the form is a plain post.
// It used to reach nothing: the fields emptied, the token stayed unused and nothing was said.
describe("POST /api/auth/reset-password, as a plain form post", () => {
  const FIELDS = {
    token: VALID_TOKEN,
    password: VALID_PASSWORD,
    passwordConfirm: VALID_PASSWORD,
  };
  const landing = (res: Response) => new URL(res.headers.get("location")!);

  it("resets the password and goes to log in, which says so", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: true, userId: "u1" });
    const res = await POST(buildFormPost(FIELDS));
    expect(res.status).toBe(303);
    expect(landing(res).pathname).toBe("/login");
    expect(landing(res).search).toBe("?notice=password_reset");
    expect(consumePasswordResetTokenMock).toHaveBeenCalledWith(VALID_TOKEN, VALID_PASSWORD);
  });

  it.each([
    ["weak", { ...FIELDS, password: "Aa1", passwordConfirm: "Aa1" }],
    ["mismatch", { ...FIELDS, passwordConfirm: `${VALID_PASSWORD}X` }],
    ["weak", { ...FIELDS, password: "", passwordConfirm: "" }],
  ])("goes back to the form as %s, consuming nothing", async (reason, fields) => {
    const res = await POST(buildFormPost(fields));
    expect(res.status).toBe(303);
    expect(landing(res).pathname).toBe("/reset-password");
    expect(landing(res).searchParams.get("error")).toBe(reason);
    expect(landing(res).searchParams.get("token")).toBe(VALID_TOKEN);
    expect(consumePasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it.each(["not_found", "expired", "used"])("says why when the link is %s", async (reason) => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: false, reason });
    const res = await POST(buildFormPost(FIELDS));
    expect(landing(res).pathname).toBe("/reset-password");
    expect(landing(res).searchParams.get("error")).toBe(reason);
  });

  it("says so when the write fails", async () => {
    consumePasswordResetTokenMock.mockRejectedValue(new Error("connection lost"));
    const res = await POST(buildFormPost(FIELDS));
    expect(landing(res).searchParams.get("error")).toBe("server_error");
  });

  it("says so when rate limited", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() });
    const res = await POST(buildFormPost(FIELDS));
    expect(landing(res).searchParams.get("error")).toBe("rate_limited");
    expect(consumePasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a mismatch", { ...FIELDS, passwordConfirm: `${VALID_PASSWORD}X` }],
    ["a weak one", { ...FIELDS, password: "Aa1!weak", passwordConfirm: "Aa1!weak" }],
  ])("never puts a password in the URL, for %s", async (_label, fields) => {
    const res = await POST(buildFormPost(fields));
    const location = res.headers.get("location")!;
    expect(location).not.toContain(encodeURIComponent(fields.password));
    expect(location).not.toContain(fields.password);
    expect(location).not.toContain("password=");
    expect(location).not.toContain("passwordConfirm=");
  });

  it("has no token to carry back when the post has none", async () => {
    const res = await POST(buildFormPost({ password: "x", passwordConfirm: "x" }));
    expect(landing(res).pathname).toBe("/reset-password");
    expect(landing(res).searchParams.has("token")).toBe(false);
  });

  it("calls a token too short to be one a bad link, whatever was typed", async () => {
    const res = await POST(buildFormPost({ token: "short", password: "x", passwordConfirm: "x" }));
    expect(landing(res).searchParams.get("error")).toBe("not_found");
    expect(consumePasswordResetTokenMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password", () => {
  it("rejects rate-limited requests", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() });
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        passwordConfirm: VALID_PASSWORD,
      }),
    );
    expect(res.status).toBe(429);
    expect(consumePasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        passwordConfirm: VALID_PASSWORD + "X",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("invalid");
    expect(body.message).toBe("mismatch");
    expect(consumePasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it("rejects weak passwords below the minimum length", async () => {
    const res = await POST(
      buildRequest({ token: VALID_TOKEN, password: "Aa1", passwordConfirm: "Aa1" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("weak");
    expect(consumePasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it("rejects passwords missing a number", async () => {
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: "PadreAlbino!ee",
        passwordConfirm: "PadreAlbino!ee",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("weak");
  });

  it("rejects passwords missing a capital letter", async () => {
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: "padrealb1no!!!",
        passwordConfirm: "padrealb1no!!!",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("weak");
  });

  it("rejects passwords missing a special character", async () => {
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: "PadreAlb1noXYZ",
        passwordConfirm: "PadreAlb1noXYZ",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("weak");
  });

  it("rejects passwords shorter than 12 characters", async () => {
    const res = await POST(
      buildRequest({ token: VALID_TOKEN, password: "Aa1!short", passwordConfirm: "Aa1!short" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("weak");
  });

  it("returns not_found when token is unknown", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        passwordConfirm: VALID_PASSWORD,
      }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("returns invalid+message=expired for expired tokens", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: false, reason: "expired" });
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        passwordConfirm: VALID_PASSWORD,
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("invalid");
    expect(body.message).toBe("expired");
  });

  it("returns invalid+message=used for already-consumed tokens", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: false, reason: "used" });
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        passwordConfirm: VALID_PASSWORD,
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("used");
  });

  it("returns ok on a successful reset", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: true, userId: "u1" });
    const res = await POST(
      buildRequest({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        passwordConfirm: VALID_PASSWORD,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; reset: boolean };
    expect(body).toEqual({ ok: true, reset: true });
  });
});
