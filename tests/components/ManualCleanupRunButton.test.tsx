/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ManualCleanupRunButton } from "@/app/admin/ingestion/ManualCleanupRunButton";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ManualCleanupRunButton", () => {
  it("renders the action button in idle state", () => {
    render(<ManualCleanupRunButton />);
    expect(screen.getByRole("button", { name: /run data cleanup now/i })).toBeInTheDocument();
  });

  it("shows a success message with counts when the cleanup completes", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          miscategorised: { totalArchived: 4, buckets: [] },
          duplicatePrayers: 2,
          hardDeleted: { totalDeleted: 1, buckets: [] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = userEvent.setup();
    render(<ManualCleanupRunButton />);
    await user.click(screen.getByRole("button", { name: /run data cleanup now/i }));

    expect(await screen.findByText(/cleanup complete/i)).toBeInTheDocument();
    expect(screen.getByText(/4 archived/)).toBeInTheDocument();
    expect(screen.getByText(/2 duplicate prayer/)).toBeInTheDocument();
    expect(screen.getByText(/1 permanently deleted/)).toBeInTheDocument();
  });

  it("shows a clear error message when the request returns a 500", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, message: "DB unavailable" }), { status: 500 }),
    );

    const user = userEvent.setup();
    render(<ManualCleanupRunButton />);
    await user.click(screen.getByRole("button", { name: /run data cleanup now/i }));

    expect(await screen.findByText(/DB unavailable/)).toBeInTheDocument();
  });

  it("shows a clear error message when fetch throws", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    render(<ManualCleanupRunButton />);
    await user.click(screen.getByRole("button", { name: /run data cleanup now/i }));

    expect(await screen.findByText(/network down/)).toBeInTheDocument();
  });
});
