import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  banDevice,
  isDeviceBanned,
  recordSecurityEvent,
  isClassification,
  listBannedDevicesWithDetail,
} from "@/lib/security/security-event-store";

beforeEach(() => {
  resetPrismaMock();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("security event store — recordSecurityEvent", () => {
  it("fingerprints IP / device credential / user agent before writing", async () => {
    let written: Record<string, unknown> = {};
    prismaMock.securityEvent.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        written = data;
        return { id: "evt_1", createdAt: new Date(), ...data };
      },
    );
    await recordSecurityEvent({
      eventType: "test_event",
      classification: "Suspicious",
      severity: "warning",
      ipAddress: "203.0.113.5",
      deviceCredential: "raw-cookie-secret",
      userAgent: "Mozilla/5.0",
    });
    expect(written.eventType).toBe("test_event");
    expect(written.classification).toBe("Suspicious");
    expect(written.severity).toBe("warning");
    // Raw values must not leak into the row.
    expect(written.ipAddressHash).not.toBe("203.0.113.5");
    expect(written.deviceCredentialHash).not.toBe("raw-cookie-secret");
    expect(written.userAgentHash).not.toBe("Mozilla/5.0");
    // But the fingerprints must be non-empty.
    expect(String(written.ipAddressHash)).toMatch(/^[0-9a-f]+$/);
    expect(String(written.deviceCredentialHash)).toMatch(/^[0-9a-f]+$/);
    expect(String(written.userAgentHash)).toMatch(/^[0-9a-f]+$/);
  });

  it("isClassification narrows correctly", () => {
    expect(isClassification("Suspicious")).toBe(true);
    expect(isClassification("Breach")).toBe(true);
    expect(isClassification("Other")).toBe(false);
    expect(isClassification("")).toBe(false);
  });
});

describe("security event store — banDevice + isDeviceBanned", () => {
  it("banDevice writes a new row when none exists, marked active", async () => {
    let written: Record<string, unknown> = {};
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
    prismaMock.bannedDevice.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        written = data;
        return { id: "bd_1", ...data, createdAt: new Date(), updatedAt: new Date() };
      },
    );
    await banDevice({
      deviceCredential: "raw-cookie-12345",
      banReason: "csrf_violation",
      createdBy: "signed_ban_link",
      securityEventId: "evt_breach_1",
    });
    expect(written.banReason).toBe("csrf_violation");
    expect(written.createdBy).toBe("signed_ban_link");
    expect(written.active).toBe(true);
    expect(String(written.deviceCredentialHash)).toMatch(/^[0-9a-f]+$/);
    // Never the raw value.
    expect(written.deviceCredentialHash).not.toBe("raw-cookie-12345");
  });

  it("banDevice is idempotent for the same device", async () => {
    const existing = {
      id: "bd_existing",
      deviceCredentialHash: "fp",
      active: true,
      firstSeenAt: new Date(0),
      lastSeenAt: new Date(0),
      createdAt: new Date(0),
      updatedAt: new Date(0),
      banReason: "x",
      createdBy: "system",
      securityEventId: null,
      ipAddressHash: null,
      userAgentHash: null,
    };
    prismaMock.bannedDevice.findUnique.mockResolvedValue(existing);
    let updated: Record<string, unknown> = {};
    prismaMock.bannedDevice.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updated = data;
        return { ...existing, ...data };
      },
    );
    await banDevice({
      deviceCredential: "raw-cookie",
      banReason: "csrf_violation",
      createdBy: "signed_ban_link",
    });
    // No new row should be created.
    expect(prismaMock.bannedDevice.create).not.toHaveBeenCalled();
    expect(updated.active).toBe(true);
    expect(updated.lastSeenAt).toBeInstanceOf(Date);
  });

  it("isDeviceBanned returns true only when the row exists AND is active", async () => {
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });
    expect(await isDeviceBanned("raw-cookie")).toBe(true);

    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: false });
    expect(await isDeviceBanned("raw-cookie")).toBe(false);

    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
    expect(await isDeviceBanned("raw-cookie")).toBe(false);
  });

  it("isDeviceBanned returns false for an empty credential without touching the DB", async () => {
    prismaMock.bannedDevice.findUnique.mockClear();
    expect(await isDeviceBanned(null)).toBe(false);
    expect(await isDeviceBanned("")).toBe(false);
    expect(prismaMock.bannedDevice.findUnique).not.toHaveBeenCalled();
  });
});

describe("listBannedDevicesWithDetail — joins originating SecurityEvent geo / UA", () => {
  it("attaches originating event fields onto each banned-device row", async () => {
    prismaMock.bannedDevice.findMany.mockResolvedValue([
      {
        id: "bd_1",
        deviceCredentialHash: "fp_1",
        ipAddressHash: null,
        userAgentHash: null,
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-01-02"),
        banReason: "csrf_violation",
        securityEventId: "evt_1",
        createdBy: "signed_ban_link",
        active: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      },
    ]);
    prismaMock.securityEvent.findMany.mockResolvedValue([
      {
        id: "evt_1",
        eventType: "csrf_violation",
        userAgent: "Mozilla/5.0",
        city: "Springfield",
        region: "IL",
        country: "US",
      },
    ]);
    const rows = await listBannedDevicesWithDetail();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.originatingCity).toBe("Springfield");
    expect(rows[0]!.originatingRegion).toBe("IL");
    expect(rows[0]!.originatingCountry).toBe("US");
    expect(rows[0]!.originatingUserAgent).toBe("Mozilla/5.0");
    expect(rows[0]!.originatingEventType).toBe("csrf_violation");
  });

  it("surfaces null fields when the originating event is missing (pruned / never linked)", async () => {
    prismaMock.bannedDevice.findMany.mockResolvedValue([
      {
        id: "bd_2",
        deviceCredentialHash: "fp_2",
        ipAddressHash: null,
        userAgentHash: null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        banReason: "system",
        securityEventId: null,
        createdBy: "system",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prismaMock.securityEvent.findMany.mockResolvedValue([]);
    const rows = await listBannedDevicesWithDetail();
    expect(rows[0]!.originatingCity).toBeNull();
    expect(rows[0]!.originatingRegion).toBeNull();
    expect(rows[0]!.originatingCountry).toBeNull();
    expect(rows[0]!.originatingUserAgent).toBeNull();
    expect(rows[0]!.originatingEventType).toBeNull();
  });

  it("skips the SecurityEvent lookup entirely when no row has a securityEventId", async () => {
    prismaMock.bannedDevice.findMany.mockResolvedValue([
      {
        id: "bd_3",
        deviceCredentialHash: "fp_3",
        ipAddressHash: null,
        userAgentHash: null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        banReason: "system",
        securityEventId: null,
        createdBy: "system",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prismaMock.securityEvent.findMany.mockClear();
    await listBannedDevicesWithDetail();
    expect(prismaMock.securityEvent.findMany).not.toHaveBeenCalled();
  });
});
