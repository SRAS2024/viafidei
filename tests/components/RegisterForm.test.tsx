/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
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
    expect(screen.queryByText(labels.weakPassword)).not.toBeInTheDocument();
  });

  it("shows the spec-mandated red alert when the password is too weak", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "weak" } });
    fireEvent.blur(password);
    const message = screen.getByText(labels.weakPassword);
    expect(message).toBeInTheDocument();
    expect(message).toHaveAttribute("role", "alert");
    // The spec mandates the exact wording — pin it so a future i18n
    // edit cannot silently weaken the on-screen rule.
    expect(message.textContent).toContain("Password must be at least 12 characters");
    expect(message.textContent).toContain("uppercase letter");
    expect(message.textContent).toContain("lowercase letter");
    expect(message.textContent).toContain("number");
    expect(message.textContent).toContain("special character");
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
    expect(screen.getByText(labels.weakPassword)).toBeInTheDocument();
    fireEvent.change(password, { target: { value: STRONG_PASSWORD } });
    fireEvent.change(confirm, { target: { value: STRONG_PASSWORD } });
    expect(screen.queryByText(labels.weakPassword)).not.toBeInTheDocument();
    expect(screen.queryByText(labels.mismatch)).not.toBeInTheDocument();
  });

  it("rejects an 11-char password (one short of the minimum) and shows the rule", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    // 11 chars, includes upper / lower / digit / special, but too short.
    fireEvent.change(password, { target: { value: "Aa1!short!!" } });
    fireEvent.blur(password);
    expect(screen.getByText(labels.weakPassword)).toBeInTheDocument();
  });

  it("rejects a 12-char password missing a special character", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "PadreAlb1noXY" } });
    fireEvent.blur(password);
    expect(screen.getByText(labels.weakPassword)).toBeInTheDocument();
  });

  it("accepts a 12-char password that includes every required class", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: STRONG_PASSWORD } });
    fireEvent.blur(password);
    expect(screen.queryByText(labels.weakPassword)).not.toBeInTheDocument();
  });

  it("ties a failure from the server to its field, and moves focus there", () => {
    render(<RegisterForm labels={labels} error="That email is taken." errorField="email" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("That email is taken.");
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("That email is taken.");
    expect(email).toHaveFocus();
  });

  // At 200% text the browser's own scroll on focus centred the Email field and left
  // "An account already exists for that email." above the top of the screen.
  it("puts a field's failure directly above it, and brings the two into view itself", () => {
    const scrolled: string[] = [];
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.id);
    };
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    try {
      render(<RegisterForm labels={labels} error="That email is taken." errorField="email" />);
      const email = screen.getByLabelText("Email");
      expect(screen.getByRole("alert").nextElementSibling).toContainElement(email);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(email).toHaveFocus();
      // The message first, then the field: a message too long to share the screen
      // still leaves the field with focus in view.
      expect(scrolled).toEqual(["register-error", "email"]);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
      focus.mockRestore();
    }
  });

  it("puts each password failure above its own field", () => {
    const { unmount } = render(
      <RegisterForm labels={labels} error="Too weak." errorField="password" />,
    );
    expect(screen.getByRole("alert").nextElementSibling).toContainElement(
      screen.getByLabelText("Password"),
    );
    unmount();
    render(<RegisterForm labels={labels} error="No match." errorField="passwordConfirm" />);
    expect(screen.getByRole("alert").nextElementSibling).toContainElement(
      screen.getByLabelText("Re-enter password"),
    );
  });

  it("starts a reader at the top of the form for a failure that belongs to no field", () => {
    render(<RegisterForm labels={labels} error="Too many requests." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests.");
    expect(screen.getByLabelText("First name")).toHaveFocus();
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });

  it("asks the browser for the right autofill on every field", () => {
    render(<RegisterForm labels={labels} />);
    expect(screen.getByLabelText("First name")).toHaveAttribute("autocomplete", "given-name");
    expect(screen.getByLabelText("Last name")).toHaveAttribute("autocomplete", "family-name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Re-enter password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("puts the Show control after the field it reveals, in reading and tab order", () => {
    render(<RegisterForm labels={labels} />);
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show" });
    expect(password.compareDocumentPosition(toggle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Re-enter password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
  });

  it("has no obvious accessibility violations in its initial render", async () => {
    const { container } = render(<RegisterForm labels={labels} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
