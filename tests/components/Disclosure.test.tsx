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
