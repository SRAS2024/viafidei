/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegisterForm } from "@/app/register/RegisterForm";

const labels = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  password: "Password",
  passwordConfirm: "Re-enter password",
  passwordRequirements:
    "Use at least 5 characters, with at least one number and one capital letter.",
  submit: "Create account",
  show: "Show",
  hide: "Hide",
  weakPassword: "Password must be at least 5 characters and include a number and a capital.",
  mismatch: "Passwords do not match.",
  privacyBefore: "By selecting create account, you agree to our ",
  privacyLink: "privacy policy",
  privacyAfter: ".",
};

describe("RegisterForm privacy notice", () => {
  it("shows the privacy notice with a link to /privacy", () => {
    render(<RegisterForm labels={labels} />);
    const notice = screen.getByTestId("register-privacy-notice");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain("By selecting create account, you agree to our");
    const link = screen.getByRole("link", { name: /privacy policy/i });
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("renders the required fields", () => {
    render(<RegisterForm labels={labels} />);
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Re-enter password")).toBeInTheDocument();
  });

  it("includes the password rule hint near the password input", () => {
    render(<RegisterForm labels={labels} />);
    expect(
      screen.getByText(/at least 5 characters, with at least one number/i),
    ).toBeInTheDocument();
  });
});
