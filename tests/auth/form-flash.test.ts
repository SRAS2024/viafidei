/**
 * What a reader typed into a form that failed on the server comes back to them without
 * ever reaching a URL, and without outliving its purpose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar, type FakeCookieJar } from "../helpers/cookies-mock";

let cookieJar: FakeCookieJar;
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

import { clearKeptFields, keepFormFields, readKeptFields } from "@/lib/auth/form-flash";

const FLASH = "vf_form_flash";

beforeEach(() => {
  cookieJar = createCookieJar();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("keepFormFields", () => {
  it("round-trips the fields, accents and all", async () => {
    await keepFormFields("/register", {
      firstName: "María Ángeles",
      lastName: "Ó Súilleabháin",
      email: "maria@example.test",
    });
    expect(await readKeptFields()).toEqual({
      firstName: "María Ángeles",
      lastName: "Ó Súilleabháin",
      email: "maria@example.test",
    });
  });

  it("seals what it stores, so a name or address is never readable in the cookie", async () => {
    await keepFormFields("/login", { email: "maria@example.test" });
    const [, sealed] = cookieJar.set.mock.calls[0] as [string, string];
    expect(sealed).not.toContain("maria");
    expect(sealed).not.toContain("example");
  });

  it("is http-only, lasts a minute, and goes only to the form's own page", async () => {
    await keepFormFields("/login", { email: "maria@example.test" });
    const [name, , options] = cookieJar.set.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(FLASH);
    expect(options).toMatchObject({
      path: "/login",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60,
      secure: false,
    });
  });

  it("marks the cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a".repeat(40));
    await keepFormFields("/login", { email: "maria@example.test" });
    const [, , options] = cookieJar.set.mock.calls[0] as [string, string, { secure: boolean }];
    expect(options.secure).toBe(true);
  });

  it("takes only the fields it knows, so a password can never come along", async () => {
    await keepFormFields("/register", {
      email: "maria@example.test",
      password: "Sup3r!Secret-Value",
      passwordConfirm: "Sup3r!Secret-Value",
    } as never);
    const kept = await readKeptFields();
    expect(Object.keys(kept)).toEqual(["email"]);
    expect(JSON.stringify(kept)).not.toContain("Secret");
  });

  it("ignores a file, an empty field and a missing one, and writes no cookie for nothing", async () => {
    await keepFormFields("/register", {
      email: new Blob(["x"]),
      firstName: "",
      lastName: null,
    });
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("cuts a value at the longest its form allows, so a hand-made post cannot bloat the cookie", async () => {
    await keepFormFields("/register", { firstName: "n".repeat(5000) });
    expect((await readKeptFields()).firstName).toHaveLength(80);
    const [, sealed] = cookieJar.set.mock.calls[0] as [string, string];
    expect(sealed.length).toBeLessThan(4000);
  });

  it("never stands in the way of the redirect", async () => {
    cookieJar.set.mockImplementation(() => {
      throw new Error("cookies are read-only here");
    });
    await expect(keepFormFields("/login", { email: "m@example.test" })).resolves.toBeUndefined();
  });
});

describe("readKeptFields", () => {
  it("answers with nothing when there is nothing", async () => {
    expect(await readKeptFields()).toEqual({});
  });

  it("answers with nothing for a cookie it did not seal", async () => {
    cookieJar.__entries.set(FLASH, "forged-value");
    expect(await readKeptFields()).toEqual({});
  });

  it("answers with nothing once the minute is up", async () => {
    await keepFormFields("/login", { email: "maria@example.test" });
    expect(await readKeptFields()).toEqual({ email: "maria@example.test" });
    vi.useFakeTimers({ now: Date.now() + 5 * 60_000 });
    expect(await readKeptFields()).toEqual({});
  });
});

describe("clearKeptFields", () => {
  it("expires the cookie on the path it was set for", async () => {
    await clearKeptFields("/register");
    const [name, value, options] = cookieJar.set.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(FLASH);
    expect(value).toBe("");
    expect(options).toMatchObject({ path: "/register", maxAge: 0 });
  });
});
