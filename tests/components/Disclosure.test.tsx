/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Disclosure } from "@/components/ui/Disclosure";

afterEach(() => cleanup());

describe("Disclosure (prayer/day dropdown)", () => {
  it("is collapsed by default and expands on click", () => {
    render(<Disclosure title="Our Father">Our Father, who art in heaven...</Disclosure>);
    const button = screen.getByRole("button", { name: /Our Father/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/who art in heaven/)).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/who art in heaven/)).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByText(/who art in heaven/)).not.toBeInTheDocument();
  });

  it("can start open", () => {
    render(
      <Disclosure title="Day 1" defaultOpen>
        Day one prayer
      </Disclosure>,
    );
    expect(screen.getByText("Day one prayer")).toBeInTheDocument();
  });
});

describe("Disclosure with an action (a novena day's megaphone)", () => {
  it("shows the action beside the title only while open, keeping the toggle (and its focus) in place", () => {
    render(
      <Disclosure
        title="All mankind"
        eyebrow="Day 1"
        action={<button type="button">Pray along: Day 1</button>}
      >
        <p>The day&apos;s prayer</p>
      </Disclosure>,
    );
    const toggle = screen.getByRole("button", { name: /all mankind/i });
    expect(screen.queryByRole("button", { name: "Pray along: Day 1" })).toBeNull();
    toggle.focus();
    fireEvent.click(toggle);
    // Same element, still focused: opening did not remount it.
    expect(screen.getByRole("button", { name: /all mankind/i })).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
    const action = screen.getByRole("button", { name: "Pray along: Day 1" });
    // Reading order: the day, its megaphone, then its prayer.
    expect(toggle.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      action.compareDocumentPosition(screen.getByText("The day's prayer")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole("button", { name: "Pray along: Day 1" })).toBeNull();
  });
});
