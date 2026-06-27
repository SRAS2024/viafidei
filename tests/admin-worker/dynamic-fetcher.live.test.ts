/**
 * LIVE proof that the keyless dynamic fetcher actually renders JavaScript.
 *
 * Skipped unless DYNAMIC_FETCHER_LIVE=1 AND a Chromium binary is available, so
 * CI (which ships no browser) stays green. Run it locally with:
 *
 *   DYNAMIC_FETCHER_LIVE=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     npx vitest run tests/admin-worker/dynamic-fetcher.live.test.ts
 *
 * It serves a JS-only shell from a local HTTP server and points renderPage() at
 * it through a public-looking hostname (so the worker's host gate permits it),
 * mapped back to localhost via Chromium's --host-resolver-rules. A correct
 * render turns the empty shell into real prose — exactly the upgrade the worker
 * relies on for client-rendered Catholic sources.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { looksDynamic, renderPage } from "@/lib/admin-worker/dynamic-fetcher";

const LIVE = process.env.DYNAMIC_FETCHER_LIVE === "1";
// A reserved-TLD host: passes isFetchableHost (not local/social/commerce) yet is
// remapped to 127.0.0.1 by the resolver flag below, so we never touch the net.
const HOST = "render-test.viafidei.example";

const SHELL = `<!doctype html><html><head><title>shell</title></head>
<body><div id="root"></div>
<script>
  document.getElementById('root').innerHTML =
    '<h1>Litany of Humility</h1><p>' +
    'O Jesus, meek and humble of heart, hear me. From the desire of being esteemed, deliver me, O Jesus. '.repeat(6) +
    '</p>';
</script></body></html>`;

describe.skipIf(!LIVE)("dynamic fetcher — live render", () => {
  let server: Server;
  let port = 0;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(SHELL);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    port = typeof addr === "object" && addr ? addr.port : 0;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("renders the JS-only shell into real prose", async () => {
    // Sanity: the raw shell is detected as dynamic (no usable static text).
    expect(looksDynamic(SHELL).dynamic).toBe(true);

    const result = await renderPage(`http://${HOST}:${port}/`, {
      timeoutMs: 20_000,
      extraLaunchArgs: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
    });

    expect(result).not.toBeNull();
    expect(result!.html).toContain("Litany of Humility");
    expect(result!.html).toContain("meek and humble of heart");
    // The rendered HTML now has real text — no longer a dynamic shell.
    expect(looksDynamic(result!.html).dynamic).toBe(false);
    expect(result!.httpStatus).toBe(200);
  }, 30_000);
});
