import { describe, expect, it } from "vitest";

import { extractByType, type ExtractorInput } from "@/lib/admin-worker/extractors";
import { popeSchema } from "@/lib/checklist/schemas/pope";
import { toChecklistContentType } from "@/lib/admin-worker/classifier";

const base = (over: Partial<ExtractorInput>): ExtractorInput => ({
  url: over.url ?? "https://www.vatican.va/x",
  host: over.host ?? "vatican.va",
  title: over.title ?? null,
  bodyText: over.bodyText ?? "",
});

describe("pope content type", () => {
  it("is a publishable catalog type", () => {
    expect(toChecklistContentType("POPE")).toBe("POPE");
    expect(popeSchema.contentType).toBe("POPE");
  });

  it("extracts the regnal name and a closed papacy range", () => {
    const out = extractByType(
      "POPE",
      base({
        title: "Pope Saint John Paul II",
        bodyText:
          "Pope Saint John Paul II served as pope from 1978 to 2005 and was a towering figure of the twentieth-century Church who reshaped the modern papacy.",
      }),
    );
    expect(out.fatalReasons).toEqual([]);
    expect(out.fields.popeName).toBe("Pope Saint John Paul II");
    expect(out.fields.papacyStart).toBe("1978");
    expect(out.fields.papacyEnd).toBe("2005");
  });

  it("leaves papacyEnd empty for the reigning pope (to present)", () => {
    const out = extractByType(
      "POPE",
      base({
        title: "Pope Francis",
        bodyText:
          "Pope Francis has reigned from 2013 to present as the Bishop of Rome and successor of Saint Peter, leading the universal Church with a focus on mercy.",
      }),
    );
    expect(out.fatalReasons).toEqual([]);
    expect(out.fields.papacyStart).toBe("2013");
    expect(out.fields.papacyEnd).toBeUndefined();
  });

  it("validates a complete pope record", () => {
    const ok = popeSchema.schema.safeParse({
      slug: "pope-francis",
      title: "Pope Francis",
      papacyStart: "2013",
      citations: ["https://www.vatican.va/content/francesco/en.html"],
    });
    expect(ok.success).toBe(true);
  });
});
