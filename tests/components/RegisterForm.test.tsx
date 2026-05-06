/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("does not show the password requirements hint by default", () => {
    render(<RegisterForm labels={labels} />);
    expect(screen.queryByText(labels.passwordRequirements)).not.toBeInTheDocument();
  });

  it("shows the password requirements message as a red alert when the password is too weak", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "weak" } });
    fireEvent.blur(password);
    const message = screen.getByText(labels.passwordRequirements);
    expect(message).toBeInTheDocument();
    expect(message).toHaveAttribute("role", "alert");
  });

  it("shows the mismatch message when the two passwords differ", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const confirm = screen.getByLabelText("Re-enter password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "Strong1Pass" } });
    fireEvent.change(confirm, { target: { value: "Different1" } });
    fireEvent.blur(confirm);
    const message = screen.getByText(labels.mismatch);
    expect(message).toBeInTheDocument();
    expect(message).toHaveAttribute("role", "alert");
  });

  it("clears the validation message once the password becomes valid", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const confirm = screen.getByLabelText("Re-enter password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "weak" } });
    fireEvent.blur(password);
    expect(screen.getByText(labels.passwordRequirements)).toBeInTheDocument();
    fireEvent.change(password, { target: { value: "Strong1Pass" } });
    fireEvent.change(confirm, { target: { value: "Strong1Pass" } });
    expect(screen.queryByText(labels.passwordRequirements)).not.toBeInTheDocument();
    expect(screen.queryByText(labels.mismatch)).not.toBeInTheDocument();
  });
});
