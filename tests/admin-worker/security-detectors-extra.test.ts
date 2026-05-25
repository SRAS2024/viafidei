/**
 * Extra security detectors — successful-brute-force-signs +
 * bypass-admin-authentication (spec §14 completeness).
 */

import { describe, expect, it } from "vitest";

import {
  detectBypassAdminAuthentication,
  detectSuccessfulBruteForceSigns,
} from "@/lib/admin-worker";

describe("detectSuccessfulBruteForceSigns", () => {
  it("fires when many failures precede a success in a short window", () => {
    expect(detectSuccessfulBruteForceSigns({ failedAttemptsInWindow: 5, windowMinutes: 10 })).toBe(
      true,
    );
    expect(detectSuccessfulBruteForceSigns({ failedAttemptsInWindow: 10, windowMinutes: 15 })).toBe(
      true,
    );
  });

  it("does not fire when the failure count is below threshold", () => {
    expect(detectSuccessfulBruteForceSigns({ failedAttemptsInWindow: 2, windowMinutes: 10 })).toBe(
      false,
    );
  });

  it("does not fire when the window is wider than the brute-force window", () => {
    expect(detectSuccessfulBruteForceSigns({ failedAttemptsInWindow: 10, windowMinutes: 60 })).toBe(
      false,
    );
  });
});

describe("detectBypassAdminAuthentication", () => {
  it("fires on a POST to an admin API without a session cookie", () => {
    expect(
      detectBypassAdminAuthentication({
        route: "/api/admin/admin-worker/run",
        method: "POST",
        hasSessionCookie: false,
      }),
    ).toBe(true);
  });

  it("does not fire on a GET (browsing without session is normal)", () => {
    expect(
      detectBypassAdminAuthentication({
        route: "/admin/diagnostics",
        method: "GET",
        hasSessionCookie: false,
      }),
    ).toBe(false);
  });

  it("does not fire for the login route itself", () => {
    expect(
      detectBypassAdminAuthentication({
        route: "/api/admin/login",
        method: "POST",
        hasSessionCookie: false,
      }),
    ).toBe(false);
  });

  it("does not fire on a non-admin route", () => {
    expect(
      detectBypassAdminAuthentication({
        route: "/api/auth/login",
        method: "POST",
        hasSessionCookie: false,
      }),
    ).toBe(false);
  });
});
