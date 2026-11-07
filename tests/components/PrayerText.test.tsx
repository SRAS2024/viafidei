/**
 * @vitest-environment jsdom
 */
/**
 * A prayer's full text as it is set on the page. The words reach a reader and a
 * screen reader in their order, one line at a time, with nothing added; only the
 * printed signs that are not words are hidden from a screen reader.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { PrayerText } from "@/components/ui/PrayerText";
import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";

afterEach(() => cleanup());

const withoutSpace = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, "");

/** The text a screen reader meets: everything outside aria-hidden. */
function spokenText(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return clone.textContent ?? "";
}

describe("PrayerText", () => {
  it("sets stanzas as paragraphs of lines, in order, with their line breaks", () => {
    const { container } = render(
      <PrayerText text={"Our Father, who art in heaven,\nhallowed be thy name;\n\nAmen."} />,
    );
    const stanzas = container.querySelectorAll("p.vf-prayer-stanza");
    expect(stanzas).toHaveLength(2);
    const lines = [...stanzas[0]!.querySelectorAll(".vf-prayer-line")].map((l) => l.textContent);
    expect(lines).toEqual(["Our Father, who art in heaven,", "hallowed be thy name;"]);
    expect(stanzas[1]).toHaveTextContent("Amen.");
  });

  it("gives Latin and Greek their language, and keeps device translation off them", () => {
    const { container } = render(<PrayerText text="Pater noster" lang="la" preserve />);
    const prayer = container.querySelector(".vf-prayer");
    expect(prayer).toHaveAttribute("lang", "la");
    expect(prayer).toHaveAttribute("translate", "no");
  });

  it("leaves the vernacular translatable", () => {
    const { container } = render(<PrayerText text="Our Father" lang="en" />);
    expect(container.querySelector(".vf-prayer")).toHaveAttribute("translate", "yes");
  });

  it("puts a line's marker in the hanging margin, part of the words", () => {
    const { container } = render(<PrayerText text={"V. Lord, open my lips.\nR. And my mouth."} />);
    const [versicle, response] = [...container.querySelectorAll(".vf-prayer-line")];
    expect(versicle).toHaveClass("vf-prayer-marked");
    expect(versicle!.querySelector(".vf-prayer-marker")).toHaveTextContent("V.");
    expect(versicle!.textContent).toBe("V. Lord, open my lips.");
    expect(response).toHaveClass("vf-prayer-response");
    expect(response!.textContent).toBe("R. And my mouth.");
  });

  it("gives every repeated response of a litany the one treatment", () => {
    const litany = [
      "Holy Mary, pray for us.",
      "Mirror of justice, pray for us.",
      "Queen of peace, pray for us.",
      "Lamb of God, who takes away the sins of the world, spare us, O Lord.",
    ];
    const { container } = render(<PrayerText text={litany.join("\n")} />);
    const responses = [...container.querySelectorAll(".vf-prayer-line .vf-prayer-response")];
    expect(responses.map((r) => r.textContent)).toEqual([
      "pray for us.",
      "pray for us.",
      "pray for us.",
      "spare us, O Lord.",
    ]);
    // The invocation and its response read in order as the line they are.
    const lines = [...container.querySelectorAll(".vf-prayer-line")].map((l) => l.textContent);
    expect(lines).toEqual(litany);
  });

  it("sets instructions and notes apart from the words that are said", () => {
    const { container } = render(
      <PrayerText
        text={"(Hail Mary)\n\nPrayed on Thursdays.\n\nSpare us, O Lord. Pater noster."}
      />,
    );
    expect(screen.getByText("(Hail Mary)")).toHaveClass("vf-prayer-rubric");
    expect(screen.getByText("Prayed on Thursdays.")).toHaveClass("vf-prayer-note");
    // Inside a spoken line, an instruction is its own quiet run.
    const inline = container.querySelector(
      ".vf-prayer-line:not(.vf-prayer-rubric) .vf-prayer-rubric",
    );
    expect(inline).toHaveTextContent("Pater noster.");
  });

  it("names a prayer's parts with real headings when the page gives a level", () => {
    render(<PrayerText text={"First Decade.\nThe Archangel Gabriel."} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "First Decade." })).toBeInTheDocument();
  });

  it("keeps a number and a name that open a part as headings", () => {
    render(<PrayerText text={"II.\n\nFirst Decade.\n\nThe Archangel Gabriel."} headingLevel={3} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "II.",
      "First Decade.",
    ]);
  });

  it("sets a part's name as text when no level is given", () => {
    const { container } = render(<PrayerText text={"First Decade.\nThe Archangel Gabriel."} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector("p.vf-prayer-heading")).toHaveTextContent("First Decade.");
  });

  it("hides printed signs from a screen reader and keeps them on the page", () => {
    const { container } = render(
      <PrayerText text="V. May almighty God bless you, + the Father, + and the Son." />,
    );
    const signs = [...container.querySelectorAll(".vf-prayer-symbol")];
    expect(signs.map((s) => s.textContent)).toEqual(["+", "+"]);
    for (const sign of signs) expect(sign).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toContain("+ the Father, + and the Son.");
    expect(spokenText(container)).not.toContain("+");
  });

  it("takes a slash that stood for a line break as the line break", () => {
    const { container } = render(
      <PrayerText text="V. The Lord be with you. / R. And also with you." />,
    );
    const lines = [...container.querySelectorAll(".vf-prayer-line")].map((l) => l.textContent);
    expect(lines).toEqual(["V. The Lord be with you.", "R. And also with you."]);
  });

  it("lets a caller render the words and add to a stanza", () => {
    render(
      <PrayerText
        text={"One.\n\nTwo."}
        renderText={(text, stanza) => <mark>{`${stanza}:${text}`}</mark>}
        afterStanza={(stanza) => <aside>{`after ${stanza}`}</aside>}
      />,
    );
    expect(screen.getByText("0:One.")).toBeInTheDocument();
    expect(screen.getByText("1:Two.")).toBeInTheDocument();
    expect(screen.getByText("after 1")).toBeInTheDocument();
  });

  it("renders on the server as well as in the browser", () => {
    expect(renderToStaticMarkup(<PrayerText text="Holy Mary, Mother of God." />)).toContain(
      "Holy Mary, Mother of God.",
    );
  });

  it("shows every word of the curated litanies and dialogues, in order", () => {
    const prayers = prayerKnowledge.filter((prayer) => {
      const body = (prayer.payload as Record<string, unknown>).body;
      return typeof body === "string" && /\bpray for us\b|^V\. |^R\. /m.test(body);
    });
    expect(prayers.length).toBeGreaterThan(20);
    for (const prayer of prayers) {
      const body = (prayer.payload as Record<string, unknown>).body as string;
      const { container, unmount } = render(<PrayerText text={body} />);
      // A slash standing for a line break is the one thing not drawn.
      expect(withoutSpace(container.textContent), prayer.slug).toBe(
        withoutSpace(body.replace(/ \/ (?=[VR]\. )/g, " ")),
      );
      unmount();
    }
  });
});
