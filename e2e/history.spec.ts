import { expect, test } from "@playwright/test";

// What jsdom cannot check on /history: that the page is usable with no script at
// all, that its rows open natively, that a change of view keeps the old list and
// the live region in place, and that the slider's list follows it.

const row = (slug: string) => `#history-event-${slug}`;

test.describe("with JavaScript", () => {
  test("shows one page of events, with its first event on the first screen", async ({ page }) => {
    await page.goto("/history");
    await expect(page.locator("details.vf-timeline-event")).toHaveCount(60);
    await expect(page.locator("#history-status")).toContainText("Showing 60 of");
    const first = page.locator(row("pentecost"));
    await expect(first).toBeVisible();
    const box = await first.boundingBox();
    expect(box?.y).toBeLessThan(page.viewportSize()?.height ?? 0);
  });

  test("keeps the same live region through a change of view", async ({ page }) => {
    await page.goto("/history");
    const status = page.locator("#history-status");
    // Wait for the page to take over its links, or this is a full page load.
    await page.waitForLoadState("networkidle");
    await status.evaluate((node) => node.setAttribute("data-same", "yes"));
    await page.locator(".vf-history-menu > summary").click();
    await page.locator(".vf-history-menu a", { hasText: "Councils" }).click();
    await expect(page).toHaveURL(/theme=councils/);
    await expect(status).not.toContainText("1,5");
    // A live region is only announced if it is the same element, changed.
    await expect(status).toHaveAttribute("data-same", "yes");
  });

  test("moves the list a moment after the slider's last key", async ({ page, isMobile }) => {
    test.skip(isMobile, "The arrow keys are a keyboard's.");
    await page.goto("/history");
    const slider = page.getByRole("slider");
    await slider.focus();
    await slider.press("ArrowRight");
    await slider.press("Shift+ArrowRight");
    await expect(slider).toHaveValue("39");
    await expect(page).toHaveURL(/year=39/, { timeout: 15_000 });
    await expect(slider).toBeFocused();
    await expect(page.locator(".vf-timeline-current")).toBeVisible();
  });

  test("gives an old link to an event the page that holds it, with the row open", async ({
    page,
  }) => {
    await page.goto(`/history${row("first-vatican-council")}`);
    await expect(page).toHaveURL(/event=first-vatican-council/, { timeout: 15_000 });
    await expect(page.locator(row("first-vatican-council"))).toHaveAttribute("open", "");
  });

  test("never scrolls sideways", async ({ page }) => {
    for (const path of ["/history", "/history?era=post-conciliar", "/history?q=nicaea"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("shows the events, never a loading placeholder", async ({ page }) => {
    await page.goto("/history");
    await expect(page.locator(row("pentecost"))).toBeVisible();
    await expect(page.getByTestId("tab-loading")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("opens a row", async ({ page }) => {
    await page.goto("/history");
    await page.locator(`${row("pentecost")} > summary`).click();
    await expect(page.locator(row("pentecost"))).toContainText("Historical context");
    await expect(page.locator(row("pentecost")).getByRole("link").first()).toBeVisible();
  });

  test("filters, pages and searches by plain links and forms", async ({ page }) => {
    await page.goto("/history");
    await page.locator(".vf-history-menu > summary").click();
    await page.locator(".vf-history-menu a", { hasText: "Councils" }).click();
    await expect(page).toHaveURL(/theme=councils/);
    await expect(page.locator("#history-status")).toContainText("Showing");

    await page.locator(".vf-history-order a", { hasText: "Newest first" }).click();
    await expect(page).toHaveURL(/theme=councils&order=newest/);

    await page.locator("#list-search-history").fill("Lateran");
    await page.locator("#list-search-history").press("Enter");
    await expect(page).toHaveURL(/theme=councils&order=newest&q=Lateran/);
  });

  test("reaches a typed year, landing on its row", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("slider")).toBeHidden();
    await page.locator("#history-year-input").fill("1054");
    await page.locator(".vf-history-goto button").click();
    await expect(page).toHaveURL(/year=1054#history-year-target$/);
    await expect(page.locator(".vf-timeline-current")).toBeInViewport();
  });
});
