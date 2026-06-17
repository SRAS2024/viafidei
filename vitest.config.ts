import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Single Vitest config. Component tests opt into jsdom via the
// `@vitest-environment jsdom` doc-comment at the top of the file
// (see tests/components/**.test.tsx). Everything else runs in Node.
//
// Integration tests live under tests/integration/** and are excluded
// from the default `npm test` run; they're picked up only when
// VITEST_INTEGRATION=1 is set, since they need a real Postgres at
// $TEST_DATABASE_URL.

const runIntegration = process.env.VITEST_INTEGRATION === "1";

export default defineConfig({
  // Vitest 4 transforms via Vite 8 (rolldown/oxc). The React plugin
  // transpiles `.tsx`/`.jsx` (automatic runtime, `react` import source) in
  // both the browser and the SSR/module-runner path Vitest uses, so component
  // test files need no explicit `import React`. Vite's built-in transform
  // alone does not JSX-transform files for the SSR runner, which is why
  // `.tsx` files failed to parse without this plugin.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // Integration tests all share ONE Postgres, and several mutate shared rows
    // (content goals, published content). Run their files SEQUENTIALLY so they
    // can't race each other — e.g. one test seeding all content goals while
    // another asserts on a hand-seeded subset. Unit tests stay fully parallel.
    fileParallelism: !runIntegration,
    setupFiles: runIntegration
      ? ["tests/setup.ts", "tests/setup.dom.ts", "tests/setup.integration.ts"]
      : ["tests/setup.ts", "tests/setup.dom.ts"],
    include: runIntegration
      ? ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
      : ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: runIntegration
      ? ["**/node_modules/**", "**/dist/**"]
      : ["**/node_modules/**", "**/dist/**", "tests/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/lib/auth/**",
        "src/lib/security/rate-limit.ts",
        "src/lib/db/tables.ts",
        "src/middleware.ts",
        "src/components/ui/ConfirmDialog.tsx",
      ],
      thresholds: {
        // Minimum coverage for security-critical surface (auth, rate
        // limiting, middleware, DB diagnostics, destructive-confirm UI).
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
