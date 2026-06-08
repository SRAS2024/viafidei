import { describe, expect, it } from "vitest";

import { inspectSchema, inspectUi } from "@/lib/admin-worker/awareness";
import { buildSelfModelCorpus } from "@/lib/admin-worker/self-model";

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

describe("self-model corpus — buildSelfModelCorpus", () => {
  it("ingests the codebase into a structured self-model corpus", () => {
    const corpus = buildSelfModelCorpus();
    expect(corpus.files.length).toBeGreaterThan(50);

    const dispatcher = corpus.files.find((f) => f.path.endsWith("admin-worker/dispatcher.ts"));
    expect(dispatcher).toBeDefined();
    // dispatcher.ts is the canonical oversized module the spec calls out.
    expect(dispatcher!.lines).toBeGreaterThan(800);
    // Deep awareness: real exports + imports, not just a line count.
    expect(dispatcher!.exports).toContain("executeMissionStage");
    expect(dispatcher!.imports.length).toBeGreaterThan(0);

    // Test files are marked; the corpus links coverage.
    expect(corpus.files.some((f) => f.isTest)).toBe(true);
    expect(corpus.files.some((f) => !f.isTest && f.referencedByTests)).toBe(true);

    // The whole-app model inputs are populated.
    expect(corpus.routes.length).toBeGreaterThan(5);
    expect(corpus.models.length).toBeGreaterThan(40);
    expect(corpus.scripts).toContain("test");
    expect(corpus.brain_ops).toContain("build_self_model");
    expect(corpus.brain_ops).not.toContain("analyze_code"); // legacy op removed
    expect(corpus.stages).toContain("PUBLIC_PUBLISH");
  });
});
