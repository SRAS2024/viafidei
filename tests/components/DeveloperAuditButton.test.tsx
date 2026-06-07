/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DeveloperAuditButton } from "@/app/admin/diagnostics/DeveloperAuditButton";

afterEach(cleanup);

describe("DeveloperAuditButton — Developer Report dropdown", () => {
  it("opens a fully-rendered, raised, scrollable panel (not clipped) and closes on Escape", () => {
    render(<DeveloperAuditButton />);

    // Closed initially.
    expect(screen.queryByText("Report period")).toBeNull();

    // Open it.
    fireEvent.click(screen.getByRole("button", { name: /Developer Report/ }));

    // Every part of the panel renders.
    expect(screen.getByText("Report period")).toBeInTheDocument();
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByText("Last 24 hours")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics Results")).toBeInTheDocument();
    expect(screen.getByText("Recommended Repairs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download PDF/ })).toBeInTheDocument();

    // The panel sits on its own raised (z-50), capped + scrollable layer so it
    // can never be clipped behind the cards below it.
    const panel = document.querySelector(".overflow-y-auto");
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("z-50");
    expect(panel?.className).toMatch(/max-h-/);

    // Escape closes it.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Report period")).toBeNull();
  });
});
