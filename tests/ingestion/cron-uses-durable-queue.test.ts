/**
 * Section 6: prove the cron route does NOT execute adapters directly
 * — every ingestion call must flow through `enqueueDueIngestionJobs`
 * (the planner) and the worker is the sole executor.
 *
 * Structural test: scan src/app/api/cron/ingest/route.ts and verify
 * it imports the planner + does NOT import `runAdapter` /
 * `runAdapterByName` / any direct adapter executor.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE = join(process.cwd(), "src/app/api/cron/ingest/route.ts");

describe("cron route only enqueues, never executes adapters", () => {
  it("imports the planner", () => {
    const src = readFileSync(ROUTE, "utf-8");
    expect(src).toContain("enqueueDueIngestionJobs");
  });

  it("does NOT call runAdapter directly", () => {
    const src = readFileSync(ROUTE, "utf-8");
    expect(src.includes("runAdapter(")).toBe(false);
    expect(src.includes("runAdapterByName(")).toBe(false);
  });

  it("does NOT import the runner module", () => {
    const src = readFileSync(ROUTE, "utf-8");
    expect(src.includes('from "@/lib/ingestion/runner"')).toBe(false);
    expect(src.includes('from "../../ingestion/runner"')).toBe(false);
  });
});

describe("worker dispatch is the only adapter executor", () => {
  it("dispatch.ts imports runAdapter (it's the sole executor)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/ingestion/queue/dispatch.ts"), "utf-8");
    expect(src).toContain("runAdapter");
  });
});
