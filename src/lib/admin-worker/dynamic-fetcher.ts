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

/** Test hook: clear the memoised availability probe. */
export function __resetDynamicFetcherCache(): void {
  availabilityCache = null;
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

  let pw: unknown;
  try {
    pw = await import("playwright");
  } catch {
    availabilityCache = false;
    return null;
  }
  const chromium = (pw as { chromium?: ChromiumLauncher }).chromium;
  if (!chromium) return null;

  const timeoutMs = opts.timeoutMs ?? renderTimeoutMs();
  let browser: PwBrowser | null = null;
  try {
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
    const context = await browser.newContext({
      userAgent: opts.userAgent ?? USER_AGENT,
      javaScriptEnabled: true,
    });
    const page = await context.newPage();
    // Skip heavy assets we never read — faster, lighter, less likely to hang.
    await page.route("**/*", (route: PwRoute) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") return route.abort();
      return route.continue();
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
  } catch {
    return null;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
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
}
interface ChromiumLauncher {
  launch(opts: {
    headless: boolean;
    executablePath: string | undefined;
    args: string[];
  }): Promise<PwBrowser>;
}
