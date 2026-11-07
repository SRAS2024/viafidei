import { expect, test } from "@playwright/test";

// A missing page in a browser, on the real server: the title says it was not found,
// which is the first thing a screen reader says, and the robots lines all say noindex.
// Next writes its own noindex on these. The root layout's "index, follow" used to sit
// beside it, along with the homepage's title.

const MISSING = [
  { path: "/no-such-page", title: "Page not found", back: "Return home", to: "/" },
  { path: "/prayers/no-such-entry", title: "Prayer not found", back: "Back to Prayers" },
  { path: "/saints/no-such-entry", title: "Saint not found", back: "Back to Saints" },
  { path: "/novenas/no-such-entry", title: "Novena not found", back: "Back to Novenas" },
  { path: "/devotions/no-such-entry", title: "Devotion not found", back: "Back to Devotions" },
  { path: "/guides/no-such-entry", title: "Guide not found", back: "Back to Guides" },
  { path: "/sacraments/no-such-entry", title: "Sacrament not found", back: "Back to Sacraments" },
  {
    path: "/spiritual-life/no-such-entry",
    title: "Spiritual practice not found",
    back: "Back to Spiritual Life",
  },
  { path: "/our-lady/no-such-entry", title: "Page not found", back: "Back to Our Lady" },
  {
    path: "/liturgy-history/no-such-entry",
    title: "Page not found",
    back: "Back to Liturgy",
    to: "/liturgy",
  },
  { path: "/parishes/no-such-entry", title: "Parish not found", back: "Back to Parishes" },
  { path: "/popes/no-such-entry", title: "Pope not found", back: "Back to Popes" },
  {
    path: "/doctors/no-such-entry",
    title: "Doctor of the Church not found",
    back: "Back to Doctors of the Church",
  },
  { path: "/rites/no-such-entry", title: "Rite not found", back: "Back to Rites" },
];

for (const { path, title, back, to } of MISSING) {
  test(`${path} says so, in its title and on the page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main h1")).toHaveText(title);
    await expect(page).toHaveTitle(`${title} · Via Fidei`);

    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")));
    expect(robots.length).toBeGreaterThan(0);
    for (const content of robots) expect(content).toBe("noindex");

    await expect(page.locator("main .vf-eyebrow")).toHaveCount(0);
    const link = page.getByRole("main").getByRole("link", { name: back });
    await expect(link).toHaveAttribute("href", to ?? `/${path.split("/")[1]}`);
  });
}

test("a missing page speaks the reader's language", async ({ context, page, baseURL }) => {
  await context.addCookies([{ name: "vf_locale", value: "es", url: baseURL! }]);
  await page.goto("/saints/no-such-entry");
  await expect(page.locator("main h1")).toHaveText("Santo no encontrado");
  await expect(page).toHaveTitle("Santo no encontrado · Via Fidei");
  await expect(page.getByRole("main").getByRole("link")).toHaveText(/Volver a los santos/);
});

// What the comments in next.config.js and on buildPublishedMetadata say: a detail route's
// [slug]/loading.tsx flushes before the not-found takes effect, so only a path with no route
// answers 404. If a detail route ever answers 404 that is good news, and both comments change.
test("a missing detail item answers 200 and a path with no route answers 404", async ({
  request,
}) => {
  expect((await request.get("/saints/no-such-entry")).status()).toBe(200);
  expect((await request.get("/no-such-page")).status()).toBe(404);
});

// The way back's longest capitalised words at 200% text on the narrowest phone. They
// used to run past the edge of the screen, and no word of the label breaks to fit now.
test.describe("the way back at 200% text on a narrow phone", () => {
  test.use({ viewport: { width: 320, height: 800 } });

  for (const { locale, path } of [
    { locale: "de", path: "/doctors/no-such-entry" },
    { locale: "pl", path: "/guides/no-such-entry" },
    { locale: "es", path: "/sacraments/no-such-entry" },
    { locale: "en", path: "/sacraments/no-such-entry" },
    { locale: "ko", path: "/prayers/no-such-entry" },
  ]) {
    test(`${locale} ${path} stays on the screen, whole`, async ({ context, page, baseURL }) => {
      await context.addCookies([{ name: "vf_locale", value: locale, url: baseURL! }]);
      await page.addInitScript(() => {
        const set = () =>
          document.documentElement && (document.documentElement.style.fontSize = "200%");
        set();
        document.addEventListener("DOMContentLoaded", set);
      });
      await page.goto(path);
      const link = page.getByRole("main").getByRole("link");
      await expect(link).toBeVisible();
      const measured = await link.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const split: string[] = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          for (const match of (node.nodeValue ?? "").matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const lines = new Set(
              [...range.getClientRects()]
                .filter((r) => r.width > 0.5)
                .map((r) => Math.round(r.top)),
            );
            if (lines.size > 1) split.push(match[0]);
          }
        }
        return { left: box.left, right: box.right, edge: innerWidth, split };
      });
      expect(measured.left).toBeGreaterThanOrEqual(0);
      expect(measured.right).toBeLessThanOrEqual(measured.edge);
      expect(measured.split).toEqual([]);
    });
  }
});
