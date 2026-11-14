/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  leaveEmpty: "Leave this field empty.",
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

// From September 2026 two bots signed strangers' addresses up through this form. These are
// the parts of the form that tell them apart, which a person must never meet.
describe("RegisterForm bot guards", () => {
  const trap = (container: HTMLElement) =>
    container.querySelector<HTMLInputElement>("input[name='website']")!;

  it("sends the server's signed note of when the form was made", () => {
    const { container } = render(<RegisterForm labels={labels} formToken="v1.note" />);
    const note = container.querySelector<HTMLInputElement>("input[name='formToken']");
    expect(note).toHaveAttribute("type", "hidden");
    expect(note).toHaveValue("v1.note");
  });

  it("has a field for machines that a screen reader never reads", () => {
    const { container } = render(<RegisterForm labels={labels} formToken="v1.note" />);
    const field = trap(container);
    expect(field).toHaveValue("");
    const box = field.closest(".vf-form-trap");
    expect(box).toHaveAttribute("aria-hidden", "true");
    expect(box).toHaveAttribute("inert");
    // Not in the accessibility tree: no textbox carries its label, and the form's own
    // fields are all a screen reader finds.
    expect(screen.queryByRole("textbox", { name: labels.leaveEmpty })).toBeNull();
    expect(screen.getAllByRole("textbox").map((input) => input.getAttribute("name"))).toEqual([
      "firstName",
      "lastName",
      "email",
    ]);
  });

  it("keeps the field out of the Tab order and out of every autofill", async () => {
    const { container } = render(<RegisterForm labels={labels} />);
    const field = trap(container);
    expect(field).toHaveAttribute("tabindex", "-1");
    expect(field).toHaveAttribute("autocomplete", "off");
    for (const optOut of ["data-1p-ignore", "data-lpignore", "data-bwignore", "data-form-type"]) {
      expect(field).toHaveAttribute(optOut);
    }
    const user = userEvent.setup();
    const reached: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      reached.push(document.activeElement?.getAttribute("name") ?? "");
    }
    expect(reached).not.toContain("website");
    expect(reached.slice(0, 3)).toEqual(["firstName", "lastName", "email"]);
  });

  it("stands between the names and the email, never just before a password", () => {
    const { container } = render(<RegisterForm labels={labels} />);
    const order = [...container.querySelectorAll("input:not([type=hidden])")].map((input) =>
      input.getAttribute("name"),
    );
    expect(order).toEqual([
      "firstName",
      "lastName",
      "website",
      "email",
      "password",
      "passwordConfirm",
    ]);
  });

  it("is hidden by moving it off the screen, not with display:none", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const rule = css.match(/\.vf-form-trap\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/left:\s*-\d+px/);
    expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  describe("a press within moments of the form appearing", () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    function fillIn() {
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: STRONG_PASSWORD } });
      fireEvent.change(screen.getByLabelText("Re-enter password"), {
        target: { value: STRONG_PASSWORD },
      });
    }

    // Only a person with every field filled for them could be this quick. The server would
    // send them back for their password; the form holds the press instead and sends it once
    // the form has been up long enough.
    it("is held, then sent once, by itself", () => {
      vi.useFakeTimers();
      const sent = vi
        .spyOn(HTMLFormElement.prototype, "requestSubmit")
        .mockImplementation(() => {});
      const { container } = render(<RegisterForm labels={labels} formToken="v1.note" />);
      const form = container.querySelector("form")!;
      fillIn();
      vi.advanceTimersByTime(1_000);

      expect(fireEvent.submit(form)).toBe(false);
      // A second press while the first is held sends nothing more.
      expect(fireEvent.submit(form)).toBe(false);
      vi.advanceTimersByTime(2_000);
      expect(sent).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1_000);
      expect(sent).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(10_000);
      expect(sent).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("is not held once the form has been up for a few seconds", () => {
      vi.useFakeTimers();
      const sent = vi
        .spyOn(HTMLFormElement.prototype, "requestSubmit")
        .mockImplementation(() => {});
      const { container } = render(<RegisterForm labels={labels} formToken="v1.note" />);
      fillIn();
      vi.advanceTimersByTime(4_000);
      // fireEvent answers false when a handler called preventDefault.
      expect(fireEvent.submit(container.querySelector("form")!)).toBe(true);
      expect(sent).not.toHaveBeenCalled();
    });

    it("still stops first for a password that is too weak", () => {
      vi.useFakeTimers();
      const sent = vi
        .spyOn(HTMLFormElement.prototype, "requestSubmit")
        .mockImplementation(() => {});
      const { container } = render(<RegisterForm labels={labels} />);
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "weak" } });
      expect(fireEvent.submit(container.querySelector("form")!)).toBe(false);
      vi.advanceTimersByTime(10_000);
      expect(sent).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Password")).toHaveFocus();
    });
  });
});
