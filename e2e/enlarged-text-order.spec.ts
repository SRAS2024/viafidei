import { expect, test, type Page } from "@playwright/test";

// Enlarged text on a phone, measured in a browser. Sizes are capped by the width there,
// so that words stay whole, and a cap on one step alone used to leave a section title
// smaller than the headings under it. The hero's longest words, in the languages that
// have them, used to run off the screen.

async function enlarge(page: Page) {
  await page.addInitScript(() => {
    const set = () =>
      document.documentElement && (document.documentElement.style.fontSize = "200%");
    set();
    document.addEventListener("DOMContentLoaded", set);
  });
}

/** Every heading in <main> larger than the one it sits under. */
const outgrown = (page: Page) =>
  page.evaluate(() => {
    const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const stack: Array<{ level: number; size: number; text: string }> = [];
    const found: string[] = [];
    for (const el of document.querySelectorAll("main h1, main h2, main h3, main h4")) {
      if (el.closest('.sr-only, [aria-hidden="true"]')) continue;
      const level = Number(el.tagName[1]);
      while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
      const parent = stack[stack.length - 1];
      const heading = { level, size: size(el), text: (el.textContent ?? "").trim() };
      if (parent && heading.size > parent.size + 0.05) {
        found.push(`${heading.text} (${heading.size}) over ${parent.text} (${parent.size})`);
      }
      stack.push(heading);
    }
    return found;
  });

/** Whatever in <main> runs past the screen's right edge. */
const pastTheEdge = (page: Page) =>
  page.evaluate(() => {
    const edge = document.documentElement.clientWidth;
    const found: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue?.trim() || node.parentElement!.closest(".sr-only")) continue;
      range.selectNodeContents(node);
      const right = Math.max(...[...range.getClientRects()].map((rect) => rect.right), 0);
      if (right > edge + 0.5) found.push(`${node.nodeValue.trim()} ${Math.round(right - edge)}px`);
    }
    return found;
  });

for (const width of [320, 375, 430]) {
  test.describe(`${width}px wide at 200% text`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of ["/", "/sacraments/baptism"]) {
      test(`${path}: no heading is larger than the one it sits under`, async ({ page }) => {
        await enlarge(page);
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        expect(await outgrown(page)).toEqual([]);
      });
    }

    for (const locale of ["fr", "es", "it", "tl"]) {
      test(`the hero stays on the screen in ${locale}`, async ({ context, page, baseURL }) => {
        await context.addCookies([{ name: "vf_locale", value: locale, url: baseURL! }]);
        await enlarge(page);
        await page.goto("/");
        await expect(page.locator(".vf-home-title")).toBeVisible();
        expect(await pastTheEdge(page)).toEqual([]);
      });
    }
  });
}
