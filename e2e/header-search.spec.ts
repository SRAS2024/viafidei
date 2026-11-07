import { expect, test, type Locator, type Page } from "@playwright/test";

// What jsdom cannot check about the site search: where the open field sits against
// the masthead and how a long word fits a row, which need real layout, and what an
// odd address or a run of pages does, which needs the real server.

const VISIBLE_TOGGLE = "header button.vf-header-search-toggle:visible";

/** Opens the header's search, once the page has taken over its controls. */
async function openSearch(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.locator(VISIBLE_TOGGLE).first().click();
  await expect(page.locator("header input[role=combobox]:visible")).toBeFocused();
}

/** Does the visible form overlap the visible mark, and does anything scroll sideways? */
function measure(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => el.getClientRects().length > 0;
    const box = (el: Element | undefined) => {
      const r = el?.getBoundingClientRect();
      return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
    };
    const mark = [...document.querySelectorAll("header .vf-wordmark")].find(visible);
    const form = [...document.querySelectorAll("header form[role=search]")].find(visible);
    return {
      mark: box(mark?.closest("a") ?? undefined),
      form: box(form),
      windowWidth: window.innerWidth,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
}

test.describe("the open field against the masthead", () => {
  async function expectClearOfTheMark(page: Page) {
    const { mark, form, windowWidth, pageWidth } = await measure(page);
    expect(mark).not.toBeNull();
    expect(form).not.toBeNull();
    const separate =
      form!.left >= mark!.right ||
      form!.right <= mark!.left ||
      form!.top >= mark!.bottom ||
      form!.bottom <= mark!.top;
    expect(separate, `field ${JSON.stringify(form)}, mark ${JSON.stringify(mark)}`).toBe(true);
    expect(form!.left).toBeGreaterThanOrEqual(0);
    expect(form!.right).toBeLessThanOrEqual(windowWidth);
    expect(pageWidth).toBeLessThanOrEqual(windowWidth);
  }

  // The widths where the mark and the field compete, at the reader's own text size
  // and enlarged the way a browser's setting or a zoom of text would.
  for (const [width, textSize] of [
    [900, 100],
    [1024, 100],
    [1280, 100],
    [1440, 100],
    [1024, 150],
    [1366, 150],
    [1024, 200],
    [1280, 200],
    [1366, 200],
    [1800, 200],
    [1920, 200],
  ] as const) {
    test(`never covers the mark at ${width}px wide and ${textSize}% text`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "These are desktop widths.");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/prayers");
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
      }, textSize);
      await openSearch(page);
      await expectClearOfTheMark(page);
    });
  }

  test("never covers the mark beside a long account link", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, "This is a desktop width.");
    // "Iniciar sesión" is more than twice as long as "Log in", which a field sized
    // from the window alone has no way to know.
    await context.addCookies([{ name: "vf_locale", value: "es", url: baseURL }]);
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/prayers");
    await openSearch(page);
    await expectClearOfTheMark(page);
  });
});

test.describe("opening the field", () => {
  /** Where the masthead and what follows it sit, in whole pixels. */
  function positions(page: Page) {
    return page.evaluate(() => {
      const top = (selector: string) => {
        const el = [...document.querySelectorAll(selector)].find(
          (candidate) => candidate.getClientRects().length > 0,
        );
        return el ? Math.round(el.getBoundingClientRect().top) : null;
      };
      return {
        header: Math.round(document.querySelector("header")!.getBoundingClientRect().height),
        account: top("header a[href='/login']"),
        tabs: top("header nav a, header nav button"),
        pageTitle: top("main h1"),
      };
    });
  }

  // The field grew with the reader's text while the mark beside it stayed 60px, so the
  // row grew when it opened, and everything below it jumped down and back.
  for (const [width, textSize] of [
    [1280, 100],
    [1350, 150],
    [1500, 160],
    [1575, 175],
    [1800, 200],
    [2700, 300],
  ] as const) {
    test(`moves nothing at ${width}px wide and ${textSize}% text`, async ({ page, isMobile }) => {
      test.skip(isMobile, "These are desktop widths.");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/prayers");
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
      }, textSize);
      const closed = await positions(page);
      await openSearch(page);
      expect(await positions(page)).toEqual(closed);
    });
  }

  for (const [width, textSize] of [
    [900, 100],
    [1280, 100],
    [1800, 200],
  ] as const) {
    test(`opens suggestions clear of the mark at ${width}px wide and ${textSize}% text`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "These are desktop widths.");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/prayers");
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
      }, textSize);
      await openSearch(page);
      await page.locator("header input[role=combobox]:visible").pressSequentially("rosary");
      await expect(page.locator("header .vf-suggest:visible")).toBeVisible();
      const separate = await page.evaluate(() => {
        const visible = (el: Element) => el.getClientRects().length > 0;
        const mark = [...document.querySelectorAll("header .vf-wordmark")]
          .find(visible)!
          .closest("a")!
          .getBoundingClientRect();
        const panel = [...document.querySelectorAll("header .vf-suggest")]
          .find(visible)!
          .getBoundingClientRect();
        return (
          panel.left >= mark.right ||
          panel.right <= mark.left ||
          panel.top >= mark.bottom ||
          panel.bottom <= mark.top
        );
      });
      expect(separate).toBe(true);
    });
  }
});

test.describe("the phone's bar at the largest text", () => {
  // The name of the site grew with the text until it pushed the menu button off the
  // window in Chromium, and ran under the search button in WebKit.
  for (const [width, textSize] of [
    [320, 200],
    [320, 300],
    [375, 300],
    [414, 300],
  ] as const) {
    test(`stays in the window at ${width}px wide and ${textSize}% text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/prayers");
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
      }, textSize);
      const bar = await page.evaluate(() => {
        const box = (selector: string) =>
          [...document.querySelectorAll(selector)]
            .find((el) => el.getClientRects().length > 0)!
            .getBoundingClientRect();
        return {
          name: box("header .vf-wordmark").right,
          search: box("header .vf-header-search-toggle").left,
          menu: box("header .vf-mobile-menu-toggle").right,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(bar.name).toBeLessThanOrEqual(bar.search);
      expect(bar.menu).toBeLessThanOrEqual(width);
      expect(bar.pageWidth).toBeLessThanOrEqual(width);
    });
  }
});

test.describe("the arrow keys", () => {
  // The spoken hint went with the desktop's layout, so enlarged text and a narrow
  // window, which bring the phone's bar, had the visible hint and no spoken one.
  for (const [width, textSize] of [
    [1280, 100],
    [1280, 150],
    [800, 100],
  ] as const) {
    test(`are told of, aloud and to the eye, at ${width}px wide and ${textSize}% text`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "A touch screen has no arrow keys to tell of.");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/prayers");
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
      }, textSize);
      await openSearch(page);
      await page.locator("header input[role=combobox]:visible").pressSequentially("rosary");
      await expect(page.locator("header .vf-suggest-all:visible")).toBeVisible();
      const rows = page.locator("header [role=option]:visible");
      test.skip((await rows.count()) === 0, "Nothing is published in this database.");
      await expect(page.locator("header [role=status]", { hasText: "arrow keys" })).toHaveCount(1);
      await expect(page.locator("header .vf-suggest-hint:visible")).toBeVisible();
    });
  }

  test("are not mentioned on a touch screen", async ({ page, isMobile }) => {
    test.skip(!isMobile, "This is the phone's project.");
    await page.goto("/prayers");
    await openSearch(page);
    await page.locator("header input[role=combobox]:visible").pressSequentially("rosary");
    await expect(page.locator("header .vf-suggest-all:visible")).toBeVisible();
    await expect(page.locator("header [role=status]", { hasText: "arrow keys" })).toHaveCount(0);
    await expect(page.locator("header .vf-suggest-hint:visible")).toHaveCount(0);
  });
});

test.describe("a long name at 200% text on a phone", () => {
  /** Sets the word, marked as a match is, in a real row: does it take one line? */
  function linesOf(row: Locator, word: string) {
    return row.evaluate((el, text) => {
      el.innerHTML = `<mark class="vf-mark">${text}</mark>`;
      const lines = [...el.querySelector("mark")!.getClientRects()].map((r) => Math.round(r.top));
      return new Set(lines).size;
    }, word);
  }

  for (const width of [320, 360, 375, 414]) {
    test(`stays whole in results and suggestions at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/search?q=rosary");
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      const result = page.locator(".vf-result-title a").first();
      test.skip((await result.count()) === 0, "Nothing is published in this database.");
      // Wider than any but about 1 production parish in 1,100.
      expect(await linesOf(result, "Dreifaltigkeitskapelle")).toBe(1);

      await openSearch(page);
      await page.locator("header input[role=combobox]:visible").pressSequentially("rosary");
      const suggestion = page.locator("header .vf-suggest-title:visible").first();
      await expect(suggestion).toBeVisible({ timeout: 15_000 });
      expect(await linesOf(suggestion, "Dreifaltigkeitskapelle")).toBe(1);
    });
  }
});

test.describe("/search", () => {
  test("shows each result once across its pages", async ({ page }) => {
    // Rows tied on rank and title were ordered afresh by each page's query, so one
    // showed on two pages and another on none, behind a count that still added up.
    const seen = new Set<string>();
    let shown = 0;
    let pages = 1;
    for (let at = 1; at <= Math.min(pages, 6); at += 1) {
      await page.goto(`/search?q=baptism&page=${at}`);
      const links = page.locator(".vf-result-title a");
      for (const href of await links.evaluateAll((all) =>
        all.map((link) => link.getAttribute("href") ?? ""),
      )) {
        seen.add(href);
        shown += 1;
      }
      const last = await page
        .locator("nav a[aria-label^='Page ']")
        .evaluateAll((all) =>
          Math.max(1, ...all.map((link) => Number(link.textContent?.trim()) || 1)),
        );
      pages = Math.max(pages, last);
    }
    expect(seen.size).toBe(shown);
  });

  test("reads a NUL in a hand-made address as if it were not there", async ({ page }) => {
    const response = await page.goto("/search?q=ro%00sary");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Search is unavailable")).toHaveCount(0);
    await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue(
      "rosary",
    );
    await expect(page).toHaveTitle(/“rosary”/);
  });

  test("says the page and the kinds of result in the reader's language", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "vf_locale", value: "es", url: baseURL }]);
    await page.goto("/search?q=mary&page=2");
    await expect(page.locator("h1")).toHaveText("Buscar");
    const headings = page.locator(".vf-result-head h2");
    test.skip((await headings.count()) === 0, "Nothing is published in this database.");
    await expect(headings.first()).not.toHaveText(
      /^(Prayer|Saint|Parish|Liturgy|Litany|Apparition|Our Lady)$/,
    );
    if ((await page.locator("nav a[aria-label^='Page ']").count()) > 0) {
      await expect(page).toHaveTitle(/página 2 de \d+/);
    }
  });

  test("gives each search landmark a name of its own", async ({ page }) => {
    await page.goto("/search?q=rosary");
    await openSearch(page);
    await expect(page.getByRole("search", { name: "Search the site", exact: true })).toBeVisible();
    await expect(page.getByRole("search", { name: "Search", exact: true })).toBeVisible();
    await expect(page.getByRole("search")).toHaveCount(2);
  });

  test("uses the first value when a parameter repeats", async ({ page }) => {
    const response = await page.goto("/search?q=rosary&q=lourdes&page=1&page=2");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Search");
    await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue(
      "rosary",
    );
  });

  test("still answers a page number far past any result", async ({ page }) => {
    const response = await page.goto("/search?q=rosary&page=99999999999999999999");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Search is unavailable")).toHaveCount(0);
  });
});
