import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { createCookieJar, type FakeCookieJar } from "../helpers/cookies-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

let cookieJar: FakeCookieJar = createCookieJar();
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

import {
  authenticate,
  createUser,
  findUserByEmail,
  requireUser,
  sessionCredentialsCurrent,
} from "@/lib/auth/user";
import { hashPassword } from "@/lib/auth/password";

beforeEach(() => {
  resetPrismaMock();
  cookieJar = createCookieJar();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createUser", () => {
  it("normalizes email, hashes password, and creates a profile (default English)", async () => {
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
    })) as {
      email: string;
      passwordHash: string;
      emailEncrypted: string;
      language: string;
    };

    expect(user.email).toBe("therese@example.com");
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(user.language).toBe("en");
    // Encrypted-at-rest fields are populated, not echoed back as plaintext.
    expect(user.emailEncrypted).toBeTruthy();
    expect(user.emailEncrypted).not.toBe("therese@example.com");

    const callArgs = prismaMock.user.create.mock.calls[0][0] as {
      data: { profile: { create: { languageOverride: string } }; language: string };
    };
    expect(callArgs.data.profile).toEqual({ create: { languageOverride: "en" } });
    expect(callArgs.data.language).toBe("en");
  });

  it("saves the requested language when supported", async () => {
    prismaMock.user.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "u1", ...data }),
    );
    const user = (await createUser({
      firstName: "Maria",
      lastName: "Goretti",
      email: "m@example.com",
      password: "Newp4ss!",
      language: "es",
    })) as { language: string };
    expect(user.language).toBe("es");
  });

  it("falls back to English for unsupported language", async () => {
    prismaMock.user.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "u1", ...data }),
    );
    const user = (await createUser({
      firstName: "Maria",
      lastName: "Goretti",
      email: "m@example.com",
      password: "Newp4ss!",
      language: "klingon",
    })) as { language: string };
    expect(user.language).toBe("en");
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

  // Readers sign in with a sealed cookie, so deleting Session rows at a password reset
  // ended nothing. These are what actually ends a sign-in now.
  describe("the credential version", () => {
    async function withCookie(cookie: { credentialVersion?: string }) {
      const sessionModule = await import("@/lib/auth/session");
      return vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        userId: "u1",
        role: "USER",
        ...cookie,
      } as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>);
    }

    it("accepts any cookie while the account's version is NULL, so the deploy signs nobody out", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1", credentialVersion: null });
      for (const cookie of [{}, { credentialVersion: "from-an-older-reset" }]) {
        const spy = await withCookie(cookie);
        expect(await requireUser()).toMatchObject({ id: "u1" });
        spy.mockRestore();
      }
    });

    it("refuses a cookie from before the reset", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1", credentialVersion: "after-reset" });
      for (const cookie of [{}, { credentialVersion: "before-reset" }]) {
        const spy = await withCookie(cookie);
        expect(await requireUser()).toBeNull();
        spy.mockRestore();
      }
    });

    it("accepts a cookie issued since the reset", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1", credentialVersion: "after-reset" });
      const spy = await withCookie({ credentialVersion: "after-reset" });
      expect(await requireUser()).toMatchObject({ id: "u1" });
      spy.mockRestore();
    });

    it("gives the header the same answer, reading only the version", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ credentialVersion: "after-reset" });
      expect(
        await sessionCredentialsCurrent({ userId: "u1", credentialVersion: "after-reset" }),
      ).toBe(true);
      expect(await sessionCredentialsCurrent({ userId: "u1" })).toBe(false);
      expect(prismaMock.user.findUnique).toHaveBeenLastCalledWith({
        where: { id: "u1" },
        select: { credentialVersion: true },
      });
      prismaMock.user.findUnique.mockResolvedValue({ credentialVersion: null });
      expect(await sessionCredentialsCurrent({ userId: "u1" })).toBe(true);
      prismaMock.user.findUnique.mockResolvedValue(null);
      expect(await sessionCredentialsCurrent({ userId: "u1" })).toBe(false);
      expect(await sessionCredentialsCurrent({})).toBe(false);
    });
  });
});

describe("recordUserSignIn", () => {
  const user = { id: "u1", email: "u@example.com", firstName: "Pio", lastName: "P" };

  it("copies the account's version into the cookie", async () => {
    const { recordUserSignIn } = await import("@/lib/auth/session");
    const session: Record<string, unknown> = {};
    recordUserSignIn(session, { ...user, credentialVersion: "v2" });
    expect(session).toMatchObject({
      userId: "u1",
      userEmail: "u@example.com",
      userName: "Pio P",
      role: "USER",
      credentialVersion: "v2",
    });
  });

  it("clears what an earlier account left in this browser's cookie", async () => {
    const { recordUserSignIn } = await import("@/lib/auth/session");
    const session: Record<string, unknown> = { credentialVersion: "someone-elses" };
    recordUserSignIn(session, { ...user, credentialVersion: null });
    expect(session.credentialVersion).toBeUndefined();
  });
});
