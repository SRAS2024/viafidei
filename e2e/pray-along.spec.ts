import { expect, test, type Page, type Route } from "@playwright/test";

// The pray-along megaphone in a real browser, for a VoiceOver user: a named button
// that starts nothing until pressed, Stop beside it while praying, each change said in
// a status region, focus never dropped, keyboard operation, and the clips played in
// order. The playlist is answered here with the site's own silent clips, so the test
// exercises the player and the page without the voice engine.

const CLIP = "/audio/silence-300.m4a";

/** Answers /api/pray-along with a playlist of `clips` short clips and a pause. */
async function stubPlaylist(page: Page, clips = 2, title = "Hail Mary") {
  const asked: string[] = [];
  await page.route("**/api/pray-along?**", async (route: Route) => {
    asked.push(route.request().url());
    const items = [];
    for (let i = 0; i < clips; i++) {
      if (i > 0) items.push({ type: "pause", ms: 300 });
      items.push({ type: "clip", url: CLIP, ready: true });
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        title,
        lang: "en",
        voice: "female",
        total: clips,
        ready: clips,
        items,
      }),
    });
  });
  return asked;
}

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  test.skip((response?.status() ?? 500) >= 400, "not published here");
  const title = await page.locator("h1").first().textContent();
  test.skip(/not found/i.test(title ?? ""), "not published here");
}

const status = (page: Page) => page.locator(".vf-pray-along [role='status']").first();

test.describe("pray along", () => {
  test("a prayer's megaphone prays it, says each change, and keeps focus", async ({ page }) => {
    const asked = await stubPlaylist(page);
    await open(page, "/prayers/hail-mary");
    const button = page.getByRole("button", { name: /^Pray along: / });
    await expect(button).toBeVisible();
    // Nothing plays until it is pressed.
    expect(asked).toHaveLength(0);

    await button.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: /^(Pause|Stop) praying along: / }).first(),
    ).toBeVisible();
    await expect.poll(() => asked.length).toBeGreaterThan(0);
    expect(new URL(asked[0]!).searchParams.get("kind")).toBe("prayer");
    expect(new URL(asked[0]!).searchParams.get("slug")).toBe("hail-mary");

    // The silent clips end in about a second: the prayer finishes and says so.
    await expect(status(page)).toHaveText("Finished.", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^Stop praying along/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Pray along: / })).toBeFocused();
  });

  test("Stop ends the prayer and returns focus to the megaphone", async ({ page }) => {
    await stubPlaylist(page, 40);
    await open(page, "/prayers/hail-mary");
    await page.getByRole("button", { name: /^Pray along: / }).click();
    const stop = page.getByRole("button", { name: /^Stop praying along: / });
    await expect(stop).toBeVisible();
    await stop.focus();
    await page.keyboard.press(" ");
    await expect(status(page)).toHaveText("Stopped.");
    await expect(page.getByRole("button", { name: /^Pray along: / })).toBeFocused();
  });

  test("pause and resume are named and said", async ({ page }) => {
    await stubPlaylist(page, 40);
    await open(page, "/prayers/hail-mary");
    await page.getByRole("button", { name: /^Pray along: / }).click();
    const pause = page.getByRole("button", { name: /^Pause praying along: / });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(status(page)).toHaveText("Paused.");
    await page.getByRole("button", { name: /^Resume praying along: / }).click();
    await expect(page.getByRole("button", { name: /^Pause praying along: / })).toBeVisible();
    await page.getByRole("button", { name: /^Stop praying along: / }).click();
  });

  test("a novena day's megaphone appears beside the day once it is open", async ({ page }) => {
    const asked = await stubPlaylist(page);
    await open(page, "/novenas/divine-mercy-novena");
    const day = page.locator(".vf-disclosure-trigger").first();
    await expect(day).toBeVisible();
    await expect(page.locator(".vf-disclosure-action")).toHaveCount(0);
    // Pressed from the keyboard, as VoiceOver presses it (Safari focuses no button on a
    // mouse click, so a click would not show whether focus survives the opening).
    await day.focus();
    await page.keyboard.press("Enter");
    // Opening did not move focus off the day.
    await expect(day).toBeFocused();
    const action = page
      .locator(".vf-disclosure-action")
      .getByRole("button", { name: /^Pray along: / });
    await expect(action).toBeVisible();
    await action.click();
    await expect.poll(() => asked.length).toBeGreaterThan(0);
    expect(new URL(asked[0]!).searchParams.get("day")).toBe("1");
    await page.getByRole("button", { name: /^Stop praying along: / }).click();
  });

  test("the Rosary's megaphone follows the set of mysteries shown", async ({ page }) => {
    const asked = await stubPlaylist(page);
    await open(page, "/guides/how-to-pray-the-rosary");
    const head = page.locator(".vf-mysteries-head");
    await expect(head.getByRole("button", { name: /^Pray along: / })).toBeVisible();
    await page
      .locator(".vf-mysteries-picker")
      .getByRole("button", { name: /^Luminous/ })
      .click();
    await expect(head.getByRole("button", { name: /Luminous Mysteries$/ })).toBeVisible();
    await head.getByRole("button", { name: /^Pray along: / }).click();
    await expect.poll(() => asked.length).toBeGreaterThan(0);
    expect(new URL(asked[0]!).searchParams.get("set")).toBe("luminous");
    await page.getByRole("button", { name: /^Stop praying along: / }).click();
  });

  test("the meter stands still for a reader who asked for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubPlaylist(page, 40);
    await open(page, "/prayers/hail-mary");
    await page.getByRole("button", { name: /^Pray along: / }).click();
    const bar = page.locator(".vf-pray-along-level i").first();
    await expect(bar).toBeVisible();
    const animation = await bar.evaluate((el) => getComputedStyle(el).animationName);
    expect(["none", ""]).toContain(animation);
    await page.getByRole("button", { name: /^Stop praying along: / }).click();
  });
});
