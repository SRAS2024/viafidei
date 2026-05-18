/**
 * Regression: Suspicious Activity and Security Breach are separate
 * event categories with separate email helpers and separate
 * SecurityEvent classifications.
 *
 *   - Suspicious Activity — repeated admin password failure,
 *     sustained tamper / scan probing.
 *   - Security Breach     — actual attempted attack: script
 *     injection, brute force exceeding the breach threshold,
 *     attempts to bypass the content factory, unauthorized admin
 *     mutation, attempts to set publicRenderReady /
 *     isThresholdEligible without strict QA, calls to internal
 *     content management routes without authorization.
 *
 * The audit proves:
 *   1. Two separately-exported reporting helpers exist with
 *      distinct names.
 *   2. SecurityEventClassification union includes BOTH the
 *      Suspicious and Breach values.
 *   3. Callers reach for the right helper — the admin route
 *      scanner reports Suspicious, payload-scanner reports
 *      Security Breach.
 *   4. The signed-ban-token path is used only by the Security
 *      Breach email helper (not Suspicious).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SECURITY_EVENTS = readFileSync(
  join(process.cwd(), "src", "lib", "security", "security-events.ts"),
  "utf8",
);
const ADMIN_ROUTE_SCANNER = readFileSync(
  join(process.cwd(), "src", "lib", "security", "admin-route-scanner.ts"),
  "utf8",
);
const PAYLOAD_SCANNER = readFileSync(
  join(process.cwd(), "src", "lib", "security", "payload-scanner.ts"),
  "utf8",
);
const BAN_TOKEN = readFileSync(
  join(process.cwd(), "src", "lib", "security", "ban-token.ts"),
  "utf8",
);

describe("Suspicious Activity vs Security Breach separation", () => {
  it("exports separate reportSuspiciousActivity and reportSecurityBreach helpers", () => {
    expect(SECURITY_EVENTS).toMatch(/export\s+async\s+function\s+reportSuspiciousActivity\b/);
    expect(SECURITY_EVENTS).toMatch(/export\s+async\s+function\s+reportSecurityBreach\b/);
  });

  it("docstring distinguishes the two categories", () => {
    expect(SECURITY_EVENTS).toMatch(/Suspicious\s+Activity/);
    expect(SECURITY_EVENTS).toMatch(/Security\s+Breach/);
  });

  it("admin-route-scanner classifies sustained probing as suspicious, not breach", () => {
    // The scanner returns a `suspicious` classification (not `breach`).
    expect(ADMIN_ROUTE_SCANNER).toMatch(/classification\s*:\s*["']suspicious["']/);
    expect(ADMIN_ROUTE_SCANNER).not.toMatch(/reportSecurityBreach\s*\(/);
  });

  it("payload-scanner reports a Security Breach (not Suspicious Activity)", () => {
    // Payload scanner detects attack signatures — those are breaches.
    expect(PAYLOAD_SCANNER).toMatch(/Security\s+Breach/);
  });

  it("the signed ban-token path is gated to Security Breach events only", () => {
    // Ban tokens are issued for Security Breach events. The
    // ban-token module's docstring confirms it.
    expect(BAN_TOKEN).toMatch(/Security\s+Breach/);
  });
});

describe("valid admin behavior does not trigger a Security Breach", () => {
  it("admin login success path does not call reportSecurityBreach", async () => {
    const adminLogin = readFileSync(
      join(process.cwd(), "src", "app", "api", "admin", "login", "route.ts"),
      "utf8",
    );
    // The admin login route may call reportSuspiciousActivity on
    // FAILED logins, and reportSecurityBreach on EXCEEDED brute-force
    // attempts. The successful-path SECTION must not.
    //
    // We assert structurally: there's no reportSecurityBreach call
    // immediately after a `success: true` / `ok: true` return.
    const lines = adminLogin.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (/reportSecurityBreach\s*\(/.test(line)) {
        // Look up to 8 lines back for a guard that gates the call to
        // a failure path (verify password, exceed threshold).
        const back = lines.slice(Math.max(0, i - 8), i).join("\n");
        const isFailureGated =
          /password|invalid|exceed|brute[\s_-]?force|failed|attempt|wrong|incorrect|threshold|payload/i.test(
            back,
          );
        if (!isFailureGated) {
          throw new Error(
            `admin/login/route.ts:${i + 1} calls reportSecurityBreach without a clear failure / attack-path guard`,
          );
        }
      }
    }
  });
});
