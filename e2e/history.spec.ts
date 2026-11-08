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

  test("reads an era's years and count as one line, and a row's parts with their commas", async ({
    page,
  }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".vf-timeline-era-head").first().ariaSnapshot()).toMatch(
      /paragraph: from 30 to 100, \d+ events?/,
    );
    expect(await page.locator(row("pentecost")).ariaSnapshot()).toContain(
      'button "c. 33, Pentecost — the Church is born, Event"',
    );
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

  test("never scrolls sideways on a phone with the text at 200%", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/history?page=2", "/history?page=13", "/history?year=1545"]) {
      await page.goto(path);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        // A kind's one long word used to run out of its row and off the screen.
        pastTheRow: [...document.querySelectorAll(".vf-timeline-summary")].filter((row) => {
          const kind = row.querySelector(".vf-timeline-kind");
          if (!kind) return false;
          const range = document.createRange();
          range.selectNodeContents(kind);
          return range.getBoundingClientRect().right > row.getBoundingClientRect().right + 1;
        }).length,
      }));
      expect(result, path).toEqual({ overflow: 0, pastTheRow: 0 });
    }
  });

  test("sets its supporting text at 14px or more", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    const small = await page.evaluate(() => {
      for (const details of document.querySelectorAll("details")) details.open = true;
      const found: string[] = [];
      const walker = document.createTreeWalker(
        document.querySelector("main")!,
        NodeFilter.SHOW_TEXT,
      );
      while (walker.nextNode()) {
        const parent = walker.currentNode.parentElement!;
        if (!walker.currentNode.nodeValue?.trim() || !parent.getClientRects().length) continue;
        // Words for a voice alone are a pixel high on purpose, and hidden from the eye.
        if (parent.closest(".sr-only, .vf-sr-inline")) continue;
        const size = parseFloat(getComputedStyle(parent).fontSize);
        if (size < 14) found.push(`${size}px ${walker.currentNode.nodeValue.trim().slice(0, 30)}`);
      }
      return found;
    });
    expect(small).toEqual([]);
  });

  test("keeps a menu's label and count apart at 200%", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await page.locator(".vf-history-menu > summary").click();
    const collisions = await page.evaluate(
      () =>
        [...document.querySelectorAll(".vf-history-menu .vf-menu-item")].filter((item) => {
          const range = document.createRange();
          range.selectNodeContents(item.querySelector(".min-w-0")!);
          const label = range.getBoundingClientRect();
          const count = item.querySelector(".vf-chip-count")!.getBoundingClientRect();
          return label.right > count.left && label.bottom > count.top && label.top < count.bottom;
        }).length,
    );
    expect(collisions).toBe(0);
  });

  test("chooses a theme with the mouse in a menu opened from the keyboard", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The keyboard's.");
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    await page.locator(".vf-history-menu > summary").focus();
    await page.keyboard.press("Enter");
    const councils = page.locator(".vf-history-menu a", { hasText: "Councils" });
    const box = await councils.boundingBox();
    await page.mouse.move(box!.x + 10, box!.y + 10);
    await page.mouse.down();
    // Open until the click has landed, with the focus where it was.
    await expect(councils).toBeVisible();
    await expect(page.locator(".vf-history-menu > summary")).toBeFocused();
    await page.mouse.up();
    await expect(page).toHaveURL(/theme=councils/);
  });

  // A screen reader reads a button's name as the focus lands on it. Given the focus
  // while the old view is still showing, the menu's button would name the choice the
  // reader is leaving, so the focus stays on the chosen link until the new view is in.
  for (const { width, menu, choice, says } of [
    {
      width: 1280,
      menu: ".vf-history-menu",
      choice: "Councils",
      says: /theme: Councils \d+ events/,
    },
    {
      width: 375,
      menu: ".vf-history-eras-fold",
      choice: "Early Middle Ages",
      says: /^Era: Early Middle Ages/,
    },
  ]) {
    test(`gives the focus back to the ${menu} button only once it names ${choice}`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "The keyboard's.");
      // Room for the safety net's eight seconds on a slow server, and the page after them.
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/history");
      await page.waitForLoadState("networkidle");
      const summary = page.locator(`${menu} > summary`);
      await summary.focus();
      await page.keyboard.press("Enter");
      await page.locator(`${menu} a`, { hasText: choice }).first().focus();
      await summary.evaluate((node) => {
        const names: string[] = [];
        (window as unknown as { __named: string[] }).__named = names;
        node.addEventListener("focus", () =>
          names.push((node.textContent ?? "").replace(/\s+/g, " ").trim()),
        );
      });
      // Holds the new view back, as a slow connection would.
      await page.route(/_rsc=/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
      await expect(summary).not.toBeFocused();
      // Playwright's WebKit can fail to commit a held view at all. The safety net in
      // watch-navigation.ts then loads it as a new page, which has no focus to give back.
      const settled = () =>
        page
          .evaluate(() => {
            const named = (window as unknown as { __named?: string[] }).__named;
            if (named === undefined) return "new page";
            return named.length > 0 ? "given back" : "waiting";
          })
          .catch(() => "waiting");
      await expect.poll(settled, { timeout: 15_000 }).not.toBe("waiting");
      test.skip(
        (await settled()) === "new page",
        "The router never committed the held view here, so the safety net loaded it.",
      );
      await expect(summary).toBeFocused();
      const named = await page.evaluate(() => (window as unknown as { __named: string[] }).__named);
      expect(named).toHaveLength(1);
      expect(named[0]).toMatch(says);
      await expect(page.locator(menu)).not.toHaveAttribute("open", "");
    });
  }

  test("goes on from a typed year to the row it found", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    await page.locator("#history-year-input").fill("1054");
    await page.locator("#history-year-input").press("Enter");
    await expect(page).toHaveURL(/year=1054/);
    const summary = page.locator(`${row("great-schism-1054")} > summary`);
    await expect(summary).toBeFocused();
    await expect(summary).toBeInViewport({ ratio: 1 });
    // Nothing stuck at the top of the window is over it.
    const covered = await summary.evaluate((el) => {
      const { top } = el.getBoundingClientRect();
      const header = document.querySelector("header")!.getBoundingClientRect().bottom;
      const heads = [...document.querySelectorAll(".vf-timeline-era-head")]
        .map((head) => head.getBoundingClientRect())
        .filter((box) => box.top <= header && box.bottom > header);
      return top < Math.max(header, ...heads.map((box) => box.bottom));
    });
    expect(covered).toBe(false);
  });

  test("holds the slider on screen, with the focus on it, while the list moves below it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The arrow keys are a keyboard's.");
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    const slider = page.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("End");
    await expect(page).toHaveURL(/year=2026/, { timeout: 15_000 });
    await expect(page.locator(".vf-timeline-current")).toBeInViewport();
    await expect(slider).toBeFocused();
    await expect(slider).toBeInViewport({ ratio: 1 });
    const header = await page.locator("header").boundingBox();
    const box = await slider.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);

    // A second move does not throw the page around.
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("Shift+ArrowLeft");
    expect(await page.evaluate(() => window.scrollY)).toBe(before);

    // Nor does the focus moving on to the year field and back (the box's own controls).
    await page.locator("#history-year-input").focus();
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await slider.focus();
    expect(await page.evaluate(() => window.scrollY)).toBe(before);

    // Enter is the way on to the row, and lets the slider go.
    await page.keyboard.press("Enter");
    await expect(page.locator(".vf-timeline-current")).toBeFocused();
    await expect(page.locator(".vf-history-docked")).toHaveCount(0);
  });

  test("keeps hold of the slider through a long era's name, with the text at 200%", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The arrow keys are a keyboard's.");
    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const slider = page.getByRole("slider");
    const docked = page.locator(".vf-history-docked");
    await slider.focus();
    for (const [key, year] of [
      ["End", 2026],
      ["ArrowLeft", 2021],
      ["Home", 33],
    ] as const) {
      await page.keyboard.press(key);
      await expect(page).toHaveURL(new RegExp(`year=${year}\\b`), { timeout: 15_000 });
      await expect(docked).toHaveCount(1);
      await expect(slider).toBeFocused();
      await expect(slider).toBeInViewport({ ratio: 1 });
    }
    // The box never takes more than it was allowed, whichever era's name it shows.
    const share = await page.evaluate(() => {
      const box = document.querySelector(".vf-history-when")!.getBoundingClientRect().height;
      const header = document.querySelector("header")!.getBoundingClientRect().height;
      return (box + header) / window.innerHeight;
    });
    expect(share).toBeLessThanOrEqual(0.6);
    // The row it stands on is whole in the window, below the box.
    const current = page.locator(".vf-timeline-current");
    await expect(current).toBeInViewport({ ratio: 1 });
  });

  // Safari ends such a drag with a click on whatever holds both of its ends.
  test("keeps hold of the slider when a drag is let go off its box", async ({ page, isMobile }) => {
    test.skip(isMobile, "The mouse's.");
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    const slider = page.getByRole("slider");
    await slider.scrollIntoViewIfNeeded();
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 11, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, y, { steps: 3 });
    await page.mouse.move(box.x + box.width / 2, y + 300, { steps: 3 });
    await page.mouse.up();
    await expect(page).toHaveURL(/year=/, { timeout: 15_000 });
    await expect(page.locator(".vf-history-docked")).toHaveCount(1);
    await expect(slider).toBeFocused();
    await expect(slider).toBeInViewport({ ratio: 1 });
  });

  test("stays put with the slider where it cannot be held in view", async ({ page, isMobile }) => {
    test.skip(isMobile, "The arrow keys are a keyboard's.");
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const slider = page.getByRole("slider");
    await slider.focus();
    await page.locator(".vf-history-when").evaluate((box) => box.scrollIntoView());
    const top = async () => (await slider.boundingBox())!.y;
    const before = await top();
    for (const [key, year] of [
      ["End", 2026],
      ["ArrowLeft", 2021],
      ["Home", 33],
    ] as const) {
      await page.keyboard.press(key);
      await expect(page).toHaveURL(new RegExp(`year=${year}\\b`), { timeout: 15_000 });
      await expect(page.locator(".vf-history-docked")).toHaveCount(0);
      await expect(slider).toBeFocused();
      // The panel above changes height with the era it names; the slider does not move.
      await expect.poll(top).toBe(before);
    }
    await page.keyboard.press("Enter");
    await expect(page.locator(".vf-timeline-current")).toBeFocused();
  });

  test("lets go of a slider moved with no focus on it, once the reader goes on", async ({
    page,
  }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    // What VoiceOver's swipe does: the value changes, and the focus stays where it was.
    await page.getByRole("slider").evaluate((slider: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        slider,
        "133",
      );
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page).toHaveURL(/year=133/, { timeout: 15_000 });
    const docked = page.locator(".vf-history-docked");
    await expect(docked).toHaveCount(1);
    // And its press: a click with no pointer, on the way on to the row.
    await page.getByRole("link", { name: /^Go to this event/ }).evaluate((a: HTMLElement) => {
      a.click();
    });
    const current = page.locator(".vf-timeline-current");
    await expect(current).toBeFocused();
    await expect(docked).toHaveCount(0);
    await expect(current).toBeInViewport({ ratio: 1 });
    const covered = await current.evaluate((row) => {
      const box = row.getBoundingClientRect();
      return ![0.1, 0.5, 0.9].every((f) =>
        row.contains(document.elementFromPoint(box.left + 40, box.top + box.height * f)),
      );
    });
    expect(covered).toBe(false);
  });

  test("clears a link in an open row of the sticky heading, going back up", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Only a wide list has a sticky heading.");
    await page.goto("/history?page=3");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      document.querySelectorAll<HTMLDetailsElement>("details.vf-timeline-event").forEach((d) => {
        d.open = true;
      });
    });
    await page.locator(".vf-history-pager a").first().focus();
    const hidden: number[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Shift+Tab");
      hidden.push(
        await page.evaluate(() => {
          const box = document.activeElement!.getBoundingClientRect();
          const stuck = [...document.querySelectorAll(".vf-timeline-era-head")]
            .map((head) => head.getBoundingClientRect())
            .filter((head) => head.top < box.bottom && head.bottom > box.top);
          const limit = Math.max(
            document.querySelector("header")!.getBoundingClientRect().bottom,
            ...stuck.map((head) => head.bottom),
          );
          return Math.max(0, limit - box.top);
        }),
      );
    }
    expect(Math.max(...hidden)).toBeLessThanOrEqual(1);
  });

  test("wraps the pager in the keyboard's order, with the text at 200%", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/history?page=13");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const links = await page.locator(".vf-history-pager a").evaluateAll((all) =>
      all.map((a) => {
        const box = a.getBoundingClientRect();
        return { x: box.left, y: box.top };
      }),
    );
    expect(links.length).toBe(7);
    const inReadingOrder = links.every((link, i) => {
      const before = links[i - 1];
      return (
        !before ||
        link.y > before.y + 10 ||
        (Math.abs(link.y - before.y) <= 10 && link.x > before.x)
      );
    });
    expect(inReadingOrder).toBe(true);
    // At most three rows, not the numbers in a column of their own.
    expect(new Set(links.map((link) => Math.round(link.y))).size).toBeLessThanOrEqual(3);
  });

  test("names every disclosure a button with its state, for VoiceOver's press", async ({
    page,
  }) => {
    await page.goto("/history");
    const summary = page.locator(`${row("pentecost")} > summary`);
    await expect(summary).toHaveAttribute("role", "button");
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await summary.click();
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    await summary.click();
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    // A new view's rows too.
    await page.locator(".vf-history-pager a[rel=next]").click();
    await expect(page).toHaveURL(/page=2/);
    const rows = page.locator("details.vf-timeline-event > summary");
    await expect(rows.first()).toHaveAttribute("role", "button");
    const unnamed = await rows.evaluateAll(
      (all) =>
        all.filter((s) => s.getAttribute("role") !== "button" || !s.hasAttribute("aria-expanded"))
          .length,
    );
    expect(unnamed).toBe(0);
  });

  test("reads a move in one voice: the status, never the route announcer", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "One browser is enough for what is announced.");
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    const title = await page.title();
    const announcer = page.locator("#__next-route-announcer__");
    const status = page.locator("#history-status .sr-only");

    await page.locator(".vf-history-order a", { hasText: "Newest first" }).click();
    await expect(status).toHaveText(/newest first/);
    await page.locator(".vf-history-order a", { hasText: "Oldest first" }).click();
    await expect(status).not.toHaveText(/newest first/);
    await page.locator(".vf-history-eras-grid a", { hasText: "Early Middle Ages" }).click();
    await expect(status).toHaveText(/^Early Middle Ages: showing/);

    expect(await page.title()).toBe(title);
    await expect(announcer).toHaveText("");
  });

  test("hands the focus to the status from a way back that is gone once followed", async ({
    page,
  }) => {
    await page.goto("/history?q=nicaea");
    await page.waitForLoadState("networkidle");
    await page.locator(".vf-timeline-status-row a", { hasText: "Clear search" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.locator("#history-status")).toBeFocused();
  });
});

test.describe("under Reduce Motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("a row opens at once", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    const heights = await page.locator(row("pentecost")).evaluate(async (details) => {
      details.querySelector("summary")!.click();
      const seen = new Set<number>();
      for (let i = 0; i < 8; i++) {
        await new Promise((next) => requestAnimationFrame(next));
        seen.add(Math.round(details.getBoundingClientRect().height));
      }
      return seen.size;
    });
    expect(heights).toBe(1);
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

  test("keeps a row a plain disclosure, which reports its own state", async ({ page }) => {
    await page.goto("/history");
    const summary = page.locator(`${row("pentecost")} > summary`);
    await expect(summary).not.toHaveAttribute("role", /./);
    await expect(summary).not.toHaveAttribute("aria-expanded", /./);
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
