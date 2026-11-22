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

  test("a prayer with a line no voice can say is told at once, plays nothing, and keeps focus", async ({
    page,
  }) => {
    // The playlist marks the line missing (the voice engine failed it in both voices).
    const LINE = "/audio/silence-700.m4a";
    const fetched: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(LINE)) fetched.push(request.url());
    });
    await page.route("**/api/pray-along?**", (route: Route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          title: "Hail Mary",
          lang: "en",
          voice: "female",
          total: 2,
          ready: 1,
          missing: 1,
          items: [
            { type: "clip", url: LINE, ready: true },
            { type: "pause", ms: 300 },
            {
              type: "clip",
              url: "/api/pray-along/clip/" + "0".repeat(40),
              ready: false,
              missing: true,
            },
          ],
        }),
      }),
    );
    await open(page, "/prayers/hail-mary");
    const button = page.getByRole("button", { name: /^Pray along: / });
    await button.focus();
    await page.keyboard.press("Enter");
    // Said in the status region at once (well inside the 2-minute wait it replaces).
    await expect(status(page)).toHaveText(
      "This prayer cannot be prayed aloud, because part of its audio could not be made.",
      { timeout: 5_000 },
    );
    // Nothing is under way: no Stop or speed; the megaphone keeps focus and its name.
    await expect(page.getByRole("button", { name: /^Stop praying along/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Speed / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Pray along: / })).toBeFocused();
    // None of the prayer was played, not even the line that was ready.
    expect(fetched).toEqual([]);
  });

  test("a pause while the next part is being made does not count against the wait", async ({
    page,
  }) => {
    // The page's clock can jump five minutes, far past the player's two-minute wait.
    await page.clock.install();
    let made = false;
    let asks = 0;
    await page.route("**/api/pray-along?**", (route: Route) => {
      asks += 1;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          title: "Hail Mary",
          lang: "en",
          voice: "female",
          total: 2,
          ready: made ? 2 : 1,
          items: [
            { type: "clip", url: CLIP, ready: true },
            { type: "pause", ms: 300 },
            { type: "clip", url: "/audio/silence-700.m4a", ready: made },
          ],
        }),
      });
    });
    // The wait's silence loads slowly, as on a slow phone network, so Pause is pressed
    // while it is still starting: the browser then cuts its play() short (AbortError),
    // which is a pause, not "The audio could not be played."
    let slowSilences = 0;
    await page.route("**/audio/silence-1100.m4a", async (route: Route) => {
      slowSilences += 1;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await open(page, "/prayers/hail-mary");
    await page.getByRole("button", { name: /^Pray along: / }).click();
    await expect(status(page)).toHaveText("The next part is being prepared…", { timeout: 15_000 });
    await page.getByRole("button", { name: /^Pause praying along: / }).click();
    await expect(status(page)).toHaveText("Paused.");
    // Still paused once the silence has arrived, not ended with an error.
    await page.waitForTimeout(2_000);
    expect(slowSilences).toBeGreaterThan(0);
    await expect(status(page)).toHaveText("Paused.");
    const before = await page.evaluate(() => Date.now());
    await page.clock.fastForward("05:00");
    // The page's own clock moved the five minutes, so the player sees them.
    expect((await page.evaluate(() => Date.now())) - before).toBeGreaterThanOrEqual(300_000);
    await page.getByRole("button", { name: /^Resume praying along: / }).click();
    // It asks again and is still waiting: the five minutes paused were not waited.
    const asked = asks;
    await expect.poll(() => asks, { timeout: 15_000 }).toBeGreaterThan(asked);
    await expect(status(page)).toHaveText("The next part is being prepared…");
    // The part is made: it plays, and the prayer is prayed to its end.
    made = true;
    await expect(status(page)).toHaveText("Finished.", { timeout: 20_000 });
    await expect(page.getByRole("button", { name: /^Pray along: / })).toBeVisible();
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
