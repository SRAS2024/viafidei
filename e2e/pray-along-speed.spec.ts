import { expect, test, type Page, type Route } from "@playwright/test";

// The speed button beside Stop, in a real browser: it steps 1x → 1.25x → 1.5x → 1x, the
// audio really plays at that speed, the browser remembers it across visits, and a
// signed-in member's saved speed follows them (and a new choice is saved to their
// account). The playlist is answered here: one short clip, then a clip "being made",
// so the prayer waits (silence playing) long enough to work the speed button.

const CLIP = "/audio/silence-300.m4a";

async function stubPlaylist(page: Page, account: { member: boolean; rate: number | null }) {
  await page.route("**/api/pray-along?**", async (route: Route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        title: "Hail Mary",
        lang: "en",
        voice: "female",
        ...account,
        total: 2,
        ready: 1,
        items: [
          { type: "clip", url: CLIP, ready: true },
          { type: "pause", ms: 300 },
          { type: "clip", url: "/api/pray-along/clip/" + "0".repeat(40), ready: false },
        ],
      }),
    });
  });
}

/** Keeps the player's audio element (it is not in the document) where the test can read it. */
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      (window as unknown as { __vfAudio: HTMLMediaElement }).__vfAudio = this;
      return play.call(this);
    };
  });
}

const audioRate = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __vfAudio?: HTMLMediaElement }).__vfAudio?.playbackRate ?? 0,
  );

async function startPraying(page: Page) {
  const response = await page.goto("/prayers/hail-mary");
  test.skip((response?.status() ?? 500) >= 400, "not published here");
  await page.getByRole("button", { name: /^Pray along: / }).click();
  await expect(page.getByRole("button", { name: /^Stop praying along: / })).toBeVisible();
}

const status = (page: Page) => page.locator(".vf-pray-along [role='status']").first();

test.describe("pray along: speed", () => {
  test("steps 1x → 1.25x → 1.5x → 1x beside Stop, and the audio follows", async ({ page }) => {
    await watchAudio(page);
    await stubPlaylist(page, { member: false, rate: null });
    await startPraying(page);
    const speed = page.getByRole("button", { name: "Speed 1x" });
    await expect(speed).toHaveText("1x");
    // Right of Stop, on the same line.
    const stopBox = await page.getByRole("button", { name: /^Stop praying along: / }).boundingBox();
    const speedBox = await speed.boundingBox();
    expect(speedBox!.x).toBeGreaterThan(stopBox!.x + stopBox!.width - 1);
    expect(
      Math.abs(speedBox!.y + speedBox!.height / 2 - (stopBox!.y + stopBox!.height / 2)),
    ).toBeLessThan(4);

    await speed.click();
    await expect(page.getByRole("button", { name: "Speed 1.25x" })).toHaveText("1.25x");
    await expect(status(page)).toHaveText("Speed 1.25x");
    await expect.poll(() => audioRate(page)).toBe(1.25);
    await page.getByRole("button", { name: "Speed 1.25x" }).click();
    await expect.poll(() => audioRate(page)).toBe(1.5);
    await page.getByRole("button", { name: "Speed 1.5x" }).click();
    await expect(page.getByRole("button", { name: "Speed 1x" })).toBeVisible();
    await expect.poll(() => audioRate(page)).toBe(1);
  });

  test("works from the keyboard", async ({ page }) => {
    await stubPlaylist(page, { member: false, rate: null });
    await startPraying(page);
    const speed = page.getByRole("button", { name: "Speed 1x" });
    await speed.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Speed 1.25x" })).toBeFocused();
    await page.keyboard.press(" ");
    await expect(page.getByRole("button", { name: "Speed 1.5x" })).toBeFocused();
  });

  test("this browser remembers the last speed on the next visit", async ({ page }) => {
    await watchAudio(page);
    await stubPlaylist(page, { member: false, rate: null });
    await startPraying(page);
    await page.getByRole("button", { name: "Speed 1x" }).click();
    await expect(page.getByRole("button", { name: "Speed 1.25x" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /^Pray along: / }).click();
    await expect(page.getByRole("button", { name: "Speed 1.25x" })).toBeVisible();
    await expect.poll(() => audioRate(page)).toBe(1.25);
  });

  test("a member's saved speed follows them, and a new choice is saved to the account", async ({
    page,
  }) => {
    const saved: unknown[] = [];
    await page.route("**/api/profile", async (route: Route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      saved.push(route.request().postDataJSON());
      await route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
    });
    // This browser last chose 1.25x; the member's account says 1.5x.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vf-pray-along-rate", "1.25");
      } catch {
        // ignore
      }
    });
    await watchAudio(page);
    await stubPlaylist(page, { member: true, rate: 1.5 });
    await startPraying(page);
    await expect(page.getByRole("button", { name: "Speed 1.5x" })).toBeVisible();
    await expect.poll(() => audioRate(page)).toBe(1.5);
    await page.getByRole("button", { name: "Speed 1.5x" }).click();
    await expect(page.getByRole("button", { name: "Speed 1x" })).toBeVisible();
    await expect.poll(() => saved, { timeout: 10_000 }).toEqual([{ audioRate: 1 }]);
  });
});
