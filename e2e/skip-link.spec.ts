import { expect, test, type Page } from "@playwright/test";

// The skip link takes the focus to <main> without a history entry of its own. One that
// made an entry broke Back: Next ignores a Back onto an entry it did not make, so after
// one more page Back changed the address and left that page on screen, and the safety
// net then loaded it again. Safari's engine is the one that matters most:
// E2E_WEBKIT=1 npx playwright test e2e/skip-link.spec.ts --project=webkit

/** WebKit reaches links by keyboard only with Option-Tab, as Safari does by default. */
const tab = (browserName: string) => (browserName === "webkit" ? "Alt+Tab" : "Tab");

async function mainAgainstHeader(page: Page) {
  return page.evaluate(() => ({
    mainTop: document.getElementById("main-content")!.getBoundingClientRect().top,
    headerBottom: document.querySelector("header")!.getBoundingClientRect().bottom,
  }));
}

test.describe("skip link", () => {
  test.skip(({ isMobile }) => isMobile, "The skip link is a keyboard's.");

  for (const { start, link, to } of [
    { start: "/", link: "header nav a[href='/saints']", to: /\/saints$/ },
    { start: "/saints", link: "header nav a[href='/prayers']", to: /\/prayers$/ },
    { start: "/saints", link: "main nav a[aria-label='Page 2']", to: /\/saints\?page=2$/ },
  ]) {
    test(`leaves Back working after a move from ${start} by ${link}`, async ({
      page,
      browserName,
    }) => {
      await page.goto(start);
      await page.waitForLoadState("networkidle");
      test.skip((await page.locator(link).count()) === 0, "needs a second page of saints");
      const entries = await page.evaluate(() => history.length);
      const loadedAt = await page.evaluate(() => performance.timeOrigin);
      const title = await page.title();
      const heading = await page.locator("h1").first().textContent();

      await page.keyboard.press(tab(browserName));
      await expect(page.locator(".vf-skip-link")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("#main-content")).toBeFocused();
      expect(new URL(page.url()).hash).toBe("");
      expect(await page.evaluate(() => history.length)).toBe(entries);
      const { mainTop, headerBottom } = await mainAgainstHeader(page);
      expect(mainTop).toBeGreaterThanOrEqual(headerBottom - 1);

      await page.locator(link).first().click();
      await expect(page).toHaveURL(to);
      await expect(page).not.toHaveTitle(title);
      const nextTitle = await page.title();

      await page.goBack();
      await expect(page).toHaveTitle(title);
      await expect(page.locator("h1").first()).toHaveText(heading ?? "");
      // The safety net under every navigation waits 8 seconds: it must not take the
      // reader forward again once that time has passed.
      await page.waitForTimeout(9_000);
      await expect(page).toHaveTitle(title);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(loadedAt);

      await page.goForward();
      await expect(page).toHaveURL(to);
      await expect(page).toHaveTitle(nextTitle);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(loadedAt);
    });
  }

  test("lands clear of the header from further down the page", async ({ page }) => {
    await page.goto("/saints");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.locator(".vf-skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    const { mainTop, headerBottom } = await mainAgainstHeader(page);
    expect(mainTop).toBeGreaterThanOrEqual(headerBottom - 1);
    expect(mainTop).toBeLessThan(headerBottom + 40);
  });
});

test.describe("skip link without script", () => {
  test.use({ javaScriptEnabled: false });
  test.skip(({ isMobile }) => isMobile, "The skip link is a keyboard's.");

  test("still jumps to the main content", async ({ page, browserName }) => {
    await page.goto("/saints");
    await page.keyboard.press(tab(browserName));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });
});
