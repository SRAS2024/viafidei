/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnverifiedEmailNotice } from "@/components/profile/UnverifiedEmailNotice";

// Tests pin the user-visible behavior of the resend-verification widget:
//   1. It only renders when the parent (the profile page) decides to render
//      it — the parent gates on `!user.emailVerifiedAt`. The widget itself
//      always shows the resend button when mounted; the gating is what is
//      missing test-wise from the route layer.
//   2. On a 200 OK response with `ok:true` it shows the success label.
//   3. On a `delivery_failed` / `email_not_configured` / `token_creation_failed`
//      response it does NOT show success — instead it shows the
//      delivery-failed label so the user knows the email never went out.

const LABELS = {
  notice: "Your email is not verified.",
  resend: "Resend verification email",
  sent: "Verification email sent.",
  rateLimited: "Too many requests. Try again later.",
  deliveryFailed: "We could not send the verification email. Please contact support.",
  error: "Unexpected error.",
};

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("UnverifiedEmailNotice", () => {
  it("renders the notice and the resend button (the parent only renders this when emailVerifiedAt is null)", () => {
    render(<UnverifiedEmailNotice labels={LABELS} />);
    expect(screen.getByText(LABELS.notice)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LABELS.resend })).toBeInTheDocument();
  });

  it("shows success ONLY when the server confirms the email was sent", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, requested: true }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<UnverifiedEmailNotice labels={LABELS} />);
    await user.click(screen.getByRole("button", { name: LABELS.resend }));
    expect(await screen.findByText(LABELS.sent)).toBeInTheDocument();
    expect(screen.queryByText(LABELS.deliveryFailed)).not.toBeInTheDocument();
  });

  it("shows the delivery-failed label when the server returns delivery_failed (NOT success)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: "server_error",
          message: "delivery_failed",
        }),
        { status: 500 },
      ),
    );
    const user = userEvent.setup();
    render(<UnverifiedEmailNotice labels={LABELS} />);
    await user.click(screen.getByRole("button", { name: LABELS.resend }));
    expect(await screen.findByText(LABELS.deliveryFailed)).toBeInTheDocument();
    expect(screen.queryByText(LABELS.sent)).not.toBeInTheDocument();
  });

  it("shows the delivery-failed label when the server returns email_not_configured", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: "server_error",
          message: "email_not_configured",
        }),
        { status: 500 },
      ),
    );
    const user = userEvent.setup();
    render(<UnverifiedEmailNotice labels={LABELS} />);
    await user.click(screen.getByRole("button", { name: LABELS.resend }));
    expect(await screen.findByText(LABELS.deliveryFailed)).toBeInTheDocument();
    expect(screen.queryByText(LABELS.sent)).not.toBeInTheDocument();
  });

  it("shows the delivery-failed label when the server returns token_creation_failed", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: "server_error",
          message: "token_creation_failed",
        }),
        { status: 500 },
      ),
    );
    const user = userEvent.setup();
    render(<UnverifiedEmailNotice labels={LABELS} />);
    await user.click(screen.getByRole("button", { name: LABELS.resend }));
    expect(await screen.findByText(LABELS.deliveryFailed)).toBeInTheDocument();
    expect(screen.queryByText(LABELS.sent)).not.toBeInTheDocument();
  });

  it("shows the rate-limit label on a 429 response (and not success)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "rate_limited" }), { status: 429 }),
    );
    const user = userEvent.setup();
    render(<UnverifiedEmailNotice labels={LABELS} />);
    await user.click(screen.getByRole("button", { name: LABELS.resend }));
    expect(await screen.findByText(LABELS.rateLimited)).toBeInTheDocument();
    expect(screen.queryByText(LABELS.sent)).not.toBeInTheDocument();
  });
});
