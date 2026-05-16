import { describe, expect, it } from "vitest";
import { validateSaintPackage } from "@/lib/content-qa/contracts/saint";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const VATICAN = staticPurposesForHost("vatican.va");
const PARISH_DIR = staticPurposesForHost("parishesonline.com");

describe("SaintPackage contract", () => {
  it("accepts an actual saint profile", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "saint-anthony-of-padua",
        title: "Saint Anthony of Padua",
        sourceUrl: "https://www.vatican.va/saints/anthony",
        sourceHost: "vatican.va",
        payload: {
          saintType: "Doctor of the Church",
          saintName: "Saint Anthony of Padua",
          feastDay: "June 13",
          feastMonth: 6,
          feastDayOfMonth: 13,
          background:
            "Saint Anthony of Padua was born in Lisbon, Portugal in 1195. He became a Franciscan friar in 1220 and was renowned for his preaching. He died in 1231 and was canonized the next year. He is a Doctor of the Church and patron saint of lost things.",
          patronage: ["lost things", "Portugal", "the poor"],
          sourceProvidesFeastDay: true,
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("deletes a saint candidate that is actually a parish named after the saint", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "saint-mary-parish",
        title: "Saint Mary Parish",
        sourceUrl: "https://www.vatican.va/saint-mary",
        sourceHost: "vatican.va",
        payload: {
          saintType: "Saint",
          saintName: "Saint Mary Parish",
          background:
            "Welcome to Saint Mary Parish. Mass schedule: Sunday 8am, 10am. Office hours: Mon-Fri 9am-5pm. Visit our staff directory to learn more about our parish ministry.",
          patronage: [],
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a saint candidate that is a school named after the saint", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "saint-paul-academy",
        title: "Saint Paul Academy",
        sourceUrl: "https://www.vatican.va/school",
        sourceHost: "vatican.va",
        payload: {
          saintType: "Saint",
          saintName: "Saint Paul Academy",
          background:
            "Saint Paul Academy is a K-12 Catholic school in Saint Paul, Minnesota. Our staff is dedicated to academic excellence. Mass schedule available.",
          patronage: [],
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a livestream from a saint church", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "saint-peter-livestream",
        title: "Saint Peter Church",
        sourceUrl: "https://www.vatican.va/livestream",
        sourceHost: "vatican.va",
        payload: {
          saintType: "Saint",
          saintName: "Saint Peter Church",
          background:
            "Welcome to our parish. Watch live every Sunday at 10am on our YouTube livestream. Bulletin available online.",
          patronage: [],
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("rejects a saint missing biography", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "no-bio",
        title: "Saint Foo",
        sourceUrl: "https://www.vatican.va/saint-foo",
        sourceHost: "vatican.va",
        payload: {
          saintType: "Saint",
          saintName: "Saint Foo",
          background: "",
          patronage: [],
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("background");
  });

  it("rejects a saint missing feast day from a feast-day source", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "saint-no-feast",
        title: "Saint Foo",
        sourceUrl: "https://www.vatican.va/saint-foo",
        sourceHost: "vatican.va",
        payload: {
          saintType: "Saint",
          saintName: "Saint Foo",
          background:
            "Saint Foo was a holy person who lived a long time ago. Born around 1200, he became a priest and died as a martyr in 1250. He is the patron of foo.",
          patronage: ["foo"],
          sourceProvidesFeastDay: true,
          // feastMonth + feastDayOfMonth deliberately omitted
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("feastDay");
  });

  it("rejects a saint from a source not approved for saints", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "saint-from-parish-dir",
        title: "Saint Anthony",
        sourceUrl: "https://parishesonline.com/saint",
        sourceHost: "parishesonline.com",
        payload: {
          saintType: "Saint",
          saintName: "Saint Anthony",
          feastMonth: 6,
          feastDayOfMonth: 13,
          background: "Born in 1195. Died in 1231. Patron of lost things.",
          patronage: ["lost things"],
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("reject");
    expect(result.reason).toMatch(/canIngestSaints/);
  });

  it("rejects a saint with invalid feast month", () => {
    const result = validateSaintPackage(
      {
        contentType: "Saint",
        slug: "saint-bad-month",
        title: "Saint Foo",
        sourceUrl: "https://www.vatican.va/saint-foo",
        sourceHost: "vatican.va",
        payload: {
          saintType: "Saint",
          saintName: "Saint Foo",
          feastMonth: 13, // invalid
          feastDayOfMonth: 1,
          background:
            "Saint Foo was a holy person who lived a long time ago. Born around 1200, he became a priest and died as a martyr in 1250. He is the patron of foo.",
          patronage: ["foo"],
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("feastMonth");
  });
});
