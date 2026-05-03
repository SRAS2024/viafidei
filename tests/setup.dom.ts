// Loaded for every Vitest run. The matchers and the cleanup hook only
// activate when a test is running in the jsdom environment (component
// tests use the `@vitest-environment jsdom` doc-comment at the top of
// the file). In node-environment tests these imports are inert.

import { afterEach } from "vitest";

if (typeof window !== "undefined" && typeof document !== "undefined") {
  // jest-dom matchers (toBeInTheDocument, etc.) extend Vitest's expect.
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
