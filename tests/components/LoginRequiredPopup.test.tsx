/**
 * @vitest-environment jsdom
 */
/**
 * The sign-in / create-account popup every account-gated control shares
 * (Favorite on a parish or a prayer, Add to spiritual life, …).
 *
 * The two things that matter to a signed-out visitor: the popup actually
 * appears, and both of its buttons carry them back to the page they were on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ path: "/parishes/st-marys" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

import { AccountRequiredButton } from "@/components/ui/AccountRequiredButton";
import {
  LoginRequiredLabelsProvider,
  LoginRequiredPopup,
} from "@/components/ui/LoginRequiredPopup";

let assign: ReturnType<typeof vi.fn>;
let realLocation: Location;

beforeEach(() => {
  nav.path = "/parishes/st-marys";
  assign = vi.fn();
  // The popup navigates hard on purpose (see its comment); jsdom's own
  // location.assign throws "not implemented", so it must be stubbed.
  realLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...realLocation, assign },
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
  vi.restoreAllMocks();
});

describe("LoginRequiredPopup", () => {
  it("renders nothing while closed", () => {
    render(<LoginRequiredPopup open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the message and both account CTAs when open", () => {
    render(<LoginRequiredPopup open onClose={() => {}} message="An account is required." />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("An account is required.");
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("returns the visitor to the current page after logging in or registering", () => {
    nav.path = "/parishes/st-marys";
    const { rerender } = render(<LoginRequiredPopup open onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(assign).toHaveBeenLastCalledWith("/login?next=%2Fparishes%2Fst-marys");

    rerender(<LoginRequiredPopup open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(assign).toHaveBeenLastCalledWith("/register?next=%2Fparishes%2Fst-marys");
  });

  it("moves focus into itself, on the first action, so a screen reader hears it", () => {
    render(<LoginRequiredPopup open onClose={() => {}} message="An account is required." />);
    expect(screen.getByRole("button", { name: "Log in" })).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "An account is required." })).toBeInTheDocument();
  });

  it("closes on the close button, the backdrop and Escape", () => {
    const onClose = vi.fn();
    render(<LoginRequiredPopup open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // A press and click on the backdrop itself (not the dialog) dismisses.
    const backdrop = screen.getByRole("presentation");
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);

    // A click inside the dialog must NOT dismiss it.
    fireEvent.pointerDown(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("waits for the press on the backdrop to finish before it closes", () => {
    // Closing on the press handed focus back, and the press then moved it to the page.
    const onClose = vi.fn();
    render(<LoginRequiredPopup open onClose={onClose} />);
    const backdrop = screen.getByRole("presentation");
    fireEvent.pointerDown(backdrop);
    // fireEvent says false when the default was prevented: focus stays in the dialog.
    expect(fireEvent.mouseDown(backdrop)).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open for a selection dragged out of the dialog onto the backdrop", () => {
    const onClose = vi.fn();
    render(<LoginRequiredPopup open onClose={onClose} message="An account is required." />);
    fireEvent.pointerDown(screen.getByText("An account is required."));
    // The browser sends the click to what the two ends share, which is the backdrop.
    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not take that drag for an earlier press on the backdrop", () => {
    const onClose = vi.fn();
    render(<LoginRequiredPopup open onClose={onClose} message="An account is required." />);
    const backdrop = screen.getByRole("presentation");
    // A press that went nowhere: it never became a click.
    fireEvent.pointerDown(backdrop);
    fireEvent.pointerDown(screen.getByText("An account is required."));
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
    // A click with no press of its own is not one: the popup stays for it.
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets a press inside the dialog move focus as usual", () => {
    render(<LoginRequiredPopup open onClose={() => {}} />);
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Create account" }))).toBe(true);
  });
});

describe("AccountRequiredButton", () => {
  it("opens the popup for a signed-out visitor instead of running the action", () => {
    const onClick = vi.fn();
    render(
      <AccountRequiredButton isAuthed={false} onClick={onClick}>
        Add
      </AccountRequiredButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each([
    [
      "the backdrop",
      () => {
        const backdrop = screen.getByRole("presentation");
        fireEvent.pointerDown(backdrop);
        fireEvent.mouseDown(backdrop);
        fireEvent.click(backdrop);
      },
    ],
    ["Close", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
  ])("hands focus back to the button that opened the popup, from %s", (_how, close) => {
    render(
      <AccountRequiredButton isAuthed={false} onClick={() => {}}>
        Add
      </AccountRequiredButton>,
    );
    const button = screen.getByRole("button", { name: "Add" });
    button.focus();
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Log in" })).toHaveFocus();
    close();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("runs the action for a signed-in user and shows no popup", () => {
    const onClick = vi.fn();
    render(
      <AccountRequiredButton isAuthed onClick={onClick}>
        Add
      </AccountRequiredButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the popup's words, from the root layout", () => {
  const GERMAN = {
    message: "Für diese Funktion ist ein Konto erforderlich.",
    loginLabel: "Anmelden",
    registerLabel: "Konto erstellen",
    closeLabel: "Schließen",
  };

  it("are the reader's when the control that opens it gives none", () => {
    render(
      <LoginRequiredLabelsProvider labels={GERMAN}>
        <LoginRequiredPopup open onClose={() => {}} />
      </LoginRequiredLabelsProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: GERMAN.message });
    expect(dialog).toHaveTextContent("Anmelden");
    expect(dialog).toHaveTextContent("Konto erstellen");
    expect(screen.getByRole("button", { name: "Schließen" })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/log in|create account/i);
  });

  it("give way to words the control gives", () => {
    render(
      <LoginRequiredLabelsProvider labels={GERMAN}>
        <LoginRequiredPopup open onClose={() => {}} message="Zum Speichern ein Konto." />
      </LoginRequiredLabelsProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Zum Speichern ein Konto." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeInTheDocument();
  });
});
