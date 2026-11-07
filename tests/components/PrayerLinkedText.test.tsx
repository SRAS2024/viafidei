/**
 * @vitest-environment jsdom
 *
 * Inline-expandable prayers in guide/novena step text: a prayer the guide uses,
 * named in a step, becomes a button that drops the full prayer open in place —
 * with its own language toggle and verbatim (translate="no") Latin/Greek. Text
 * that names no known prayer renders untouched.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PrayerLinkedText } from "@/components/ui/PrayerLinkedText";
import type { GuidePrayerData } from "@/components/ui/GuidePrayers";

afterEach(() => cleanup());
// The language choice is session-wide, so one test's Latin must not leak into the next.
beforeEach(() => window.sessionStorage.clear());

const OUR_FATHER: GuidePrayerData = {
  slug: "our-father",
  title: "Our Father",
  variants: [
    { code: "en", label: "English", text: "Our Father, who art in heaven...", preserve: false },
    { code: "la", label: "Latin", text: "Pater noster, qui es in caelis...", preserve: true },
  ],
};
const HAIL_HOLY_QUEEN: GuidePrayerData = {
  slug: "salve-regina",
  title: "Hail Holy Queen (Salve Regina)",
  variants: [
    { code: "en", label: "English", text: "Hail, holy Queen, Mother of mercy...", preserve: false },
  ],
};
const GLORY_BE: GuidePrayerData = {
  slug: "glory-be",
  title: "Glory Be",
  variants: [{ code: "en", label: "English", text: "Glory be to the Father...", preserve: false }],
};

describe("PrayerLinkedText", () => {
  it("reads as a link, and says whether its prayer is open", () => {
    render(<PrayerLinkedText text="Pray the Our Father." prayers={[OUR_FATHER]} />);
    const link = screen.getByRole("button", { name: "Our Father" });
    expect(link).toHaveClass("vf-link");
    expect(link).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(link);
    expect(link).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(link.getAttribute("aria-controls")!)).toHaveTextContent(
      "Our Father, who art in heaven...",
    );
    fireEvent.click(link);
    expect(link).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/who art in heaven/)).not.toBeInTheDocument();
  });

  it("works from the keyboard: Enter and Space open and close, Tab reaches the chips", async () => {
    const user = userEvent.setup();
    render(<PrayerLinkedText text="Pray the Our Father." prayers={[OUR_FATHER]} />);
    const link = screen.getByRole("button", { name: "Our Father" });

    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(link).toHaveAttribute("aria-expanded", "true");

    // The opened prayer comes next in the tab order, with its chips.
    await user.tab();
    const latin = screen.getByRole("button", { name: "Latin" });
    expect(latin).toHaveFocus();
    await user.keyboard(" ");
    expect(latin).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Pater noster/)).toBeInTheDocument();
    await user.keyboard(" ");
    expect(latin).toHaveAttribute("aria-pressed", "false");

    await user.tab({ shift: true });
    expect(link).toHaveFocus();
    await user.keyboard(" ");
    expect(link).toHaveAttribute("aria-expanded", "false");
  });

  it("opens a prayer with the look of a disclosure, its text set as prayer", () => {
    render(<PrayerLinkedText text="Pray the Our Father." prayers={[OUR_FATHER]} />);
    fireEvent.click(screen.getByRole("button", { name: "Our Father" }));
    const panel = screen.getByRole("heading", { name: "Our Father" }).closest(".vf-disclosure");
    expect(panel).not.toBeNull();
    const line = screen.getByText(/who art in heaven/);
    expect(line).toHaveClass("vf-prayer-line");
    expect(line.closest(".vf-disclosure-body")).not.toBeNull();
    expect(line.closest(".vf-prayer")).toHaveAttribute("lang", "en");
  });

  it("does not read a name's punctuation on its own", () => {
    const { container } = render(
      <PrayerLinkedText text="(Our Father)" prayers={[OUR_FATHER]} matchCase />,
    );
    const hidden = [...container.querySelectorAll('[aria-hidden="true"]')].filter(
      (node) => !(node instanceof SVGElement),
    );
    expect(hidden.map((node) => node.textContent)).toEqual(["(", ")"]);
    expect(container.textContent).toBe("(Our Father)");
  });

  describe("over text that is itself prayer", () => {
    const ANGELUS = [
      "V. The Angel of the Lord declared unto Mary.",
      "R. And she conceived of the Holy Spirit.",
      "(Our Father)",
      "V. Behold the handmaid of the Lord.",
      "R. Be it done unto me.",
      "(Our Father)",
    ].join("\n");

    it("sets the text as prayer, with its links", () => {
      const { container } = render(
        <PrayerLinkedText text={ANGELUS} prayers={[OUR_FATHER]} matchCase />,
      );
      expect(container.querySelectorAll(".vf-prayer-stanza")).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: "Our Father" })).toHaveLength(2);
      expect(screen.getByText("And she conceived of the Holy Spirit.")).toBeInTheDocument();
    });

    it("opens a prayer under the stanza that names it, and only there", () => {
      const { container } = render(
        <PrayerLinkedText text={ANGELUS} prayers={[OUR_FATHER]} matchCase />,
      );
      const [first, second] = screen.getAllByRole("button", { name: "Our Father" });
      fireEvent.click(second!);
      expect(first).toHaveAttribute("aria-expanded", "false");
      expect(second).toHaveAttribute("aria-expanded", "true");
      expect(screen.getAllByText(/who art in heaven/)).toHaveLength(1);

      const panel = document.getElementById(second!.getAttribute("aria-controls")!);
      const stanzas = container.querySelectorAll(".vf-prayer-stanza");
      expect(
        stanzas[1]!.compareDocumentPosition(panel!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(stanzas[1]!.contains(panel)).toBe(false);

      fireEvent.click(first!);
      const ids = [first!, second!].map((link) => link.getAttribute("aria-controls"));
      expect(new Set(ids).size).toBe(2);
      expect(screen.getAllByText(/who art in heaven/)).toHaveLength(2);
    });

    it("does not make a line that says a prayer's words a link to it", () => {
      const GLORY: GuidePrayerData = { ...GLORY_BE };
      render(
        <PrayerLinkedText
          text={"Glory be to Thee, O Lord, for all Thy gifts.\nOur Father, most holy, our Creator."}
          prayers={[GLORY, OUR_FATHER]}
          matchCase
        />,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("Glory be to Thee, O Lord, for all Thy gifts.")).toBeInTheDocument();
    });

    it("still links a line that only points at a prayer", () => {
      render(
        <PrayerLinkedText
          text={"V. Glory be to the Father, etc.\n\nOn the single bead, pray the Our Father."}
          prayers={[GLORY_BE, OUR_FATHER]}
          matchCase
        />,
      );
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
        "Glory be",
        "Our Father",
      ]);
    });
  });

  it("expands the full prayer in place when a named prayer is clicked", () => {
    render(
      <PrayerLinkedText text="On the first bead pray the Our Father." prayers={[OUR_FATHER]} />,
    );

    // The prayer text is hidden until the name is clicked.
    expect(screen.queryByText(/Our Father, who art in heaven/)).not.toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Our Father/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Our Father, who art in heaven/)).toBeInTheDocument();
  });

  it("offers a language toggle and marks Latin translate=no", () => {
    render(<PrayerLinkedText text="Pray the Our Father." prayers={[OUR_FATHER]} />);
    fireEvent.click(screen.getByRole("button", { name: /Our Father/ }));

    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    const latin = screen.getByText(/Pater noster, qui es in caelis/);
    expect(latin).toBeInTheDocument();
    expect(latin.closest(".vf-prayer")).toHaveAttribute("translate", "no");
  });

  it("matches the short form of a parenthetical title and plural forms", () => {
    render(
      <PrayerLinkedText
        text="Conclude with the Hail Holy Queen. Pray ten Hail Marys."
        prayers={[HAIL_HOLY_QUEEN, OUR_FATHER]}
      />,
    );
    // "Hail Holy Queen" (short form of the title) is linked.
    expect(screen.getByRole("button", { name: /Hail Holy Queen/ })).toBeInTheDocument();
  });

  it("renders plain text when no known prayer is named", () => {
    render(<PrayerLinkedText text="Make the Sign of the Cross." prayers={[GLORY_BE]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Make the Sign of the Cross.")).toBeInTheDocument();
  });

  it("does not over-match: a bare word is not turned into a prayer link", () => {
    // "father" alone must not match the "Our Father" entry.
    render(<PrayerLinkedText text="Honor your father and mother." prayers={[OUR_FATHER]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers the same Latin chip as the prayer page, never an English one", () => {
    render(<PrayerLinkedText text="Pray the Our Father." prayers={[OUR_FATHER]} />);
    fireEvent.click(screen.getByRole("button", { name: /Our Father/ }));
    expect(screen.getByRole("group", { name: "Our Father language" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();
  });

  it("shows no chip for a prayer that has only its vernacular", () => {
    render(<PrayerLinkedText text="Pray the Glory Be." prayers={[GLORY_BE]} />);
    fireEvent.click(screen.getByRole("button", { name: /Glory Be/ }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("gives each opened panel its own id, even when two texts open the same prayer", () => {
    render(
      <>
        <PrayerLinkedText text="Day one: pray one Our Father." prayers={[OUR_FATHER]} />
        <PrayerLinkedText text="Day two: pray one Our Father." prayers={[OUR_FATHER]} />
      </>,
    );
    const [first, second] = screen.getAllByRole("button", { name: /Our Father/ });
    fireEvent.click(first!);
    fireEvent.click(second!);
    const ids = [first!, second!].map((b) => b.getAttribute("aria-controls")!);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
      expect(document.getElementById(id)).toHaveTextContent("Our Father, who art in heaven...");
    }
  });

  it("titles an opened prayer at the heading level its place in the page needs", () => {
    const { unmount } = render(
      <PrayerLinkedText text="Pray the Our Father." prayers={[OUR_FATHER]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Our Father/ }));
    expect(screen.getByRole("heading", { level: 3, name: "Our Father" })).toBeInTheDocument();
    unmount();

    // Straight under a prayer page's h1: an h2, never a skipped level.
    render(
      <PrayerLinkedText text="Pray the Our Father." prayers={[OUR_FATHER]} headingLevel={2} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Our Father/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Our Father" })).toBeInTheDocument();
  });

  it("says when the language shown is a machine translation, and only then", () => {
    const CREED: GuidePrayerData = {
      slug: "apostles-creed",
      title: "Apostles' Creed",
      variants: [
        { code: "en", label: "English", text: "I believe in God...", preserve: false },
        { code: "la", label: "Latin", text: "Credo in Deum...", preserve: true },
        {
          code: "el",
          label: "Greek",
          text: "Πιστεύω εἰς Θεὸν...",
          preserve: true,
          unofficial: true,
        },
      ],
    };
    render(<PrayerLinkedText text="Pray the Apostles' Creed." prayers={[CREED]} />);
    fireEvent.click(screen.getByRole("button", { name: /Apostles' Creed/ }));
    const note = /Unofficial translation/;
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Greek" }));
    expect(screen.getByText("Πιστεύω εἰς Θεὸν...").closest(".vf-prayer")).toHaveAttribute(
      "translate",
      "no",
    );
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  it("with matchCase, links only names capitalised as names (the text is itself prayer)", () => {
    render(
      <PrayerLinkedText
        text={"Joseph is our father in faith.\nOur Father, Hail Mary, Glory Be"}
        prayers={[OUR_FATHER, GLORY_BE]}
        matchCase
      />,
    );
    const links = screen.getAllByRole("button");
    expect(links.map((b) => b.textContent)).toEqual(["Our Father", "Glory Be"]);
  });
});
