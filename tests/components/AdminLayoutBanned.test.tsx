/**
 * @vitest-environment jsdom
 *
 * Admin layout enforces the banned-device gate. A banned device
 * cannot see any admin page — the layout short-circuits before any
 * nested server component runs, and there is no UI affordance to
 * lift the ban.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const isCurrentDeviceBannedMock = vi.fn();

vi.mock("@/lib/security/banned-guard", () => ({
  isCurrentDeviceBanned: (...args: unknown[]) => isCurrentDeviceBannedMock(...args),
}));
vi.mock("@/lib/i18n/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslator: vi.fn().mockResolvedValue({ t: (key: string) => key }),
}));
vi.mock("@/components/SecurityTamperDetector", () => ({
  SecurityTamperDetector: () => null,
}));

import AdminLayout from "@/app/admin/layout";

beforeEach(() => {
  isCurrentDeviceBannedMock.mockReset();
});

async function renderLayout() {
  const element = await AdminLayout({ children: <div data-testid="child">child-content</div> });
  render(element);
}

describe("admin layout — banned device gate", () => {
  it("renders the normal layout when the device is not banned", async () => {
    isCurrentDeviceBannedMock.mockResolvedValue(false);
    await renderLayout();
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-banned-block")).not.toBeInTheDocument();
  });

  it("renders the access-denied block when the device IS banned", async () => {
    isCurrentDeviceBannedMock.mockResolvedValue(true);
    await renderLayout();
    expect(screen.getByTestId("admin-banned-block")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("the banned block names bans as permanent (no unban affordance)", async () => {
    isCurrentDeviceBannedMock.mockResolvedValue(true);
    await renderLayout();
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
    // No appeal/unban/restore controls.
    expect(screen.queryByRole("button", { name: /unban/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /unban/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /appeal/i })).not.toBeInTheDocument();
  });
});
