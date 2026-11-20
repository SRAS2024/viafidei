import { expect, test } from "@playwright/test";

// The whole chain with real audio, no stubs: the page's megaphone asks the server for the
// playlist, the server serves clips the voice engine made, and the browser plays them
// through to "Finished.". Opt-in (E2E_REAL_AUDIO=1): it needs the Hail Mary's clips made
// by voice-engine/worker.py in the database the server reads.

test.skip(!process.env.E2E_REAL_AUDIO, "needs clips made by the voice engine (E2E_REAL_AUDIO=1)");

test("the Hail Mary is prayed aloud, from the Sign of the Cross to the Sign of the Cross", async ({
  page,
}) => {
  // Count the seconds of recorded prayer the audio element really plays (its clock, not
  // ours): the player's element is not in the document, so watch it from play().
  await page.addInitScript(() => {
    const w = window as unknown as { __vfPlayed: number };
    w.__vfPlayed = 0;
    const watched = new WeakSet<HTMLMediaElement>();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!watched.has(this)) {
        watched.add(this);
        let src = "";
        let last = 0;
        this.addEventListener("timeupdate", () => {
          if (this.currentSrc !== src) {
            src = this.currentSrc;
            last = this.currentTime;
            return;
          }
          if (src.includes("/api/pray-along/clip/") && this.currentTime > last) {
            w.__vfPlayed += this.currentTime - last;
          }
          last = this.currentTime;
        });
      }
      return play.call(this);
    };
  });
  const clips: number[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/api/pray-along/clip/")) clips.push(res.status());
  });
  await page.goto("/prayers/hail-mary");
  await page.getByRole("button", { name: /^Pray along: / }).click();
  const status = page.locator(".vf-pray-along [role='status']").first();
  await expect(status).toHaveText("Praying along.", { timeout: 30_000 });
  // Sign of the Cross (~4 s) + Hail Mary (~15 s) + Sign of the Cross, with pauses between.
  await expect(status).toHaveText("Finished.", { timeout: 60_000 });
  const played = await page.evaluate(() => (window as unknown as { __vfPlayed: number }).__vfPlayed);
  expect(played).toBeGreaterThan(15);
  expect(clips.length).toBeGreaterThan(0);
  expect(clips.every((s) => s === 200 || s === 206)).toBe(true);
});
