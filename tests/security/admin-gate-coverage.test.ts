/**
 * Spec item 10 — the centralized admin gate stays authoritative.
 *
 * `gateAdminApiCall` is the ONE place that enforces CSRF, banned-device
 * blocking and a completed-2FA admin session together. A route that guards
 * itself with a bare `requireAdmin()` still authenticates, but it skips CSRF
 * and the banned-device block — for a mutating handler that is a live hole.
 *
 * This test does two things:
 *   1. Proves the scanner actually detects a bypass (so the assertions below
 *      cannot pass vacuously).
 *   2. Pins the CURRENT set of un-gated admin routes. The set may only
 *      SHRINK: a new admin endpoint outside the gate fails CI immediately,
 *      while fixing one of the listed routes keeps the suite green. The
 *      pinned mutation entries are tracked gate debt, listed in this agent's
 *      cross-file requests with the exact change each route needs.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ADMIN_GATE_EXEMPT_ROUTES,
  adminMutationRoutesBypassingCentralGate,
  adminRoutesBypassingCentralGate,
  scanAdminRouteGateCoverage,
} from "@/lib/security/admin-route-coverage";

/**
 * Admin API routes that still guard themselves with `requireAdmin()` instead
 * of the central gate. Every one of them authenticates; what they miss is
 * CSRF + banned-device enforcement. Shrink this list, never grow it.
 *
 * It is now EMPTY: the last 13 entries (three read-only routes and the ten
 * checklist mutations) were converted to `gateAdminApiCall`. Keep it empty —
 * an entry here is a live gap, not a style choice.
 */
const KNOWN_UNGATED_ROUTES: ReadonlySet<string> = new Set<string>([]);

function fixtureRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "vf-gate-scan-"));
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }
  return root;
}

describe("the gate-coverage scanner actually works", () => {
  it("classifies gated, requireAdmin-only and unguarded routes", () => {
    const root = fixtureRepo({
      "src/app/api/admin/gated/route.ts":
        'import { gateAdminApiCall } from "@/lib/security/admin-gate";\nexport async function POST(req) { await gateAdminApiCall(req); }\n',
      "src/app/api/admin/bare/route.ts":
        'import { requireAdmin } from "@/lib/auth";\nexport async function POST() { await requireAdmin(); }\n',
      "src/app/api/admin/open/route.ts": "export async function DELETE() { return null; }\n",
    });
    const reports = scanAdminRouteGateCoverage({ rootDir: root });
    const byRoute = Object.fromEntries(reports.map((r) => [r.route, r]));

    expect(byRoute["src/app/api/admin/gated/route.ts"]!.guard).toBe("gate");
    expect(byRoute["src/app/api/admin/gated/route.ts"]!.gated).toBe(true);
    expect(byRoute["src/app/api/admin/bare/route.ts"]!.guard).toBe("require-admin");
    expect(byRoute["src/app/api/admin/open/route.ts"]!.guard).toBe("none");
    expect(byRoute["src/app/api/admin/open/route.ts"]!.mutations).toEqual(["DELETE"]);

    const bypassing = adminRoutesBypassingCentralGate(reports).map((r) => r.route);
    expect(bypassing).toContain("src/app/api/admin/bare/route.ts");
    expect(bypassing).toContain("src/app/api/admin/open/route.ts");
    expect(bypassing).not.toContain("src/app/api/admin/gated/route.ts");
  });

  it("does not count a mention of the gate inside a comment as a call", () => {
    const root = fixtureRepo({
      "src/app/api/admin/commented/route.ts":
        "// TODO: switch this to gateAdminApiCall(req)\nexport async function POST() { return null; }\n",
    });
    const [report] = scanAdminRouteGateCoverage({ rootDir: root });
    expect(report!.gated).toBe(false);
  });

  // The scanner used to answer per FILE: `gateAdminApiCall` appearing anywhere
  // marked the whole route gated. Four real routes (media, media/[id], email,
  // email/admin-test) paired a gated POST/DELETE with a bare requireAdmin()
  // GET and were all reported as covered, so an empty debt list proved nothing
  // about those reads. Judging each handler on its own body is what makes the
  // empty list below mean something.
  it("does not let a gated mutation vouch for an unguarded read in the same file", () => {
    const root = fixtureRepo({
      "src/app/api/admin/mixed/route.ts": [
        'import { gateAdminApiCall } from "@/lib/security/admin-gate";',
        'import { requireAdmin } from "@/lib/auth";',
        "export async function GET() {",
        "  const admin = await requireAdmin();",
        "  return admin ? null : null;",
        "}",
        "export async function POST(req) {",
        "  const gate = await gateAdminApiCall(req);",
        "  if (!gate.ok) return gate.response;",
        "  return null;",
        "}",
      ].join("\n"),
    });
    const [report] = scanAdminRouteGateCoverage({ rootDir: root });
    expect(report!.handlerGuards.GET).toBe("require-admin");
    expect(report!.handlerGuards.POST).toBe("gate");
    expect(report!.ungatedHandlers).toEqual(["GET"]);
    expect(report!.gated).toBe(false);
  });

  it("counts a file gated only when every exported handler reaches the gate", () => {
    const root = fixtureRepo({
      "src/app/api/admin/both/route.ts": [
        'import { gateAdminApiCall } from "@/lib/security/admin-gate";',
        "export async function GET(req) {",
        "  const gate = await gateAdminApiCall(req);",
        "  if (!gate.ok) return gate.response;",
        "  return null;",
        "}",
        "export async function DELETE(req) {",
        "  const gate = await gateAdminApiCall(req);",
        "  if (!gate.ok) return gate.response;",
        "  return null;",
        "}",
      ].join("\n"),
    });
    const [report] = scanAdminRouteGateCoverage({ rootDir: root });
    expect(report!.ungatedHandlers).toEqual([]);
    expect(report!.gated).toBe(true);
  });
});

describe("no admin API route bypasses the central gate outside the pinned set", () => {
  const reports = scanAdminRouteGateCoverage();

  it("finds the real admin routes (sanity)", () => {
    expect(reports.length).toBeGreaterThan(10);
    expect(reports.some((r) => r.gated)).toBe(true);
  });

  it("the tracked-gate-debt list is empty and stays empty", () => {
    // Every admin route now goes through gateAdminApiCall. This assertion is
    // the ratchet: re-adding an entry above to make a new bypass pass has to
    // break this test first.
    expect([...KNOWN_UNGATED_ROUTES]).toEqual([]);
  });

  it("every un-gated route is either exempt or already-tracked gate debt", () => {
    const unexpected = adminRoutesBypassingCentralGate(reports)
      .map((r) => r.route)
      .filter((route) => !KNOWN_UNGATED_ROUTES.has(route));
    expect(unexpected).toEqual([]);
  });

  it("every un-gated MUTATION route is already-tracked gate debt", () => {
    const unexpected = adminMutationRoutesBypassingCentralGate(reports)
      .map((r) => r.route)
      .filter((route) => !KNOWN_UNGATED_ROUTES.has(route));
    expect(unexpected).toEqual([]);
  });

  it("only login and logout are exempt from needing a principal", () => {
    expect([...ADMIN_GATE_EXEMPT_ROUTES].sort()).toEqual([
      "src/app/api/admin/login/route.ts",
      "src/app/api/admin/logout/route.ts",
    ]);
  });

  it("no admin route is completely unguarded", () => {
    const unguarded = reports
      .filter((r) => r.guard === "none" && !ADMIN_GATE_EXEMPT_ROUTES.has(r.route))
      .map((r) => r.route);
    expect(unguarded).toEqual([]);
  });
});
