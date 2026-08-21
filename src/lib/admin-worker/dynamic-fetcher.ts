/**
 * Dynamic (headless-browser) fetcher — a KEYLESS ingestion capability.
 *
 * Many authoritative Catholic sources render their text client-side: the
 * static HTML the plain fetcher receives is a near-empty shell
 * (`<div id="root"></div>` + a JavaScript bundle) with no usable prose. Until
 * now the worker detected those pages (`detect_dynamic_page`), filed a
 * developer request for a "dynamic fetcher", and then abandoned the source.
 * This module IS that capability — it renders the page in a headless Chromium
 * and returns the post-JavaScript HTML, so JS-only sources flow through the
 * normal pipeline (read → classify → extract → verify → publish) with no API
 * key and no human involvement.
 *
 * Two principles keep it safe:
 *
 *   1. KEYLESS. It needs no API key, only a Chromium binary. The worker image
 *      ships one (see Dockerfile.worker); this dev environment provides one at
 *      $PLAYWRIGHT_BROWSERS_PATH.
 *
 *   2. GRACEFUL-OPTIONAL. When Playwright or a browser binary is absent (or the
 *      capability is disabled, or we're offline), every entry point degrades to
 *      a no-op and the worker behaves exactly as before — it falls back to the
 *      static body. So adding it can never break a deploy; it only widens reach
 *      where a browser happens to be available.
 *
 * Enabled by default (like the machine-translation fallback). Set
 * `ADMIN_WORKER_DYNAMIC_FETCHER=0` (or `false`/`off`/`no`) to opt out, or
 * `ADMIN_WORKER_SKIP_NETWORK=1` (tests / offline) to force it off.
 */

import { existsSync } from "node:fs";

import { isFetchableHost } from "@/lib/checklist";

import { workerExecutionAllowed } from "./execution-context";

const DEFAULT_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_SETTLE_MS = 3_000;
const MAX_RENDER_BYTES = 5_000_000; // mirror the static fetcher's cap

// Present as a mainstream browser (matches fetcher.ts) — some hosts vary their
// markup for unknown User-Agents.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Memoised "is Playwright importable" probe. Reset between tests via
// __resetDynamicFetcherCache().
let availabilityCache: boolean | null = null;

/**
 * True when the dynamic fetcher may run. Default ON — it is a keyless
 * capability — so only an explicit opt-out (or offline/test mode) disables it.
 */
export function dynamicFetcherEnabled(): boolean {
  // Headless Chromium is Admin Worker computation: it only ever runs on the
  // local (MacBook) runtime, never inside the production web service (spec §7).
  if (!workerExecutionAllowed()) return false;
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_DYNAMIC_FETCHER ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

function renderTimeoutMs(): number {
  const raw = (process.env.ADMIN_WORKER_DYNAMIC_FETCHER_TIMEOUT_MS ?? "").trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

// ── Concurrency cap ──────────────────────────────────────────────────────────
// Each renderPage launches a FULL headless Chromium. Nothing else bounds how
// many run at once, so N concurrent worker lanes could fan out N browsers and
// spike memory into an OS OOM-kill of the whole worker (SIGKILL — uncatchable
// in JS, the credible cause of a worker dying between passes with no error).
// A hand-off semaphore caps concurrent renders (default 1; env-tunable).
let activeRenders = 0;
const renderWaiters: Array<() => void> = [];
function maxConcurrentRenders(): number {
  const n = Number((process.env.ADMIN_WORKER_DYNAMIC_FETCHER_CONCURRENCY ?? "").trim());
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
async function acquireRenderSlot(): Promise<void> {
  if (activeRenders < maxConcurrentRenders()) {
    activeRenders += 1;
    return;
  }
  await new Promise<void>((resolve) => renderWaiters.push(resolve));
  // Slot handed directly from releaseRenderSlot (activeRenders left unchanged).
}
/**
 * Live browser-rendering activity, surfaced on the local Admin Worker
 * dashboard (spec §20.4) so the operator can see exactly how much Chromium
 * work the MacBook is doing right now.
 */
export function browserRenderActivity(): {
  active: number;
  waiting: number;
  maxConcurrent: number;
} {
  return {
    active: activeRenders,
    waiting: renderWaiters.length,
    maxConcurrent: maxConcurrentRenders(),
  };
}

function releaseRenderSlot(): void {
  const next = renderWaiters.shift();
  if (next) next();
  else activeRenders = Math.max(0, activeRenders - 1);
}

/**
 * Resolve the Chromium executable, in priority order:
 *   1. `ADMIN_WORKER_CHROMIUM_PATH` (explicit operator override), if it exists.
 *   2. A `<PLAYWRIGHT_BROWSERS_PATH>/chromium` symlink, if present — covers dev
 *      environments whose pre-installed browser version differs from the one
 *      Playwright would otherwise resolve.
 *   3. `undefined` — let Playwright resolve its own bundled browser (the
 *      production worker image installs a version-matched Chromium).
 */
export function chromiumExecutablePath(): string | undefined {
  const explicit = (process.env.ADMIN_WORKER_CHROMIUM_PATH ?? "").trim();
  if (explicit && existsSync(explicit)) return explicit;
  const browsersPath = (process.env.PLAYWRIGHT_BROWSERS_PATH ?? "").trim();
  if (browsersPath) {
    const symlink = `${browsersPath.replace(/\/+$/, "")}/chromium`;
    if (existsSync(symlink)) return symlink;
  }
  return undefined;
}

/**
 * Whether the capability is both enabled AND the Playwright module can be
 * imported. Used by the skill runtime to decide whether to file a
 * "dynamic fetcher needed" developer request (it should not, once the
 * capability is present). Does not launch a browser — that happens lazily in
 * renderPage(), which fails open if the launch fails.
 */
export async function dynamicFetcherAvailable(): Promise<boolean> {
  if (!dynamicFetcherEnabled()) return false;
  if (availabilityCache !== null) return availabilityCache;
  try {
    await import("playwright");
    availabilityCache = true;
  } catch {
    availabilityCache = false;
  }
  return availabilityCache;
}

/** Test hook: clear the memoised availability probe + release any held slots. */
export function __resetDynamicFetcherCache(): void {
  availabilityCache = null;
  activeRenders = 0;
  renderWaiters.length = 0;
}

// Test-only injection seam for the Chromium launcher. Production ALWAYS resolves
// the launcher by importing Playwright lazily (below); this stays null. Tests
// inject a controllable fake so the concurrency cap, hard-timeout, and teardown
// logic can be exercised deterministically without a real browser — and without
// depending on the test runner intercepting the dynamic import of an external
// native module (Playwright), which it does not do reliably.
let chromiumLauncherForTest: ChromiumLauncher | null = null;
export function __setChromiumLauncherForTest(launcher: ChromiumLauncher | null): void {
  chromiumLauncherForTest = launcher;
}

/**
 * Shared "is this a JS-only shell?" heuristic. A page is dynamic when it has
 * almost no visible text AND either a known SPA marker or any `<script>` —
 * i.e. the text we want is produced by JavaScript we haven't run. Used both by
 * the fetcher (to decide whether to re-render) and by the `detect_dynamic_page`
 * skill, so there is a single definition.
 */
export function looksDynamic(body: string): { dynamic: boolean; textLength: number } {
  const textLength = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
  const dynamicMarkers =
    /enable javascript|please wait|loading\.\.\.|window\.__INITIAL_STATE__|<div id="root">\s*<\/div>|<div id="app">\s*<\/div>/i.test(
      body,
    );
  const dynamic = textLength < 200 && (dynamicMarkers || /<script/i.test(body));
  return { dynamic, textLength };
}

export interface DynamicRenderResult {
  html: string;
  finalUrl: string;
  httpStatus: number;
}

/**
 * Render a URL in a headless Chromium and return the post-JavaScript HTML.
 * Returns null (fail-open) when disabled, the host is not fetchable, Playwright
 * is missing, or anything goes wrong during launch / navigation. The browser is
 * always closed.
 */
export async function renderPage(
  url: string,
  opts: { timeoutMs?: number; userAgent?: string; extraLaunchArgs?: string[] } = {},
): Promise<DynamicRenderResult | null> {
  if (!dynamicFetcherEnabled()) return null;

  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  // Defence-in-depth: never render an unapproved host even if a caller slips.
  if (!isFetchableHost(host)) return null;

  let chromium: ChromiumLauncher | undefined = chromiumLauncherForTest ?? undefined;
  if (!chromium) {
    let pw: unknown;
    try {
      pw = await import("playwright");
    } catch {
      availabilityCache = false;
      return null;
    }
    chromium = (pw as { chromium?: ChromiumLauncher }).chromium;
  }
  if (!chromium) return null;

  const timeoutMs = opts.timeoutMs ?? renderTimeoutMs();
  // Hard wall-clock cap over the WHOLE render. Only page.goto/waitForLoadState
  // take a per-call timeout; launch()/newContext()/newPage()/content() do not,
  // so a wedged Chromium (which is what a memory-pressured/zombie browser
  // becomes) would hang renderPage forever — holding a concurrency slot and
  // leaking the subprocess. The cap covers launch + navigate + settle + content
  // with headroom over the navigation timeout (env-overridable).
  const hardCapMs = (() => {
    const n = Number((process.env.ADMIN_WORKER_DYNAMIC_FETCHER_HARD_CAP_MS ?? "").trim());
    return Number.isFinite(n) && n > 0 ? n : timeoutMs + 20_000;
  })();

  await acquireRenderSlot();
  let browser: PwBrowser | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Tear the browser down HARD: bound close() (a wedged browser can hang it
  // forever), then SIGKILL the underlying Chromium process as a fallback so we
  // never accumulate zombie browsers across many fetches (the OOM path). Safe
  // to call more than once.
  const teardown = async (): Promise<void> => {
    const b = browser;
    if (!b) return;
    browser = null;
    await Promise.race([
      b.close().catch(() => undefined),
      new Promise<void>((r) => setTimeout(r, 5_000).unref?.()),
    ]);
    try {
      b.process?.()?.kill?.("SIGKILL");
    } catch {
      /* already gone */
    }
  };

  const core = (async (): Promise<DynamicRenderResult | null> => {
    browser = await chromium.launch({
      headless: true,
      executablePath: chromiumExecutablePath(),
      // extraLaunchArgs lets locked-down deployments add proxy / host-resolver
      // flags (and lets the live test reach a local server). Empty by default.
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        ...(opts.extraLaunchArgs ?? []),
      ],
    });
    // A browser EventEmitter emitting 'disconnected'/'error' with no listener
    // would throw and, in the bare worker process (no uncaughtException net),
    // crash it. A no-op listener makes the event harmless.
    browser.on?.("disconnected", () => undefined);
    const context = await browser.newContext({
      userAgent: opts.userAgent ?? USER_AGENT,
      javaScriptEnabled: true,
    });
    const page = await context.newPage();
    // Skip heavy assets we never read — faster, lighter, less likely to hang.
    // route.abort()/continue() reject if the page is torn down mid-flight; that
    // rejection is NOT awaited by Playwright, so swallow it here or it becomes
    // an unhandledRejection that crashes the worker.
    await page.route("**/*", (route: PwRoute) => {
      const type = route.request().resourceType();
      const p =
        type === "image" || type === "media" || type === "font" ? route.abort() : route.continue();
      void Promise.resolve(p).catch(() => undefined);
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    // Let client-side rendering settle, capped so a long-polling page can't hang us.
    await page
      .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_SETTLE_MS })
      .catch(() => undefined);
    const html = await page.content();
    const finalUrl = page.url() || url;
    const httpStatus = response ? response.status() : 200;
    const trimmed =
      Buffer.byteLength(html, "utf8") > MAX_RENDER_BYTES ? html.slice(0, MAX_RENDER_BYTES) : html;
    return { html: trimmed, finalUrl, httpStatus };
  })();

  // Whenever core settles — including LATE, after a hard-timeout already made us
  // return null — tear the browser down. Observing core here also means its
  // rejection is always handled (never an unhandledRejection).
  void core.finally(() => teardown()).catch(() => undefined);

  try {
    return await Promise.race([
      core,
      new Promise<null>((_, reject) => {
        timer = setTimeout(() => reject(new Error("renderPage hard timeout")), hardCapMs);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
    releaseRenderSlot();
  }
}

// Minimal structural types for the lazily-imported Playwright surface we use.
// Avoids a hard compile-time dependency on the package being resolvable.
interface PwRequest {
  resourceType(): string;
}
interface PwRoute {
  request(): PwRequest;
  abort(): Promise<void>;
  continue(): Promise<void>;
}
interface PwResponse {
  status(): number;
}
interface PwPage {
  route(pattern: string, handler: (route: PwRoute) => unknown): Promise<void>;
  goto(url: string, opts: { waitUntil: string; timeout: number }): Promise<PwResponse | null>;
  waitForLoadState(state: string, opts: { timeout: number }): Promise<void>;
  content(): Promise<string>;
  url(): string;
}
interface PwContext {
  newPage(): Promise<PwPage>;
}
interface PwBrowser {
  newContext(opts: { userAgent: string; javaScriptEnabled: boolean }): Promise<PwContext>;
  close(): Promise<void>;
  // Optional in this structural view: real Playwright browsers expose both, but
  // test doubles may not. `on` lets us silence stray 'disconnected'/'error'
  // events; `process()` gives the underlying child so teardown can SIGKILL a
  // wedged Chromium that close() can't reap.
  on?(event: string, handler: (...args: unknown[]) => void): void;
  process?(): { kill?(signal?: string): void } | null;
}
interface ChromiumLauncher {
  launch(opts: {
    headless: boolean;
    executablePath: string | undefined;
    args: string[];
  }): Promise<PwBrowser>;
}
