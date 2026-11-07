import { expect, test, type Page } from "@playwright/test";

// What a screen reader is told while a page's placeholder shows. In the WebKit Safari
// uses, VoiceOver announces a live region whose words change, and nothing of one that
// arrives already holding them, which is how a client navigation puts the placeholder
// in place. So the status starts empty and its words follow half a second later, if the
// page has not arrived by then.
//
// A slow page, not a slow network: the reply comes at once except its last rows, the
// page's own content, which arrive three seconds later. The router shows the loading
// boundary meanwhile, as it does in production for a page whose data takes time.
const SLOW_PAGE = `(() => {
  const fetchOf = window.fetch;
  window.fetch = async (input, init) => {
    const url = String((input && input.url) || input);
    const headers = init && init.headers;
    const rsc = /_rsc=/.test(url) || (headers && (headers.RSC || headers.rsc || (headers.get && headers.get("rsc"))));
    if (!rsc || !window.__slowPage) return fetchOf(input, init);
    const response = await fetchOf(input, init);
    const rows = (await response.text()).split("\\n");
    const keep = Math.max(1, rows.length - 3);
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(rows.slice(0, keep).join("\\n") + "\\n"));
        setTimeout(() => {
          controller.enqueue(encoder.encode(rows.slice(keep).join("\\n")));
          controller.close();
        }, window.__slowPage);
      },
    });
    return new Response(body, { status: response.status, headers: response.headers });
  };
})();`;

/** The placeholder's status, over the slow page's wait, each change once. */
async function statusOverTime(page: Page, from: string, to: string) {
  await page.addInitScript(SLOW_PAGE);
  await page.goto(from);
  await page.waitForLoadState("networkidle");
  return page.evaluate(async (to) => {
    (window as unknown as { __slowPage: number }).__slowPage = 3000;
    const seen: Array<{ at: number; busy: boolean; words: string | null }> = [];
    const start = performance.now();
    const look = setInterval(() => {
      const status = document.querySelector("main [role=status]");
      const now = {
        at: Math.round(performance.now() - start),
        busy: !!document.querySelector('[aria-busy="true"]'),
        words: status ? (status.textContent ?? "") : null,
      };
      const last = seen.at(-1);
      if (!last || last.busy !== now.busy || last.words !== now.words) seen.push(now);
    }, 20);
    (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(
      to,
    );
    await new Promise((resolve) => setTimeout(resolve, 4000));
    clearInterval(look);
    return seen;
  }, to);
}

for (const [locale, words] of [
  ["en", "Loading the readings of the day…"],
  ["es", "Cargando las lecturas del día…"],
] as const) {
  test(`a slow page's placeholder says it is loading, a moment after it shows, in ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "vf_locale", value: locale, url: baseURL! }]);
    const seen = await statusOverTime(page, "/privacy", "/liturgy/readings");
    const shown = seen.find((step) => step.busy);
    const said = seen.find((step) => step.busy && step.words === words);
    expect(shown, JSON.stringify(seen)).toBeDefined();
    // Put in place empty: arriving already holding its words, it would never be heard.
    expect(shown!.words).toBe("");
    expect(said, JSON.stringify(seen)).toBeDefined();
    expect(said!.at - shown!.at).toBeGreaterThanOrEqual(400);
    // The page itself, in the end.
    expect(seen.at(-1)!.busy).toBe(false);
  });
}

test("a placeholder sent with the page holds its words from the first byte", async ({
  request,
}) => {
  const html = await (await request.get("/liturgy/readings")).text();
  expect(html).toContain('<p role="status" class="sr-only">Loading the readings of the day…</p>');
});
