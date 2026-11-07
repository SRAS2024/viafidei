/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(
    <ConfirmDialog
      open
      title="Remove this saint?"
      body="This will remove {name} from your saved saints."
      entityName="St. Therese"
      cancelLabel="Cancel"
      confirmLabel="Remove"
      destructive
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { ...utils, onCancel, onConfirm };
}

afterEach(() => cleanup());

describe("ConfirmDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="x"
        body="x"
        cancelLabel="c"
        confirmLabel="ok"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the title and interpolates {name} in the body", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Remove this saint?")).toBeInTheDocument();
    expect(
      screen.getByText("This will remove St. Therese from your saved saints."),
    ).toBeInTheDocument();
  });

  it("does NOT confirm when only the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm only when the confirm button is explicitly clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("dismisses (without confirming) on Escape", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("dismisses (without confirming) on backdrop click", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();
    await user.click(screen.getByRole("presentation"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("is named by its title and described by its body, for a screen reader", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Remove this saint?" });
    expect(dialog).toHaveAccessibleDescription(
      "This will remove St. Therese from your saved saints.",
    );
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("opens with focus on Cancel when destructive, so a stray Enter destroys nothing", () => {
    renderDialog({ destructive: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("opens with focus on the confirm button when nothing would be lost", () => {
    renderDialog({ destructive: false });
    expect(screen.getByRole("button", { name: "Remove" })).toHaveFocus();
  });

  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Remove" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Remove" })).toHaveFocus();
  });

  it("returns focus to the control that opened it, and frees the page behind it", async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <ConfirmDialog
            open={open}
            title="Sure?"
            body="Really."
            cancelLabel="Cancel"
            confirmLabel="Yes"
            destructive
            onCancel={() => setOpen(false)}
            onConfirm={() => setOpen(false)}
          />
        </>
      );
    }
    const { container } = render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    expect(container).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(container).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
  });

  it("leaves out the description when there is only a title", () => {
    renderDialog({ body: "", entityName: undefined });
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-describedby");
  });

  it("uses the destructive button styling when destructive=true", () => {
    renderDialog({ destructive: true });
    expect(screen.getByRole("button", { name: "Remove" }).className).toMatch(/vf-btn-danger/);
  });

  it("has no obvious accessibility violations (aria-modal, labelled, named buttons)", async () => {
    renderDialog();
    // Portalled to <body>, so the check has to start there.
    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });
});
