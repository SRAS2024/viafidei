import { expect, test, type Page } from "@playwright/test";

// The day the site shows, in a browser: it is the visitor's own, it stays so across
// midnight without moving anything under a reader, it gives way to what the visitor
// presses, and a date typed by hand is only believed once it is whole. The timezones
// are chosen so the device's date differs from the server's UTC one whatever the hour.

function visitorWhoseDateDiffers(): { timezoneId: string; date: string } {
  const timezoneId = new Date().getUTCHours() < 10 ? "Pacific/Honolulu" : "Pacific/Kiritimati";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { timezoneId, date };
}

test.describe("the readings page finds the visitor's own date", () => {
  const { timezoneId, date } = visitorWhoseDateDiffers();
  test.use({ timezoneId });
  // Hydration and the router's request, then the fallback's two seconds if it comes to that.
  test.setTimeout(45_000);
  const arrival = { timeout: 15_000 };

  test("by the router, in the ordinary way", async ({ page }) => {
    await page.goto("/liturgy/readings");
    await expect(page).toHaveURL(new RegExp(`\\?date=${date}$`), arrival);
  });

  test("even when the router never commits the new page", async ({ page }) => {
    // What the failure looks like from outside: WebKit has been seen to ask for the
    // page and then do nothing with it, with no error. The address must still change.
    await page.route("**/liturgy/readings?date=*", async (route) => {
      const request = route.request();
      if (request.isNavigationRequest()) await route.continue();
    });
    await page.goto("/liturgy/readings");
    await expect(page).toHaveURL(new RegExp(`\\?date=${date}$`), arrival);
    await expect(page.locator(".vf-detail-subtitle")).toBeVisible();
  });

  test("and keeps what else was asked for", async ({ page }) => {
    await page.goto("/liturgy/readings?mass=vigil");
    await expect(page).toHaveURL(new RegExp(`\\?date=${date}&mass=vigil$`), arrival);
  });

  for (const unusable of ["2026-02-30", "garbage", "0002-03-21", "9999-12-31"]) {
    test(`when the date it was given is ${unusable}`, async ({ page }) => {
      await page.goto(`/liturgy/readings?date=${unusable}`);
      await expect(page).toHaveURL(new RegExp(`\\?date=${date}$`), arrival);
    });
  }
});

test("the last day of the calendar's years opens with its Vigil", async ({ page }) => {
  await page.goto("/liturgy/readings?date=2099-12-31&mass=vigil");
  await expect(page.locator("article h1")).toHaveText("Vigil of Mary, the Holy Mother of God");
});

test.describe("a tab left open across midnight", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  const SATURDAY_NIGHT = new Date("2026-11-08T07:59:00Z"); // 23:59 on Saturday, November 7

  test("the homepage's day moves on", async ({ page }) => {
    await page.clock.install({ time: SATURDAY_NIGHT });
    await page.goto("/");
    const heading = page.locator("#home-today-title");
    await expect(heading).toHaveText("Saturday, November 7, 2026");
    const readings = page.getByRole("link", { name: "Read today's Mass readings" });
    await expect(readings).toHaveAttribute("href", "/liturgy/readings?date=2026-11-07");
    await expect(page.getByRole("link", { name: /Sunday Vigil/ })).toBeVisible();

    await page.clock.fastForward("02:00");
    await expect(heading).toHaveText("Sunday, November 8, 2026");
    await expect(readings).toHaveAttribute("href", "/liturgy/readings?date=2026-11-08");
    await expect(page.getByRole("link", { name: /Sunday Vigil/ })).toHaveCount(0);
  });

  test("the calendar follows, until the visitor picks a day", async ({ page }) => {
    await page.clock.install({ time: SATURDAY_NIGHT });
    await page.goto("/liturgical-calendar");
    const field = page.getByLabel("Choose a date");
    await expect(field).toHaveValue("2026-11-07");
    await page.clock.fastForward("02:00");
    await expect(field).toHaveValue("2026-11-08");

    await field.fill("2026-12-25");
    await page.clock.fastForward("24:00:00");
    await expect(field).toHaveValue("2026-12-25");
  });
});

test.describe("a readings tab left open across midnight, in a timezone with the server's date", () => {
  test.use({ timezoneId: "UTC" });
  test.setTimeout(45_000);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);

  /** Opened late, and read down to the last reading with focus on a link, as a voice would be. */
  async function readDownThePage(page: Page) {
    await page.clock.install({ time: new Date(`${today}T23:50:00Z`) });
    await page.goto("/liturgy/readings");
    await page.clock.runFor(1000);
    await expect(page.locator(".vf-detail-subtitle")).toBeVisible();
    // The date is read as the page comes to life, so it must have, before the clock jumps.
    await expect.poll(() => page.evaluate(() => history.state?.__NA)).toBe(true);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/liturgy\/readings$/);
    return page.evaluate(() => {
      document.querySelector(".vf-reading-section:last-of-type")?.scrollIntoView();
      document.querySelector<HTMLElement>('a[href="/liturgical-calendar"]')?.focus({
        preventScroll: true,
      });
      return window.scrollY;
    });
  }

  test("stays where the reader is at midnight", async ({ page }) => {
    const y = await readDownThePage(page);
    const subtitle = await page.locator(".vf-detail-subtitle").textContent();
    await page.clock.fastForward("15:00");
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/liturgy\/readings$/);
    await expect(page.locator(".vf-detail-subtitle")).toHaveText(subtitle!);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    await expect(page.locator('a[href="/liturgical-calendar"]')).toBeFocused();
  });

  test("stays there after a moment in another app", async ({ page }) => {
    const y = await readDownThePage(page);
    await page.clock.fastForward("15:00");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.clock.fastForward("02:00");
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/liturgy\/readings$/);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
  });

  test("moves to the new day when the visitor comes back in the morning", async ({ page }) => {
    await readDownThePage(page);
    await page.clock.fastForward("15:00");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.clock.fastForward("08:00:00");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page).toHaveURL(new RegExp(`\\?date=${tomorrow}$`), { timeout: 15_000 });
  });
});

test.describe("a readings tab opened on another date than the server's", () => {
  const { timezoneId, date } = visitorWhoseDateDiffers();
  test.use({ timezoneId });
  test.setTimeout(60_000);
  const arrival = { timeout: 15_000 };

  const dayAfter = (iso: string, days = 1) =>
    new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

  const comeBackTomorrow = async (page: Page) => {
    await page.clock.fastForward("24:00:00");
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
  };

  test("follows the day too, however many days it stays open", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await page.goto("/liturgy/readings");
    await expect(page).toHaveURL(new RegExp(`\\?date=${date}$`), arrival);
    await comeBackTomorrow(page);
    await expect(page).toHaveURL(new RegExp(`\\?date=${dayAfter(date)}$`), arrival);
    await comeBackTomorrow(page);
    await expect(page).toHaveURL(new RegExp(`\\?date=${dayAfter(date, 2)}$`), arrival);
  });

  test("follows it after a reload, and after the page was loaded afresh", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    // The router never answers, so the page gets there by a full load.
    let withheld = true;
    await page.route("**/liturgy/readings?date=*", async (route) => {
      const request = route.request();
      if (withheld && !request.isNavigationRequest()) return;
      await route.continue();
    });
    await page.goto("/liturgy/readings");
    await page.clock.runFor(1000);
    await expect
      .poll(
        async () => {
          await page.clock.runFor(500);
          return page.url();
        },
        { timeout: 15_000 },
      )
      .toMatch(new RegExp(`\\?date=${date}$`));
    await expect(page.locator(".vf-detail-subtitle")).toBeVisible();
    withheld = false;
    await page.clock.runFor(1000);
    await expect.poll(() => page.evaluate(() => history.state?.vfFollowsToday)).toBe(true);

    await page.reload();
    await page.clock.runFor(1000);
    await expect(page.locator(".vf-detail-subtitle")).toBeVisible();
    await comeBackTomorrow(page);
    await expect(page).toHaveURL(new RegExp(`\\?date=${dayAfter(date)}$`), arrival);
  });

  test("but a date the visitor opened stays that date", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await page.goto(`/liturgy/readings?date=${date}`);
    await page.clock.runFor(1000);
    await expect(page.locator(".vf-detail-subtitle")).toBeVisible();
    await comeBackTomorrow(page);
    await page.waitForTimeout(3000);
    await page.clock.runFor(3000);
    await expect(page).toHaveURL(new RegExp(`\\?date=${date}$`));
  });
});

test.describe("today's saints find the visitor's own date", () => {
  const { timezoneId, date } = visitorWhoseDateDiffers();
  test.use({ timezoneId });
  test.setTimeout(60_000);
  const arrival = { timeout: 15_000 };

  const dayAfter = (iso: string, days = 1) =>
    new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const named = (iso: string) => {
    const [, month, day] = iso.split("-").map(Number);
    return new RegExp(`/saints/today\\?month=${month}&day=${day}$`);
  };
  const label = (page: Page) => page.locator(".vf-page-hero-lede");
  const inWords = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T12:00:00Z`));

  const comeBackTomorrow = async (page: Page) => {
    await page.clock.fastForward("24:00:00");
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
  };

  test("by the router, in the ordinary way", async ({ page }) => {
    await page.goto("/saints/today");
    await expect(page).toHaveURL(named(date), arrival);
    await expect(label(page)).toHaveText(inWords(date));
  });

  test("even when the router never commits the new page", async ({ page }) => {
    await page.route("**/saints/today?month=*", async (route) => {
      if (route.request().isNavigationRequest()) await route.continue();
    });
    await page.goto("/saints/today");
    await expect(page).toHaveURL(named(date), arrival);
    await expect(label(page)).toHaveText(inWords(date));
  });

  test("and follows the day in a tab left open, however many days", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await page.goto("/saints/today");
    await expect(page).toHaveURL(named(date), arrival);
    await comeBackTomorrow(page);
    await expect(page).toHaveURL(named(dayAfter(date)), arrival);
    await expect(label(page)).toHaveText(inWords(dayAfter(date)));
    await comeBackTomorrow(page);
    await expect(page).toHaveURL(named(dayAfter(date, 2)), arrival);
    await expect(label(page)).toHaveText(inWords(dayAfter(date, 2)));
  });

  // The list is replaced whole, and WebKit puts the page back at the top as it does,
  // whatever the router was told; a focused card went with the list, in every engine.
  test("and keeps the reader's place in the list as the day moves under them", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await page.clock.install({ time: new Date() });
    await page.goto("/saints/today");
    await expect(page).toHaveURL(named(date), arrival);
    const cards = page.locator("main .vf-entry-link");
    await expect(cards.first()).toBeVisible();
    const last = (await cards.count()) - 1;
    await cards.nth(last).focus();
    await cards.nth(last).evaluate((card) => card.scrollIntoView({ block: "center" }));
    const before = await page.evaluate(() => Math.round(window.scrollY));
    expect(before).toBeGreaterThan(0);
    await comeBackTomorrow(page);
    await expect(page).toHaveURL(named(dayAfter(date)), arrival);
    await expect(label(page)).toHaveText(inWords(dayAfter(date)));
    const after = await page.evaluate(() => {
      const cards = [...document.querySelectorAll<HTMLElement>("main .vf-entry-link")];
      const room = document.documentElement.scrollHeight - window.innerHeight;
      return {
        y: Math.round(window.scrollY),
        room: Math.round(room),
        focused: cards.indexOf(document.activeElement as HTMLElement),
        count: cards.length,
      };
    });
    // The card in the same place in the new list, or its last if the list is shorter.
    expect(after.focused).toBe(Math.min(last, after.count - 1));
    expect(after.y).toBe(Math.min(before, after.room));
  });

  for (const [road, held] of [
    ["the router", 1200],
    ["the page loaded afresh, when the router never commits", null],
  ] as const) {
    test(`and keeps the reader's place when ${road} brings their own day's list`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 500 });
      await page.route("**/saints/today?month=*", async (route) => {
        if (route.request().isNavigationRequest()) return route.continue();
        if (held === null) return; // never answered
        await new Promise((resolve) => setTimeout(resolve, held));
        await route.continue().catch(() => {});
      });
      await page.goto("/saints/today");
      // The server's day's list, while the visitor's is on its way.
      const cards = page.locator("main .vf-entry-link");
      await expect(cards.first()).toBeVisible();
      const last = (await cards.count()) - 1;
      await cards.nth(last).focus();
      await cards.nth(last).evaluate((card) => card.scrollIntoView({ block: "center" }));
      const before = await page.evaluate(() => Math.round(window.scrollY));
      await expect(page).toHaveURL(named(date), arrival);
      await expect(label(page)).toHaveText(inWords(date));
      const after = await page.evaluate(() => {
        const cards = [...document.querySelectorAll<HTMLElement>("main .vf-entry-link")];
        return {
          y: Math.round(window.scrollY),
          room: Math.round(document.documentElement.scrollHeight - window.innerHeight),
          focused: cards.indexOf(document.activeElement as HTMLElement),
          count: cards.length,
        };
      });
      expect(after.focused).toBe(Math.min(last, after.count - 1));
      expect(after.y).toBe(Math.min(before, after.room));
    });
  }

  test("but a date named in the address stays that date", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await page.goto("/saints/today?month=12&day=25");
    await page.clock.runFor(1000);
    await expect(label(page)).toHaveText("December 25");
    await comeBackTomorrow(page);
    await page.waitForTimeout(3000);
    await page.clock.runFor(3000);
    await expect(page).toHaveURL(/\/saints\/today\?month=12&day=25$/);
    await expect(label(page)).toHaveText("December 25");
  });
});

test.describe("a link pressed while the date is being corrected", () => {
  const { timezoneId } = visitorWhoseDateDiffers();
  test.use({ timezoneId });
  test.setTimeout(60_000);

  const isRsc = (url: string) => url.includes("_rsc=");
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const [how, correctionTakes] of [
    ["while the router is still asking", 5000],
    ["once the router has its answer", 0],
  ] as const) {
    test(`wins, on a slow network, ${how}`, async ({ page }) => {
      const documents: string[] = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame())
          documents.push(request.url());
      });
      let asked = false;
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        if (isRsc(url) && url.includes("/liturgy/readings?date=")) {
          asked = true;
          await sleep(correctionTakes);
        } else if (isRsc(url) && url.includes("/liturgical-calendar?")) {
          await sleep(3000);
        }
        await route.continue().catch(() => {});
      });
      await page.goto("/liturgy/readings");
      await expect.poll(() => asked, { timeout: 30_000 }).toBe(true);
      await page
        .getByRole("link", { name: "Open the liturgical calendar" })
        .click({ timeout: 5000 });
      await expect(page).toHaveURL(/\/liturgical-calendar$/, { timeout: 15_000 });
      // Well past when the page would have been loaded afresh, and it has stayed.
      await page.waitForTimeout(2500);
      await expect(page).toHaveURL(/\/liturgical-calendar$/);
      expect(documents).toHaveLength(1);
    });
  }
});

test.describe("a line of facts", () => {
  test("keeps its words apart for a voice, with the commas and the number in the line", async ({
    page,
  }) => {
    await page.goto("/liturgy/readings?date=2026-11-07");
    const line = page.locator(".vf-reading-meta").first();
    await expect(line).toMatchAriaSnapshot(
      "- paragraph: Ordinary Time, Sunday Cycle A, Weekday Cycle 2",
    );
    const voices = line.locator(".vf-sr-inline");
    await expect(voices).toHaveCount(3);
    for (const voice of await voices.all()) {
      // Absolutely positioned, Safari's accessibility tree would take it out of the line.
      await expect(voice).toHaveCSS("position", "static");
      await expect(voice).toHaveCSS("display", "inline");
      await expect(voice).toHaveCSS("opacity", "0");
    }
  });

  test("looks as if the voice's words were not there", async ({ page }) => {
    await page.goto("/liturgy/readings?date=2026-11-07");
    const copied = await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".vf-reading-meta")!);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      return selection.toString();
    });
    expect(copied).toBe("Ordinary Time · Sunday Cycle A · Weekday Cycle II");
  });
});

test.describe("the Rosary's mysteries, left open past midnight", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  const SATURDAY_NIGHT = new Date("2026-11-08T07:59:00Z"); // 23:59 on Saturday, November 7

  test("say what today is, and keep the set on show until the visitor comes back", async ({
    page,
  }) => {
    await page.clock.install({ time: SATURDAY_NIGHT });
    await page.goto("/guides/how-to-pray-the-rosary");
    const joyful = page.getByRole("button", { name: "Joyful (today)" });
    await expect(joyful).toHaveAttribute("aria-pressed", "true");

    await page.clock.fastForward("02:00");
    await expect(page.getByText("Today (Sunday) the Glorious Mysteries are prayed.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Glorious (today)" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.getByRole("button", { name: "Joyful", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.clock.fastForward("08:00:00");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: "Glorious (today)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("typing a date on the calendar", () => {
  const KEYBOARD_ONLY = "Playwright's WebKit date field does not move between its segments";

  async function typeIntoDate(page: Page, digits: string) {
    await page.getByLabel("Choose a date").focus();
    await page.keyboard.type(digits, { delay: 40 });
  }

  test("announces nothing until the year is whole, and keeps what was typed", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", KEYBOARD_ONLY);
    await page.goto("/liturgical-calendar");
    const field = page.getByLabel("Choose a date");
    await expect(field).toBeVisible();
    await field.fill("2026-03-24");
    const status = page.locator('.vf-calendar-result > p[role="status"]');
    await expect(status).toContainText("March 24, 2026");

    await typeIntoDate(page, "0324"); // Month and day, the same again.
    for (const digit of ["2", "0", "2"]) {
      await page.keyboard.type(digit);
      await expect(status).toContainText("March 24, 2026");
    }
    await page.keyboard.type("7");
    await expect(field).toHaveValue("2027-03-24");
    await expect(status).toContainText("March 24, 2027: Wednesday of Holy Week");
  });

  test("says which years it covers, and goes back when the visitor moves on", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", KEYBOARD_ONLY);
    await page.goto("/liturgical-calendar");
    const field = page.getByLabel("Choose a date");
    await field.fill("2026-03-24");
    await typeIntoDate(page, "03241850");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("This calendar covers the years 1970 to 2099.")).toBeVisible();
    await field.blur();
    await expect(field).toHaveValue("2026-03-24");
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
  });

  test("says so for a year of more digits than a year has", async ({ page }) => {
    // Safari's year takes up to six digits and stays there. Chromium's stops at four here.
    await page.goto("/liturgical-calendar");
    const field = page.getByLabel("Choose a date");
    await field.fill("2026-03-24");
    await field.fill("20271-03-24");
    test.skip((await field.inputValue()) !== "20271-03-24", "This engine's field has no such year");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("This calendar covers the years 1970 to 2099.")).toBeVisible();
    await expect(page.locator('.vf-calendar-result > p[role="status"]')).toContainText(
      "March 24, 2026",
    );
  });
});

test("the rite's note calls every rite a Rite", async ({ page }) => {
  await page.goto("/liturgical-calendar");
  await page.getByLabel("Rite", { exact: true }).selectOption("byzantine");
  await expect(
    page.getByText(
      "This is the Roman Rite's calendar for the Dioceses of the United States. The Byzantine Rite observes",
    ),
  ).toBeVisible();
});

test.describe("the rite field at 200% text", () => {
  for (const width of [375, 768, 1280]) {
    test(`every rite fits at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(() => {
        const set = () =>
          document.documentElement && (document.documentElement.style.fontSize = "200%");
        set();
        document.addEventListener("DOMContentLoaded", set);
      });
      await page.goto("/liturgical-calendar");
      await expect(page.getByLabel("Rite")).toBeVisible();
      const cut = await page.getByLabel("Rite").evaluate((node) => {
        const select = node as HTMLSelectElement;
        const style = getComputedStyle(select);
        const room =
          select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const context = document.createElement("canvas").getContext("2d")!;
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return [...select.options]
          .map((option) => option.textContent ?? "")
          .filter((text) => context.measureText(text).width > room);
      });
      expect(cut).toEqual([]);
    });
  }
});
