/**
 * Two-factor scope: HUMAN administrator only.
 *
 * The owner's constraint is absolute — the second factor applies ONLY to a
 * human administrator signing into the interactive admin interface. It must
 * never apply to an ordinary user account, and never to the Admin Worker, a
 * machine credential, a worker API, a scheduled job or any other autonomous
 * process. The Admin Worker has no inbox; if it ever had to read a code it
 * would stop being autonomous, and production would stop.
 *
 * This suite proves that structurally (nothing in the worker / cron / user
 * surface can even reach the challenge module) and behaviourally (the
 * machine-authentication path still authorizes with no challenge in
 * existence).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import type { NextRequest } from "next/server";
import { deriveCronSecret, isAuthorizedCron } from "@/lib/security/cron-auth";

const ROOT = process.cwd();

function collectFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every symbol that can start, answer or complete a two-factor challenge. */
const TWO_FACTOR_SYMBOLS = [
  "admin-2fa",
  "issueAdminTwoFactorChallenge",
  "verifyAdminTwoFactorCode",
  "generateAdminTwoFactorCode",
  "completeAdminTwoFactor",
];

const AUTOMATED_SURFACES = [
  "src/lib/admin-worker",
  "src/lib/security/cron-auth.ts",
  "scripts/run-worker.ts",
  "intelligence",
];

describe("no automated process can reach the two-factor challenge", () => {
  const files = AUTOMATED_SURFACES.flatMap((entry) => {
    const full = join(ROOT, entry);
    try {
      return statSync(full).isDirectory() ? collectFiles(full) : [full];
    } catch {
      return [];
    }
  });

  it("finds the worker surface (guards against the scan matching nothing)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("no worker, cron or scheduled-job file mentions the challenge at all", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (TWO_FACTOR_SYMBOLS.some((symbol) => source.includes(symbol))) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the challenge module never reaches back into the worker tree", () => {
    const source = readFileSync(join(ROOT, "src/lib/auth/admin-2fa.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*admin-worker/);
    expect(source).not.toMatch(/from\s+["'][^"']*cron-auth/);
  });
});

describe("no ordinary user account is ever asked for a code", () => {
  const userAuthRoutes = [
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/register/route.ts",
    "src/app/api/auth/forgot-password/route.ts",
    "src/app/api/auth/reset-password/route.ts",
    "src/app/api/auth/verify-email/route.ts",
    "src/lib/auth/user.ts",
    "src/lib/auth/password.ts",
    "src/lib/auth/tokens.ts",
  ];

  it.each(userAuthRoutes)("%s does not mention the admin second factor", (relPath) => {
    const source = readFileSync(join(ROOT, relPath), "utf8");
    for (const symbol of TWO_FACTOR_SYMBOLS) {
      expect(source).not.toContain(symbol);
    }
  });

  it("the only routes that touch it are the admin sign-in ones", () => {
    const routes = collectFiles(join(ROOT, "src/app/api"));
    const touching = routes
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return TWO_FACTOR_SYMBOLS.some((symbol) => source.includes(symbol));
      })
      .map((file) => relative(ROOT, file).replace(/\\/g, "/"))
      .sort();
    expect(touching).toEqual([
      "src/app/api/admin/login/route.ts",
      "src/app/api/auth/admin-2fa/resend/route.ts",
      "src/app/api/auth/admin-2fa/verify/route.ts",
    ]);
  });
});

describe("machine authentication is unaffected", () => {
  beforeEach(() => {
    resetPrismaMock();
    process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  });

  function cronRequest(token: string): NextRequest {
    const base = new Request("https://viafidei.example.com/api/cron/thing", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    return base as unknown as NextRequest;
  }

  it("authorizes the worker's own credential with no challenge in existence", async () => {
    // Nothing has issued a code, and the challenge table is never queried:
    // the machine path does not go near it.
    const token = await deriveCronSecret();
    expect(token).toBeTruthy();
    await expect(isAuthorizedCron(cronRequest(token!))).resolves.toBe(true);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("still rejects a wrong machine credential — this is not a weakening", async () => {
    await expect(isAuthorizedCron(cronRequest("not-the-token"))).resolves.toBe(false);
  });
});
