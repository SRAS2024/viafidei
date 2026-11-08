import { expect, test, type Page } from "@playwright/test";

// What the second independent check of the visual system found, measured in a browser
// at the widths and text sizes where each one showed. The rules themselves are held in
// tests/content/visual-system-styles.test.ts.

async function enlargeText(page: Page, percent: number) {
  await page.addInitScript((size) => {
    const set = () =>
      document.documentElement && (document.documentElement.style.fontSize = `${size}%`);
    set();
    document.addEventListener("DOMContentLoaded", set);
  }, percent);
}

/** The site's own theme choice, set on the origin the page has already opened. */
async function useTheme(page: Page, theme: "light" | "dark") {
  await page.context().addCookies([{ name: "vf_theme", value: theme, url: page.url() }]);
  await page.emulateMedia({ colorScheme: theme });
}

/** How many lines an element's text runs to. */
async function lineCount(page: Page, selector: string) {
  const element = page.locator(selector).first();
  // A production build streams the page into a hidden holder first; measure it once shown.
  await expect(element).toBeVisible();
  return element.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [...range.getClientRects()].filter((r) => r.width > 0.5).map((r) => r.top);
    return new Set(tops.map((t) => Math.round(t / 4))).size;
  });
}

test.describe("the homepage's readings button between 980 and 1040 wide", () => {
  for (const width of [980, 1024]) {
    test(`keeps its label on one line at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const button = page.locator(".vf-home-readings-go .vf-btn");
      await expect(button).toBeVisible();
      expect(await lineCount(page, ".vf-home-readings-go .vf-btn")).toBe(1);
      expect((await button.boundingBox())!.height).toBeLessThanOrEqual(45);
    });
  }
});

test("a field marked invalid shows the focus ring when it has focus, in the dark theme", async ({
  page,
}) => {
  await page.goto("/login");
  await useTheme(page, "dark");
  await page.goto("/login?error=invalid");
  await page.locator("#password").focus();
  const ring = await page
    .locator("#password")
    .evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineWidth]);
  expect(ring).toEqual(["solid", "2px"]);
});

test("a chosen filter carries a light edge in the dark theme", async ({ page }) => {
  await page.goto("/rites");
  await useTheme(page, "dark");
  await page.goto("/rites");
  const edge = await page
    .locator(".vf-filter-active")
    .first()
    .evaluate((el) => getComputedStyle(el).borderTopColor);
  // var(--link) in the dark theme: 7.5:1 against the page, where the blue fill is 2.7:1.
  expect(edge).toBe("rgb(169, 193, 242)");
});

test.describe("a phone with enlarged text", () => {
  test("keeps VIA FIDEI on one line beside the search button at 320 and 200%", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await enlargeText(page, 200);
    await page.goto("/prayers");
    expect(await lineCount(page, ".vf-header-bar .vf-wordmark")).toBe(1);
  });

  test("sets Get directions at the size of Share and Favorite beside it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await enlargeText(page, 200);
    await page.goto("/parishes");
    const href = await page.locator(".vf-entry-title a").first().getAttribute("href");
    await page.goto(href!);
    const sizes = await page
      .locator(".vf-detail-actions .vf-btn")
      .evaluateAll((buttons) => buttons.map((b) => getComputedStyle(b).fontSize));
    expect(sizes.length).toBeGreaterThan(1);
    expect(new Set(sizes).size).toBe(1);
  });

  test("shows a failed sign-up's message on screen with the field it marks", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await enlargeText(page, 200);
    await page.goto("/register?error=exists");
    await expect(page.locator("#email")).toBeFocused();
    await page.waitForTimeout(300);
    const seen = await page.evaluate(() => {
      const header = document.querySelector("header")!.getBoundingClientRect().bottom;
      const inView = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.top >= header - 1 && r.bottom <= innerHeight + 1;
      };
      return [
        inView(document.querySelector("#register-error")!),
        inView(document.querySelector("#email")!),
      ];
    });
    expect(seen).toEqual([true, true]);
  });

  test("keeps an opened event's title at least the size of its text", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await enlargeText(page, 200);
    await page.goto("/history");
    await page.locator(".vf-timeline-summary").first().click();
    const [title, body] = await page.evaluate(() =>
      [
        ".vf-timeline-event[open] .vf-timeline-title",
        ".vf-timeline-event[open] .vf-timeline-body",
      ].map((s) => parseFloat(getComputedStyle(document.querySelector(s)!).fontSize)),
    );
    expect(title).toBeGreaterThan(body);
  });
});

test("never breaks 33-Day at its hyphen in a card's title", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/guides?page=2");
  const held = page.locator(".vf-entry-title span.whitespace-nowrap", { hasText: "33-Day" });
  await expect(held).toHaveCount(1);
  expect(await lineCount(page, ".vf-entry-title span.whitespace-nowrap >> text=33-Day")).toBe(1);
});

test("balances the forgot-password lede", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/forgot-password");
  const widths = await page.locator(".vf-account-lede").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines: Record<number, number> = {};
    for (const r of range.getClientRects())
      lines[Math.round(r.top)] = (lines[Math.round(r.top)] ?? 0) + r.width;
    return Object.values(lines);
  });
  if (widths.length > 1) expect(Math.min(...widths) / Math.max(...widths)).toBeGreaterThan(0.6);
});

test("keeps the church history pager on one row at 320 wide", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/history?page=13");
  const rows = await page
    .locator(".vf-history-pager li:not(.vf-history-pager-gap)")
    .evaluateAll(
      (items) => new Set(items.map((li) => Math.round(li.getBoundingClientRect().top / 10))).size,
    );
  expect(rows).toBe(1);
});

test("keeps the church history year readout inside the page at 320 wide and 300% text", async ({
  page,
}) => {
  await enlargeText(page, 300);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/history");
  const readout = page.locator(".vf-history-readout");
  await expect(readout).toBeVisible();
  // Every era's name is laid out in the readout's one cell, so its widest is measured here.
  const [scroll, client] = await readout.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});
