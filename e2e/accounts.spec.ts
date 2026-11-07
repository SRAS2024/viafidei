import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";

// The account flows in a real browser, under the server's real Content-Security-Policy.
// Each test signs up its own reader, from its own client address so the sign-up limit
// counts them apart. Passwords are generated here and written nowhere.

const newPassword = () => `Vf${randomBytes(12).toString("base64url")}a1!`;
const newEmail = () => `vf-e2e-${randomBytes(5).toString("hex")}@example.test`;
const clientAddress = () =>
  `198.51.100.${(randomBytes(1)[0]! % 250) + 1}, 203.0.113.${(randomBytes(1)[0]! % 250) + 1}`;

async function freshContext(browser: Browser, baseURL: string | undefined) {
  return browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
}

async function signUp(context: BrowserContext) {
  const email = newEmail();
  const password = newPassword();
  const page = await context.newPage();
  await page.goto("/register");
  await page.fill("#firstName", "Testa");
  await page.fill("#lastName", "Verifier");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.fill("#passwordConfirm", password);
  await Promise.all([
    page.waitForURL("**/profile"),
    page.locator("form[action='/api/auth/register'] button[type=submit]").click(),
  ]);
  return { email, password, page };
}

test("the journal's PDF button opens the print dialog, and the entry is formatted", async ({
  browser,
  baseURL,
}) => {
  const context = await freshContext(browser, baseURL);
  const { page } = await signUp(context);
  await context.addInitScript(() => {
    const counted = window as unknown as { printed: number };
    counted.printed = 0;
    window.print = () => {
      counted.printed += 1;
    };
  });

  await page.goto("/profile/journal");
  await page.getByRole("button", { name: "New entry" }).click();
  await page.fill("#journalTitle", "Faith & Hope");
  await page.fill(
    "#journalBody",
    "## A heading\n\nA **bold** word.\n\n- first\n- second\n\n> A quote",
  );
  await page.locator("form[action='/api/journal'] button[type=submit]").click();
  await expect(page.getByRole("status").filter({ hasText: "Entry saved." })).toBeVisible();

  const pdfLink = page.getByRole("link", { name: /Faith & Hope.*PDF/ });
  await expect(pdfLink).toBeVisible();
  const violations: string[] = [];
  context.on("console", (message) => {
    if (message.type() === "error") violations.push(message.text());
  });
  const [pdf] = await Promise.all([context.waitForEvent("page"), pdfLink.click()]);
  await pdf.waitForLoadState("load");

  await expect
    .poll(() => pdf.evaluate(() => (window as unknown as { printed: number }).printed))
    .toBe(1);
  expect(violations).toEqual([]);
  await expect(pdf.locator("h1")).toHaveText("Faith & Hope");
  await expect(pdf.locator("h2")).toHaveText("A heading");
  await expect(pdf.locator("main strong")).toHaveText("bold");
  await expect(pdf.locator("ul li")).toHaveCount(2);
  await expect(pdf.locator("blockquote")).toHaveText("A quote");
  await pdf.getByRole("button", { name: "Print or save as PDF" }).click();
  expect(await pdf.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(2);
  await context.close();
});

test("an over-long journal entry stays in the form, with the reason", async ({
  browser,
  baseURL,
}) => {
  const context = await freshContext(browser, baseURL);
  const { page } = await signUp(context);
  await page.goto("/profile/journal");
  await page.getByRole("button", { name: "New entry" }).click();
  const words = "word ".repeat(4001);
  await page.fill("#journalTitle", "Too long");
  await page.fill("#journalBody", words);
  await page.locator("form[action='/api/journal'] button[type=submit]").click();

  await expect(page.locator("#journal-body-error")).toContainText("20,000");
  await expect(page.locator("#journalBody")).toHaveValue(words);
  await expect(page.locator("#journalBody")).toBeFocused();
  await context.close();
});

test("a link while writing asks first, and the words come back with the page", async ({
  browser,
  baseURL,
}) => {
  const context = await freshContext(browser, baseURL);
  const { page } = await signUp(context);
  const questions: string[] = [];
  let answer: "accept" | "dismiss" = "dismiss";
  page.on("dialog", (dialog) => {
    questions.push(dialog.message());
    void dialog[answer]();
  });
  await page.goto("/profile/journal");
  await page.getByRole("button", { name: "New entry" }).click();
  await page.fill("#journalTitle", "Unsaved");
  await page.fill("#journalBody", "Words I have not saved");

  // The page's own Back link is a client navigation at every width.
  const away = page.locator('main a[href="/profile"]').first();
  await away.click();
  await expect.poll(() => questions.length).toBe(1);
  expect(questions[0]).toContain("not saved yet");
  await expect(page).toHaveURL(/\/profile\/journal$/);
  await expect(page.locator("#journalBody")).toHaveValue("Words I have not saved");

  answer = "accept";
  await away.click();
  await page.waitForURL(/\/profile$/);
  await page.goBack();
  await expect(page.locator("#journalBody")).toHaveValue("Words I have not saved");
  await expect(page.locator("#journalTitle")).toHaveValue("Unsaved");
  await expect(page.getByText("Your unsaved writing is back")).toBeFocused();

  // Saved, there is nothing left to ask about or bring back.
  await page.locator("form[action='/api/journal'] button[type=submit]").click();
  await expect(page.getByRole("status").filter({ hasText: "Entry saved." })).toBeVisible();
  const asked = questions.length;
  await away.click();
  await page.waitForURL(/\/profile$/);
  expect(questions.length).toBe(asked);
  await page.goBack();
  await expect(page.getByRole("button", { name: "New entry" })).toBeVisible();
  await context.close();
});

test("a failed save says what failed: the connection, or something on our side", async ({
  browser,
  baseURL,
}) => {
  const context = await freshContext(browser, baseURL);
  const { page } = await signUp(context);
  await page.goto("/profile/journal");
  await page.getByRole("button", { name: "New entry" }).click();
  await page.fill("#journalTitle", "A title");
  await page.fill("#journalBody", "Some words");
  const save = page.locator("form[action='/api/journal'] button[type=submit]");
  const alert = page.locator("form[action='/api/journal'] [role=alert]");

  await page.route("**/api/journal", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"ok":false}' }),
  );
  await save.click();
  await expect(alert).toContainText("a problem on our side");
  await expect(alert).not.toContainText("connection");
  await page.unroute("**/api/journal");

  await page.route("**/api/journal", (route) => route.abort());
  await save.click();
  await expect(alert).toContainText("Check your connection");
  await page.unroute("**/api/journal");

  await expect(page.locator("#journalBody")).toHaveValue("Some words");
  await context.close();
});

test("a goal's journal keeps text over the limit, with the reason", async ({
  browser,
  baseURL,
}) => {
  const context = await freshContext(browser, baseURL);
  const { page } = await signUp(context);
  await context.request.post("/api/goals", {
    data: { title: "A goal", description: "x" },
    headers: { origin: new URL(page.url()).origin },
  });
  await page.goto("/profile/goals");
  await page.getByRole("button", { name: "Open journal" }).first().click();
  const form = page
    .locator("form")
    .filter({ has: page.locator("textarea") })
    .last();
  await form.locator("input").first().fill("A note");
  const body = form.locator("textarea");
  await body.focus();
  await page.keyboard.insertText("q".repeat(20010));
  await expect(body).toHaveValue("q".repeat(20010));

  await form.locator("button[type=submit]").click();
  await expect(form.locator("[role=alert]")).toContainText("20,010");
  await expect(form.locator("[role=alert]")).toContainText("20,000");
  await expect(body).toBeFocused();
  await expect(body).toHaveAttribute("aria-invalid", "true");
  await expect(body).toHaveValue("q".repeat(20010));
  await context.close();
});

test("the print page keeps the numbers a reader typed, and a long link wraps", async ({
  browser,
  baseURL,
}) => {
  const context = await freshContext(browser, baseURL);
  const { page } = await signUp(context);
  await context.addInitScript(() => {
    window.print = () => {};
  });
  const link = `https://www.vatican.va/content/francesco/en/${"a-very-long-path-".repeat(8)}.html`;
  const made = await context.request.post("/api/journal", {
    data: {
      title: "Numbers",
      body: [
        "23. The Lord is my shepherd",
        "51. Have mercy on me",
        "",
        "1917. The year of Fatima was on my mind.",
        "",
        "1. Made with",
        "1. the toolbar",
        "",
        link,
      ].join("\n"),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  const { entry } = (await made.json()) as { entry: { id: string } };
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/api/journal/${entry.id}/download`);

  await expect(page.locator("main ol").first().locator("li").first()).toHaveAttribute(
    "value",
    "23",
  );
  await expect(page.locator("main ol").first().locator("li").nth(1)).toHaveAttribute("value", "51");
  await expect(page.locator("main p").filter({ hasText: "1917." })).toHaveText(
    "1917. The year of Fatima was on my mind.",
  );
  await expect(page.locator("main ol").nth(1).locator("li[value]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await context.close();
});

// A reader on a slow connection can press before the page's script has run, and some never
// run it. These forms used to take the press, empty their fields and say nothing.
test.describe("with no script", () => {
  const noScript = async (browser: Browser, baseURL: string | undefined) =>
    browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      extraHTTPHeaders: { "x-forwarded-for": clientAddress() },
    });

  test("forgot password answers, with the address kept out of the URL", async ({
    browser,
    baseURL,
  }) => {
    const context = await noScript(browser, baseURL);
    const page = await context.newPage();
    const email = newEmail();
    await page.goto("/forgot-password");
    await page.fill("#email", email);
    await Promise.all([
      page.waitForURL(/\/forgot-password\?sent=1$/),
      page.locator("form button[type=submit]").click(),
    ]);
    await expect(page.getByText(`If an account exists for ${email}`)).toHaveRole("status");
    await context.close();
  });

  test("reset password answers, keeps the link's token, and no password", async ({
    browser,
    baseURL,
  }) => {
    const context = await noScript(browser, baseURL);
    const page = await context.newPage();
    const token = "z".repeat(43);
    const password = newPassword();
    await page.goto(`/reset-password?token=${token}`);
    await page.fill("#password", password);
    await page.fill("#passwordConfirm", `${password}x`);
    await Promise.all([
      page.waitForURL(/error=mismatch/),
      page.locator("form button[type=submit]").click(),
    ]);
    await expect(page.getByRole("alert")).toContainText("do not match");
    expect(page.url()).toContain(`token=${token}`);
    expect(page.url()).not.toContain(encodeURIComponent(password));

    await page.fill("#password", password);
    await page.fill("#passwordConfirm", password);
    await Promise.all([
      page.waitForURL(/error=not_found/),
      page.locator("form button[type=submit]").click(),
    ]);
    await expect(page.getByRole("alert")).toContainText("invalid");
    await context.close();
  });
});

test("a failed log in keeps where the reader was going and what they typed", async ({
  browser,
  baseURL,
}) => {
  const signedUp = await freshContext(browser, baseURL);
  const { email, password } = await signUp(signedUp);
  await signedUp.close();

  const context = await freshContext(browser, baseURL);
  const page = await context.newPage();
  await page.goto("/login?next=/prayers");
  await page.fill("#email", email);
  await page.fill("#password", newPassword());
  await Promise.all([
    page.waitForURL(/error=invalid/),
    page.locator("form[action='/api/auth/login'] button[type=submit]").click(),
  ]);

  expect(page.url()).toContain("next=%2Fprayers");
  expect(page.url()).not.toContain("example.test");
  await expect(page.locator("#email")).toHaveValue(email);
  await expect(page.locator("#password")).toHaveValue("");
  await expect(page.locator("#email")).toBeFocused();

  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL("**/prayers"),
    page.locator("form[action='/api/auth/login'] button[type=submit]").click(),
  ]);
  await context.close();
});

test("a taken address keeps the typed fields, and never the passwords", async ({
  browser,
  baseURL,
}) => {
  const signedUp = await freshContext(browser, baseURL);
  const { email, password } = await signUp(signedUp);
  await signedUp.close();

  const context = await freshContext(browser, baseURL);
  const page = await context.newPage();
  await page.goto("/register?next=/prayers");
  await page.fill("#firstName", "María");
  await page.fill("#lastName", "Goretti");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.fill("#passwordConfirm", password);
  await Promise.all([
    page.waitForURL(/error=exists/),
    page.locator("form[action='/api/auth/register'] button[type=submit]").click(),
  ]);

  expect(page.url()).toContain("next=%2Fprayers");
  expect(page.url()).not.toContain("example.test");
  expect(page.url()).not.toContain("Goretti");
  await expect(page.locator("#firstName")).toHaveValue("María");
  await expect(page.locator("#lastName")).toHaveValue("Goretti");
  await expect(page.locator("#email")).toHaveValue(email);
  await expect(page.locator("#email")).toBeFocused();
  await expect(page.locator("#password")).toHaveValue("");
  await expect(page.locator("#passwordConfirm")).toHaveValue("");
  await context.close();
});

for (const code of ["constructor", "__proto__", "toString"]) {
  test(`/register?error=${code} shows the form, not an error page`, async ({ page }) => {
    const response = await page.goto(`/register?error=${code}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#register-error")).toBeVisible();
  });
}

for (const hostile of ["/%09/evil.example", "/%0A/evil.example", "//evil.example"]) {
  test(`/login?next=${hostile} carries nothing off-site into the form`, async ({ page }) => {
    await page.goto(`/login?next=${hostile}`);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("input[name=next]")).toHaveCount(0);
  });
}
