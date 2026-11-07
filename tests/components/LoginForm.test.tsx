/**
 * @vitest-environment jsdom
 */
/**
 * The log-in form posts and the server redirects back with the failure in the
 * URL, so the message is on the page from first paint and no live region will
 * ever say it. A screen-reader user finds out because focus lands on the field,
 * which reads out its own error.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import { LoginForm } from "@/app/login/LoginForm";

const labels = {
  email: "Email",
  password: "Password",
  submit: "Log in",
  show: "Show password",
  hide: "Hide password",
};

afterEach(() => cleanup());

describe("LoginForm", () => {
  it("posts to the login route, carrying the page to return to", () => {
    const { container } = render(<LoginForm labels={labels} next="/prayers/hail-mary" />);
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/api/auth/login");
    expect(form).toHaveAttribute("method", "post");
    expect(container.querySelector('input[name="next"]')).toHaveValue("/prayers/hail-mary");
  });

  it("asks the browser for the right autofill", () => {
    render(<LoginForm labels={labels} />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });

  it("shows no error and takes no focus on a fresh visit", () => {
    render(<LoginForm labels={labels} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).not.toHaveFocus();
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });

  it("ties a failed attempt to both fields and moves focus to the first", () => {
    render(<LoginForm labels={labels} error="Email or password is incorrect." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    for (const name of ["Email", "Password"]) {
      const field = screen.getByLabelText(name);
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription("Email or password is incorrect.");
    }
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("reveals the password with a control that follows the field in tab order", () => {
    render(<LoginForm labels={labels} />);
    const field = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(field.compareDocumentPosition(toggle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(toggle);
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("has no obvious accessibility violations, with or without an error", async () => {
    const { container, rerender } = render(<LoginForm labels={labels} />);
    expect((await axe(container)).violations).toEqual([]);
    rerender(<LoginForm labels={labels} error="Email or password is incorrect." />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
