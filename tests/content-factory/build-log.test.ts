/**
 * listRecentBuildFailures + recordBuildLog admin queries.
 *
 * Spec line: "Build logs should answer why content was not created."
 * The factory writes one ContentPackageBuildLog row per attempt;
 * the admin Build Failures page reads from it via this function.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listRecentBuildFailures, recordBuildLog } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

describe("listRecentBuildFailures", () => {
  it("filters to non-built_complete_package rows and returns the latest first", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      {
        id: "log1",
        contentType: "Prayer",
        sourceUrl: "https://vatican.va/p1",
        sourceHost: "vatican.va",
        buildStatus: "build_failed_missing_required_fields",
        failureReason: "missing prayerText",
        missingFieldsJson: ["prayerText"],
        createdAt: new Date("2025-01-02"),
      },
      {
        id: "log2",
        contentType: "Saint",
        sourceUrl: "https://vatican.va/s1",
        sourceHost: "vatican.va",
        buildStatus: "wrong_content",
        failureReason: "looks like a parish page",
        missingFieldsJson: [],
        createdAt: new Date("2025-01-01"),
      },
    ]);
    const rows = await listRecentBuildFailures({ limit: 20 });
    expect(rows.length).toBe(2);
    expect(rows[0].contentType).toBe("Prayer");
    expect(rows[0].failureReason).toContain("missing prayerText");
    expect(rows[0].missingFields).toContain("prayerText");
    // The where clause filters to NOT built_complete_package.
    const call = prismaMock.contentPackageBuildLog.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect((call.where.buildStatus as { not?: string }).not).toBe("built_complete_package");
  });

  it("scopes by contentType when given", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    await listRecentBuildFailures({ contentType: "Saint", limit: 10 });
    const call = prismaMock.contentPackageBuildLog.findMany.mock.calls[0][0] as {
      where: { contentType?: string };
    };
    expect(call.where.contentType).toBe("Saint");
  });

  it("caps the limit at 500", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    await listRecentBuildFailures({ limit: 99999 });
    const call = prismaMock.contentPackageBuildLog.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(call.take).toBe(500);
  });
});

describe("recordBuildLog", () => {
  it("writes a row with builder name + version + status for a successful build", async () => {
    prismaMock.contentPackageBuildLog.create.mockResolvedValue({ id: "log" });
    await recordBuildLog({
      result: {
        outcome: "built_complete_package",
        contentType: "Prayer",
        builderName: "PrayerBuilder",
        builderVersion: "1.0.0",
        package: {
          contentType: "Prayer",
          slug: "ave-maria",
          title: "Ave Maria",
          sourceUrl: "https://vatican.va/p",
          sourceHost: "vatican.va",
          payload: { prayerText: "Hail Mary…" },
          provenance: {},
        },
        missingFields: [],
      },
      sourceUrl: "https://vatican.va/p",
      sourceHost: "vatican.va",
    });
    const call = prismaMock.contentPackageBuildLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.builderName).toBe("PrayerBuilder");
    expect(call.data.builderVersion).toBe("1.0.0");
    expect(call.data.buildStatus).toBe("built_complete_package");
    expect(call.data.contentType).toBe("Prayer");
    expect(call.data.candidateSlug).toBe("ave-maria");
  });

  it("writes the failure reason + missing fields on a failed build", async () => {
    prismaMock.contentPackageBuildLog.create.mockResolvedValue({ id: "log" });
    await recordBuildLog({
      result: {
        outcome: "build_failed_missing_required_fields",
        contentType: "Saint",
        builderName: "SaintBuilder",
        builderVersion: "1.0.0",
        failureReason: "biography too short",
        missingFields: ["biography"],
      },
      sourceUrl: "https://example.com/s",
      sourceHost: "example.com",
    });
    const call = prismaMock.contentPackageBuildLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.buildStatus).toBe("build_failed_missing_required_fields");
    expect(call.data.failureReason).toBe("biography too short");
    expect(call.data.missingFieldsJson).toEqual(["biography"]);
  });

  it("does not throw when the DB write fails", async () => {
    prismaMock.contentPackageBuildLog.create.mockRejectedValue(new Error("DB outage"));
    await expect(
      recordBuildLog({
        result: {
          outcome: "wrong_content",
          contentType: "Devotion",
          builderName: "DevotionBuilder",
          builderVersion: "1.0.0",
          failureReason: "looks like a livestream",
          missingFields: [],
        },
        sourceUrl: "https://example.com/d",
        sourceHost: "example.com",
      }),
    ).resolves.toBeUndefined();
  });
});
