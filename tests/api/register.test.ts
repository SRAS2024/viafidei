import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar, type FakeCookieJar } from "../helpers/cookies-mock";

const rateLimitMock = vi.fn();
const findUserByEmailMock = vi.fn();
const createUserMock = vi.fn();
const issueEmailVerificationTokenMock = vi.fn();
const sendEmailVerificationEmailMock = vi.fn();
const sendWelcomeEmailMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimitMock(...args) };
});

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/schemas")>("@/lib/auth/schemas");
  return {
    ...actual,
    findUserByEmail: (...args: unknown[]) => findUserByEmailMock(...args),
    createUser: (...args: unknown[]) => createUserMock(...args),
    issueEmailVerificationToken: (...args: unknown[]) => issueEmailVerificationTokenMock(...args),
    getSession: (...args: unknown[]) => getSessionMock(...args),
  };
});

vi.mock("@/lib/email", () => ({
  sendEmailVerificationEmail: (...args: unknown[]) => sendEmailVerificationEmailMock(...args),
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmailMock(...args),
}));

let cookieJar: FakeCookieJar;
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

import { POST } from "@/app/api/auth/register/route";
import { issueSignupFormToken, SIGNUP_FORM_MAX_AGE_MS } from "@/lib/auth/signup-guard";
import { SIGNUP_FORM_MIN_FILL_MS, signupFormProof } from "@/lib/auth/signup-guard-fields";
import type { NextRequest } from "next/server";

/**
 * The form as a person's browser sends it back: carrying the note the page was handed out
 * with, made twenty seconds earlier, what the page's script writes from that note, and the
 * field only a machine fills in left empty. A test may replace any of them, or leave one out
 * with `undefined`.
 */
function buildRequest(form: Record<string, string | undefined>): NextRequest {
  const fd = new FormData();
  const formToken =
    "formToken" in form ? form.formToken : issueSignupFormToken(Date.now() - 20_000);
  const fields: Record<string, string | undefined> = {
    formToken,
    formProof: formToken ? signupFormProof(formToken) : undefined,
    website: "",
    ...form,
  };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v);
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    body: fd,
    headers: { "x-forwarded-for": "203.0.113.5" },
  }) as unknown as NextRequest;
}

/** The keys the limiter was asked about, in order. */
const limiterKeys = () => rateLimitMock.mock.calls.map((call) => call[0] as string);

beforeEach(() => {
  rateLimitMock.mockReset();
  findUserByEmailMock.mockReset();
  createUserMock.mockReset();
  issueEmailVerificationTokenMock.mockReset();
  sendEmailVerificationEmailMock.mockReset();
  sendWelcomeEmailMock.mockReset();
  getSessionMock.mockReset();
  cookieJar = createCookieJar();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 4, resetAt: Date.now() + 60_000 });
  findUserByEmailMock.mockResolvedValue(null);
  createUserMock.mockResolvedValue({
    id: "u1",
    email: "user@example.com",
    firstName: "Pio",
    lastName: "P",
    language: "en",
  });
  issueEmailVerificationTokenMock.mockResolvedValue({
    token: "raw-verify-token",
    expiresAt: new Date(Date.now() + 60_000),
  });
  sendEmailVerificationEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendWelcomeEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });
  getSessionMock.mockResolvedValue({
    userId: undefined,
    save: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/register", () => {
  const validBody = {
    firstName: "Pio",
    lastName: "Pietrelcina",
    email: "user@example.com",
    password: "Stigm4tica!Pad",
    passwordConfirm: "Stigm4tica!Pad",
  };

  it("rejects malformed email by redirecting back to /register", async () => {
    const res = await POST(buildRequest({ ...validBody, email: "not-email" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/register?error=invalid");
  });

  it("rejects a JSON body (wrong Content-Type) with the user-facing 'invalid' error", async () => {
    // formData() throws on application/json; the route should classify it as
    // a bad form body and redirect to ?error=invalid rather than ?error=server
    // so the user sees the same field-level message as any other validation failure.
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.5",
      },
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/register?error=invalid");
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects weak passwords", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "weak", passwordConfirm: "weak" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/register?error=weak");
  });

  it("rejects passwords missing a number", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "PadreAlbino!ee", passwordConfirm: "PadreAlbino!ee" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=weak");
  });

  it("rejects passwords missing a capital letter", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "padrealb1no!!!", passwordConfirm: "padrealb1no!!!" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=weak");
  });

  it("rejects passwords missing a lowercase letter", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "PADREALB1NO!!!", passwordConfirm: "PADREALB1NO!!!" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=weak");
  });

  it("rejects passwords missing a special character", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "PadreAlb1noXYZ", passwordConfirm: "PadreAlb1noXYZ" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=weak");
  });

  it("rejects passwords shorter than 12 characters (even when meeting every class)", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "Aa1!short", passwordConfirm: "Aa1!short" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=weak");
  });

  it("rejects mismatched password confirmation", async () => {
    const res = await POST(buildRequest({ ...validBody, passwordConfirm: "Different1!Pad" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=mismatch");
  });

  it('refuses a sign-up named "Test User" without creating an account or sending email', async () => {
    const res = await POST(buildRequest({ ...validBody, firstName: "Test", lastName: "User" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=invalid");
    expect(createUserMock).not.toHaveBeenCalled();
    expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
  });

  it("rejects already-registered email", async () => {
    findUserByEmailMock.mockResolvedValue({ id: "existing", email: "user@example.com" });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=exists");
  });

  it("redirects to rate-limited when limiter rejects", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=rate_limited");
  });

  // From September 2026 two bots signed strangers' addresses up here, so each stranger was
  // sent a welcome email. Each fetched /register and posted it 0.2 to 0.9 seconds later.
  describe("a post from a machine", () => {
    async function expectRefused(form: Record<string, string | undefined>, error = "retry") {
      const res = await POST(buildRequest({ ...validBody, ...form }));
      expect(res.status).toBe(303);
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.pathname).toBe("/register");
      expect(location.searchParams.get("error")).toBe(error);
      expect(createUserMock).not.toHaveBeenCalled();
      expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
      expect(issueEmailVerificationTokenMock).not.toHaveBeenCalled();
      return res;
    }

    it("is refused when the field only a machine can reach was filled in", async () => {
      await expectRefused({ website: "https://cheap-pills.example" });
      // Told apart from the form alone: no database work, nothing counted.
      expect(findUserByEmailMock).not.toHaveBeenCalled();
      expect(rateLimitMock).not.toHaveBeenCalled();
    });

    it("is refused when it never fetched the form, so carries no note", async () => {
      await expectRefused({ formToken: undefined });
      expect(findUserByEmailMock).not.toHaveBeenCalled();
    });

    it("is refused when it posts the form within moments of fetching it", async () => {
      for (const ago of [200, 900, SIGNUP_FORM_MIN_FILL_MS - 100]) {
        createUserMock.mockClear();
        await expectRefused({ formToken: issueSignupFormToken(Date.now() - ago) });
      }
      expect(findUserByEmailMock).not.toHaveBeenCalled();
    });

    it("is refused when the note was altered", async () => {
      const token = issueSignupFormToken(Date.now() - 20_000);
      const [version, , nonce, signature] = token.split(".");
      const backdated = [version, (Date.now() - 60_000).toString(36), nonce, signature].join(".");
      await expectRefused({ formToken: backdated });
      await expectRefused({ formToken: "v1.made.up" });
    });

    it("is refused when it never ran the page's script, however long it waits", async () => {
      await expectRefused({ formProof: undefined });
      await expectRefused({ formProof: "0000000000000000" });
      expect(findUserByEmailMock).not.toHaveBeenCalled();
    });

    it("is refused when it posts one copy of the form twice", async () => {
      rateLimitMock.mockImplementation(async (key: string) => ({
        ok: !key.startsWith("signup-form:"),
        remaining: 0,
        resetAt: Date.now() + 60_000,
      }));
      await expectRefused({});
    });

    it("keeps what a person typed, apart from the password, if one is ever caught", async () => {
      await expectRefused({
        formToken: issueSignupFormToken(Date.now() - SIGNUP_FORM_MAX_AGE_MS - 1),
      });
      const { readKeptFields } = await import("@/lib/auth/form-flash");
      expect(await readKeptFields()).toEqual({
        firstName: "Pio",
        lastName: "Pietrelcina",
        email: "user@example.com",
      });
    });
  });

  describe("the day's allowance of new accounts", () => {
    function refuseKey(prefix: string) {
      rateLimitMock.mockImplementation(async (key: string) => ({
        ok: !key.startsWith(prefix),
        remaining: 0,
        resetAt: Date.now() + 60_000,
      }));
    }

    it("stops a connection that has made its day's accounts", async () => {
      refuseKey("register-day:");
      const res = await POST(buildRequest(validBody));
      expect(new URL(res.headers.get("location") ?? "").searchParams.get("error")).toBe(
        "daily_limit",
      );
      expect(createUserMock).not.toHaveBeenCalled();
      expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
      // The site's own count is left alone.
      expect(limiterKeys()).not.toContain("register-site-day");
    });

    it("stops everyone once the site has made its day's accounts", async () => {
      refuseKey("register-site-day");
      const res = await POST(buildRequest(validBody));
      expect(new URL(res.headers.get("location") ?? "").searchParams.get("error")).toBe(
        "daily_limit",
      );
      expect(createUserMock).not.toHaveBeenCalled();
      expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
    });

    it("counts only an attempt that would make an account", async () => {
      await POST(buildRequest({ ...validBody, password: "weak", passwordConfirm: "weak" }));
      findUserByEmailMock.mockResolvedValue({ id: "taken" });
      await POST(buildRequest(validBody));
      expect(limiterKeys()).toEqual(["register:203.0.113.5"]);
    });

    it("spends the form's note and the day's allowance when an account is made", async () => {
      const res = await POST(buildRequest(validBody));
      expect(res.headers.get("location")).toContain("/profile");
      expect(createUserMock).toHaveBeenCalledTimes(1);
      const keys = limiterKeys();
      expect(keys[0]).toBe("register:203.0.113.5");
      expect(keys[1]).toMatch(/^signup-form:[A-Za-z0-9_-]{16}$/);
      expect(keys.slice(2)).toEqual(["register-day:203.0.113.5", "register-site-day"]);
    });
  });

  // An account-gated control (Favorite on a parish) sends the visitor to
  // /register?next=…; the form posts that back so registering returns them to
  // where they were instead of dropping them on /profile.
  it("honours a same-site `next` field and lands the visitor back where they started", async () => {
    const res = await POST(buildRequest({ ...validBody, next: "/parishes/st-marys" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/parishes/st-marys");
  });

  it("refuses an off-site `next` and falls back to /profile", async () => {
    for (const hostile of ["//evil.com", "https://evil.com", "/\\evil.com", "evil.com"]) {
      const res = await POST(buildRequest({ ...validBody, next: hostile }));
      const location = res.headers.get("location") ?? "";
      // new URL("//evil.com", origin) resolves to a THIRD-PARTY origin, so a
      // bare "starts with /" check is not enough.
      expect(location).toContain("/profile");
      expect(location).not.toContain("evil.com");
    }
  });

  it("refuses a `next` the URL parser would turn into another site", async () => {
    for (const hostile of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/.//evil.com"]) {
      const res = await POST(buildRequest({ ...validBody, next: hostile }));
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.origin).toBe("http://localhost");
      expect(location.pathname).toBe("/profile");
    }
  });

  describe("a failed attempt", () => {
    const FLASH = "vf_form_flash";

    it("goes back with the page the visitor was on their way to", async () => {
      findUserByEmailMock.mockResolvedValue({ id: "taken" });
      const res = await POST(buildRequest({ ...validBody, next: "/prayers/hail-mary" }));
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.pathname).toBe("/register");
      expect(location.searchParams.get("error")).toBe("exists");
      expect(location.searchParams.get("next")).toBe("/prayers/hail-mary");
    });

    it("never carries a hostile `next` back", async () => {
      const res = await POST(
        buildRequest({
          ...validBody,
          password: "weak",
          passwordConfirm: "weak",
          next: "//evil.com",
        }),
      );
      expect(res.headers.get("location")).not.toContain("evil.com");
      expect(res.headers.get("location")).not.toContain("next=");
    });

    it("keeps the typed names and address out of the URL, in a sealed short-lived cookie", async () => {
      findUserByEmailMock.mockResolvedValue({ id: "taken" });
      const res = await POST(buildRequest(validBody));
      const location = res.headers.get("location") ?? "";
      for (const typed of ["Pio", "Pietrelcina", "user", "example.com"]) {
        expect(location).not.toContain(typed);
      }
      const flash = cookieJar.set.mock.calls.find((call) => call[0] === FLASH);
      expect(flash).toBeDefined();
      const [, sealed, options] = flash as [string, string, Record<string, unknown>];
      expect(sealed).not.toContain("Pietrelcina");
      expect(sealed).not.toContain("example.com");
      expect(options).toMatchObject({ path: "/register", httpOnly: true, sameSite: "lax" });
      expect(options.maxAge).toBeLessThanOrEqual(60);

      const { readKeptFields } = await import("@/lib/auth/form-flash");
      expect(await readKeptFields()).toEqual({
        firstName: "Pio",
        lastName: "Pietrelcina",
        email: "user@example.com",
      });
    });

    it("never keeps a password, whatever the failure", async () => {
      findUserByEmailMock.mockResolvedValue({ id: "taken" });
      await POST(buildRequest(validBody));
      const { readKeptFields } = await import("@/lib/auth/form-flash");
      expect(Object.keys(await readKeptFields()).sort()).toEqual([
        "email",
        "firstName",
        "lastName",
      ]);
    });

    it("clears what was kept once the account is made", async () => {
      await POST(buildRequest(validBody));
      const clear = cookieJar.set.mock.calls.find((call) => call[0] === FLASH);
      expect(clear?.[1]).toBe("");
      expect((clear?.[2] as { maxAge: number }).maxAge).toBe(0);
    });
  });

  it("creates the user, sends a single welcome email carrying the verify token, and redirects to /profile", async () => {
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/profile");

    expect(createUserMock).toHaveBeenCalledTimes(1);
    // Registration now sends ONE email — a welcome message with the
    // verification link as its CTA. The standalone verification email
    // is gone; the resend-from-profile path is the only place
    // sendEmailVerificationEmail still fires.
    expect(sendWelcomeEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailVerificationEmailMock).not.toHaveBeenCalled();
    const welcomeCall = sendWelcomeEmailMock.mock.calls[0][0] as {
      user: { id: string };
      token: string;
    };
    expect(welcomeCall.user.id).toBe("u1");
    expect(welcomeCall.token).toBe("raw-verify-token");
  });

  it("saves the requested language to the user record", async () => {
    cookieJar.set("vf_locale", "es", {});
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    const arg = createUserMock.mock.calls[0][0] as { language: string };
    expect(arg.language).toBe("es");
  });

  it("creates the user even when welcome email delivery fails (non-blocking)", async () => {
    sendWelcomeEmailMock.mockResolvedValue({ ok: false, reason: "delivery_failed" });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/profile");
    expect(createUserMock).toHaveBeenCalled();
  });
});
