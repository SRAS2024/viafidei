import { describe, expect, it } from "vitest";

import { validatePayload } from "@/lib/worker/schemas";
import { findCuratedEntry } from "@/lib/worker/knowledge";

describe("Divine Mercy Chaplet guide", () => {
  const entry = findCuratedEntry("GUIDE", "how-to-pray-the-divine-mercy-chaplet");

  it("exists as a curated GUIDE of kind 'chaplet'", () => {
    expect(entry).toBeDefined();
    expect(entry?.payload.kind).toBe("chaplet");
    expect(entry?.payload.title).toBe("How to Pray the Divine Mercy Chaplet");
  });

  it("validates against the guide schema with ordered steps", () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const result = validatePayload("GUIDE", entry.payload);
    expect(result.ok, result.ok ? "" : result.errors.join("; ")).toBe(true);
    const steps = entry.payload.steps as Array<{ body: string }>;
    expect(steps.length).toBeGreaterThanOrEqual(5);
    // The two defining petitions of the chaplet are present, verbatim.
    const text = steps.map((s) => s.body).join(" ");
    expect(text).toMatch(/Eternal Father, I offer You the Body and Blood/);
    expect(text).toMatch(/For the sake of His sorrowful Passion/);
  });
});
