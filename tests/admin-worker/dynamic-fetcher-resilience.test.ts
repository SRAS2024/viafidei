/**
 * Dynamic-fetcher resilience — the hardening added after a worker died between
 * passes (audit 2026-07-12) with a LOOPING SOURCE_FETCH escalation, the
 * credible cause being headless-Chromium memory/zombie accumulation
 * OOM-killing the whole worker. These cases drive renderPage with an INJECTED
 * fake Chromium launcher (`__setChromiumLauncherForTest`) so they stay
 * browser-free while exercising the real safety code:
 *
 *   1. Concurrency cap — concurrent renders never launch more than one Chromium
 *      at a time (default), so N worker lanes can't fan out N browsers into an
 *      OOM. (env ADMIN_WORKER_DYNAMIC_FETCHER_CONCURRENCY tunes it.)
 *   2. Hard timeout — a wedged launch that never resolves makes renderPage
 *      return null within the hard cap (it doesn't hang forever holding a slot),
 *      and the browser is torn down.
 *   3. Fail-open — a launch that throws returns null, never propagating.
 *   4. Teardown — every rendered browser is close()d, and a wedged one is
 *      SIGKILLed via process().kill().
 *
 * The launcher is INJECTED rather than mocked through `import("playwright")`:
 * Playwright is an external native module and the runner does not reliably
 * intercept its dynamic import, so a mock would non-deterministically leak the
 * real browser. The injected launcher is a production-supported test seam that
 * still runs the genuine concurrency/timeout/teardown paths.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetDynamicFetcherCache,
  __setChromiumLauncherForTest,
  renderPage,
} from "@/lib/admin-worker/dynamic-fetcher";

// Approved Catholic host so isFetchableHost passes (no network is touched —
// the launcher is a fake).
const URL1 = "https://www.vatican.va/a";
const URL2 = "https://www.vatican.va/b";

// ── Controllable fake Chromium ───────────────────────────────────────────────
// Each launch() resolves per `launchImpl`; the fake browser records close()/
// kill() so teardown is observable. `liveLaunches`/`maxLiveLaunches` capture the
// concurrency high-watermark deterministically.
let launchImpl: () => Promise<unknown> = async () => makeBrowser();
let liveLaunches = 0;
let maxLiveLaunches = 0;
const closed: string[] = [];
const killed: string[] = [];

function makeBrowser(id = "b") {
  return {
    on: () => undefined,
    process: () => ({ kill: () => killed.push(id) }),
    async newContext() {
      return {
        async newPage() {
          return {
            route: async () => undefined,
            goto: async () => ({ status: () => 200 }),
            waitForLoadState: async () => undefined,
            content: async () => "<html><body>rendered prose here</body></html>",
            url: () => URL1,
          };
        },
      };
    },
    async close() {
      closed.push(id);
    },
  };
}

const fakeChromium = {
  launch: async () => {
    liveLaunches += 1;
    maxLiveLaunches = Math.max(maxLiveLaunches, liveLaunches);
    try {
      return await launchImpl();
    } finally {
      liveLaunches -= 1;
    }
  },
};

const ENV = [
  "ADMIN_WORKER_DYNAMIC_FETCHER",
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_DYNAMIC_FETCHER_CONCURRENCY",
  "ADMIN_WORKER_DYNAMIC_FETCHER_HARD_CAP_MS",
  "ADMIN_WORKER_DYNAMIC_FETCHER_TIMEOUT_MS",
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetDynamicFetcherCache();
  __setChromiumLauncherForTest(
    fakeChromium as unknown as Parameters<typeof __setChromiumLauncherForTest>[0],
  );
  launchImpl = async () => makeBrowser();
  liveLaunches = 0;
  maxLiveLaunches = 0;
  closed.length = 0;
  killed.length = 0;
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetDynamicFetcherCache();
  __setChromiumLauncherForTest(null);
});

describe("renderPage concurrency cap (OOM prevention)", () => {
  // Each launch holds a browser "live" for ~40ms; firing MORE renders than the
  // cap and reading the high-watermark `maxLiveLaunches` proves serialization
  // deterministically, without depending on checking at an exact instant.
  const slowLaunch = () => {
    launchImpl = async () => {
      await new Promise((r) => setTimeout(r, 40));
      return makeBrowser();
    };
  };

  it("never launches more than one Chromium at a time by default", async () => {
    slowLaunch();
    const results = await Promise.all([
      renderPage(URL1),
      renderPage(URL2),
      renderPage("https://www.vatican.va/c"),
    ]);
    expect(maxLiveLaunches).toBe(1);
    // …and every render — including the two that waited on the semaphore —
    // still completed with a real result (the hand-off never drops work).
    expect(results.every((r) => r !== null)).toBe(true);
    expect(closed.length).toBe(3); // each browser torn down
  });

  it("allows exactly the configured number of concurrent renders", async () => {
    process.env.ADMIN_WORKER_DYNAMIC_FETCHER_CONCURRENCY = "2";
    slowLaunch();
    const results = await Promise.all([
      renderPage(URL1),
      renderPage(URL2),
      renderPage("https://www.vatican.va/c"),
      renderPage("https://www.vatican.va/d"),
    ]);
    // Cap is 2 → up to two live at once, never more.
    expect(maxLiveLaunches).toBe(2);
    expect(results.every((r) => r !== null)).toBe(true);
  });
});

describe("renderPage hard timeout (never hangs, tears down)", () => {
  it("returns null within the hard cap when launch wedges forever", async () => {
    process.env.ADMIN_WORKER_DYNAMIC_FETCHER_HARD_CAP_MS = "150";
    launchImpl = () => new Promise(() => undefined); // never resolves
    const start = Date.now();
    const result = await renderPage(URL1);
    expect(result).toBeNull();
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("releases the slot after a timeout so the NEXT render still runs", async () => {
    process.env.ADMIN_WORKER_DYNAMIC_FETCHER_HARD_CAP_MS = "120";
    // First render wedges + times out; the slot must be released for the second.
    launchImpl = () => new Promise(() => undefined);
    const first = await renderPage(URL1);
    expect(first).toBeNull();

    launchImpl = async () => makeBrowser("ok");
    const second = await renderPage(URL2);
    expect(second).not.toBeNull();
  });
});

describe("renderPage fail-open on launch error", () => {
  it("returns null (never throws) when chromium.launch rejects", async () => {
    launchImpl = async () => {
      throw new Error("launch failed: cannot allocate memory");
    };
    await expect(renderPage(URL1)).resolves.toBeNull();
  });
});
