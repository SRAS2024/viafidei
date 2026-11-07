/**
 * @vitest-environment jsdom
 */
/**
 * The log in and create account pages take `error` and `next` straight from the URL, and
 * after a failed attempt they get the reader's words back from a cookie.
 *
 * `error` used to be looked up on a plain object, so /register?error=constructor found an
 * inherited function, which cannot be passed to a client component: the whole page answered
 * 500 and showed "Registration unavailable" where the form should be.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { createCookieJar, type FakeCookieJar } from "../helpers/cookies-mock";

let cookieJar: FakeCookieJar;
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("@/lib/i18n/translator");
  return { getTranslator: async () => ({ t: createTranslator("en"), locale: "en" }) };
});

import ForgotPasswordPage from "@/app/forgot-password/page";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import ResetPasswordPage from "@/app/reset-password/page";
import { keepFormFields } from "@/lib/auth/form-flash";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

const EN = DICTIONARIES.en!;

async function showRegister(params: Record<string, string | string[]>) {
  render(await RegisterPage({ searchParams: Promise.resolve(params) }));
}

async function showLogin(params: Record<string, string | string[]>) {
  render(await LoginPage({ searchParams: Promise.resolve(params) as never }));
}

function hiddenNext(): string | null {
  return document.querySelector<HTMLInputElement>('input[name="next"]')?.value ?? null;
}

beforeEach(() => {
  cookieJar = createCookieJar();
});

afterEach(() => cleanup());

describe("/register", () => {
  // What a server page hands a client component must be data: a function here is the very
  // thing that made the page answer 500.
  it.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "hands the form no inherited member for ?error=%s",
    async (code) => {
      const page = await RegisterPage({ searchParams: Promise.resolve({ error: code }) });
      const form = (page.props as { children: ReactElement<{ errorField?: unknown }> }).children;
      expect(form.props.errorField).toBeUndefined();
    },
  );

  it.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "shows the generic error above a working form for ?error=%s",
    async (code) => {
      await showRegister({ error: code });
      expect(screen.getByRole("alert")).toHaveTextContent(EN["auth.error.generic"]!);
      expect(screen.getByLabelText(EN["auth.firstName"]!)).toBeInTheDocument();
      // It belongs to no field, so focus goes to the first one and no field is marked.
      expect(screen.getByLabelText(EN["auth.firstName"]!)).toHaveFocus();
      expect(screen.getByLabelText(EN["auth.email"]!)).not.toHaveAttribute("aria-invalid");
    },
  );

  it("still ties a known failure to its field", async () => {
    await showRegister({ error: "exists" });
    const email = screen.getByLabelText(EN["auth.email"]!);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveFocus();
  });

  it("copes with a repeated error parameter", async () => {
    await showRegister({ error: ["exists", "weak"] });
    expect(screen.getByRole("alert")).toHaveTextContent(EN["auth.error.generic"]!);
  });

  it("carries a safe next into the form and the log in link", async () => {
    await showRegister({ next: "/prayers/hail-mary" });
    expect(hiddenNext()).toBe("/prayers/hail-mary");
    expect(screen.getByRole("link", { name: EN["auth.toLogin"]! })).toHaveAttribute(
      "href",
      "/login?next=%2Fprayers%2Fhail-mary",
    );
  });

  it.each(["/\t/evil.example", "//evil.example", "/\\evil.example", "https://evil.example"])(
    "keeps the hostile next %j out of the form and the link",
    async (next) => {
      await showRegister({ next });
      expect(hiddenNext()).toBeNull();
      expect(screen.getByRole("link", { name: EN["auth.toLogin"]! })).toHaveAttribute(
        "href",
        "/login",
      );
    },
  );

  it("gives back what the reader typed after a failure, and never a password", async () => {
    await keepFormFields("/register", {
      firstName: "María",
      lastName: "Ó Súilleabháin",
      email: "maria@example.test",
    });
    await showRegister({ error: "exists" });
    expect(screen.getByLabelText(EN["auth.firstName"]!)).toHaveValue("María");
    expect(screen.getByLabelText(EN["auth.lastName"]!)).toHaveValue("Ó Súilleabháin");
    expect(screen.getByLabelText(EN["auth.email"]!)).toHaveValue("maria@example.test");
    expect(screen.getByLabelText(EN["auth.password"]!)).toHaveValue("");
    expect(screen.getByLabelText(EN["auth.passwordConfirm"]!)).toHaveValue("");
  });

  it("gives nothing back on a fresh visit, with or without the cookie", async () => {
    await keepFormFields("/register", { email: "maria@example.test" });
    await showRegister({});
    expect(screen.getByLabelText(EN["auth.email"]!)).toHaveValue("");
  });
});

describe("/forgot-password, after a plain post of its form", () => {
  const show = async (params: Record<string, string | string[]>) =>
    render(await ForgotPasswordPage({ searchParams: Promise.resolve(params) }));

  it("is the bare form on a fresh visit", async () => {
    await show({});
    expect(screen.getByLabelText(EN["auth.email"]!)).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("confirms, naming the address from the cookie, not the URL", async () => {
    await keepFormFields("/forgot-password", { email: "maria@example.test" });
    await show({ sent: "1" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "If an account exists for maria@example.test,",
    );
    expect(screen.queryByLabelText(EN["auth.email"]!)).not.toBeInTheDocument();
  });

  it("claims nothing when the address is gone: a stale or hand-typed URL", async () => {
    await show({ sent: "1" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText(EN["auth.email"]!)).toBeInTheDocument();
  });

  it("says why it was refused, with the address kept", async () => {
    await keepFormFields("/forgot-password", { email: "maria@example" });
    await show({ error: "invalid" });
    expect(screen.getByRole("alert")).toHaveTextContent(EN["auth.forgot.invalidAddress"]!);
    expect(screen.getByLabelText(EN["auth.email"]!)).toHaveValue("maria@example");
  });

  it("says when it was rate limited", async () => {
    await show({ error: "rate_limited" });
    expect(screen.getByRole("alert")).toHaveTextContent(EN["auth.forgot.rateLimitedFallback"]!);
  });

  it.each(["constructor", "__proto__", ["a", "b"]])("copes with ?error=%s", async (code) => {
    await show({ error: code });
    expect(screen.getByRole("alert")).toHaveTextContent(EN["auth.forgot.error"]!);
  });
});

describe("/reset-password, after a plain post of its form", () => {
  const show = async (params: Record<string, string | string[]>) =>
    render(await ResetPasswordPage({ searchParams: Promise.resolve(params) as never }));

  it("is the bare form on the link from the email", async () => {
    await show({ token: "tok" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="token"]')!.value).toBe("tok");
  });

  it.each([
    ["weak", "auth.weakPassword"],
    ["mismatch", "auth.mismatch"],
    ["not_found", "auth.reset.invalidToken"],
    ["expired", "auth.reset.expiredToken"],
    ["used", "auth.reset.usedToken"],
    ["rate_limited", "auth.forgot.rateLimitedFallback"],
    ["server_error", "auth.forgot.error"],
    ["constructor", "auth.forgot.error"],
    ["__proto__", "auth.forgot.error"],
  ])("says why for ?error=%s, above the form", async (code, key) => {
    await show({ token: "tok", error: code });
    expect(screen.getByRole("alert")).toHaveTextContent(EN[key]!);
    expect(screen.getByRole("alert").textContent).not.toContain("{");
    expect(document.querySelector("form")).not.toBeNull();
  });
});

describe("/login", () => {
  it("carries a safe next into the form and the create account link", async () => {
    await showLogin({ next: "/prayers/hail-mary" });
    expect(hiddenNext()).toBe("/prayers/hail-mary");
    expect(screen.getByRole("link", { name: EN["auth.toRegister"]! })).toHaveAttribute(
      "href",
      "/register?next=%2Fprayers%2Fhail-mary",
    );
  });

  it.each(["/\t/evil.example", "/\n/evil.example", "//evil.example", "/.//evil.example"])(
    "keeps the hostile next %j out of the form and the link",
    async (next) => {
      await showLogin({ next });
      expect(hiddenNext()).toBeNull();
      expect(screen.getByRole("link", { name: EN["auth.toRegister"]! })).toHaveAttribute(
        "href",
        "/register",
      );
    },
  );

  it("gives back the address after a failure, with next, and never the password", async () => {
    await keepFormFields("/login", { email: "maria@example.test" });
    await showLogin({ error: "invalid", next: "/prayers/hail-mary" });
    expect(screen.getByRole("alert")).toHaveTextContent(EN["auth.invalid"]!);
    expect(hiddenNext()).toBe("/prayers/hail-mary");
    const email = screen.getByLabelText(EN["auth.email"]!);
    expect(email).toHaveValue("maria@example.test");
    expect(email).toHaveFocus();
    expect(screen.getByLabelText(EN["auth.password"]!)).toHaveValue("");
  });

  it("gives nothing back on a fresh visit, with or without the cookie", async () => {
    await keepFormFields("/login", { email: "maria@example.test" });
    await showLogin({});
    expect(screen.getByLabelText(EN["auth.email"]!)).toHaveValue("");
  });
});
