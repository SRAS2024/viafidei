import { describe, expect, it } from "vitest";
import { sendBiweeklyAdminReport } from "@/lib/email";

describe("biweekly report ingestion health summary", () => {
  it("accepts an optional IngestionHealthSummary parameter", async () => {
    const result = await sendBiweeklyAdminReport(
      {},
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-15T00:00:00Z"),
      {
        totalJobsRun: 42,
        jobsCompleted: 40,
        jobsFailed: 1,
        jobsRetried: 5,
        itemsSentToReview: 17,
        sourcesFailing: 2,
        archivedThisWindow: 30,
        permanentlyDeletedThisWindow: 5,
        dedupedThisWindow: 12,
      },
    );
    expect(typeof result.ok).toBe("boolean");
  });

  it("works without the optional summary parameter (backwards compatible)", async () => {
    const result = await sendBiweeklyAdminReport(
      {},
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-15T00:00:00Z"),
    );
    expect(typeof result.ok).toBe("boolean");
  });
});
