/**
 * @vitest-environment jsdom
 */
/**
 * On a slow connection a page can be read and filled before its script has run. A controlled
 * field (`value={state}`) lost that text at hydration, without a word: a password manager's
 * fill vanished and the reader was told their password was too weak. And a form with no
 * method, pressed in that same moment, sent the browser's default GET, which put the new
 * passwords in the address bar.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";

import { ForgotPasswordForm } from "@/app/forgot-password/ForgotPasswordForm";
import { RegisterForm } from "@/app/register/RegisterForm";
import { ResetPasswordForm } from "@/app/reset-password/ResetPasswordForm";

const STRONG = "Strong1Pass!Word";

const registerLabels = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  password: "Password",
  passwordConfirm: "Re-enter password",
  passwordRequirements: "Requirements",
  submit: "Create account",
  show: "Show",
  hide: "Hide",
  weakPassword: "Too weak",
  mismatch: "Passwords do not match.",
  privacyBefore: "By selecting create account, you agree to our ",
  privacyLink: "privacy policy",
  privacyAfter: ".",
};
const resetLabels = {
  newPassword: "New password",
  confirmPassword: "Re-type new password",
  submit: "Update password",
  successHeading: "Changed",
  backToLogin: "Back",
  show: "Show",
  hide: "Hide",
  weakPassword: "Too weak",
  mismatch: "Passwords do not match.",
  invalidToken: "Invalid",
  expiredToken: "Expired",
  usedToken: "Used",
  rateLimited: "Slow down",
  error: "Error",
};
const forgotLabels = {
  email: "Email",
  submit: "Send reset link",
  success: "Sent to {email}.",
  notFound: "None",
  rateLimited: "Wait {minutes}.",
  rateLimitedFallback: "Wait.",
  invalidAddress: "Check the address.",
  error: "Error",
  deliveryFailed: "Failed",
};

const ORIGINAL_FETCH = globalThis.fetch;
let root: Root | null = null;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  cleanup();
});

/** The page as a slow connection gives it: the server's HTML, filled in before script runs. */
async function fillThenHydrate(form: ReactElement, filled: Record<string, string>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  container.innerHTML = renderToString(form);
  for (const [id, value] of Object.entries(filled)) {
    document.querySelector<HTMLInputElement>(`#${id}`)!.value = value;
  }
  await act(async () => {
    root = hydrateRoot(container, form);
  });
}

function submit() {
  return fireEvent.submit(document.querySelector("form")!);
}

describe("text put in a field before the page's script has run", () => {
  it("survives on the reset form, and is what gets sent", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await fillThenHydrate(<ResetPasswordForm token="tok" labels={resetLabels} />, {
      password: STRONG,
      passwordConfirm: STRONG,
    });
    expect(document.querySelector<HTMLInputElement>("#password")!.value).toBe(STRONG);
    await act(async () => {
      submit();
    });
    expect(screen.queryByText("Too weak")).not.toBeInTheDocument();
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(sent).toMatchObject({ password: STRONG, passwordConfirm: STRONG });
  });

  it("survives on the register form, and passes its checks", async () => {
    await fillThenHydrate(<RegisterForm labels={registerLabels} />, {
      password: STRONG,
      passwordConfirm: STRONG,
    });
    expect(document.querySelector<HTMLInputElement>("#password")!.value).toBe(STRONG);
    expect(document.querySelector<HTMLInputElement>("#passwordConfirm")!.value).toBe(STRONG);
    // fireEvent answers false when a handler called preventDefault.
    let allowed = false;
    await act(async () => {
      allowed = submit();
    });
    expect(allowed).toBe(true);
    expect(screen.queryByText("Too weak")).not.toBeInTheDocument();
  });

  it("survives on the forgot password form, and is what gets sent", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, sent: true }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await fillThenHydrate(<ForgotPasswordForm labels={forgotLabels} />, {
      email: "maria@example.test",
    });
    await act(async () => {
      submit();
    });
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(sent).toEqual({ email: "maria@example.test" });
  });
});

describe("a form pressed before the page's script has run", () => {
  it.each([
    [
      "reset",
      <ResetPasswordForm key="r" token="tok" labels={resetLabels} />,
      "/api/auth/reset-password",
    ],
    ["forgot", <ForgotPasswordForm key="f" labels={forgotLabels} />, "/api/auth/forgot-password"],
  ])("reaches the server, and not through the address bar: %s", (_name, form, action) => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(form);
    const element = container.querySelector("form")!;
    expect(element.getAttribute("method")).toBe("post");
    expect(element.getAttribute("action")).toBe(action);
  });

  it("carries the reset link's token with the passwords", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ResetPasswordForm token="tok" labels={resetLabels} />);
    expect(container.querySelector<HTMLInputElement>('input[name="token"]')!.value).toBe("tok");
  });
});

describe("the answer to a plain post, already on the page when it loads", () => {
  // A live region says nothing about what was there at first paint.
  it("takes focus on the reset form, so a screen reader says it", async () => {
    await fillThenHydrate(
      <ResetPasswordForm token="tok" labels={resetLabels} failure="This link has expired." />,
      {},
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This link has expired.");
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("comes before the fields, which are the next thing to fill in", async () => {
    await fillThenHydrate(
      <ResetPasswordForm token="tok" labels={resetLabels} failure={resetLabels.mismatch} />,
      {},
    );
    const alert = screen.getByRole("alert");
    expect(alert.compareDocumentPosition(document.querySelector("#password")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("goes when the reader types again, if it was about what they typed", async () => {
    await fillThenHydrate(
      <ResetPasswordForm token="tok" labels={resetLabels} failure={resetLabels.mismatch} />,
      {},
    );
    expect(screen.getByRole("alert")).toHaveTextContent(resetLabels.mismatch);
    fireEvent.change(document.querySelector("#password")!, { target: { value: "a" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stays when the reader types again, if it was about the link", async () => {
    await fillThenHydrate(
      <ResetPasswordForm token="tok" labels={resetLabels} failure={resetLabels.expiredToken} />,
      {},
    );
    fireEvent.change(document.querySelector("#password")!, { target: { value: "a" } });
    expect(screen.getByRole("alert")).toHaveTextContent(resetLabels.expiredToken);
  });

  it("takes focus on the forgot form, with the address back in its field", async () => {
    await fillThenHydrate(
      <ForgotPasswordForm
        labels={forgotLabels}
        outcome={{ kind: "rate_limited", retryAfterSeconds: null }}
        email="maria@example.test"
      />,
      {},
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Wait.");
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(document.querySelector<HTMLInputElement>("#email")!.value).toBe("maria@example.test");
  });

  it("ties a refused address to its field, and goes when it is edited", async () => {
    await fillThenHydrate(
      <ForgotPasswordForm
        labels={forgotLabels}
        outcome={{ kind: "invalid_address" }}
        email="maria@localhost"
      />,
      {},
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Check the address.");
    expect(alert).toHaveFocus();
    const field = document.querySelector<HTMLInputElement>("#email")!;
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Check the address.");
    fireEvent.change(field, { target: { value: "maria@example.test" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "false");
  });

  it("sends that address when the form is pressed again", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, sent: true }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await fillThenHydrate(
      <ForgotPasswordForm
        labels={forgotLabels}
        outcome={{ kind: "error" }}
        email="maria@example.test"
      />,
      {},
    );
    await act(async () => {
      submit();
    });
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(sent).toEqual({ email: "maria@example.test" });
  });

  it("shows the confirmation in place of the form, with focus on it", async () => {
    await fillThenHydrate(
      <ForgotPasswordForm
        labels={forgotLabels}
        outcome={{ kind: "ok", email: "maria@example.test" }}
      />,
      {},
    );
    expect(screen.getByRole("status")).toHaveTextContent("Sent to maria@example.test.");
    expect(screen.getByRole("status")).toHaveFocus();
    expect(document.querySelector("form")).toBeNull();
  });
});
