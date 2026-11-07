/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { GuideSteps, InstructionText, ListedText, ReadingText } from "@/components/ui/GuideSteps";
import type { GuidePrayerData } from "@/components/ui/GuidePrayers";
import { createTranslator } from "@/lib/i18n/translator";

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

const HAIL_MARY: GuidePrayerData = {
  slug: "hail-mary",
  title: "Hail Mary",
  variants: [
    { code: "en", label: "English", text: "Hail Mary, full of grace...", preserve: false },
  ],
};

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

  it("breaks a step's long text into paragraphs sooner than a page's", () => {
    const sentence =
      "This is an ordinary sentence of a step, written out at about ordinary length.";
    const body = Array.from({ length: 7 }, () => sentence).join(" ");
    expect(body.length).toBeGreaterThan(450);
    expect(body.length).toBeLessThan(600);

    const step = render(<GuideSteps steps={[{ order: 1, title: "A long step", body }]} />);
    expect(step.container.querySelectorAll(".vf-step-body > p").length).toBeGreaterThan(1);
    step.unmount();

    const page = render(<ReadingText text={body} />);
    expect(page.container.querySelectorAll("p")).toHaveLength(1);
  });

  it("titles its steps one level under the heading the list sits under", () => {
    const { rerender } = render(<GuideSteps steps={STEPS} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    rerender(<GuideSteps steps={STEPS} titleLevel={2} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
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

  it("lets a prayer named as a part open from its name, as from the words under it", () => {
    render(
      <GuideSteps
        steps={[
          {
            order: 3,
            title: "The split",
            body: 'The leader prays the first half. Our Father: leader to "on earth," people from "Give us." Hail Mary: leader to "Jesus," people from "Holy Mary." Glory Be: leader "Glory be," people "as it was."',
          },
        ]}
        prayers={[...PRAYERS, HAIL_MARY]}
      />,
    );
    const name = screen.getByRole("button", { name: "Our Father" });
    expect(name.closest("p")).toHaveClass("vf-substep-title");
    expect(screen.getByRole("button", { name: "Hail Mary" }).closest("p")).toHaveClass(
      "vf-substep-title",
    );
    // A part that names no prayer the guide has is set just as a part.
    expect(screen.getByText("Glory Be")).toHaveClass("vf-substep-title");
    fireEvent.click(name);
    expect(screen.getByText(/who art in heaven/)).toBeVisible();
  });

  it("sets a part's name as plain text when no prayers are supplied", () => {
    render(
      <GuideSteps
        steps={[
          {
            order: 1,
            title: "The split",
            body: 'Our Father: leader to "earth." Hail Mary: leader to "Jesus." Glory Be: leader "Glory."',
          },
        ]}
      />,
    );
    expect(screen.getByText("Our Father")).toHaveClass("vf-substep-title");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says the step's number in the reader's language", () => {
    render(<GuideSteps steps={STEPS.slice(0, 1)} itemName="Part" t={createTranslator("es")} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Parte 1: Begin with the Sign of the Cross",
    );
    cleanup();
    render(<GuideSteps steps={STEPS.slice(0, 1)} t={createTranslator("es")} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Paso 1: Begin with the Sign of the Cross",
    );
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

describe("ListedText", () => {
  const DAYS =
    "Six days are kept. In the dioceses six days are observed: Mary on January 1; the Ascension; the Assumption on August 15; All Saints on November 1; the Immaculate Conception on December 8; and the Nativity on December 25. The Epiphany is transferred.";

  it("sets an article's list as a list, with no number and no step", () => {
    const { container } = render(
      <div className="vf-reading">
        <ListedText text={DAYS} />
      </div>,
    );
    const items = within(container.querySelector<HTMLElement>("ul")!).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Mary on January 1",
      "The Ascension",
      "The Assumption on August 15",
      "All Saints on November 1",
      "The Immaculate Conception on December 8; and",
      "The Nativity on December 25",
    ]);
    expect(container.querySelector("ul")).toHaveAttribute("role", "list");
    expect(container.querySelector("ol")).toBeNull();
    expect(container.textContent).not.toMatch(/\bStep\b/);
    expect(container.querySelector(".vf-step-number")).toBeNull();
    expect(screen.getByText(/^Six days are kept/)).toBeVisible();
    expect(screen.getByText("The Epiphany is transferred.")).toBeVisible();
  });

  it("is plain paragraphs when the text holds no list", () => {
    const { container } = render(<ListedText text="The Ascension is kept on Thursday." />);
    expect(container.querySelector("ul")).toBeNull();
    expect(screen.getByText("The Ascension is kept on Thursday.")).toBeVisible();
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
