/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refreshSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy, push: vi.fn(), replace: vi.fn() }),
}));

import { RemoveSavedButton } from "@/components/ui/RemoveSavedButton";

const labels = {
  remove: "Remove",
  cancel: "Cancel",
  removeTitle: "Remove this saint?",
  removeBody: "Remove {name} from your saved saints.",
};

beforeEach(() => {
  refreshSpy.mockReset();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RemoveSavedButton", () => {
  it("does NOT call the DELETE endpoint just because the button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <RemoveSavedButton
        kind="saints"
        entityId="abc123"
        entityTitle="St. Therese"
        labels={labels}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    // Confirm dialog is now open; fetch must NOT have fired yet.
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does NOT call the DELETE endpoint when the user dismisses with Cancel", async () => {
    const user = userEvent.setup();
    render(
      <RemoveSavedButton
        kind="saints"
        entityId="abc123"
        entityTitle="St. Therese"
        labels={labels}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("calls DELETE only after the user confirms", async () => {
    const user = userEvent.setup();
    render(
      <RemoveSavedButton
        kind="saints"
        entityId="abc123"
        entityTitle="St. Therese"
        labels={labels}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    // Two "Remove" buttons exist now (the trigger + the confirm). The one
    // inside the dialog is the destructive confirm button.
    const dialog = screen.getByRole("dialog");
    const confirmInsideDialog = within(dialog).getByRole("button", { name: "Remove" });
    await user.click(confirmInsideDialog);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/saved/saints?id=abc123");
    expect(init.method).toBe("DELETE");
  });
});
