import { describe, expect, it } from "vitest";

import { inspectCode, inspectSchema, inspectUi } from "@/lib/admin-worker/awareness";

// These inspectors are pure filesystem reads over the real repo (no brain).

describe("schema awareness — inspectSchema", () => {
  it("parses Prisma models with field/relation/index counts", () => {
    const models = inspectSchema();
    expect(models.length).toBeGreaterThan(40);
    const byName = new Map(models.map((m) => [m.name, m]));

    // A known model exists and has fields.
    const brainCall = byName.get("AdminWorkerBrainCall");
    expect(brainCall).toBeDefined();
    expect(brainCall!.fields).toBeGreaterThan(5);

    // The graph edge model declares relations (fromNode / toNode).
    const edge = byName.get("AdminWorkerGraphEdge");
    expect(edge).toBeDefined();
    expect(edge!.relations).toBeGreaterThanOrEqual(2);
    expect(edge!.indexes).toBeGreaterThan(0);
  });
});

describe("UI awareness — inspectUi", () => {
  it("finds public routes and admin pages", () => {
    const ui = inspectUi();
    expect(ui.public_routes).toContain("/prayers");
    expect(ui.public_routes).toContain("/saints");
    // The new intelligence dashboard is an admin page.
    expect(ui.admin_pages).toContain("/admin/intelligence");
    // api + private route groups are excluded.
    expect(ui.public_routes).not.toContain("/api");
  });
});

describe("code awareness — inspectCode", () => {
  it("summarises worker modules and surfaces the oversized ones", () => {
    const files = inspectCode();
    expect(files.length).toBeGreaterThan(20);
    const dispatcher = files.find((f) => f.path.endsWith("admin-worker/dispatcher.ts"));
    expect(dispatcher).toBeDefined();
    // dispatcher.ts is the canonical oversized module the spec calls out.
    expect(dispatcher!.lines).toBeGreaterThan(800);
    // .test.ts and .d.ts files are excluded.
    expect(files.some((f) => f.path.includes(".test."))).toBe(false);
  });
});
