import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// The parish directory in a real browser, for what jsdom cannot see: layout and
// the device's location. The near API is answered here, so these run on an empty
// directory as well as a full one, and "Use my location" is always on the page.

const CHICAGO = { latitude: 41.88, longitude: -87.63 };

const row = (over: Record<string, unknown>) => ({
  id: String(over.title),
  slug: String(over.title).replace(/\W+/g, "-"),
  subtitle: "A Catholic parish",
  designation: "parish",
  location: "",
  address: null,
  postalCode: null,
  website: null,
  city: null,
  state: null,
  country: null,
  countryCode: null,
  latitude: 41.88,
  longitude: -87.62027,
  href: "/parishes/x",
  ...over,
});

/** The records that broke the old five-column card, and worse. */
const AWKWARD = [
  row({
    title: "Dae Seongdang (대성당)",
    address: "경기도수원시영통구매탄동삼성로129번길성당사무실내부주차장입구앞",
    postalCode: "16677",
    city: "수원시영통구매탄동",
    state: "경기도",
    country: "South Korea",
    countryCode: "KR",
  }),
  row({
    title: "東京カテドラル聖マリア大聖堂付属聖イグナチオ・デ・ロヨラ教会主聖堂",
    address: "東京都千代田区麹町六丁目五番一号上智大学四谷キャンパス隣接敷地内",
    postalCode: "102-0083",
    city: "千代田区",
    country: "Japan",
    countryCode: "JP",
  }),
  row({
    title: "כנסיית הביקור",
    address: "מנהרת כרם",
    postalCode: "9574320",
    city: "ירושלים",
    state: "מחוז ירושלים",
    country: "Israel",
    countryCode: "IL",
  }),
  row({
    title: "Donaudampfschifffahrtsgesellschaftskapitänswitwenkapelle",
    city: "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch",
    country: "United Kingdom",
    countryCode: "GB",
  }),
  row({ title: "Coordinates Only Chapel", designation: "chapel" }),
];

async function allowLocation(context: BrowserContext, page: Page, items: unknown[]) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(CHICAGO);
  await page.route("**/api/parishes/near**", (route) =>
    route.fulfill({
      json: { items, requestedRadiusMiles: 50, radiusMiles: 50, widened: false },
    }),
  );
}

const locate = (page: Page) => page.getByRole("button", { name: "Use my location" }).click();
const liveRegion = (page: Page) => page.locator('main [role="status"]');

test("Use my location announces the nearest parishes and puts a distance on each", async ({
  page,
  context,
}) => {
  await allowLocation(context, page, [row({ title: "Near Parish", city: "Chicago" })]);
  await page.goto("/parishes");
  await locate(page);

  await expect(liveRegion(page)).toContainText("The parishes nearest you, within 50 miles.");
  const card = page.getByRole("article").filter({ hasText: "Near Parish" });
  await expect(card).toContainText(/0\.5 mi away|800 m away/);
  await expect(card.getByRole("button", { name: "Get directions to Near Parish" })).toBeVisible();

  // The control leaves with its sentence, and focus must not fall to the page.
  await page.getByRole("button", { name: "Show the full directory" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Use my location" })).toBeFocused();
  await expect(card).toHaveCount(0);
});

test("a blocked browser gets its steps and Try again", async ({ page }) => {
  await page.addInitScript(() => {
    const denied = {
      code: 1,
      message: "",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };
    navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.(denied as never);
    navigator.permissions.query = async () => ({ state: "denied" }) as PermissionStatus;
  });
  await page.goto("/parishes");
  await locate(page);

  await expect(liveRegion(page)).toContainText("Your browser is blocking location");
  await expect(liveRegion(page).getByRole("listitem").first()).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Use my location" })).toBeFocused();
});

test("every card holds its name, address and button, whatever the script", async ({
  page,
  context,
}) => {
  await allowLocation(context, page, AWKWARD);
  await page.goto("/parishes");
  await locate(page);
  await expect(page.getByRole("article")).toHaveCount(AWKWARD.length);

  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) out.push(`page scrolls sideways: ${root.scrollWidth}`);
    for (const card of document.querySelectorAll("main article")) {
      const box = card.getBoundingClientRect();
      const name = card.querySelector("h2")?.textContent ?? "";
      for (const part of card.querySelectorAll("h2, address, button")) {
        const r = part.getBoundingClientRect();
        if (r.left < box.left || r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5) {
          out.push(`${part.tagName} leaves the card of ${name}`);
        }
      }
      const address = card.querySelector("address")?.getBoundingClientRect();
      const button = card.querySelector("button")?.getBoundingClientRect();
      if (address && button && button.top < address.bottom) {
        out.push(`the button is not beneath the address of ${name}`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});
