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
  it("shows success ONLY on { ok:true, sent:true }", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, sent: true, email: "u@x.test" }), { status: 200 }),
    );
    await submit("u@x.test");
    expect(await screen.findByText(/Reset email sent to u@x.test\./)).toBeInTheDocument();
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
    expect(await screen.findByText(LABELS.notFound)).toBeInTheDocument();
    expect(screen.queryByText(/Reset email sent to/)).not.toBeInTheDocument();
  });

  it("has no obvious accessibility violations in its initial render", async () => {
    const { container } = render(<ForgotPasswordForm labels={LABELS} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
