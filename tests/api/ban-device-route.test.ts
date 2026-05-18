/**
 * Tests for the signed-link /api/security/ban-device/[token] route.
 *
 * Proves:
 *   * A valid signed token creates a BannedDevice row.
 *   * An invalid signature is rejected with 400.
 *   * An expired token is rejected with 400.
 *   * A second click on the same token is idempotent (no duplicate row).
 *   * The route deletes sessions tied to the device credential.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { encodeBanToken } from "@/lib/security/ban-token";

beforeEach(() => {
  resetPrismaMock();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

async function callRoute(token: string): Promise<Response> {
  const { GET } = await import("@/app/api/security/ban-device/[token]/route");
  const req = new Request(`http://localhost/api/security/ban-device/${token}`) as never;
  return GET(req, { params: Promise.resolve({ token }) });
}

describe("/api/security/ban-device/[token]", () => {
  it("a valid token creates a BannedDevice row and shows a confirmation page", async () => {
    const token = encodeBanToken({
      securityEventId: "evt_ok",
      deviceCredentialHash: "fp_ok",
      expiresAt: Date.now() + 60_000,
    });
    prismaMock.securityEvent.findUnique.mockResolvedValue({
      id: "evt_ok",
      eventType: "sqli_attempt",
      ipAddressHash: null,
      userAgentHash: null,
    });
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
    let written: Record<string, unknown> = {};
    prismaMock.bannedDevice.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        written = data;
        return { id: "bd_1", ...data, createdAt: new Date(), updatedAt: new Date() };
      },
    );
    prismaMock.session.deleteMany.mockResolvedValue({ count: 2 });
    const res = await callRoute(token);
    expect(res.status).toBe(200);
    expect(prismaMock.bannedDevice.create).toHaveBeenCalledTimes(1);
    expect(written.deviceCredentialHash).toBe("fp_ok");
    expect(written.banReason).toBe("sqli_attempt");
    expect(written.createdBy).toBe("signed_ban_link");
    expect(written.active).toBe(true);
    // Sessions tied to the banned device must be revoked.
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { deviceCredentialHash: "fp_ok" },
    });
    const body = await res.text();
    expect(body).toMatch(/Device banned/);
  });

  it("an invalid signature is rejected with 400 and writes nothing", async () => {
    const token = encodeBanToken({
      securityEventId: "evt_x",
      deviceCredentialHash: "fp",
      expiresAt: Date.now() + 60_000,
    });
    const tampered = token.slice(0, -3) + "AAA";
    const res = await callRoute(tampered);
    expect(res.status).toBe(400);
    expect(prismaMock.bannedDevice.create).not.toHaveBeenCalled();
  });

  it("an expired token is rejected with 400", async () => {
    const token = encodeBanToken({
      securityEventId: "evt_x",
      deviceCredentialHash: "fp",
      expiresAt: Date.now() - 60_000,
    });
    const res = await callRoute(token);
    expect(res.status).toBe(400);
    expect(prismaMock.bannedDevice.create).not.toHaveBeenCalled();
    const body = await res.text();
    expect(body).toMatch(/expired/);
  });

  it("clicking the same token a second time is idempotent (no duplicate row)", async () => {
    const token = encodeBanToken({
      securityEventId: "evt_dup",
      deviceCredentialHash: "fp_dup",
      expiresAt: Date.now() + 60_000,
    });
    prismaMock.securityEvent.findUnique.mockResolvedValue({
      id: "evt_dup",
      eventType: "csrf_violation",
      ipAddressHash: null,
      userAgentHash: null,
    });
    prismaMock.bannedDevice.findUnique.mockResolvedValue({
      id: "bd_existing",
      active: true,
      deviceCredentialHash: "fp_dup",
      banReason: "csrf_violation",
      createdBy: "signed_ban_link",
      securityEventId: "evt_dup",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddressHash: null,
      userAgentHash: null,
    });
    const res = await callRoute(token);
    expect(res.status).toBe(200);
    expect(prismaMock.bannedDevice.create).not.toHaveBeenCalled();
    const body = await res.text();
    expect(body).toMatch(/already banned/i);
  });
});
