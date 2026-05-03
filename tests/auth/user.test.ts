import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { createCookieJar, type FakeCookieJar } from "../helpers/cookies-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

let cookieJar: FakeCookieJar = createCookieJar();
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

import { authenticate, createUser, findUserByEmail, requireUser } from "@/lib/auth/user";
import { hashPassword } from "@/lib/auth/password";

beforeEach(() => {
  resetPrismaMock();
  cookieJar = createCookieJar();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createUser", () => {
  it("normalizes email, hashes password, and creates a profile", async () => {
    prismaMock.user.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "u1",
        ...data,
      }),
    );

    const user = (await createUser({
      firstName: "Therese",
      lastName: "Lisieux",
      email: "  Therese@Example.COM  ",
      password: "littleflower-1897!",
    })) as { email: string; passwordHash: string; emailEncrypted: string };

    expect(user.email).toBe("therese@example.com");
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
    // Encrypted-at-rest fields are populated, not echoed back as plaintext.
    expect(user.emailEncrypted).toBeTruthy();
    expect(user.emailEncrypted).not.toBe("therese@example.com");

    const callArgs = prismaMock.user.create.mock.calls[0][0] as { data: { profile: unknown } };
    expect(callArgs.data.profile).toEqual({ create: {} });
  });
});

describe("findUserByEmail", () => {
  it("looks up by normalized email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "ignatius@example.com" });
    const result = await findUserByEmail("  Ignatius@Example.COM ");
    expect(result).toMatchObject({ id: "u1" });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ignatius@example.com" },
    });
  });
});

describe("authenticate", () => {
  it("returns the user when credentials match a USER role", async () => {
    const passwordHash = await hashPassword("monasticlife-1491!");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "ignatius@example.com",
      passwordHash,
      role: "USER",
    });
    const result = await authenticate("ignatius@example.com", "monasticlife-1491!");
    expect(result).toMatchObject({ id: "u1" });
  });

  it("returns null when no user exists for the email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await authenticate("ghost@example.com", "anything");
    expect(result).toBeNull();
  });

  it("returns null when the password is wrong", async () => {
    const passwordHash = await hashPassword("right-password-1234");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      passwordHash,
      role: "USER",
    });
    const result = await authenticate("u@example.com", "WRONG-password");
    expect(result).toBeNull();
  });

  it("refuses to authenticate ADMIN-role accounts via the user path", async () => {
    const passwordHash = await hashPassword("right-password-1234");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
    });
    const result = await authenticate("admin@example.com", "right-password-1234");
    expect(result).toBeNull();
  });
});

describe("requireUser", () => {
  it("returns null when no session exists", async () => {
    const result = await requireUser();
    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the session role is not USER", async () => {
    // The session module just looks at session.role/session.userId; we don't
    // need a real iron-session payload to verify the early return.
    // Set up an empty cookie jar and stub the session getter to return an
    // ADMIN session.
    const sessionModule = await import("@/lib/auth/session");
    const sessionSpy = vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      userId: "u1",
      role: "ADMIN",
      // iron-session attaches save/destroy on the real object; tests for the
      // early-return path don't invoke them.
    } as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>);

    const result = await requireUser();
    expect(result).toBeNull();
    sessionSpy.mockRestore();
  });

  it("loads the user record when the session is a valid USER", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "u@example.com" });
    const sessionModule = await import("@/lib/auth/session");
    const sessionSpy = vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      userId: "u1",
      role: "USER",
    } as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>);

    const result = await requireUser();
    expect(result).toMatchObject({ id: "u1" });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: "u1" } });
    sessionSpy.mockRestore();
  });
});
