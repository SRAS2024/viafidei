/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";

import { ResetPasswordForm } from "@/app/reset-password/ResetPasswordForm";

const labels = {
  newPassword: "New password",
  confirmPassword: "Re-type new password",
  submit: "Update Password",
  successHeading: "Password changed successfully",
  backToLogin: "Back to log in",
  show: "Show password",
  hide: "Hide password",
  weakPassword: "Password must be at least 12 characters.",
  mismatch: "Passwords do not match.",
  invalidToken: "This reset link is invalid.",
  expiredToken: "This reset link has expired.",
  usedToken: "This reset link has already been used.",
  rateLimited: "Too many attempts.",
  error: "Something went wrong.",
};

const STRONG = "Strong1Pass!Word";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Re-type new password"), { target: { value: confirm } });
}

describe("ResetPasswordForm", () => {
  it("answers a submit of empty fields, rather than doing nothing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm token="t" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(labels.weakPassword);
    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(labels.weakPassword);
    expect(field).toHaveFocus();
  });

  it("ties a mismatch to the second field and sends nothing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm token="t" labels={labels} />);
    fill(STRONG, `${STRONG}x`);
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(fetchMock).not.toHaveBeenCalled();
    const field = screen.getByLabelText("Re-type new password");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(labels.mismatch);
    expect(field).toHaveFocus();
  });

  it("reveals both fields together", () => {
    render(<ResetPasswordForm token="t" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Re-type new password")).toHaveAttribute("type", "text");
  });

  it("moves focus to the success message, with the way to log in as the next step", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    render(<ResetPasswordForm token="t" labels={labels} />);
    fill(STRONG, STRONG);
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    const message = await screen.findByTestId("reset-success-heading");
    await waitFor(() => expect(message).toHaveFocus());
    expect(message).toHaveAttribute("role", "status");
    expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");
  });

  it("announces an expired link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, message: "expired" }), { status: 400 }),
      ),
    );
    render(<ResetPasswordForm token="t" labels={labels} />);
    fill(STRONG, STRONG);
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.expiredToken);
  });

  it("has no obvious accessibility violations", async () => {
    const { container } = render(<ResetPasswordForm token="t" labels={labels} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
