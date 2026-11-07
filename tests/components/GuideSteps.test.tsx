/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { GuideSteps, InstructionText, ReadingText } from "@/components/ui/GuideSteps";
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

  it("tells a screen reader the step's number, and says the list is a list", () => {
    const { container } = render(<GuideSteps steps={STEPS} />);
    const list = container.querySelector("ol")!;
    expect(list).toHaveClass("vf-steps");
    expect(list).toHaveAttribute("role", "list");
    expect(container.querySelector(".vf-step-number")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { name: /Step 1: Begin with/ })).toHaveClass(
      "vf-step-title",
    );
    expect(container.querySelector(".vf-step-body")).toHaveClass("vf-reading");
  });

  it("gives a step with no title no heading, and still says its number", () => {
    render(
      <GuideSteps steps={[{ order: 1, title: null, body: "Become aware of God's presence." }]} />,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Step 1:")).toHaveClass("sr-only");
    expect(screen.getByText("Become aware of God's presence.")).toBeVisible();
  });

  it("sets the words to say apart from the instruction, in order and in full", () => {
    const { container } = render(
      <GuideSteps
        steps={[
          {
            order: 4,
            title: "Confess your sins to the priest",
            body: "Begin: 'Bless me, Father, for I have sinned.' Confess all mortal sins.",
          },
        ]}
      />,
    );
    const body = container.querySelector(".vf-step-body")!;
    expect([...body.children].map((el) => el.tagName)).toEqual(["P", "BLOCKQUOTE", "P"]);
    expect(body.children[0]).toHaveTextContent("Begin:");
    expect(body.querySelector("blockquote.vf-spoken .vf-prayer")).toHaveTextContent(
      "Bless me, Father, for I have sinned.",
    );
    expect(body.children[2]).toHaveTextContent("Confess all mortal sins.");
  });

  it("lists a sequence inside a step with its own numbers, between the words around it", () => {
    const { container } = render(
      <GuideSteps
        steps={[
          {
            order: 3,
            title: "The stations",
            body: "They run in order: 1. Jesus is condemned. 2. He takes up his Cross. 3. He falls. Walk slowly.",
          },
        ]}
      />,
    );
    const nested = container.querySelector<HTMLElement>(".vf-step-body ol.vf-substeps")!;
    expect(
      within(nested)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Jesus is condemned.", "He takes up his Cross.", "He falls."]);
    expect(screen.getByText("They run in order:")).toBeVisible();
    expect(screen.getByText("Walk slowly.")).toBeVisible();
  });

  it("carries a nested count on from an earlier step", () => {
    const { container } = render(
      <GuideSteps
        steps={[
          {
            order: 4,
            title: "The middle choirs",
            body: 'Fourth: "By the Dominations. Amen." Fifth: "By the Powers. Amen." Sixth: "By the Virtues. Amen."',
          },
        ]}
      />,
    );
    expect(container.querySelector("ol.vf-substeps")).toHaveAttribute("start", "4");
  });
});

describe("InstructionText", () => {
  const LECTIO =
    "1. Lectio (reading): read a brief passage of Scripture slowly, twice. 2. Meditatio (meditation): reflect on a word or phrase that resonates. 3. Oratio (prayer): respond to God from the heart. 4. Contemplatio (contemplation): rest silently in God's presence. Pope Benedict XVI urged the rediscovery of Lectio Divina in Verbum Domini (2010).";

  it("gives each of Lectio Divina's four movements its own step, then the closing sentence", () => {
    const { container } = render(
      <div className="vf-reading">
        <InstructionText text={LECTIO} />
      </div>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Step 1: Lectio (reading)",
      "Step 2: Meditatio (meditation)",
      "Step 3: Oratio (prayer)",
      "Step 4: Contemplatio (contemplation)",
    ]);
    expect(screen.getByText("Read a brief passage of Scripture slowly, twice.")).toBeVisible();
    expect(container.querySelector("ol + p")).toHaveTextContent(
      /^Pope Benedict XVI urged the rediscovery/,
    );
  });

  it("is plain paragraphs when the text holds no sequence", () => {
    const { container } = render(<InstructionText text="Pray the Hail Mary daily." />);
    expect(container.querySelector("ol")).toBeNull();
    expect(screen.getByText("Pray the Hail Mary daily.")).toBeVisible();
  });

  it("keeps prayer names inline-expandable in a parsed step", () => {
    render(
      <InstructionText
        text="1. Kneel down quietly. 2. Pray the Our Father slowly. 3. Rest a moment."
        prayers={PRAYERS}
      />,
    );
    expect(screen.getByRole("button", { name: /Our Father/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("ReadingText", () => {
  it("breaks a long paragraph into paragraphs with the same words", () => {
    const text = Array.from(
      { length: 12 },
      (_, i) => `This is sentence ${i + 1} of the guide's long introduction to the prayer.`,
    ).join(" ");
    const { container } = render(<ReadingText text={text} />);
    const paragraphs = [...container.querySelectorAll("p")].map((p) => p.textContent);
    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs.join(" ")).toBe(text);
  });
});
