import { describe, expect, it } from "vitest";

import { extractByType, type ExtractorInput } from "@/lib/admin-worker/extractors";
import { riteSchema } from "@/lib/worker/schemas/rite";
import { ritesChecklist } from "@/lib/worker/checklists/rites";
import { CATHOLIC_RITES } from "@/lib/content-shared/rites";
import { toChecklistContentType } from "@/lib/admin-worker/classifier";

const base = (over: Partial<ExtractorInput>): ExtractorInput => ({
  url: over.url ?? "https://www.vatican.va/x",
  host: over.host ?? "vatican.va",
  title: over.title ?? null,
  bodyText: over.bodyText ?? "",
});

describe("rite content type", () => {
  it("is a publishable catalog type", () => {
    expect(toChecklistContentType("RITE")).toBe("RITE");
    expect(riteSchema.contentType).toBe("RITE");
  });

  it("seeds one record per recognized Catholic rite", () => {
    expect(ritesChecklist).toHaveLength(CATHOLIC_RITES.length);
    expect(ritesChecklist.every((r) => typeof r.metadata?.riteKey === "string")).toBe(true);
  });

  it("extracts the rite name and a history section", () => {
    const out = extractByType(
      "RITE",
      base({
        title: "Byzantine Rite",
        bodyText:
          "History: The Byzantine Rite developed in Constantinople and spread across the Eastern Churches, shaping the Divine Liturgy of Saint John Chrysostom over many centuries of tradition.",
      }),
    );
    expect(out.fatalReasons).toEqual([]);
    expect(out.fields.riteName).toBe("Byzantine Rite");
    expect(String(out.fields.history)).toMatch(/Byzantine Rite developed/);
  });

  it("validates a complete rite record", () => {
    const ok = riteSchema.schema.safeParse({
      slug: "rite-roman",
      title: "Roman (Latin) Rite",
      riteKey: "roman",
      history: "The Roman Rite is the predominant liturgical rite of the Latin Church.",
      citations: ["https://www.vatican.va/x"],
    });
    expect(ok.success).toBe(true);
  });
});
