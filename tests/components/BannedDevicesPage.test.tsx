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
vi.mock("@/lib/security/security-event-store", () => ({
  listBannedDevices: (...args: unknown[]) => listBannedDevicesMock(...args),
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
});

async function renderBannedDevicesPage() {
  // Server components return a Promise<JSX>; render the resolved value.
  const element = await BannedDevicesPage();
  render(element);
}

describe("admin banned-devices page", () => {
  it("renders an empty state when no devices are banned", async () => {
    listBannedDevicesMock.mockResolvedValue([]);
    await renderBannedDevicesPage();
    expect(screen.getByTestId("banned-devices-empty")).toBeInTheDocument();
  });

  it("renders the table when there are banned devices", async () => {
    listBannedDevicesMock.mockResolvedValue([
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
      },
    ]);
    await renderBannedDevicesPage();
    expect(screen.getByTestId("banned-devices-table")).toBeInTheDocument();
    expect(screen.getByText(/csrf_violation/)).toBeInTheDocument();
  });

  it("NEVER renders an unban button or any UI affordance to remove a ban", async () => {
    listBannedDevicesMock.mockResolvedValue([
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
