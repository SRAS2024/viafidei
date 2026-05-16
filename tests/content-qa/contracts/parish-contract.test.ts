import { describe, expect, it } from "vitest";
import { validateParishPackage } from "@/lib/content-qa/contracts/parish";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const PARISH_DIR = staticPurposesForHost("parishesonline.com");
const VATICAN = staticPurposesForHost("vatican.va");

describe("ParishPackage contract", () => {
  it("accepts an actual parish record", () => {
    const result = validateParishPackage(
      {
        contentType: "Parish",
        slug: "saint-marys-boston",
        title: "Saint Mary's Catholic Church",
        sourceUrl: "https://parishesonline.com/saint-marys",
        sourceHost: "parishesonline.com",
        payload: {
          parishName: "Saint Mary's Catholic Church",
          address: "123 Main St",
          city: "Boston",
          region: "MA",
          country: "United States",
          diocese: "Archdiocese of Boston",
          websiteUrl: "https://saintmarys.org",
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("publish");
  });

  it("deletes a bulletin page", () => {
    const result = validateParishPackage(
      {
        contentType: "Parish",
        slug: "weekly-bulletin",
        title: "Weekly Parish Bulletin",
        sourceUrl: "https://parishesonline.com/bulletin",
        sourceHost: "parishesonline.com",
        payload: {
          parishName: "Weekly Parish Bulletin",
          address: "Various",
          city: "Boston",
          country: "United States",
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a livestream page", () => {
    const result = validateParishPackage(
      {
        contentType: "Parish",
        slug: "live-stream",
        title: "Live Stream Mass Page",
        sourceUrl: "https://parishesonline.com/livestream",
        sourceHost: "parishesonline.com",
        payload: {
          parishName: "Live Stream Mass Page",
          address: "Live",
          city: "Boston",
          country: "United States",
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a staff page", () => {
    const result = validateParishPackage(
      {
        contentType: "Parish",
        slug: "staff-page",
        title: "Saint Foo Parish Staff Directory",
        sourceUrl: "https://parishesonline.com/staff",
        sourceHost: "parishesonline.com",
        payload: {
          parishName: "Saint Foo Parish Staff Directory",
          address: "123 Main St",
          city: "Boston",
          country: "United States",
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a school page", () => {
    const result = validateParishPackage(
      {
        contentType: "Parish",
        slug: "saint-foo-academy",
        title: "Saint Foo Academy",
        sourceUrl: "https://parishesonline.com/school",
        sourceHost: "parishesonline.com",
        payload: {
          parishName: "Saint Foo Academy",
          address: "123 Main St",
          city: "Boston",
          country: "United States",
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("delete");
  });

  it("rejects a parish missing location", () => {
    const result = validateParishPackage(
      {
        contentType: "Parish",
        slug: "no-location",
        title: "Saint Mary's Catholic Church",
        sourceUrl: "https://parishesonline.com/no-loc",
        sourceHost: "parishesonline.com",
        payload: {
          parishName: "Saint Mary's Catholic Church",
          address: "",
          city: "",
          country: "",
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("country");
  });

  it("rejects a parish from a non-parish source", () => {
    const result = validateParishPackage(
      {
        contentType: "Parish",
        slug: "from-vatican",
        title: "Saint Mary's",
        sourceUrl: "https://www.vatican.va/parish",
        sourceHost: "vatican.va",
        payload: {
          parishName: "Saint Mary's",
          address: "123 Main St",
          city: "Rome",
          country: "Italy",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("reject");
    expect(result.reason).toMatch(/not approved to ingest parishes|canIngestParishes/);
  });
});
