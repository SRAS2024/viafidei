/**
 * @vitest-environment jsdom
 *
 * Tab loading + empty state component tests (spec §19).
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabEmptyState, TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

describe("TabLoadingSkeleton", () => {
  it("renders the supplied title", () => {
    render(<TabLoadingSkeleton title="Prayers" />);
    expect(screen.getByText("Prayers")).toBeInTheDocument();
  });

  it("renders the requested number of skeleton cards", () => {
    render(<TabLoadingSkeleton title="Sacraments" cards={7} />);
    const cards = screen.getAllByTestId("tab-loading-card");
    expect(cards).toHaveLength(7);
  });

  it("defaults to 6 skeleton cards when no count is supplied", () => {
    render(<TabLoadingSkeleton title="Saints" />);
    const cards = screen.getAllByTestId("tab-loading-card");
    expect(cards).toHaveLength(6);
  });

  it("exposes a 'Loading the latest published content' message", () => {
    render(<TabLoadingSkeleton title="History" />);
    expect(screen.getByText(/Loading the latest published content/)).toBeInTheDocument();
  });
});

describe("TabEmptyState", () => {
  it("renders the supplied title", () => {
    render(<TabEmptyState title="No prayers yet" />);
    expect(screen.getByText("No prayers yet")).toBeInTheDocument();
  });

  it("renders the default 'still building' description", () => {
    render(<TabEmptyState title="No saints yet" />);
    expect(screen.getByText(/factory is still building content/i)).toBeInTheDocument();
  });

  it("renders a custom description when supplied", () => {
    render(<TabEmptyState title="Empty" description="Custom message goes here." />);
    expect(screen.getByText("Custom message goes here.")).toBeInTheDocument();
  });
});
