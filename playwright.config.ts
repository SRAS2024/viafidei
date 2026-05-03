import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// E2E and visual regression suite. Browsers are NOT installed by default;
// run `npx playwright install --with-deps` before invoking `npm run test:e2e`.
// CI runs this in a separate job that explicitly installs browsers.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? "e2e-only-session-secret-must-be-32-chars-minimum",
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/viafidei_e2e",
    },
  },
});
