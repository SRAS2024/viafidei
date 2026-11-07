/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { RitePicker } from "@/app/profile/settings/RitePicker";

afterEach(() => cleanup());

describe("RitePicker", () => {
  it("keeps the saved word apart from its mark, or VoiceOver hears nothing", () => {
    render(
      <RitePicker
        initialRite="ROMAN"
        options={[
          { value: "ROMAN", label: "Roman" },
          { value: "BYZANTINE", label: "Byzantine" },
        ]}
        label="Rite"
        savedLabel="Saved"
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    fireEvent.change(screen.getByRole("combobox", { name: "Rite" }), {
      target: { value: "BYZANTINE" },
    });
    // Safari's accessibility tree drops the rest of a line of text that begins with
    // something hidden from it. Side by side in a flex row, each is a line of its own.
    expect(status).toHaveClass("flex");
    const [mark, word] = Array.from(status.children);
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(word).toHaveTextContent(/^Saved$/);
    expect(word).not.toHaveAttribute("aria-hidden");
    for (const node of status.childNodes) expect(node.nodeType).toBe(Node.ELEMENT_NODE);
  });
});
