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
const VALID_PASSWORD = "Newp4ss!";

beforeEach(() => {
  rateLimitMock.mockReset();
  consumePasswordResetTokenMock.mockReset();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 2, resetAt: Date.now() + 60_000 });
});

afterEach(() => {
  vi.useRealTimers();
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
      buildRequest({ token: VALID_TOKEN, password: "Padre", passwordConfirm: "Padre" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("weak");
  });

  it("rejects passwords missing a capital letter", async () => {
    const res = await POST(
      buildRequest({ token: VALID_TOKEN, password: "padre1", passwordConfirm: "padre1" }),
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
