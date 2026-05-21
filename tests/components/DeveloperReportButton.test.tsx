/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeveloperReportButton } from "@/components/diagnostics/DeveloperReportButton";

const MONTHS = [
  { value: "2026-05", label: "May 2026" },
  { value: "2026-04", label: "April 2026" },
];

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeveloperReportButton", () => {
  it("renders the Developer Report button at the top of the panel", () => {
    render(<DeveloperReportButton availableMonths={MONTHS} />);
    expect(screen.getByRole("button", { name: /developer report/i })).toBeInTheDocument();
  });

  it("shows a download icon to the right of the label", () => {
    render(<DeveloperReportButton availableMonths={MONTHS} />);
    expect(screen.getByTestId("developer-report-download-icon")).toBeInTheDocument();
  });

  it("opens a menu with the three report-period options", async () => {
    const user = userEvent.setup();
    render(<DeveloperReportButton availableMonths={MONTHS} />);
    await user.click(screen.getByRole("button", { name: /developer report/i }));
    expect(screen.getByRole("menuitem", { name: /last 24 hours/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /last 7 days/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Month")).toBeInTheDocument();
  });

  it("lists the available months in the Month dropdown", async () => {
    const user = userEvent.setup();
    render(<DeveloperReportButton availableMonths={MONTHS} />);
    await user.click(screen.getByRole("button", { name: /developer report/i }));
    const select = screen.getByLabelText("Month") as HTMLSelectElement;
    expect(select.querySelectorAll("option").length).toBe(3); // placeholder + 2 months
    expect(screen.getByRole("option", { name: "May 2026" })).toBeInTheDocument();
  });

  it("POSTs the selected period and downloads the returned PDF", async () => {
    fetchSpy.mockResolvedValue(
      new Response(new Blob(["%PDF"], { type: "application/pdf" }), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="developer-audit-last-24-hours.pdf"',
        },
      }),
    );
    const user = userEvent.setup();
    render(<DeveloperReportButton availableMonths={MONTHS} />);
    await user.click(screen.getByRole("button", { name: /developer report/i }));
    await user.click(screen.getByRole("menuitem", { name: /last 24 hours/i }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/diagnostics/developer-report");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ period: "last-24-hours" });
    expect(
      await screen.findByText(/downloaded developer-audit-last-24-hours\.pdf/i),
    ).toBeInTheDocument();
  });

  it("shows an error state that names the failed report source", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: "server_error",
          message:
            "Developer Audit report could not be generated. Failed report source: System Logs.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    render(<DeveloperReportButton availableMonths={MONTHS} />);
    await user.click(screen.getByRole("button", { name: /developer report/i }));
    await user.click(screen.getByRole("menuitem", { name: /last 7 days/i }));
    expect(await screen.findByTestId("developer-report-error")).toHaveTextContent(
      /Failed report source: System Logs/i,
    );
  });
});
