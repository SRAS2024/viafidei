/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    await user.click(screen.getByRole("dialog"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("uses the destructive button styling when destructive=true", () => {
    renderDialog({ destructive: true });
    expect(screen.getByRole("button", { name: "Remove" }).className).toMatch(/vf-btn-danger/);
  });

  it("has no obvious accessibility violations (aria-modal, labelled, named buttons)", async () => {
    const { container } = renderDialog();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
