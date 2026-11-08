import { expect, test, type Page } from "@playwright/test";

// A client navigation that has gone half a second without moving the address says it is
// loading, once, in the one status in the layout, and clears when the page arrives. One
// that lands at once says nothing but its title, which Next's route announcer speaks.
// Safari's engine is the one that matters most:
// E2E_WEBKIT=1 npx playwright test e2e/navigation-pending.spec.ts --project=webkit

const READINGS = "main a[href^='/liturgy/readings?date']";
const SAID = "vf-e2e-navigation-pending";

// Room for the safety net's eight seconds on a slow server, and the page after them.
test.describe.configure({ timeout: 60_000 });

/**
 * Everything the status says from now on, in order, an empty string when it clears. The
 * tab's session storage keeps a copy, because a page the router never commits arrives as
 * a new document: the safety net in watch-navigation.ts loads it itself after 8 s, which
 * Playwright's WebKit sometimes needs on a held response.
 */
async function listen(page: Page) {
  await page.evaluate((key) => {
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    sessionStorage.setItem(key, "[]");
    const status = document.querySelector('[data-testid="navigation-pending"]')!;
    new MutationObserver(() => {
      said.push(status.textContent ?? "");
      sessionStorage.setItem(key, JSON.stringify(said));
    }).observe(status, { subtree: true, childList: true, characterData: true });
  }, SAID);
}

/** What the status has said, and whether the page arrived as a new document. */
const heard = (page: Page) =>
  page.evaluate((key) => {
    const said = (window as unknown as { __said?: string[] }).__said;
    return {
      said: said ?? (JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[]),
      newDocument: said === undefined,
    };
  }, SAID);

/**
 * The status said it was loading, once, and is clear now the page is in. A page the safety
 * net loaded is a new document whose status starts out empty, so the old one may have gone
 * before it cleared its own.
 */
async function expectSaidOnceThenCleared(page: Page) {
  await expect(page.getByTestId("navigation-pending")).toHaveText("");
  const { said, newDocument } = await heard(page);
  if (newDocument) {
    test.info().annotations.push({
      type: "safety net",
      description: "The router never committed the held page, so it came as a new document.",
    });
    expect([["Loading"], ["Loading", ""]]).toContainEqual(said);
  } else {
    expect(said).toEqual(["Loading", ""]);
  }
}

async function readyToFollow(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const link = page.locator(READINGS).first();
  // A pointer or the focus over a link prefetches it, as it does for a reader.
  await link.hover();
  await page.waitForTimeout(1000);
  await listen(page);
  await link.focus();
}

/** Holds back the page itself, not its prefetch, as a slow connection would. */
async function slowPages(page: Page) {
  await page.route(/_rsc=/, async (route) => {
    if (!(await route.request().headerValue("next-router-prefetch"))) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    await route.continue();
  });
}

/** Opens the theme menu on /history and listens from there. */
async function readyToChooseTheme(page: Page) {
  await page.goto("/history");
  await page.waitForLoadState("networkidle");
  await page.locator(".vf-history-menu > summary").click();
  await listen(page);
}

test("says it is loading while a slow page has not moved the address, then clears", async ({
  page,
}) => {
  await readyToFollow(page);
  const start = page.url();
  await slowPages(page);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  // Where the router puts the page's own placeholder up at once, the address moves with
  // it, and the placeholder says it is loading instead.
  const placeholderShown = page.url() !== start;
  if (!placeholderShown) {
    await expect(page.getByTestId("navigation-pending")).toHaveText("Loading");
  }
  await expect(page).toHaveURL(/\/liturgy\/readings\?date=/, { timeout: 20_000 });
  if (placeholderShown) {
    await expect(page.getByTestId("navigation-pending")).toHaveText("");
    expect((await heard(page)).said).toEqual([]);
  } else {
    await expectSaidOnceThenCleared(page);
  }
});

// /history has no placeholder, so that it works with no script, and a choice of theme
// keeps the old list on screen until the new one is in.
test("says it is loading once over a slow change of view on /history", async ({ page }) => {
  await readyToChooseTheme(page);
  await slowPages(page);
  await page.locator(".vf-history-menu a", { hasText: "Councils" }).click();
  await page.waitForTimeout(1200);
  await expect(page).not.toHaveURL(/theme=councils/);
  await expect(page.getByTestId("navigation-pending")).toHaveText("Loading");
  await expect(page).toHaveURL(/theme=councils/, { timeout: 20_000 });
  await expectSaidOnceThenCleared(page);
});

// The way the tests above can end in Playwright's WebKit, made certain: the page itself
// never answers, so the safety net loads it, and the status has still said it only once.
test("says it is loading once over a page the router never commits", async ({ page }) => {
  await readyToChooseTheme(page);
  // Prefetches and the full page load still answer.
  await page.route(/_rsc=/, async (route) => {
    if (await route.request().headerValue("next-router-prefetch")) await route.continue();
  });
  await page.locator(".vf-history-menu a", { hasText: "Councils" }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("navigation-pending")).toHaveText("Loading");
  await expect(page).toHaveURL(/theme=councils/, { timeout: 30_000 });
  await expectSaidOnceThenCleared(page);
  expect((await heard(page)).newDocument).toBe(true);
});

test("says nothing more for a page that lands at once", async ({ page }) => {
  await readyToFollow(page);
  await page.evaluate(() => {
    const from = location.href;
    const started = performance.now();
    const look = setInterval(() => {
      if (location.href === from) return;
      clearInterval(look);
      (window as unknown as { __landed: number }).__landed = performance.now() - started;
    }, 5);
  });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/liturgy\/readings\?date=/, { timeout: 20_000 });
  await page.waitForTimeout(1000);
  // A page that came as a new document was loaded by the safety net, eight seconds on.
  const landed = await page.evaluate(
    () => (window as unknown as { __landed?: number }).__landed ?? Number.POSITIVE_INFINITY,
  );
  test.skip(
    landed > 400,
    Number.isFinite(landed)
      ? `The page took ${Math.round(landed)} ms here, too long to be a quick one.`
      : "The safety net loaded the page here, too late to be a quick one.",
  );
  expect((await heard(page)).said).toEqual([]);
});
