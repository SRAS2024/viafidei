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
import { LoginRequiredPopup } from "@/components/ui/LoginRequiredPopup";

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

  it("closes on the close button, the backdrop and Escape", () => {
    const onClose = vi.fn();
    render(<LoginRequiredPopup open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Pointer-down on the backdrop itself (not the dialog) dismisses.
    const backdrop = screen.getByRole("presentation");
    fireEvent.pointerDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);

    // A pointer-down inside the dialog must NOT dismiss it.
    fireEvent.pointerDown(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
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
