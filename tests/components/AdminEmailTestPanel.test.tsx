/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminEmailTestPanel } from "@/app/admin/diagnostics/email/AdminEmailTestPanel";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminEmailTestPanel", () => {
  it("renders one Send button per admin email flow", () => {
    render(<AdminEmailTestPanel adminEmail="ops@example.com" resendConfigured={true} />);
    // Nine flows (biweekly, monthly archive, monthly error PDF,
    // milestones 25/50/75/final, critical failure, security breach).
    expect(screen.getAllByRole("button", { name: /send/i })).toHaveLength(9);
    expect(screen.getByText("Biweekly Admin Report")).toBeInTheDocument();
    expect(screen.getByText("Monthly Archive Cleaning Up")).toBeInTheDocument();
    expect(screen.getByText("Monthly Error Report (PDF)")).toBeInTheDocument();
    expect(screen.getByText(/Threshold milestone — 25%/)).toBeInTheDocument();
    expect(screen.getByText(/Threshold milestone — 100% \(Final\)/)).toBeInTheDocument();
    expect(screen.getByText("Critical Failure")).toBeInTheDocument();
    expect(screen.getByText("Security Breach")).toBeInTheDocument();
  });

  it("shows the resolved ADMIN_EMAIL in the panel intro", () => {
    render(<AdminEmailTestPanel adminEmail="ops@example.com" resendConfigured={true} />);
    expect(screen.getByText("ops@example.com")).toBeInTheDocument();
  });

  it("disables every Send button and surfaces a blocker when ADMIN_EMAIL is null", () => {
    render(<AdminEmailTestPanel adminEmail={null} resendConfigured={true} />);
    const buttons = screen.getAllByRole("button", { name: /send/i });
    for (const b of buttons) expect(b).toBeDisabled();
    expect(screen.getByText(/ADMIN_EMAIL is not set/i)).toBeInTheDocument();
  });

  it("disables every Send button and surfaces a blocker when RESEND_API_KEY is missing", () => {
    render(<AdminEmailTestPanel adminEmail="ops@example.com" resendConfigured={false} />);
    const buttons = screen.getAllByRole("button", { name: /send/i });
    for (const b of buttons) expect(b).toBeDisabled();
    expect(screen.getByText(/RESEND_API_KEY is not set/i)).toBeInTheDocument();
  });

  it("posts to /api/admin/email/admin-test with the matching flow when a Send button is clicked", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          delivery: "sent",
          flow: "biweekly_report",
          adminEmail: "ops@example.com",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    render(<AdminEmailTestPanel adminEmail="ops@example.com" resendConfigured={true} />);

    // Find the Biweekly Admin Report row by its label, then click the
    // Send button inside that row.
    const biweeklyRow = screen.getByText("Biweekly Admin Report").closest("tr");
    expect(biweeklyRow).not.toBeNull();
    const sendBtn = within(biweeklyRow as HTMLElement).getByRole("button", { name: /send/i });
    await user.click(sendBtn);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/email/admin-test");
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toEqual({ flow: "biweekly_report" });

    expect(await screen.findByText(/delivered to/)).toBeInTheDocument();
  });

  it("renders a clear failure message when the server returns ok:false", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: "resend rejected sender domain" }), {
        status: 500,
      }),
    );
    const user = userEvent.setup();
    render(<AdminEmailTestPanel adminEmail="ops@example.com" resendConfigured={true} />);
    const criticalRow = screen.getByText("Critical Failure").closest("tr") as HTMLElement;
    await user.click(within(criticalRow).getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/Delivery failed/)).toBeInTheDocument();
    expect(screen.getByText(/resend rejected sender domain/)).toBeInTheDocument();
  });

  it("renders a skipped message when the server says transport is unconfigured", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          delivery: "skipped",
          reason: "email_not_configured",
          flow: "security_breach",
        }),
        { status: 200 },
      ),
    );
    const user = userEvent.setup();
    render(<AdminEmailTestPanel adminEmail="ops@example.com" resendConfigured={true} />);
    const breachRow = screen.getByText("Security Breach").closest("tr") as HTMLElement;
    await user.click(within(breachRow).getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/Skipped at the transport layer/)).toBeInTheDocument();
    expect(screen.getByText(/email_not_configured/)).toBeInTheDocument();
  });
});
