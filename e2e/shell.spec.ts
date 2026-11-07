import { expect, test, type Page } from "@playwright/test";

// What jsdom cannot check about the site's shell: heights, what a real press does to
// focus, and what a real engine does with a container query. Safari's engine is the
// one that matters most here, and the one where these broke, so run this file there
// too: E2E_WEBKIT=1 npx playwright test e2e/shell.spec.ts --project=webkit

/** The height --header-h resolves to, and the header's own. */
async function heights(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--header-h);width:1px";
    document.body.appendChild(probe);
    const declared = probe.getBoundingClientRect().height;
    probe.remove();
    return {
      declared,
      real: document.querySelector("header")!.getBoundingClientRect().height,
      tabs: !!document.querySelector('nav[aria-label="Primary"]')?.getClientRects().length,
    };
  });
}

/**
 * Opens a page, and fails there if the page itself failed. A test that goes on to skip
 * for want of content must not read a server error as a page with nothing on it.
 */
async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.ok(), `${path} answered ${response?.status()}`).toBe(true);
  await page.waitForLoadState("networkidle");
}

/** How far --header-h is from the header's real height. */
function gap(page: Page) {
  return async () => {
    const { declared, real } = await heights(page);
    return Math.abs(declared - real);
  };
}

test.describe("the header", () => {
  test("is as tall as --header-h says, at the tabs and at the phone bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    let measured = await heights(page);
    expect(measured.real).toBe(118);
    expect(measured.declared).toBeCloseTo(118, 0);
    expect(measured.tabs).toBe(true);

    await page.setViewportSize({ width: 600, height: 800 });
    await expect.poll(async () => (await heights(page)).tabs).toBe(false);
    measured = await heights(page);
    expect(measured.real).toBeLessThan(70);
    // It follows within the frame, which a test can catch it before.
    await expect.poll(gap(page)).toBeLessThan(1);
  });

  test("gives enlarged text the short bar, whatever the window", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect.poll(async () => (await heights(page)).tabs).toBe(false);
    expect((await heights(page)).real).toBeLessThan(110);
    await expect.poll(gap(page)).toBeLessThan(1);
  });

  test("is opaque", async ({ page }) => {
    await page.goto("/login");
    const style = await page
      .locator("header")
      .first()
      .evaluate((node) => {
        const computed = getComputedStyle(node);
        return { background: computed.backgroundColor, blur: computed.backdropFilter };
      });
    expect(style.background).toMatch(/^rgb\(/);
    expect(style.blur === "none" || !style.blur).toBe(true);
  });
});

test.describe("the tabs", () => {
  test.skip(({ isMobile }) => isMobile, "The tabs are a wide window's.");

  test("a mouse press lands, in a menu opened from the keyboard", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Saints submenu" }).focus();
    await page.keyboard.press("Enter");
    const link = page.locator('nav[aria-label="Primary"] ul a[href="/popes"]');
    const box = (await link.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page).toHaveURL(/\/popes$/, { timeout: 15_000 });
  });

  test("the first click on a chevron keeps what hovering opened", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const chevron = page.getByRole("button", { name: "Saints submenu" });
    await chevron.hover();
    await expect(chevron).toHaveAttribute("aria-expanded", "true");
    await chevron.click();
    await expect(chevron).toHaveAttribute("aria-expanded", "true");
    await chevron.click();
    await expect(chevron).toHaveAttribute("aria-expanded", "false");
  });

  test("a screen reader hears the same tab lit that a sighted reader sees", async ({ page }) => {
    const primary = page.locator('nav[aria-label="Primary"]');
    for (const [path, tab, state] of [
      ["/prayers", "/prayers", "page"],
      ["/litanies", "/prayers", "true"],
      ["/popes", "/saints", "true"],
      ["/church-documents", "/history", "true"],
    ] as const) {
      await visit(page, path);
      const lit = primary.locator("a.vf-nav-link-active");
      await expect(lit).toHaveCount(1);
      await expect(lit).toHaveAttribute("href", tab);
      await expect(lit).toHaveAttribute("aria-current", state);
    }
  });

  test("a passing pointer leaves a reader their menu, and focus in it", async ({
    page,
    browserName,
  }) => {
    await visit(page, "/login");
    await page.mouse.move(640, 700);
    const chevron = page.getByRole("button", { name: "Saints submenu" });
    await chevron.focus();
    await page.keyboard.press("Enter");
    await expect(chevron).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    const focused = page.locator('nav[aria-label="Primary"] ul a:focus');
    await expect(focused).toHaveCount(1);

    // Across another tab and away again.
    const other = (await page.getByRole("button", { name: "Prayers submenu" }).boundingBox())!;
    await page.mouse.move(other.x, other.y + other.height / 2, { steps: 8 });
    await page.mouse.move(640, 700, { steps: 8 });
    await expect(chevron).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Prayers submenu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(focused).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(chevron).toBeFocused();
    await expect(chevron).toHaveAttribute("aria-expanded", "false");
  });

  test("Prayers reaches Devotions and Novenas", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Prayers submenu" }).click();
    const menu = page.getByRole("list", { name: "Prayers" });
    await expect(menu.locator('a[href="/devotions"]')).toBeVisible();
    await expect(menu.locator('a[href="/novenas"]')).toBeVisible();
  });
});

test.describe("the phone menu", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("closes when focus moves out of it", async ({ page, browserName }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const toggle = page.locator('button[aria-controls="vf-mobile-menu"]');
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#vf-mobile-menu")).toBeVisible();
    // Safari's Tab skips links unless Option is held.
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
    for (let stop = 0; stop < 40; stop += 1) {
      await page.keyboard.press(tab);
      const left = await page.evaluate(
        () =>
          !document.activeElement?.closest("#vf-mobile-menu") &&
          document.activeElement?.getAttribute("aria-controls") !== "vf-mobile-menu",
      );
      if (left) break;
    }
    await expect(page.locator("#vf-mobile-menu")).toHaveCount(0);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("shows the current page as filled, at a contrast a sighted reader can see", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator('button[aria-controls="vf-mobile-menu"]').click();
    const home = page.locator('#vf-mobile-menu a[href="/"]');
    await home.click();
    await expect(page).toHaveURL(/\/$/);
    await page.locator('button[aria-controls="vf-mobile-menu"]').click();
    const fill = await page
      .locator('#vf-mobile-menu a[aria-current="page"]')
      .evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(fill).toMatch(/^rgb\(31, 58, 138\)$/);
  });

  test("still sets the current page apart, legibly, in forced colours", async ({
    page,
    browserName,
  }) => {
    // Safari has no such mode: emulating it there flips the media query and forces nothing.
    test.skip(browserName === "webkit", "No forced colours in Safari's engine.");
    await page.emulateMedia({ forcedColors: "active" });
    await visit(page, "/");
    await page.locator('button[aria-controls="vf-mobile-menu"]').click();
    const row = (selector: string) =>
      page.locator(selector).evaluate((node) => {
        const style = getComputedStyle(node);
        return { fill: style.backgroundColor, adjust: style.forcedColorAdjust };
      });
    const current = await row('#vf-mobile-menu a[aria-current="page"]');
    const other = await row('#vf-mobile-menu a[href="/guides"]');
    expect(current.fill).not.toBe(other.fill);
    // Without this the browser paints the page's colour behind the words.
    expect(current.adjust).toBe("none");
  });
});

test.describe("a filter's panel", () => {
  test.skip(({ isMobile }) => isMobile, "Sized here by window and text size, not by device.");

  /** Opens the first collapsed filter on a page, if the page has one. */
  async function openFilter(page: Page, path: string) {
    await visit(page, path);
    const trigger = page.locator('main button[aria-expanded][aria-label*=":"]').first();
    test.skip((await trigger.count()) === 0, "No published content here to filter.");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator("main ul.vf-filter-panel");
    await expect(panel).toBeVisible();
    return panel;
  }

  async function onScreen(page: Page) {
    return page.evaluate(() => {
      const panel = document.querySelector("main ul.vf-filter-panel")!.getBoundingClientRect();
      const trigger = document
        .querySelector('main button[aria-expanded="true"]')!
        .getBoundingClientRect();
      const header = document.querySelector("header")!.getBoundingClientRect().bottom;
      return panel.bottom <= window.innerHeight && panel.top >= header && trigger.top >= header - 1;
    });
  }

  test("is on screen with its trigger in a short window", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openFilter(page, "/prayers");
    await expect.poll(() => onScreen(page)).toBe(true);
  });

  test("is on screen with its trigger at enlarged text", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 });
    await visit(page, "/guides");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const trigger = page.locator('main button[aria-expanded][aria-label*=":"]').first();
    test.skip((await trigger.count()) === 0, "No published content here to filter.");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main ul.vf-filter-panel")).toBeVisible();
    await expect.poll(() => onScreen(page)).toBe(true);
  });

  for (const [width, height] of [
    [640, 360],
    [568, 320],
  ] as const) {
    test(`stays in a ${width} by ${height} window at enlarged text, and gives its trigger back`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await visit(page, "/prayers");
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      const trigger = page.locator('main button[aria-expanded][aria-label*=":"]').first();
      test.skip((await trigger.count()) === 0, "No published content here to filter.");
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("main ul.vf-filter-panel")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const panel = document
              .querySelector("main ul.vf-filter-panel")!
              .getBoundingClientRect();
            const header = document.querySelector("header")!.getBoundingClientRect().bottom;
            return panel.top >= header && panel.bottom <= window.innerHeight;
          }),
        )
        .toBe(true);

      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      const whole = await trigger.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const header = document.querySelector("header")!.getBoundingClientRect().bottom;
        return box.top >= header && box.bottom <= window.innerHeight;
      });
      expect(whole).toBe(true);
    });
  }

  test("a mouse press lands, in a panel opened from the keyboard", async ({ page }) => {
    const panel = await openFilter(page, "/guides");
    const option = panel.locator("a").nth(1);
    const href = await option.getAttribute("href");
    // The panel may still be bringing itself into view.
    await expect
      .poll(async () => {
        const before = await page.evaluate(() => window.scrollY);
        await page.waitForTimeout(150);
        return (await page.evaluate(() => window.scrollY)) === before;
      })
      .toBe(true);
    const box = (await option.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page).toHaveURL(new RegExp(`${href!.replace(/[?]/g, "\\?")}$`), {
      timeout: 15_000,
    });
  });

  test("gives focus back to a trigger that names the choice", async ({ page }) => {
    const panel = await openFilter(page, "/guides");
    const option = panel.locator("a").nth(1);
    const label = (await option.locator("span").first().textContent())!.trim();
    await option.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/filter=/, { timeout: 15_000 });
    await expect(page.locator(":focus")).toHaveAttribute("aria-label", new RegExp(`: ${label}$`));
  });
});

test.describe("turning a page", () => {
  test("lands at the start of the new items", async ({ page }) => {
    await visit(page, "/prayers");
    const link = page.locator('main nav a[aria-label="Page 2"]');
    test.skip((await link.count()) === 0, "Not enough published content for a second page.");
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/page=2/, { timeout: 15_000 });
    await expect(page.locator("main ul.vf-grid")).toBeFocused();
    const top = await page.locator("main ul.vf-grid").evaluate((list) => {
      return list.getBoundingClientRect().top - document.querySelector("header")!.offsetHeight;
    });
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(100);
  });

  test("leaves focus with a reader who has moved on while a slow page comes", async ({ page }) => {
    await visit(page, "/prayers");
    const link = page.locator('main nav a[aria-label="Page 2"]');
    test.skip((await link.count()) === 0, "Not enough published content for a second page.");
    await page.route(/[?&]page=2/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await link.focus();
    await page.keyboard.press("Enter");
    const search = page.locator("main input[name=q]").first();
    await search.focus();
    await page.keyboard.type("our");
    await expect(page).toHaveURL(/page=2/, { timeout: 15_000 });
    await expect(page.locator("[data-focus-landing]")).toHaveCount(0);
    await expect(search).toBeFocused();
    await page.keyboard.type(" father");
    await expect(search).toHaveValue("our father");
  });
});

test.describe("a dialog", () => {
  test("gives focus back while it is still there, so focus never falls to the page", async ({
    page,
  }) => {
    // Here and not only in a unit test: this rests on the order the React in Next's own
    // bundle does things in, which is not the React the unit tests run on.
    await visit(page, "/prayers");
    const first = page.locator("main .vf-entry-link").first();
    test.skip((await first.count()) === 0, "No published prayers to open.");
    await visit(page, (await first.getAttribute("href"))!);
    const favorite = page.getByRole("button", { name: /^favorite/i }).first();
    await favorite.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await favorite.evaluate((button) => {
      button.addEventListener("focus", () => {
        button.dataset.dialogThere = String(!!document.querySelector('[role="dialog"]'));
      });
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(favorite).toBeFocused();
    await expect(favorite).toHaveAttribute("data-dialog-there", "true");
  });

  test("gives focus back from a press on the backdrop, once the press is over", async ({
    page,
  }) => {
    // Closing on the press handed focus back, and the same press then moved it to the page.
    await visit(page, "/prayers");
    const first = page.locator("main .vf-entry-link").first();
    test.skip((await first.count()) === 0, "No published prayers to open.");
    await visit(page, (await first.getAttribute("href"))!);
    const favorite = page.getByRole("button", { name: /^favorite/i }).first();
    await favorite.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // A corner of the backdrop, well clear of the dialog.
    await page.mouse.move(4, page.viewportSize()!.height - 4);
    await page.mouse.down();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(favorite).toBeFocused();
  });
});

test.describe("Share", () => {
  test("keeps focus and says what happened", async ({ page }) => {
    // Needs a detail page, so a database with content in it.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async () => {} },
        configurable: true,
      });
    });
    await visit(page, "/guides");
    const first = page.locator("main .vf-entry-link").first();
    test.skip((await first.count()) === 0, "No published guides to open.");
    await page.goto((await first.getAttribute("href"))!);
    await page.waitForLoadState("networkidle");
    const share = page.getByRole("button", { name: /^Share/ }).first();
    await share.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main [role=status]", { hasText: "Link copied" })).toHaveCount(1);
    await expect(share).toBeFocused();
    await expect(share).toBeEnabled();
  });
});
