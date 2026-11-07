import { expect, test, type Page } from "@playwright/test";

// How-tos and their prayers at 200% text on a phone, measured in a browser: the
// chips of the Rosary's picker keep their labels, no prayer breaks a word, opened from
// a disclosure or in place inside a nested list, a marker never runs into its line, and
// the page never scrolls sideways. A page with nothing published on it (a database
// without the curated content) has nothing to measure.

test.use({ viewport: { width: 375, height: 800 } });

async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    const set = () =>
      document.documentElement && (document.documentElement.style.fontSize = "200%");
    set();
    document.addEventListener("DOMContentLoaded", set);
  });
  const response = await page.goto(path);
  test.skip((response?.status() ?? 500) >= 400, "not published here");
  const title = await page.locator("h1").first().textContent();
  test.skip(/not found/i.test(title ?? ""), "not published here");
  // Every disclosure and every prayer named in the text, opened where it is named. Twice,
  // for a prayer named inside one that has just opened.
  for (let pass = 0; pass < 2; pass += 1) {
    await page.evaluate(() => {
      for (const button of document.querySelectorAll<HTMLElement>(
        "main button[aria-expanded='false']",
      )) {
        button.click();
      }
    });
    await page.waitForTimeout(200);
  }
}

/** The words the browser broke across two lines. */
const splitWords = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest(".sr-only")) continue;
      for (const match of (node.nodeValue ?? "").matchAll(/[\p{L}\p{N}’']{3,}/gu)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0.5);
        if (new Set(rects.map((rect) => Math.round(rect.top))).size > 1) found.push(match[0]);
      }
    }
    return found;
  });

/** The markers whose text runs into what follows them on the line: "Ant.Thou". */
const crowdedMarkers = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main .vf-prayer-marker")].flatMap((marker) => {
      const text = marker.firstChild;
      const after = marker.nextSibling;
      if (!text || after?.nodeType !== Node.TEXT_NODE || !after.nodeValue) return [];
      const ownWords = document.createRange();
      ownWords.setStart(text, 0);
      ownWords.setEnd(text, (marker.textContent ?? "").trimEnd().length);
      const next = document.createRange();
      next.setStart(after, 0);
      next.setEnd(after, 1);
      const gap = next.getBoundingClientRect().left - ownWords.getBoundingClientRect().right;
      return gap < 2 ? [`${marker.textContent}: ${gap.toFixed(1)}`] : [];
    }),
  );

test("the Rosary's picker keeps each label inside its chip at 200% text", async ({ page }) => {
  await open(page, "/guides/how-to-pray-the-rosary");
  const chips = page.locator(".vf-mysteries-picker button");
  await expect(chips).toHaveCount(4);
  const overruns = await chips.evaluateAll((buttons) =>
    buttons.map((button) => {
      const range = document.createRange();
      range.selectNodeContents(button);
      return range.getBoundingClientRect().right - button.getBoundingClientRect().right;
    }),
  );
  for (const overrun of overruns) expect(overrun).toBeLessThan(0);
  // Never three and one: every row of the picker is full.
  const rows = await chips.evaluateAll((buttons) => {
    const byRow = new Map<number, number>();
    for (const button of buttons) {
      const top = Math.round(button.getBoundingClientRect().top);
      byRow.set(top, (byRow.get(top) ?? 0) + 1);
    }
    return [...byRow.values()];
  });
  expect(new Set(rows).size).toBe(1);
});

for (const path of [
  "/devotions/holy-rosary",
  "/guides/how-to-pray-the-rosary",
  "/novenas/divine-mercy-novena",
  "/novenas/novena-our-lady-of-mount-carmel-brown-scapular",
  // Prayers opened in place inside a nested list, on its narrower line.
  "/guides/how-to-pray-a-litany",
  "/guides/how-to-pray-the-liturgy-of-the-hours",
  "/guides/how-to-teach-a-child-the-basic-prayers",
  // The longest words the prayers have, on numbered lines and hanging ones.
  "/novenas/novena-saint-catherine-of-siena",
  "/novenas/novena-saint-bernard-of-clairvaux",
  "/devotions/white-scapular-of-the-most-holy-trinity",
  "/devotions/visits-to-the-blessed-sacrament",
]) {
  test(`an opened prayer breaks no word at 200% text: ${path}`, async ({ page }) => {
    await open(page, path);
    expect(await splitWords(page)).toEqual([]);
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways).toBeLessThanOrEqual(0);
  });
}

for (const path of ["/novenas/novena-saint-peter", "/devotions/chaplet-of-saint-anthony"]) {
  test(`a marker keeps clear of its line at 200% text: ${path}`, async ({ page }) => {
    await open(page, path);
    expect(await crowdedMarkers(page)).toEqual([]);
  });
}

test("a prayer's punctuation stays in its box, where no line can start with it", async ({
  page,
}) => {
  await open(page, "/guides/how-to-pray-the-liturgy-of-the-hours");
  const { marks, outside } = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const outside: string[] = [];
    for (const button of main.querySelectorAll(".vf-inline-prayer-toggle")) {
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      walker.currentNode = button;
      let node = walker.nextNode();
      while (node && button.contains(node)) node = walker.nextNode();
      if (node && /^[,.;:)]/.test(node.nodeValue ?? "")) outside.push(node.nodeValue!.slice(0, 20));
    }
    return { marks: main.querySelectorAll(".vf-inline-prayer-mark").length, outside };
  });
  expect(marks).toBeGreaterThan(0);
  expect(outside).toEqual([]);
});
