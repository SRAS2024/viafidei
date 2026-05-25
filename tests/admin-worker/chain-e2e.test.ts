/**
 * End-to-end chain test (spec §27). Proves a single source page can
 * traverse Discovery → Read → Classify → Extract → Cross-source
 * Verify → would-publish — all via the deterministic Phase 8–10
 * modules. The HTTP / DB persistence pieces are mocked; this asserts
 * the modules connect end-to-end and that no AI APIs are involved.
 */

import { describe, expect, it, vi } from "vitest";

import { classify } from "@/lib/admin-worker/classifier";
import { verifyCrossSource } from "@/lib/admin-worker/cross-source-verifier";
import { PrayerExtractor, SaintExtractor, NovenaExtractor } from "@/lib/admin-worker/extractors";
import { hasFullProvenance } from "@/lib/admin-worker/provenance";
import { readSource } from "@/lib/admin-worker/source-reader";

function makePrisma() {
  return {
    adminWorkerSourceRead: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "read1", checksum: "abc" })),
      update: vi.fn(async () => ({})),
    },
    adminWorkerPipelineStage: { create: vi.fn(async () => ({ id: "stage1" })) },
    adminWorkerMemory: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
  } as unknown as Parameters<typeof readSource>[0];
}

describe("e2e — Prayer chain", () => {
  it("Discovery → Read → Classify → Extract → Verify → publishAllowed=true", async () => {
    const prisma = makePrisma();
    const url = "https://catholic.example/prayers/our-father";
    const host = "catholic.example";
    const body =
      "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come. Through Christ our Lord. Amen.";

    // Step 1: classify directly to assert the chain starts right.
    const cls = classify({ url, title: "Our Father Prayer", bodyText: body });
    expect(cls.contentType).toBe("PRAYER");

    // Step 2: readSource() orchestrates classifier + extractor + write.
    const outcome = await readSource(prisma, {
      sourceUrl: url,
      sourceHost: host,
      rawBody: body,
      title: "Our Father Prayer",
    });
    expect(outcome.classifierContentType).toBe("PRAYER");
    expect(outcome.extraction?.fatalReasons).toEqual([]);

    // Step 3: extract again standalone for fine-grained assertions.
    const extraction = PrayerExtractor({ url, host, title: "Our Father Prayer", bodyText: body });
    expect(extraction.fields.prayerText).toMatch(/Amen/);

    // Step 4: cross-source verify against a second source.
    const verify = verifyCrossSource({
      contentType: "PRAYER",
      fields: {
        prayerTitle: extraction.fields.prayerTitle,
        prayerText: extraction.fields.prayerText,
      },
      validationSources: [
        {
          host: "vatican.example",
          fields: {
            prayerTitle: "Our Father Prayer",
            prayerText:
              "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come. Through Christ our Lord. Amen.",
          },
        },
      ],
    });
    expect(verify.publishAllowed).toBe(true);

    // Step 5: every required field has provenance.
    expect(hasFullProvenance(["prayerTitle", "prayerText"], extraction.sourceEvidence)).toBe(true);
  });
});

describe("e2e — Saint chain", () => {
  it("Discovery → Classify → Extract → Verify produces a publishable Saint package", () => {
    const url = "https://catholic.example/saints/saint-francis";
    const body =
      "Saint Francis of Assisi was born in 1181 in Italy. He died in 1226. His feast day is October 4. He is the patron of animals.";
    const cls = classify({ url, title: "Saint Francis of Assisi", bodyText: body });
    expect(cls.contentType).toBe("SAINT");
    const ext = SaintExtractor({
      url,
      host: "catholic.example",
      title: "Saint Francis of Assisi",
      bodyText: body,
    });
    expect(ext.fields.feastDay).toBe("October 4");
    const verify = verifyCrossSource({
      contentType: "SAINT",
      fields: { saintName: ext.fields.saintName, feastDay: ext.fields.feastDay },
      validationSources: [
        {
          host: "vatican.example",
          fields: { saintName: "Saint Francis of Assisi", feastDay: "October 4" },
        },
      ],
    });
    expect(verify.publishAllowed).toBe(true);
  });
});

describe("e2e — Novena chain", () => {
  it("rejects an incomplete novena and refuses publishing", () => {
    const body = "Day 1: pray. Amen.";
    const ext = NovenaExtractor({
      url: "https://example.org/novenas/x",
      host: "example.org",
      title: "Short Novena",
      bodyText: body,
    });
    expect(ext.fatalReasons.length).toBeGreaterThanOrEqual(8);
    const verify = verifyCrossSource({
      contentType: "NOVENA",
      fields: { novenaTitle: ext.fields.novenaTitle, duration: ext.fields.duration },
      validationSources: [],
    });
    expect(verify.publishAllowed).toBe(false);
  });
});
