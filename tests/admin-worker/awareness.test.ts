import { describe, expect, it } from "vitest";

import { inspectSchema, inspectUi } from "@/lib/admin-worker/awareness";

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
