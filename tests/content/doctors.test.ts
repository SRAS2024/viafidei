import { describe, expect, it } from "vitest";

import { extractByType, type ExtractorInput } from "@/lib/admin-worker/extractors";
import { doctorSchema } from "@/lib/checklist/schemas/doctor";
import { toChecklistContentType } from "@/lib/admin-worker/classifier";

const base = (over: Partial<ExtractorInput>): ExtractorInput => ({
  url: over.url ?? "https://www.vatican.va/x",
  host: over.host ?? "vatican.va",
  title: over.title ?? null,
  bodyText: over.bodyText ?? "",
});

describe("doctor-of-the-church content type", () => {
  it("is a publishable catalog type", () => {
    expect(toChecklistContentType("DOCTOR")).toBe("DOCTOR");
    expect(doctorSchema.contentType).toBe("DOCTOR");
  });

  it("extracts the doctoral epithet and a feast day", () => {
    const out = extractByType(
      "DOCTOR",
      base({
        title: "Saint Augustine of Hippo",
        bodyText:
          "Saint Augustine of Hippo is honored as the Doctor of Grace for his profound theological writings on grace, the Trinity, and the City of God. His feast day is August 28.",
      }),
    );
    expect(out.fatalReasons).toEqual([]);
    expect(out.fields.doctorName).toBe("Saint Augustine of Hippo");
    expect(String(out.fields.doctorTitle)).toMatch(/Doctor of Grace/);
    expect(out.fields.feastDay).toBe("August 28");
  });

  it("recognizes the single-word doctoral epithets", () => {
    const out = extractByType(
      "DOCTOR",
      base({
        title: "Saint Thomas Aquinas",
        bodyText:
          "Saint Thomas Aquinas, known as the Angelic Doctor, was a Dominican friar whose Summa Theologiae shaped Catholic theology for centuries.",
      }),
    );
    expect(String(out.fields.doctorTitle)).toMatch(/Angelic Doctor/);
  });

  it("validates a complete doctor record", () => {
    const ok = doctorSchema.schema.safeParse({
      slug: "doctor-thomas-aquinas",
      title: "Saint Thomas Aquinas",
      doctorTitle: "Angelic Doctor",
      citations: ["https://www.vatican.va/x"],
    });
    expect(ok.success).toBe(true);
  });
});
