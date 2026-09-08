/**
 * @vitest-environment jsdom
 *
 * The admin sign-in page is now two-staged (security spec item 1). Which
 * stage it shows is decided by the SERVER — the presence of a pending
 * `AdminSession` row — never by the query string, so nobody can reach or skip
 * the code form by editing a URL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireAdminMock = vi.fn();
const getPendingMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdminMock(...a) }));
vi.mock("@/lib/auth/admin-session", () => ({
  getPendingAdminSession: (...a: unknown[]) => getPendingMock(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirectMock(...a) }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (key: string) => key }),
}));

import AdminLogin from "@/app/admin/login/page";

const PENDING = {
  adminSessionId: "pending-session-id-abc",
  username: "root",
  authenticatedAt: new Date(),
  expiresAt: new Date(Date.now() + 600_000),
};

async function renderPage(params: Record<string, string> = {}) {
  const element = await AdminLogin({ searchParams: Promise.resolve(params) });
  return render(element);
}

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue(null);
  getPendingMock.mockReset().mockResolvedValue(null);
  // next/navigation's redirect() throws to unwind the render; mirroring that
  // is what proves the page STOPS rather than falling through to a form.
  redirectMock.mockReset().mockImplementation((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  });
});

describe("stage one — credentials", () => {
  it("shows the password form when no sign-in is in progress", async () => {
    const { container } = await renderPage();
    expect(container.querySelector('form[action="/api/admin/login"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.querySelector('input[name="code"]')).toBeNull();
  });

  it("cannot be pushed to the code form by a query parameter", async () => {
    // The URL claims stage two; the server says no pending session exists.
    const { container } = await renderPage({ stage: "code" });
    expect(container.querySelector('input[name="code"]')).toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
  });
});

describe("stage two — the code", () => {
  beforeEach(() => {
    getPendingMock.mockResolvedValue(PENDING);
  });

  it("shows the six-digit code form once the password has been accepted", async () => {
    const { container } = await renderPage();
    const input = container.querySelector('input[name="code"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.getAttribute("pattern")).toBe("[0-9]{6}");
    expect(input!.getAttribute("maxlength")).toBe("6");
    expect(input!.getAttribute("autocomplete")).toBe("one-time-code");
    // The password form is gone: this stage cannot be skipped by resubmitting it.
    expect(container.querySelector('input[name="password"]')).toBeNull();
  });

  it("posts to the verification endpoint and offers a resend", async () => {
    const { container } = await renderPage();
    expect(container.querySelector('form[action="/api/auth/admin-2fa/verify"]')).not.toBeNull();
    expect(container.querySelector('form[action="/api/auth/admin-2fa/resend"]')).not.toBeNull();
  });

  it("never renders the code, the account, or the session id", async () => {
    const { container } = await renderPage({ stage: "code" });
    expect(container.textContent).not.toContain(PENDING.adminSessionId);
    expect(container.textContent).not.toContain(PENDING.username);
    expect(container.querySelector("input[value]")).toBeNull();
  });

  it("gives one generic refusal, naming no cause", async () => {
    await renderPage({ stage: "code", error: "code" });
    const message = screen.getByText(/that code is not valid/i);
    expect(message).toBeTruthy();
    // Nothing that would tell an attacker which control fired.
    expect(message.textContent).not.toMatch(/expired|attempts|used|superseded|rate/i);
  });

  it("says so when a code could not be delivered, without revealing anything", async () => {
    const { container } = await renderPage({ stage: "code", notice: "undelivered" });
    expect(screen.getByText(/could not be delivered/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/[0-9]{6}/);
  });

  it("tells the administrator a resend invalidates the previous code", async () => {
    await renderPage({ stage: "code", notice: "sent" });
    expect(screen.getByText(/earlier code no longer works/i)).toBeTruthy();
  });
});

describe("an already-authenticated administrator", () => {
  it("is sent straight to the console and never re-challenged", async () => {
    requireAdminMock.mockResolvedValue({ username: "root", signedInAt: Date.now() });
    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT:/admin?welcome=1");
    // requireAdmin() only returns a principal when the second factor already
    // completed, so this is not a bypass.
    expect(getPendingMock).not.toHaveBeenCalled();
  });
});
