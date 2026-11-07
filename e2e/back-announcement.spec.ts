import { expect, test, type Page } from "@playwright/test";

// What only a production build shows: there, Next uses a prefetch of the page for a move
// within the page, and that move used to empty the router's cache. So Back fetched the page
// again, with a blank title, and the route announcer spoke twice. Safari's engine is the
// one that matters most: E2E_WEBKIT=1 npx playwright test e2e/back-announcement.spec.ts --project=webkit

/** Records what the route announcer says, what the title goes through, and what is fetched. */
async function watch(page: Page) {
  await page.addInitScript(() => {
    const seen = { said: [] as string[], titles: [] as string[], fetched: [] as string[] };
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    const fetch = window.fetch;
    window.fetch = function (...args) {
      const url = String(args[0] instanceof Request ? args[0].url : args[0]);
      const headers = (args[1]?.headers ?? {}) as Record<string, string>;
      if (url.includes("_rsc") && !headers["next-router-prefetch"]) seen.fetched.push(url);
      return fetch.apply(this, args);
    };
    addEventListener("DOMContentLoaded", () => {
      let title = document.title;
      setInterval(() => {
        if (document.title !== title) seen.titles.push((title = document.title));
        const announcer = document.querySelector("next-route-announcer")?.shadowRoot?.firstChild;
        if (announcer && !(announcer as { watched?: boolean }).watched) {
          (announcer as { watched?: boolean }).watched = true;
          new MutationObserver(() => seen.said.push(announcer.textContent ?? "")).observe(
            announcer,
            { subtree: true, childList: true, characterData: true },
          );
        }
      }, 5);
    });
  });
}

/** What has been seen since the last time of asking. */
function seenSince(page: Page) {
  return page.evaluate(() => {
    const { __seen: seen } = window as unknown as {
      __seen: { said: string[]; titles: string[]; fetched: string[] };
    };
    return {
      said: seen.said.splice(0),
      titles: seen.titles.splice(0),
      fetched: seen.fetched.splice(0),
    };
  });
}

test("Back to a list says its title once, with nothing fetched and no blank title", async ({
  page,
}) => {
  await watch(page);
  await page.goto("/saints");
  await page.waitForLoadState("networkidle");
  const pageTwo = page.locator('main nav a[aria-label="Page 2"]').first();
  test.skip((await pageTwo.count()) === 0, "needs a second page of saints");
  const before = await page.title();

  await pageTwo.click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => page.title()).not.toBe(before);
  await page.waitForTimeout(300);
  await seenSince(page);

  await page.goBack();
  await expect(page).toHaveTitle(before);
  await page.waitForTimeout(500);
  const back = await seenSince(page);
  expect(back.said).toEqual([before]);
  expect(back.titles).toEqual([before]);
  expect(back.fetched).toEqual([]);
});

test("Back to a page the router cannot hold still says its title once", async ({ page }) => {
  await watch(page);
  await page.goto("/saints");
  await page.waitForLoadState("networkidle");
  const pageTwo = page.locator('main nav a[aria-label="Page 2"]').first();
  test.skip((await pageTwo.count()) === 0, "needs a second page of saints");
  const before = await page.title();

  await pageTwo.click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await seenSince(page);

  await page.goBack();
  await expect(page).toHaveTitle(before);
  await page.waitForTimeout(500);
  const back = await seenSince(page);
  expect(back.said).toEqual([before]);
  expect(back.titles).toEqual([before]);
});
