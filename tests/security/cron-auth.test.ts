import { beforeEach, describe, expect, it } from "vitest";
import { isAuthorizedCron, deriveCronSecret } from "@/lib/security/cron-auth";

type FakeRequest = {
  headers: { get(name: string): string | null };
  ip?: string;
};

function makeReq(opts: {
  bearer?: string;
  ip?: string;
  xForwardedFor?: string;
  xRealIp?: string;
}): FakeRequest {
  const headerMap: Record<string, string> = {};
  if (opts.bearer) headerMap["authorization"] = `Bearer ${opts.bearer}`;
  if (opts.xForwardedFor) headerMap["x-forwarded-for"] = opts.xForwardedFor;
  if (opts.xRealIp) headerMap["x-real-ip"] = opts.xRealIp;
  return {
    headers: {
      get(name: string) {
        return headerMap[name.toLowerCase()] ?? null;
      },
    },
    ip: opts.ip,
  };
}

const STRONG_SECRET = "a".repeat(64);

beforeEach(() => {
  delete process.env.SESSION_SECRET;
});

describe("isAuthorizedCron — bearer path", () => {
  it("accepts a request carrying the SESSION_SECRET-derived bearer", async () => {
    process.env.SESSION_SECRET = STRONG_SECRET;
    const secret = await deriveCronSecret();
    expect(secret).toBeTruthy();
    const req = makeReq({ bearer: secret!, ip: "203.0.113.10" }) as never;
    expect(await isAuthorizedCron(req)).toBe(true);
  });

  it("rejects a request with the wrong bearer from a non-loopback IP", async () => {
    process.env.SESSION_SECRET = STRONG_SECRET;
    const req = makeReq({ bearer: "wrong-secret", ip: "203.0.113.10" }) as never;
    expect(await isAuthorizedCron(req)).toBe(false);
  });
});

describe("isAuthorizedCron — loopback fallback (in-process scheduler)", () => {
  it("accepts a no-bearer request from 127.0.0.1 even without SESSION_SECRET", async () => {
    const req = makeReq({ ip: "127.0.0.1" }) as never;
    expect(await isAuthorizedCron(req)).toBe(true);
  });

  it("accepts ::1 (IPv6 loopback)", async () => {
    const req = makeReq({ ip: "::1" }) as never;
    expect(await isAuthorizedCron(req)).toBe(true);
  });

  it("accepts the IPv4-mapped IPv6 loopback ::ffff:127.0.0.1", async () => {
    const req = makeReq({ ip: "::ffff:127.0.0.1" }) as never;
    expect(await isAuthorizedCron(req)).toBe(true);
  });

  it("rejects a non-loopback IP with no bearer", async () => {
    const req = makeReq({ ip: "203.0.113.10" }) as never;
    expect(await isAuthorizedCron(req)).toBe(false);
  });

  it("rejects a 127.0.0.1 source IP if x-forwarded-for is set (proxy spoofing guard)", async () => {
    const req = makeReq({ ip: "127.0.0.1", xForwardedFor: "203.0.113.10" }) as never;
    expect(await isAuthorizedCron(req)).toBe(false);
  });

  it("rejects a 127.0.0.1 source IP if x-real-ip is set", async () => {
    const req = makeReq({ ip: "127.0.0.1", xRealIp: "203.0.113.10" }) as never;
    expect(await isAuthorizedCron(req)).toBe(false);
  });

  it("rejects a request with no IP at all", async () => {
    const req = makeReq({}) as never;
    expect(await isAuthorizedCron(req)).toBe(false);
  });
});
