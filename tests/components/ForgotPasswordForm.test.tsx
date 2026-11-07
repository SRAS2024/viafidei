/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { ForgotPasswordForm } from "@/app/forgot-password/ForgotPasswordForm";

// The forgot-password form must NEVER show success when the server
// returned `delivery_failed` or `email_not_configured`. The whole point
// of those response codes is that the email never reached the user;
// claiming "we sent it" leaves them refreshing an empty inbox forever.

const LABELS = {
  email: "Email",
  submit: "Send reset email",
  success: "Reset email sent to {email}.",
  notFound: "No account found for that email.",
  rateLimited: "Try again in {minutes} minutes.",
  rateLimitedFallback: "Too many requests. Try again later.",
  invalidAddress: "Check the address.",
  error: "Unexpected error.",
  deliveryFailed: "We could not send the reset email. Please contact support.",
};

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

async function submit(email: string) {
  const user = userEvent.setup();
  render(<ForgotPasswordForm labels={LABELS} />);
  await user.type(screen.getByLabelText(LABELS.email), email);
  await user.click(screen.getByRole("button", { name: LABELS.submit }));
}

describe("ForgotPasswordForm", () => {
  // The browser's own check passes "maria@localhost". Trying again would change nothing, so
  // the reader is told what to look at, and put there.
  it("says what is wrong with an address the server refuses, and goes back to it", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "invalid" }), { status: 400 }),
    );
    await submit("maria@localhost");
    expect(await screen.findByRole("alert")).toHaveTextContent(LABELS.invalidAddress);
    const field = screen.getByLabelText(LABELS.email);
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(LABELS.invalidAddress);
  });

  it("shows success ONLY on { ok:true, sent:true }", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, sent: true, email: "u@x.test" }), { status: 200 }),
    );
    await submit("u@x.test");
    const message = await screen.findByText(/Reset email sent to u@x.test\./);
    expect(message).toHaveAttribute("role", "status");
    // The form and its button are gone; focus lands on what replaced them.
    expect(message).toHaveFocus();
  });

  it("leaves an empty form to the browser's own validation, sending nothing", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm labels={LABELS} />);
    await user.click(screen.getByRole("button", { name: LABELS.submit }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText(LABELS.email)).toBeInvalid();
  });

  it("does NOT show success when the server returns delivery_failed (Resend rejected the send)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, error: "server_error", message: "delivery_failed" }),
        { status: 500 },
      ),
    );
    await submit("u@x.test");
    expect(await screen.findByText(LABELS.deliveryFailed)).toBeInTheDocument();
    // The success template uses {email} substitution; if substitution
    // happened, the rendered string would contain the address.
    expect(screen.queryByText(/Reset email sent to/)).not.toBeInTheDocument();
  });

  it("does NOT show success when the server returns email_not_configured (RESEND_API_KEY missing)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, error: "server_error", message: "email_not_configured" }),
        { status: 500 },
      ),
    );
    await submit("u@x.test");
    expect(await screen.findByText(LABELS.deliveryFailed)).toBeInTheDocument();
    expect(screen.queryByText(/Reset email sent to/)).not.toBeInTheDocument();
  });

  it("shows the not-found message when no account exists for the email (and not success)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404 }),
    );
    await submit("ghost@x.test");
    expect(await screen.findByText(LABELS.notFound)).toHaveAttribute("role", "alert");
    const field = screen.getByLabelText(LABELS.email);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(LABELS.notFound);
    expect(screen.queryByText(/Reset email sent to/)).not.toBeInTheDocument();
  });

  it("has no obvious accessibility violations in its initial render", async () => {
    const { container } = render(<ForgotPasswordForm labels={LABELS} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
