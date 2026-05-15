/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ManualIngestRunButton } from "@/app/admin/ingestion/ManualIngestRunButton";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ManualIngestRunButton", () => {
  it("renders the action button in idle state with the current mode", () => {
    render(<ManualIngestRunButton initialMode="constant" />);
    expect(screen.getByRole("button", { name: /run ingestion now/i })).toBeInTheDocument();
    expect(screen.getByText(/constant fill/)).toBeInTheDocument();
  });

  it("shows a success message including the per-run totals when the request succeeds", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            totalJobs: 3,
            runs: [
              {
                jobName: "vatican.encyclicals",
                sourceHost: "vatican.va",
                adapterFound: true,
                summary: {
                  recordsSeen: 5,
                  recordsCreated: 2,
                  recordsUpdated: 0,
                  recordsSkipped: 3,
                  recordsFailed: 0,
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = userEvent.setup();
    render(<ManualIngestRunButton initialMode="maintenance" />);
    await user.click(screen.getByRole("button", { name: /run ingestion now/i }));

    expect(await screen.findByText(/Ingestion run finished/)).toBeInTheDocument();
    expect(screen.getByText(/3 jobs ran/)).toBeInTheDocument();
    expect(screen.getByText(/2 created/)).toBeInTheDocument();
  });

  it("shows a clear error message when the run fails", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, message: "lock contended" }), { status: 500 }),
    );

    const user = userEvent.setup();
    render(<ManualIngestRunButton initialMode="constant" />);
    await user.click(screen.getByRole("button", { name: /run ingestion now/i }));

    expect(await screen.findByText(/lock contended/)).toBeInTheDocument();
  });
});
