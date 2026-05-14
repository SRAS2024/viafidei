import { describe, expect, it } from "vitest";
import { looksLikeNonContent } from "@/lib/ingestion/validate";

describe("looksLikeNonContent (used by data/cleanup)", () => {
  it("flags broadcast-schedule copy", () => {
    expect(
      looksLikeNonContent(
        "EWTN live television programming is available worldwide twenty-four hours a day.",
      ),
    ).toBe(true);
  });

  it("flags newsletter sign-up copy", () => {
    expect(
      looksLikeNonContent("Subscribe to our newsletter for weekly Catholic reflections."),
    ).toBe(true);
  });

  it("flags a 'Catholic Australia, a work of' style byline", () => {
    expect(
      looksLikeNonContent(
        "Catholic Australia, a work of the Australian Catholic Bishops Conference, exists to serve.",
      ),
    ).toBe(true);
  });

  it("flags donation and shop copy", () => {
    expect(looksLikeNonContent("Donate now to support our mission. Make a donation today.")).toBe(
      true,
    );
  });

  it("flags 404 / privacy-policy navigation copy", () => {
    expect(looksLikeNonContent("404 Not Found")).toBe(true);
  });

  it("does not flag genuine prayer text", () => {
    expect(
      looksLikeNonContent(
        "Hail Mary, full of grace, the Lord is with thee. Blessed art thou among women.",
      ),
    ).toBe(false);
  });

  it("does not flag a saint biography", () => {
    expect(
      looksLikeNonContent(
        "Saint Thomas Aquinas was born in 1225 in the Kingdom of Sicily, became a Dominican friar, and produced the Summa Theologica.",
      ),
    ).toBe(false);
  });
});
