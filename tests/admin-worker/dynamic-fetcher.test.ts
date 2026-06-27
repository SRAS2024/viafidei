/**
 * The keyless dynamic (headless-browser) fetcher. These cases are deterministic
 * and browser-free: they cover the JS-only heuristic, the enable/disable
 * policy, executable-path resolution, and renderPage()'s fail-open guards
 * (disabled / offline / bad URL / unapproved host all return null without ever
 * launching a browser). A live render against real Chromium lives in the
 * env-gated dynamic-fetcher.live.test.ts so CI stays browser-free.
 */
import { existsSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import {
  __resetDynamicFetcherCache,
  chromiumExecutablePath,
  dynamicFetcherEnabled,
  looksDynamic,
  renderPage,
} from "@/lib/admin-worker/dynamic-fetcher";
import { discoverySkills } from "@/lib/admin-worker/skills/discovery-skills";
import type { SkillContext } from "@/lib/admin-worker/skills/types";

const ENV_KEYS = [
  "ADMIN_WORKER_DYNAMIC_FETCHER",
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_CHROMIUM_PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
  "ADMIN_WORKER_OPEN_INTERNET",
] as const;

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetDynamicFetcherCache();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetDynamicFetcherCache();
});

describe("looksDynamic", () => {
  it("flags a JS-only shell (empty root + script) as dynamic", () => {
    const shell = `<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>`;
    const r = looksDynamic(shell);
    expect(r.dynamic).toBe(true);
    expect(r.textLength).toBeLessThan(200);
  });

  it("flags an 'enable JavaScript' notice as dynamic", () => {
    const notice = `<html><body><noscript>Please enable JavaScript to view this page.</noscript><script></script></body></html>`;
    expect(looksDynamic(notice).dynamic).toBe(true);
  });

  it("treats a page with real prose as NOT dynamic, even with scripts", () => {
    const real = `<html><body><h1>Litany of Humility</h1><p>${"O Jesus, meek and humble of heart, hear me. ".repeat(
      20,
    )}</p><script>analytics()</script></body></html>`;
    const r = looksDynamic(real);
    expect(r.dynamic).toBe(false);
    expect(r.textLength).toBeGreaterThan(200);
  });
});

describe("dynamicFetcherEnabled", () => {
  it("defaults ON when unset (keyless capability)", () => {
    expect(dynamicFetcherEnabled()).toBe(true);
  });

  it.each(["0", "false", "off", "no", "OFF"])("is disabled by opt-out value %s", (v) => {
    process.env.ADMIN_WORKER_DYNAMIC_FETCHER = v;
    expect(dynamicFetcherEnabled()).toBe(false);
  });

  it("is forced off in offline mode (ADMIN_WORKER_SKIP_NETWORK=1)", () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    expect(dynamicFetcherEnabled()).toBe(false);
  });
});

describe("chromiumExecutablePath", () => {
  it("returns an explicit ADMIN_WORKER_CHROMIUM_PATH when it exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "chrome-exe-"));
    const exe = join(dir, "chrome");
    writeFileSync(exe, "#!/bin/sh\n");
    process.env.ADMIN_WORKER_CHROMIUM_PATH = exe;
    expect(chromiumExecutablePath()).toBe(exe);
  });

  it("ignores ADMIN_WORKER_CHROMIUM_PATH when the file is absent", () => {
    process.env.ADMIN_WORKER_CHROMIUM_PATH = "/no/such/chrome";
    expect(chromiumExecutablePath()).toBeUndefined();
  });

  it("resolves a <PLAYWRIGHT_BROWSERS_PATH>/chromium symlink", () => {
    const dir = mkdtempSync(join(tmpdir(), "pw-browsers-"));
    const target = join(dir, "real-chrome");
    writeFileSync(target, "#!/bin/sh\n");
    const link = join(dir, "chromium");
    symlinkSync(target, link);
    process.env.PLAYWRIGHT_BROWSERS_PATH = dir;
    expect(chromiumExecutablePath()).toBe(link);
  });

  it("returns undefined when nothing is configured (let Playwright resolve)", () => {
    // Guard: only meaningful when the test host has no pre-set browsers path.
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    delete process.env.ADMIN_WORKER_CHROMIUM_PATH;
    expect(chromiumExecutablePath()).toBeUndefined();
  });
});

describe("renderPage fail-open guards (no browser launched)", () => {
  it("returns null when the capability is disabled", async () => {
    process.env.ADMIN_WORKER_DYNAMIC_FETCHER = "0";
    expect(await renderPage("https://www.vatican.va/x")).toBeNull();
  });

  it("returns null in offline mode", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    expect(await renderPage("https://www.vatican.va/x")).toBeNull();
  });

  it("returns null for an invalid URL", async () => {
    expect(await renderPage("not-a-url")).toBeNull();
  });

  it("returns null for an unapproved (local) host", async () => {
    // localhost is always blocked by isFetchableHost — renderPage must refuse it
    // before ever importing Playwright.
    expect(await renderPage("http://localhost:3000/x")).toBeNull();
  });
});

describe("request_dynamic_fetcher_upgrade is capability-aware", () => {
  const skill = discoverySkills.find((s) => s.name === "request_dynamic_fetcher_upgrade")!;

  function ctxWithUpsert(upsert: ReturnType<typeof vi.fn>): SkillContext {
    return {
      prisma: {
        adminWorkerDeveloperRequest: { upsert },
      } as unknown as PrismaClient,
      input: { host: "example.org" },
    } as unknown as SkillContext;
  }

  it("files NO developer request when the dynamic fetcher is available", async () => {
    // Default (enabled) + Playwright importable in the test env → available.
    const upsert = vi.fn(async () => ({ id: "should-not-be-called" }));
    const result = await skill.execute(ctxWithUpsert(upsert));
    expect(upsert).not.toHaveBeenCalled();
    expect(result.status).toBe("SUCCEEDED");
    expect((result.output as { detail?: string }).detail).toMatch(/available/i);
  });

  it("files a developer request when the capability is disabled", async () => {
    process.env.ADMIN_WORKER_DYNAMIC_FETCHER = "0"; // disabled → not available
    const upsert = vi.fn(async () => ({ id: "req-1" }));
    const result = await skill.execute(ctxWithUpsert(upsert));
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("SUCCEEDED");
    expect((result.output as { detail?: string }).detail).toMatch(/filed/i);
  });
});

describe("test-host helpers exist", () => {
  it("exposes a sanity check for symlink support", () => {
    // Sanity: the symlink-based path test above only makes sense where fs
    // symlinks work; assert the primitive so a platform without them fails loud.
    const dir = mkdtempSync(join(tmpdir(), "pw-symlink-check-"));
    const target = join(dir, "t");
    writeFileSync(target, "x");
    const link = join(dir, "l");
    symlinkSync(target, link);
    expect(existsSync(link)).toBe(true);
  });
});
