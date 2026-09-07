/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { GuideSteps } from "@/components/ui/GuideSteps";
import type { GuidePrayerData } from "@/components/ui/GuidePrayers";

afterEach(() => cleanup());

const STEPS = [
  { order: 1, title: "Begin with the Sign of the Cross", body: "Make the Sign of the Cross." },
  { order: 2, title: "Opening prayers", body: "On the first bead pray the Our Father." },
  { order: 3, title: "Announce the first mystery", body: "Announce the mystery of the day." },
];

const PRAYERS: GuidePrayerData[] = [
  {
    slug: "our-father",
    title: "Our Father",
    variants: [
      { code: "en", label: "English", text: "Our Father, who art in heaven...", preserve: false },
      { code: "la", label: "Latin", text: "Pater noster...", preserve: true },
    ],
  },
];

describe("GuideSteps", () => {
  it("renders an ordered list — a how-to is a sequence, not a set", () => {
    const { container } = render(<GuideSteps steps={STEPS} />);
    expect(container.querySelector("ol")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows every step's body without a click (never a closed accordion)", () => {
    // This is the whole fix: the guide used to be N closed chevrons.
    render(<GuideSteps steps={STEPS} />);
    for (const step of STEPS) {
      expect(screen.getByText(step.body)).toBeVisible();
    }
    // No disclosure buttons at all.
    expect(screen.queryByRole("button", { expanded: false })).not.toBeInTheDocument();
  });

  it("numbers the steps", () => {
    render(<GuideSteps steps={STEPS} />);
    for (const n of ["1", "2", "3"]) {
      expect(screen.getByText(n)).toBeInTheDocument();
    }
  });

  it("gives each step a heading so the page outline is navigable", () => {
    render(<GuideSteps steps={STEPS} />);
    expect(
      screen.getByRole("heading", { name: /Begin with the Sign of the Cross/ }),
    ).toBeInTheDocument();
  });

  it("makes prayer names inside a step body inline-expandable when prayers are supplied", () => {
    render(<GuideSteps steps={STEPS} prayers={PRAYERS} />);
    // PrayerLinkedText turns the named prayer into a button.
    expect(screen.getByRole("button", { name: /Our Father/ })).toBeInTheDocument();
  });

  it("renders plain text when no prayers are supplied", () => {
    render(<GuideSteps steps={STEPS} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for an empty step list", () => {
    const { container } = render(<GuideSteps steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
