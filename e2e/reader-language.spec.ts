import { expect, test } from "@playwright/test";

// Words a reader hears on pages that are otherwise largely in their language: the label
// over a detail page's title, /history's page and era links, and the sign-in popup a
// signed-out Favorite opens. Each was English for every reader.

test.describe("in Spanish", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "vf_locale", value: "es", url: baseURL! }]);
  });

  for (const [path, label] of [
    ["/our-lady/our-lady-of-aparecida", "Advocación de la Virgen María"],
    ["/sacraments/baptism", "Sacramento de la iniciación cristiana"],
    ["/sacraments/holy-orders", "Sacramento al servicio de la comunidad"],
    ["/guides/how-to-pray-the-rosary", "Rosario"],
    ["/liturgy-history/symbolism-of-incense-and-candles", "Simbolismo litúrgico"],
  ] as const) {
    test(`the label over ${path}'s title is the reader's`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(".vf-detail-header .vf-eyebrow")).toHaveText(label);
    });
  }

  // "Santo" over a woman's bare name read her as a man, and the record cannot say which.
  test("a saint's stage over a bare name is left unsaid rather than guessed", async ({ page }) => {
    await page.goto("/saints/saint-catherine-of-vadstena");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catherine of Vadstena");
    await expect(page.locator(".vf-detail-header .vf-eyebrow")).toHaveCount(0);
  });

  test("/history's page links are the reader's, from the first to the last", async ({ page }) => {
    await page.goto("/history?page=2");
    const pager = page.getByRole("navigation", { name: "Páginas de acontecimientos" });
    await expect(pager.getByRole("link", { name: /Anterior/ })).toBeVisible();
    await expect(pager.getByRole("link", { name: "Página 3" })).toBeVisible();
    await expect(pager.getByRole("link", { name: /Siguiente/ })).toBeVisible();
    await expect(pager).not.toContainText(/Previous|Next/);
  });

  test("/history's neighbouring eras are the reader's", async ({ page }) => {
    await page.goto("/history?era=persecution");
    const steps = page.getByRole("navigation", { name: "Épocas vecinas" });
    await expect(steps.getByRole("link", { name: /^Época anterior/ })).toBeVisible();
    await expect(steps.getByRole("link", { name: /^Época siguiente/ })).toBeVisible();
  });
});

test("a saint's stage is said where one word serves everyone", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "vf_locale", value: "ko", url: baseURL! }]);
  await page.goto("/saints/saint-catherine-of-vadstena");
  await expect(page.locator(".vf-detail-header .vf-eyebrow")).toHaveText("성인");
});

for (const [locale, favorite, message, logIn, create, close] of [
  [
    "de",
    "Favorit",
    "Für diese Aktion brauchen Sie ein Konto.",
    "Anmelden",
    "Konto erstellen",
    "Schließen",
  ],
  [
    "pl",
    "Do ulubionych",
    "Do tej czynności potrzebujesz konta.",
    "Zaloguj się",
    "Utwórz konto",
    "Zamknij",
  ],
  [
    "tl",
    "Paborito",
    "Kailangan mo ng account para rito.",
    "Mag-sign in",
    "Gumawa ng account",
    "Isara",
  ],
] as const) {
  test(`the sign-in popup a signed-out Favorite opens speaks ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "vf_locale", value: locale, url: baseURL! }]);
    await page.goto("/prayers/our-father");
    await page.getByRole("button", { name: favorite }).click();
    const dialog = page.getByRole("dialog", { name: message });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: logIn, exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: create, exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: close, exact: true })).toBeVisible();
    await expect(dialog).not.toContainText(/Log in|Create account/i);
  });
}
