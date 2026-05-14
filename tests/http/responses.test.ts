import { describe, expect, it } from "vitest";
import { jsonError, jsonOk } from "@/lib/http/responses";
import { REQUEST_ID_HEADER } from "@/lib/observability";

describe("jsonOk", () => {
  it("returns a 200 with { ok: true, ...data }", async () => {
    const res = jsonOk({ count: 3 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, count: 3 });
  });

  it("returns just { ok: true } when called with no data", async () => {
    const res = jsonOk();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("jsonError", () => {
  it("maps a known code to the right status", async () => {
    expect(jsonError("unauthorized").status).toBe(401);
    expect(jsonError("forbidden").status).toBe(403);
    expect(jsonError("not_found").status).toBe(404);
    expect(jsonError("conflict").status).toBe(409);
    expect(jsonError("invalid").status).toBe(400);
    expect(jsonError("too_large").status).toBe(413);
    expect(jsonError("rate_limited").status).toBe(429);
    expect(jsonError("server_error").status).toBe(500);
  });

  it("returns { ok: false, error: code } in the body by default", async () => {
    const res = jsonError("not_found");
    expect(await res.json()).toEqual({ ok: false, error: "not_found" });
  });

  it("includes an optional human-readable message", async () => {
    const res = jsonError("invalid", { message: "password_invalid" });
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid",
      message: "password_invalid",
    });
  });

  it("includes structured details when provided", async () => {
    const res = jsonError("invalid", { details: { field: "email" } });
    const body = await res.json();
    expect(body.details).toEqual({ field: "email" });
  });

  it("surfaces request id in both the response body and the X-Request-Id header", async () => {
    const res = jsonError("server_error", { requestId: "req-abc123" });
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("req-abc123");
    const body = await res.json();
    expect(body.requestId).toBe("req-abc123");
  });

  it("does not surface a request id when none is provided (no empty header)", async () => {
    const res = jsonError("server_error");
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeNull();
    const body = await res.json();
    expect(body.requestId).toBeUndefined();
  });

  it("respects an explicit status override (e.g. 422 for a special invalid case)", async () => {
    const res = jsonError("invalid", { status: 422 });
    expect(res.status).toBe(422);
    // The error code in the body still reflects the semantic category.
    expect((await res.json()).error).toBe("invalid");
  });
});
