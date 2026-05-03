import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  pruneExpiredTokens,
  verifyCurrentPassword,
} from "@/lib/auth/tokens";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

import crypto from "node:crypto";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("issuePasswordResetToken", () => {
  it("creates a hashed token row and returns the raw token + expiry ~1h ahead", async () => {
    prismaMock.passwordResetToken.create.mockResolvedValue({});
    const before = Date.now();
    const issued = await issuePasswordResetToken("u1");
    const after = Date.now();

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(issued.expiresAt.getTime() - before).toBeGreaterThanOrEqual(60 * 60 * 1000 - 5);
    expect(issued.expiresAt.getTime() - after).toBeLessThanOrEqual(60 * 60 * 1000);

    const writeArgs = prismaMock.passwordResetToken.create.mock.calls[0][0] as {
      data: { userId: string; tokenHash: string };
    };
    expect(writeArgs.data.userId).toBe("u1");
    // The stored hash must match sha256(token) and never the raw token.
    expect(writeArgs.data.tokenHash).toBe(sha256Hex(issued.token));
    expect(writeArgs.data.tokenHash).not.toBe(issued.token);
  });
});

describe("consumePasswordResetToken", () => {
  it("returns not_found when the token doesn't exist", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    const result = await consumePasswordResetToken("anything", "new-password-123");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns expired when the token is past expiry", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    const result = await consumePasswordResetToken("anything", "new-password-123");
    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns used when the token has already been consumed", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    const result = await consumePasswordResetToken("anything", "new-password-123");
    expect(result).toEqual({ ok: false, reason: "used" });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rotates the password, marks the token used, and clears all sessions", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.passwordResetToken.update.mockResolvedValue({});
    prismaMock.session.deleteMany.mockResolvedValue({ count: 2 });

    const result = await consumePasswordResetToken("anything", "rotated-password-1234");
    expect(result).toEqual({ ok: true, userId: "u1" });

    // The new password is hashed (not stored as plaintext) and verifies.
    const userUpdateArgs = prismaMock.user.update.mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    expect(userUpdateArgs.data.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(userUpdateArgs.data.passwordHash, "rotated-password-1234")).toBe(
      true,
    );

    // Token is marked used (with usedAt date) so it cannot be reused.
    const tokenUpdateArgs = prismaMock.passwordResetToken.update.mock.calls[0][0] as {
      data: { usedAt: Date };
    };
    expect(tokenUpdateArgs.data.usedAt).toBeInstanceOf(Date);

    // All existing sessions are torn down so old cookies cannot keep working.
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });

    // All three writes happen inside a single transaction.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("issueEmailVerificationToken", () => {
  it("creates a hashed token row with a 24h TTL", async () => {
    prismaMock.emailVerificationToken.create.mockResolvedValue({});
    const before = Date.now();
    const issued = await issueEmailVerificationToken("u1");
    expect(issued.expiresAt.getTime() - before).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 5);

    const writeArgs = prismaMock.emailVerificationToken.create.mock.calls[0][0] as {
      data: { tokenHash: string };
    };
    expect(writeArgs.data.tokenHash).toBe(sha256Hex(issued.token));
  });
});

describe("consumeEmailVerificationToken", () => {
  it("returns not_found when the token doesn't exist", async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue(null);
    const result = await consumeEmailVerificationToken("anything");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns expired when the token is past expiry", async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    const result = await consumeEmailVerificationToken("anything");
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("returns used when the token has already been consumed", async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    const result = await consumeEmailVerificationToken("anything");
    expect(result).toEqual({ ok: false, reason: "used" });
  });

  it("marks the user emailVerifiedAt and the token used in a single transaction", async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.emailVerificationToken.update.mockResolvedValue({});

    const result = await consumeEmailVerificationToken("anything");
    expect(result).toEqual({ ok: true, userId: "u1" });

    const userUpdateArgs = prismaMock.user.update.mock.calls[0][0] as {
      data: { emailVerifiedAt: Date };
    };
    expect(userUpdateArgs.data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("pruneExpiredTokens", () => {
  it("deletes both expired password-reset and email-verification rows and sums them", async () => {
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.emailVerificationToken.deleteMany.mockResolvedValue({ count: 4 });

    const total = await pruneExpiredTokens(new Date("2026-01-01T00:00:00Z"));
    expect(total).toBe(7);

    const resetArgs = prismaMock.passwordResetToken.deleteMany.mock.calls[0][0] as {
      where: { expiresAt: { lt: Date } };
    };
    expect(resetArgs.where.expiresAt.lt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("verifyCurrentPassword", () => {
  it("returns true when the password matches the user's stored hash", async () => {
    const passwordHash = await hashPassword("current-password-1234");
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash });
    expect(await verifyCurrentPassword("u1", "current-password-1234")).toBe(true);
  });

  it("returns false when the password does not match", async () => {
    const passwordHash = await hashPassword("current-password-1234");
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash });
    expect(await verifyCurrentPassword("u1", "wrong-password")).toBe(false);
  });

  it("returns false when the user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await verifyCurrentPassword("u1", "anything")).toBe(false);
  });
});
