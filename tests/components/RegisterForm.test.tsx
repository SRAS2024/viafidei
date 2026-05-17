/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { RegisterForm } from "@/app/register/RegisterForm";

const labels = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  password: "Password",
  passwordConfirm: "Re-enter password",
  passwordRequirements:
    "Use at least 12 characters with one uppercase letter, one lowercase letter, one number, and one special character.",
  submit: "Create account",
  show: "Show",
  hide: "Hide",
  weakPassword:
    "Password must be at least 12 characters and include one uppercase letter, one lowercase letter, one number, and one special character.",
  mismatch: "Passwords do not match.",
  privacyBefore: "By selecting create account, you agree to our ",
  privacyLink: "privacy policy",
  privacyAfter: ".",
};

const STRONG_PASSWORD = "Strong1Pass!Word";
const ANOTHER_STRONG_PASSWORD = "D1fferent!P@ssword";

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
    fireEvent.change(password, { target: { value: STRONG_PASSWORD } });
    fireEvent.change(confirm, { target: { value: ANOTHER_STRONG_PASSWORD } });
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
    fireEvent.change(password, { target: { value: STRONG_PASSWORD } });
    fireEvent.change(confirm, { target: { value: STRONG_PASSWORD } });
    expect(screen.queryByText(labels.passwordRequirements)).not.toBeInTheDocument();
    expect(screen.queryByText(labels.mismatch)).not.toBeInTheDocument();
  });

  it("rejects an 11-char password (one short of the minimum) and shows the rule", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    // 11 chars, includes upper / lower / digit / special, but too short.
    fireEvent.change(password, { target: { value: "Aa1!short!!" } });
    fireEvent.blur(password);
    expect(screen.getByText(labels.passwordRequirements)).toBeInTheDocument();
  });

  it("rejects a 12-char password missing a special character", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "PadreAlb1noXY" } });
    fireEvent.blur(password);
    expect(screen.getByText(labels.passwordRequirements)).toBeInTheDocument();
  });

  it("accepts a 12-char password that includes every required class", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: STRONG_PASSWORD } });
    fireEvent.blur(password);
    expect(screen.queryByText(labels.passwordRequirements)).not.toBeInTheDocument();
  });

  it("has no obvious accessibility violations in its initial render", async () => {
    const { container } = render(<RegisterForm labels={labels} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
