/**
 * Validation fetcher (follow-up §1). Proves the verifier actually
 * fetches validation source pages and compares fields — not just
 * names hosts and records MISSING_EVIDENCE.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/fetcher", () => ({
  adminWorkerFetch: vi.fn(),
}));

vi.mock("@/lib/admin-worker/source-reader", () => ({
  readSource: vi.fn(async () => ({
    sourceReadId: "sr",
    reused: false,
    checksum: "cs",
    classifierContentType: "SAINT",
    classifierConfidence: 0.9,
    classifierReasons: [],
    extraction: null,
    pipelineStageId: null,
    rejected: false,
    rejectionReason: null,
  })),
}));

vi.mock("@/lib/admin-worker/validation-source-resolver", () => ({
  resolveValidationSources: vi.fn(async () => [
    {
      host: "www.vatican.va",
      authority: "VATICAN" as const,
      reason: "Vatican calendar",
      pastSuccessRate: 0,
      reputationTier: "TRUSTED" as const,
      rank: 1,
    },
    {
      host: "www.usccb.org",
      authority: "USCCB" as const,
      reason: "USCCB liturgical calendar",
      pastSuccessRate: 0,
      reputationTier: "GOOD" as const,
      rank: 0.8,
    },
  ]),
}));

import { fetchAndCompareValidation } from "@/lib/admin-worker/validation-fetcher";
import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";

function mockFetchOk(body: string) {
  vi.mocked(adminWorkerFetch).mockResolvedValue({
    url: "x",
    finalUrl: "x",
    httpStatus: 200,
    contentType: "text/html",
    contentLength: body.length,
    checksum: "ck",
    etag: null,
    lastModifiedHeader: null,
    body,
    durationMs: 1,
    attempt: 1,
    succeeded: true,
    unchanged: false,
    rejectionReason: null,
    errorClass: null,
    errorMessage: null,
    fetchResultRowId: "fr",
    redirectChain: [],
  });
}

function mockFetchFail() {
  vi.mocked(adminWorkerFetch).mockResolvedValue({
    url: "x",
    finalUrl: "x",
    httpStatus: 500,
    contentType: null,
    contentLength: null,
    checksum: null,
    etag: null,
    lastModifiedHeader: null,
    body: "",
    durationMs: 1,
    attempt: 1,
    succeeded: false,
    unchanged: false,
    rejectionReason: "HTTP 500",
    errorClass: "HTTP_500",
    errorMessage: "HTTP 500",
    fetchResultRowId: null,
    redirectChain: [],
  });
}

const prisma = {} as unknown as Parameters<typeof fetchAndCompareValidation>[0];

describe("fetchAndCompareValidation (spec §1 follow-up)", () => {
  it("returns MATCH when the validation page body contains the expected value", async () => {
    mockFetchOk("<p>Saint Pio — feast day: September 23</p>");
    const out = await fetchAndCompareValidation(prisma, {
      contentType: "SAINT",
      field: "feastDay",
      expectedValue: "September 23",
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].matchStatus).toBe("MATCH");
    expect(out[0].host).toBe("www.vatican.va");
  });

  it("returns MISMATCH when the body loads but the expected value is missing", async () => {
    mockFetchOk("<p>Some unrelated content</p>");
    const out = await fetchAndCompareValidation(prisma, {
      contentType: "SAINT",
      field: "feastDay",
      expectedValue: "September 23",
    });
    expect(out[0].matchStatus).toBe("MISMATCH");
  });

  it("returns MISSING_EVIDENCE when every probe URL fails to fetch", async () => {
    mockFetchFail();
    const out = await fetchAndCompareValidation(prisma, {
      contentType: "SAINT",
      field: "feastDay",
      expectedValue: "September 23",
    });
    expect(out[0].matchStatus).toBe("MISSING_EVIDENCE");
  });

  it("respects excludeAuthorities so the conflict-retry path can skip lower tiers", async () => {
    mockFetchOk("<p>October 1</p>");
    const out = await fetchAndCompareValidation(prisma, {
      contentType: "SAINT",
      field: "feastDay",
      expectedValue: "October 1",
      excludeAuthorities: ["VATICAN"],
    });
    // VATICAN was excluded so the only remaining host should be USCCB.
    expect(out.every((r) => r.host !== "www.vatican.va")).toBe(true);
  });

  it("returns empty list when the resolver returns no sources", async () => {
    const { resolveValidationSources } =
      await import("@/lib/admin-worker/validation-source-resolver");
    vi.mocked(resolveValidationSources).mockResolvedValueOnce([]);
    const out = await fetchAndCompareValidation(prisma, {
      contentType: "PARISH",
      field: "irrelevant",
      expectedValue: "x",
    });
    expect(out).toEqual([]);
  });

  it("returns MISSING_EVIDENCE when expected value is empty", async () => {
    mockFetchOk("<p>anything</p>");
    const out = await fetchAndCompareValidation(prisma, {
      contentType: "SAINT",
      field: "feastDay",
      expectedValue: "",
    });
    expect(out[0].matchStatus).toBe("MISSING_EVIDENCE");
  });
});
