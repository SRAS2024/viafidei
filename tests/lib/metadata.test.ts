import { describe, expect, it } from "vitest";
import { appConfig } from "@/lib/config";
import { buildDetailMetadata, canonicalUrlFor, notFoundMetadataFor } from "@/lib/metadata";

const BASE = appConfig.canonicalUrl.replace(/\/$/, "");

describe("canonicalUrlFor", () => {
  it("returns the trailing-slash root for the empty path or '/'", () => {
    expect(canonicalUrlFor("")).toBe(`${BASE}/`);
    expect(canonicalUrlFor("/")).toBe(`${BASE}/`);
  });

  it("joins absolute paths to the canonical base without double slashes", () => {
    expect(canonicalUrlFor("/prayers")).toBe(`${BASE}/prayers`);
    expect(canonicalUrlFor("/prayers/anima-christi")).toBe(`${BASE}/prayers/anima-christi`);
  });

  it("inserts the leading slash when the caller forgot it", () => {
    expect(canonicalUrlFor("prayers/te-deum")).toBe(`${BASE}/prayers/te-deum`);
  });

  it("trims one trailing slash from the canonical base before joining", () => {
    // Even if appConfig.canonicalUrl ever ends in "/", the helper must
    // not produce "//prayers".
    const url = canonicalUrlFor("/prayers");
    expect(url).not.toMatch(/\/\/prayers$/);
  });
});

describe("buildDetailMetadata", () => {
  it("sets alternates.canonical to the supplied path (relative form)", () => {
    const meta = buildDetailMetadata({ path: "/prayers/te-deum", title: "Te Deum" });
    expect(meta.alternates?.canonical).toBe("/prayers/te-deum");
  });

  it("sets openGraph.url to the absolute canonical URL", () => {
    const meta = buildDetailMetadata({ path: "/saints/augustine", title: "St. Augustine" });
    expect(meta.openGraph?.url).toBe(`${BASE}/saints/augustine`);
  });

  it("pins openGraph.siteName and type to the brand defaults", () => {
    const meta = buildDetailMetadata({ path: "/x", title: "X" });
    expect(meta.openGraph?.siteName).toBe("Via Fidei");
    expect(meta.openGraph?.type).toBe("article");
  });

  it("includes the description on every channel when provided", () => {
    const meta = buildDetailMetadata({
      path: "/x",
      title: "X",
      description: "An ancient prayer of the Church.",
    });
    expect(meta.description).toBe("An ancient prayer of the Church.");
    // OpenGraph object is the typed Next.js shape; cast to extract fields
    // we just set without making the test sensitive to unrelated keys.
    const og = meta.openGraph as { description?: string };
    expect(og.description).toBe("An ancient prayer of the Church.");
    const tw = meta.twitter as { description?: string };
    expect(tw.description).toBe("An ancient prayer of the Church.");
  });

  it("omits description fields entirely when none was passed", () => {
    const meta = buildDetailMetadata({ path: "/x", title: "X" });
    expect(meta.description).toBeUndefined();
    const og = meta.openGraph as { description?: string };
    expect(og.description).toBeUndefined();
  });

  it("includes the image only when imageUrl is supplied", () => {
    const without = buildDetailMetadata({ path: "/x", title: "X" });
    const og = without.openGraph as { images?: unknown };
    expect(og.images).toBeUndefined();

    const withImage = buildDetailMetadata({
      path: "/x",
      title: "X",
      imageUrl: "https://res.cloudinary.com/example.jpg",
    });
    const ogWith = withImage.openGraph as { images?: Array<{ url: string }> };
    expect(ogWith.images?.[0]?.url).toBe("https://res.cloudinary.com/example.jpg");
  });

  it("uses summary_large_image twitter card only when an image is set", () => {
    const noImage = buildDetailMetadata({ path: "/x", title: "X" });
    const tw1 = noImage.twitter as { card?: string };
    expect(tw1.card).toBe("summary");

    const withImage = buildDetailMetadata({
      path: "/x",
      title: "X",
      imageUrl: "https://res.cloudinary.com/x.jpg",
    });
    const tw2 = withImage.twitter as { card?: string };
    expect(tw2.card).toBe("summary_large_image");
  });
});

describe("notFoundMetadataFor", () => {
  it("returns a stable Not Found title and noindex/nofollow", () => {
    const meta = notFoundMetadataFor("/prayers");
    expect(meta.title).toBe("Not Found");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("anchors the canonical at the supplied index path so search engines re-find the index", () => {
    expect(notFoundMetadataFor("/prayers").alternates?.canonical).toBe("/prayers");
    expect(notFoundMetadataFor("saints").alternates?.canonical).toBe("/saints");
  });
});
