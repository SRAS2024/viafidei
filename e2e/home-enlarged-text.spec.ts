import { expect, test } from "@playwright/test";

// The homepage at 200% text on a phone, measured in a browser: a link's name wraps
// between its words, whichever part of the page it is in, and the page never scrolls
// sideways.

test.use({ viewport: { width: 375, height: 800 } });

test("the homepage breaks no word at 200% text", async ({ page }) => {
  await page.addInitScript(() => {
    const set = () =>
      document.documentElement && (document.documentElement.style.fontSize = "200%");
    set();
    document.addEventListener("DOMContentLoaded", set);
  });
  await page.goto("/");
  await expect(page.locator(".vf-home-begin-links a")).toHaveCount(5);
  await page.waitForTimeout(500);

  const split = await page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const room = node.parentElement!.getBoundingClientRect().width;
      for (const match of (node.nodeValue ?? "").matchAll(/[\p{L}\p{N}’']{3,}/gu)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0.5);
        const lines = new Set(rects.map((rect) => Math.round(rect.top)));
        const width = rects.reduce((sum, rect) => sum + rect.width, 0);
        if (lines.size > 1 && width < room * 0.95) found.push(match[0]);
      }
    }
    return found;
  });
  expect(split).toEqual([]);

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);
});

// Beyond the 200% above, a button's own words used to be what pushed the page: "Spiritual
// Life" here, "Geistliches Leben" in German, "Udostępnij" on a detail page in Polish.
for (const [width, textSize, locale, path] of [
  [375, 300, "en", "/"],
  [320, 250, "en", "/"],
  [320, 300, "en", "/"],
  [375, 300, "de", "/"],
  [320, 250, "de", "/"],
  [375, 300, "pl", "/"],
  [375, 300, "pl", "/prayers/our-father"],
  [320, 250, "pl", "/prayers/our-father"],
] as const) {
  test(`a button's words wrap on ${path} at ${width} wide and ${textSize}% text, in ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "vf_locale", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}%`;
    }, textSize);
    const pushed = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return {
        sideways: document.documentElement.scrollWidth - width,
        buttons: [...document.querySelectorAll(".vf-btn")]
          .filter((button) => button.getClientRects().length > 0)
          .filter((button) => {
            const box = button.getBoundingClientRect();
            return box.left < 0 || box.right > width;
          })
          .map((button) => button.textContent),
      };
    });
    expect(pushed).toEqual({ sideways: 0, buttons: [] });
  });
}

// A button's word stands whole. A rule that broke words anywhere split CREATE ACCOUNT into
// ACCOU / NT in the sign-in popup, and CLEAR SEARCH into SEARC / H, where the word fitted
// in the button with its padding given up. The word runs into the padding instead, and
// stays inside the button's edge; a dialog's own padding gives way so that it can.
for (const [width, textSize, locale, path] of [
  [320, 200, "en", "#popup"],
  [375, 300, "en", "#popup"],
  [320, 250, "en", "#popup"],
  [375, 300, "en", "/search?q=zzzzqq"],
  [320, 250, "en", "/history?q=zzzzqq"],
  [375, 200, "de", "/search?q=zzzzqq"],
  [375, 200, "pl", "/search?q=zzzzqq"],
  [375, 200, "la", "/search?q=zzzzqq"],
  [320, 250, "de", "/"],
  [375, 300, "fr", "/login"],
  [320, 250, "fr", "/login"],
] as const) {
  test(`a button keeps every word whole and inside its edge on ${path} at ${width} wide and ${textSize}% text, in ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "vf_locale", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript((size) => {
      const set = () =>
        document.documentElement && (document.documentElement.style.fontSize = `${size}%`);
      set();
      document.addEventListener("DOMContentLoaded", set);
    }, textSize);
    if (path === "#popup") {
      await page.goto("/prayers/our-father");
      await page.locator(".vf-detail-actions button[aria-pressed]").click();
      await expect(page.getByRole("dialog")).toBeVisible();
    } else {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(300);
    const found = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const scope = document.querySelector("[role=dialog]") ?? document;
      const bad: string[] = [];
      for (const button of scope.querySelectorAll(".vf-btn")) {
        if (!button.getClientRects().length) continue;
        const edge = button.getBoundingClientRect();
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node.parentElement!.closest(".sr-only,[aria-hidden=true]")) continue;
          for (const match of (node.nodeValue ?? "").matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const rects = [...range.getClientRects()].filter((rect) => rect.width > 0.5);
            const word = range.getBoundingClientRect();
            if (new Set(rects.map((rect) => Math.round(rect.top))).size > 1)
              bad.push(`${match[0]} broken`);
            if (word.left < edge.left - 0.5 || word.right > edge.right + 0.5)
              bad.push(`${match[0]} outside its button`);
          }
        }
      }
      return { bad, sideways: document.documentElement.scrollWidth - width };
    });
    expect(found).toEqual({ bad: [], sideways: 0 });
  });
}
