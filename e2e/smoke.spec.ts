import { expect, test } from "@playwright/test";

// Minimum viable smoke pass: every primary nav route loads without error
// and the header (the most-reported regression surface) remains visible
// after navigation. Visual snapshots are pinned for the home + search
// + profile pages so accidental layout drift is caught in CI.

const PRIMARY_PAGES = [
  { path: "/", name: "home" },
  { path: "/prayers", name: "prayers" },
  { path: "/spiritual-life", name: "spiritual-life" },
  { path: "/spiritual-guidance", name: "spiritual-guidance" },
  { path: "/liturgy-history", name: "liturgy-history" },
  { path: "/saints", name: "saints" },
  { path: "/search", name: "search" },
  { path: "/login", name: "login" },
  { path: "/register", name: "register" },
];

for (const page of PRIMARY_PAGES) {
  test(`loads ${page.name} (${page.path}) and shows the header`, async ({ page: p }) => {
    const response = await p.goto(page.path);
    expect(response?.status(), `expected 2xx for ${page.path}`).toBeLessThan(400);
    await expect(p.locator("header").first()).toBeVisible();
  });
}

test("header remains visible after navigating between tabs (regression guard)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("header").first()).toBeVisible();

  for (const target of ["/prayers", "/saints", "/search", "/"]) {
    await page.goto(target);
    await expect(page.locator("header").first()).toBeVisible();
  }
});

test.describe("visual regression snapshots", () => {
  test("home page layout", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("home.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("search page layout", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("search.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("login page layout", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe("performance smoke checks", () => {
  test("home page responds under 5s end-to-end", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
    expect(Date.now() - start).toBeLessThan(5_000);
  });

  test("public list APIs return paginated payloads (not unbounded)", async ({ request }) => {
    const res = await request.get("/api/prayers?take=10000");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { items: unknown[] };
    // Server clamps `take` at 200 — more than that and the cap is broken.
    expect(body.items.length).toBeLessThanOrEqual(200);
  });
});
