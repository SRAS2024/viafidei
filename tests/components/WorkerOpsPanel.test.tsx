/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkerOpsPanel } from "@/app/admin/worker-diagnostics/WorkerOpsPanel";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WorkerOpsPanel", () => {
  it("renders every repair / diagnostic action button", () => {
    render(<WorkerOpsPanel />);
    expect(screen.getByRole("button", { name: /run worker once/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /repair queue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /repair source jobs/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recover content growth/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /audit existing raw rows/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /convert valid raw rows through factory/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run strict cleanup and explain results/i }),
    ).toBeInTheDocument();
  });

  it("posts to the queue repair route and shows the repair summary", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          report: {
            staleRunningJobsRecovered: 2,
            retryableFailedRequeued: 1,
            permanentlyFailedLeftAlone: 0,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = userEvent.setup();
    render(<WorkerOpsPanel />);
    await user.click(screen.getByRole("button", { name: /repair queue/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/queue/repair",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText(/Stale jobs recovered: 2/)).toBeInTheDocument();
  });

  it("shows a clear error message when an action fails", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 }),
    );

    const user = userEvent.setup();
    render(<WorkerOpsPanel />);
    await user.click(screen.getByRole("button", { name: /run worker once/i }));

    expect(await screen.findByText(/Failed \(HTTP 401\)/)).toBeInTheDocument();
  });
});
