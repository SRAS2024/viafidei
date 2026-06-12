/**
 * @vitest-environment jsdom
 *
 * Inline-expandable prayers in guide/novena step text: a prayer the guide uses,
 * named in a step, becomes a button that drops the full prayer open in place —
 * with its own language toggle and verbatim (translate="no") Latin/Greek. Text
 * that names no known prayer renders untouched.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PrayerLinkedText } from "@/components/ui/PrayerLinkedText";
import type { GuidePrayerData } from "@/components/ui/GuidePrayers";

afterEach(() => cleanup());

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
    expect(latin).toHaveAttribute("translate", "no");
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
});
