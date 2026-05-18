/**
 * @vitest-environment jsdom
 *
 * Banned devices admin page invariants:
 *   * Renders the list of banned devices when present.
 *   * Renders an "empty state" when no rows exist.
 *   * NEVER renders an unban button or form action — bans are permanent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ username: "admin", signedInAt: Date.now() }),
}));
const listBannedDevicesMock = vi.fn();
const listBannedDevicesWithDetailMock = vi.fn();
vi.mock("@/lib/security/security-event-store", () => ({
  listBannedDevices: (...args: unknown[]) => listBannedDevicesMock(...args),
  listBannedDevicesWithDetail: (...args: unknown[]) => listBannedDevicesWithDetailMock(...args),
}));
// AdminSection is an async server component; replace with a synchronous
// passthrough so RTL's render() can mount the page.
vi.mock("@/app/admin/_sections/AdminSection", () => ({
  AdminSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: vi.fn().mockResolvedValue({
    t: (key: string) => key,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));

import BannedDevicesPage from "@/app/admin/banned-devices/page";

beforeEach(() => {
  listBannedDevicesMock.mockReset();
  listBannedDevicesWithDetailMock.mockReset();
});

async function renderBannedDevicesPage() {
  // Server components return a Promise<JSX>; render the resolved value.
  const element = await BannedDevicesPage();
  render(element);
}

describe("admin banned-devices page", () => {
  it("renders an empty state when no devices are banned", async () => {
    listBannedDevicesWithDetailMock.mockResolvedValue([]);
    await renderBannedDevicesPage();
    expect(screen.getByTestId("banned-devices-empty")).toBeInTheDocument();
  });

  it("renders the table when there are banned devices, including originating-event geo fields", async () => {
    listBannedDevicesWithDetailMock.mockResolvedValue([
      {
        id: "bd_1",
        deviceCredentialHash: "fp_abcdef123456",
        ipAddressHash: null,
        userAgentHash: null,
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-01-02"),
        banReason: "csrf_violation",
        securityEventId: "evt_111",
        createdBy: "signed_ban_link",
        active: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        originatingEventType: "csrf_violation",
        originatingUserAgent: "Mozilla/5.0 (Linux; Android attacker)",
        originatingCity: "Springfield",
        originatingRegion: "IL",
        originatingCountry: "US",
      },
    ]);
    await renderBannedDevicesPage();
    expect(screen.getByTestId("banned-devices-table")).toBeInTheDocument();
    expect(screen.getByText(/csrf_violation/)).toBeInTheDocument();
    // Geo + UA columns surface the originating-event context.
    expect(screen.getByTestId("banned-device-city")).toHaveTextContent("Springfield");
    expect(screen.getByTestId("banned-device-region")).toHaveTextContent("IL");
    expect(screen.getByTestId("banned-device-country")).toHaveTextContent("US");
    expect(screen.getByTestId("banned-device-user-agent").textContent).toMatch(/Mozilla\/5\.0/);
  });

  it("renders '—' placeholders for missing geo / UA when the originating event has no detail", async () => {
    listBannedDevicesWithDetailMock.mockResolvedValue([
      {
        id: "bd_2",
        deviceCredentialHash: "fp_ee",
        ipAddressHash: null,
        userAgentHash: null,
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-01-02"),
        banReason: "sqli_attempt",
        securityEventId: "evt_222",
        createdBy: "signed_ban_link",
        active: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        originatingEventType: "sqli_attempt",
        originatingUserAgent: null,
        originatingCity: null,
        originatingRegion: null,
        originatingCountry: null,
      },
    ]);
    await renderBannedDevicesPage();
    expect(screen.getByTestId("banned-device-city").textContent).toBe("—");
    expect(screen.getByTestId("banned-device-region").textContent).toBe("—");
    expect(screen.getByTestId("banned-device-country").textContent).toBe("—");
  });

  it("NEVER renders an unban button or any UI affordance to remove a ban", async () => {
    listBannedDevicesWithDetailMock.mockResolvedValue([
      {
        id: "bd_1",
        deviceCredentialHash: "fp_abcdef123456",
        ipAddressHash: null,
        userAgentHash: null,
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-01-02"),
        banReason: "csrf_violation",
        securityEventId: "evt_111",
        createdBy: "signed_ban_link",
        active: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        originatingEventType: "csrf_violation",
        originatingUserAgent: null,
        originatingCity: null,
        originatingRegion: null,
        originatingCountry: null,
      },
    ]);
    await renderBannedDevicesPage();
    // No "Unban", "Remove", or "Restore" controls anywhere.
    expect(screen.queryByRole("button", { name: /unban/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /restore/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /unban/i })).not.toBeInTheDocument();
    // The permanent-ban notice is rendered.
    expect(screen.getByTestId("banned-devices-permanent-notice")).toBeInTheDocument();
  });
});
