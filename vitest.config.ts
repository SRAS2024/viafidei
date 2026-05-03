import { defineConfig } from "vitest/config";
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  esbuild: {
    // Automatic JSX runtime so component test files don't need an
    // explicit `import React from "react"` — matches Next's behavior.
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "node",
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
