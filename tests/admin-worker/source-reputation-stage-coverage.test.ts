/**
 * Spec §19: source reputation must update after EVERY stage —
 * discovery, fetch, read, classification, extraction, validation,
 * strict QA, quality score, publishing, post-publish verification.
 *
 * This static scan confirms a reputation push (pushReputation with the
 * right `stage:`, or recordSourceOutcome in the fetcher) is wired into
 * each stage's source module, so a regression that drops one is caught.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ReputationStage } from "@/lib/admin-worker/source-reputation-hooks";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(here, "../../src/lib/admin-worker", rel), "utf8");

const dispatcher = src("dispatcher.ts");
const sourceReader = src("source-reader.ts");
const fetcher = src("fetcher.ts");
const discovery = src("discovery-orchestrator.ts");

describe("source reputation updates after every stage (spec §19)", () => {
  it("ReputationStage union covers all spec §19 stages", () => {
    // Compile-time: every spec stage must be assignable to ReputationStage.
    const stages: ReputationStage[] = [
      "discovery",
      "fetch",
      "source_read",
      "classification",
      "extraction",
      "verification",
      "qa",
      "publish",
      "post_publish",
      "repair",
    ];
    expect(stages.length).toBe(10);
  });

  it("discovery pushes reputation (discovery-orchestrator)", () => {
    expect(discovery).toContain('stage: "discovery"');
  });

  it("fetch updates reputation (fetcher)", () => {
    expect(fetcher).toContain("recordSourceOutcome");
  });

  it("source read pushes reputation (source-reader)", () => {
    expect(sourceReader).toContain('stage: "source_read"');
  });

  it("classification pushes reputation (dispatcher)", () => {
    expect(dispatcher).toContain('stage: "classification"');
  });

  it("extraction pushes reputation (dispatcher)", () => {
    expect(dispatcher).toContain('stage: "extraction"');
  });

  it("validation pushes reputation (dispatcher cross-source stage)", () => {
    expect(dispatcher).toContain('stage: "verification"');
  });

  it("strict QA pushes reputation (dispatcher strict-QA stage)", () => {
    expect(dispatcher).toContain('stage: "qa"');
  });

  it("publishing (incl. quality-score gate) pushes reputation (dispatcher persist stage)", () => {
    expect(dispatcher).toContain('stage: "publish"');
  });

  it("post-publish pushes reputation (dispatcher)", () => {
    expect(dispatcher).toContain('stage: "post_publish"');
  });
});
