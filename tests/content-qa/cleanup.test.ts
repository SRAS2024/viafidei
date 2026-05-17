/**
 * Strict content QA cleanup — unit tests for the existing-content audit
 * job. These tests use the prismaMock to verify that:
 *
 *   - Valid PUBLISHED rows are flagged with publicRenderReady +
 *     isThresholdEligible.
 *   - Invalid rows are DELETED + logged under the strict
 *     `deleteAllInvalid` policy. They are NEVER left in REVIEW or DRAFT
 *     by the automatic loop.
 *   - Noise rows (livestream / event / bulletin) are hard-deleted with
 *     a RejectedContentLog entry written BEFORE deletion.
 *   - The rejection log carries the new provenance fields:
 *     packageVersion, validationDecision, failureCategory, cleanupMode,
 *     sweepReason, originalStatus.
 *   - The legacy `public_only` + non-`deleteAllInvalid` policy still
 *     parks missing-field failures in REVIEW for backwards safety.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runStrictContentCleanup } from "@/lib/content-qa/cleanup";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.spiritualLifeGuide,
    prismaMock.liturgyEntry,
    prismaMock.parish,
    prismaMock.dailyLiturgy,
  ]) {
    m.findMany.mockResolvedValue([]);
    m.delete.mockResolvedValue({});
    m.update.mockResolvedValue({});
  }
  prismaMock.rejectedContentLog.createMany.mockResolvedValue({ count: 0 });
  prismaMock.rejectedContentLog.create.mockResolvedValue({});
  prismaMock.dataManagementLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runStrictContentCleanup — strict deleteAllInvalid policy", () => {
  it("flags a valid Prayer row as publicRenderReady = true", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p1",
        slug: "hail-mary",
        defaultTitle: "Hail Mary",
        body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women. Pray for us. Amen.",
        category: "Marian",
        prayerType: "Marian prayer",
        externalSourceKey: "https://www.vatican.va/hail-mary",
        sourceUrl: "https://www.vatican.va/hail-mary",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "abc",
      },
    ]);

    const summary = await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });

    expect(prismaMock.prayer.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.prayer.update.mock.calls[0][0];
    expect(updateCall.data.publicRenderReady).toBe(true);
    expect(updateCall.data.isThresholdEligible).toBe(true);
    expect(updateCall.data.packageValidationStatus).toBe("valid");
    expect(updateCall.data.status).toBeUndefined();
    expect(summary.totalFlaggedReady).toBe(1);
    expect(summary.totalHardDeleted).toBe(0);
    expect(summary.mode).toBe("all_catalog_rows");
    expect(summary.deleteAllInvalid).toBe(true);
  });

  it("hard-deletes a Prayer that is actually a livestream and logs the rejection", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p2",
        slug: "livestream-prayer",
        defaultTitle: "Watch Live: Rosary on YouTube",
        body: "Join us live on Facebook every Sunday at 7pm. Watch on YouTube. Click here to register now for the livestream.",
        category: "Daily",
        prayerType: "Traditional Catholic prayer",
        externalSourceKey: "https://www.vatican.va/livestream",
        sourceUrl: "https://www.vatican.va/livestream",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "xyz",
      },
    ]);

    const summary = await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });

    expect(prismaMock.prayer.delete).toHaveBeenCalledWith({ where: { id: "p2" } });
    expect(prismaMock.rejectedContentLog.createMany).toHaveBeenCalled();
    const logCall = prismaMock.rejectedContentLog.createMany.mock.calls[0][0];
    const rejections = logCall.data;
    expect(rejections).toHaveLength(1);
    expect(rejections[0].contentType).toBe("Prayer");
    expect(rejections[0].decision).toBe("delete");
    expect(rejections[0].failureCategory).toBe("wrong_content");
    expect(rejections[0].cleanupMode).toBe("all_catalog_rows");
    expect(rejections[0].sweepReason).toBe("scheduled");
    expect(rejections[0].originalStatus).toBe("PUBLISHED");
    expect(rejections[0].packageVersion).toBeDefined();
    expect(rejections[0].validationDecision).toBe("delete");
    expect(summary.totalHardDeleted).toBe(1);
  });

  it("under strict policy, a Prayer with a missing required field is DELETED, not parked in REVIEW", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p3",
        slug: "missing-prayer-type",
        defaultTitle: "No Type",
        body: "Lord, hear my prayer. Amen.",
        category: "",
        prayerType: null,
        externalSourceKey: "https://www.vatican.va/no-type",
        sourceUrl: "https://www.vatican.va/no-type",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "qqq",
      },
    ]);

    const summary = await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });

    expect(prismaMock.prayer.delete).toHaveBeenCalledWith({ where: { id: "p3" } });
    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
    expect(prismaMock.rejectedContentLog.createMany).toHaveBeenCalled();
    const rejections = prismaMock.rejectedContentLog.createMany.mock.calls[0][0].data;
    expect(rejections[0].contentType).toBe("Prayer");
    // The contract returns `reject` for missing-field failures; the
    // wrong-content detector returns `delete`. Under deleteAllInvalid
    // both produce a deleted row, so the log decision is either one.
    expect(["delete", "reject"]).toContain(rejections[0].decision);
    expect(["missing_required_field", "wrong_content"]).toContain(rejections[0].failureCategory);
    expect(summary.totalHardDeleted).toBe(1);
  });

  it("strict policy never leaves an invalid row in REVIEW (deletes a REVIEW-status row outright)", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p4",
        slug: "stuck-in-review",
        defaultTitle: "Half Prayer",
        body: "Lord.",
        category: "",
        prayerType: null,
        externalSourceKey: "https://www.vatican.va/half",
        sourceUrl: "https://www.vatican.va/half",
        sourceHost: "vatican.va",
        status: "REVIEW",
        contentChecksum: "rrr",
      },
    ]);

    const summary = await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });

    expect(prismaMock.prayer.delete).toHaveBeenCalledWith({ where: { id: "p4" } });
    expect(prismaMock.rejectedContentLog.createMany).toHaveBeenCalled();
    const rejections = prismaMock.rejectedContentLog.createMany.mock.calls[0][0].data;
    expect(rejections[0].originalStatus).toBe("REVIEW");
    expect(summary.totalHardDeleted).toBe(1);
  });

  it("strict policy never leaves an invalid row in DRAFT (deletes a DRAFT-status row outright)", async () => {
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "s-draft",
        slug: "draft-saint",
        canonicalName: "Saint Stub",
        biography: "",
        patronages: [],
        feastDay: null,
        feastMonth: null,
        feastDayOfMonth: null,
        externalSourceKey: "https://www.vatican.va/stub",
        sourceUrl: "https://www.vatican.va/stub",
        sourceHost: "vatican.va",
        status: "DRAFT",
        contentChecksum: "drf",
      },
    ]);

    await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });

    expect(prismaMock.saint.delete).toHaveBeenCalledWith({ where: { id: "s-draft" } });
    const rejections = prismaMock.rejectedContentLog.createMany.mock.calls[0][0].data;
    expect(rejections[0].originalStatus).toBe("DRAFT");
  });

  it("logs each deletion with content type, source, reason, and full provenance", async () => {
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "s1",
        slug: "saint-mary-parish",
        canonicalName: "Saint Mary Parish",
        biography: "Office hours: Mon-Fri 9-5. Mass schedule: Sunday 8am, 10am, 12pm.",
        patronages: [],
        feastDay: null,
        feastMonth: null,
        feastDayOfMonth: null,
        officialPrayer: null,
        externalSourceKey: "https://www.vatican.va/parish",
        sourceUrl: "https://www.vatican.va/parish",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "ck",
      },
    ]);

    await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
      sweepReason: "post_ingestion",
    });

    expect(prismaMock.saint.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    const logCall = prismaMock.rejectedContentLog.createMany.mock.calls[0][0];
    expect(logCall.data[0].contentType).toBe("Saint");
    expect(logCall.data[0].sourceUrl).toContain("vatican.va");
    expect(logCall.data[0].rejectionReason).toMatch(/institution|parish|wrong/i);
    expect(logCall.data[0].sweepReason).toBe("post_ingestion");
    expect(logCall.data[0].originalStatus).toBe("PUBLISHED");
    expect(logCall.data[0].originalChecksum).toBe("ck");
  });

  it("writes the rejection log BEFORE deleting (log-failure must keep row alive)", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-log-fail",
        slug: "logfail",
        defaultTitle: "Watch live for nothing",
        body: "Click here to register now for our livestream broadcast on YouTube. Watch live.",
        category: "Daily",
        prayerType: "Traditional Catholic prayer",
        externalSourceKey: "https://www.vatican.va/lf",
        sourceUrl: "https://www.vatican.va/lf",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "lf",
      },
    ]);
    prismaMock.rejectedContentLog.createMany.mockRejectedValueOnce(new Error("db unreachable"));

    const summary = await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });

    expect(prismaMock.prayer.delete).not.toHaveBeenCalled();
    expect(summary.totalHardDeleted).toBe(0);
    expect(summary.totalLogFailures).toBeGreaterThanOrEqual(1);
  });

  it("legacy mode (deleteAllInvalid=false, public_only) still parks missing-field failures in REVIEW", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-legacy",
        slug: "legacy-missing-type",
        defaultTitle: "Half Prayer",
        body: "Lord, hear my prayer. Amen.",
        category: "",
        prayerType: null,
        externalSourceKey: "https://www.vatican.va/legacy",
        sourceUrl: "https://www.vatican.va/legacy",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "lg",
      },
    ]);

    await runStrictContentCleanup({
      policy: { deleteAllInvalid: false, mode: "public_only" },
    });

    expect(prismaMock.prayer.delete).not.toHaveBeenCalled();
    expect(prismaMock.prayer.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.prayer.update.mock.calls[0][0];
    expect(updateCall.data.publicRenderReady).toBe(false);
    expect(updateCall.data.status).toBe("REVIEW");
  });

  it("scan-all-catalog-rows mode finds REVIEW + DRAFT + ARCHIVED rows", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-archived",
        slug: "archived-prayer",
        defaultTitle: "Old Prayer",
        body: "Watch live every Sunday on YouTube. Click here for the livestream.",
        category: "Daily",
        prayerType: "Traditional Catholic prayer",
        externalSourceKey: "https://www.vatican.va/old",
        sourceUrl: "https://www.vatican.va/old",
        sourceHost: "vatican.va",
        status: "ARCHIVED",
        contentChecksum: "old",
      },
    ]);

    await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });

    expect(prismaMock.prayer.findMany).toHaveBeenCalled();
    const findCall = prismaMock.prayer.findMany.mock.calls[0][0];
    expect(findCall.where).toEqual({});
    expect(prismaMock.prayer.delete).toHaveBeenCalledWith({ where: { id: "p-archived" } });
  });

  it("public_only mode keeps the legacy where clause (PUBLISHED or publicRenderReady=true)", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([]);
    await runStrictContentCleanup({
      policy: { deleteAllInvalid: false, mode: "public_only" },
    });
    const findCall = prismaMock.prayer.findMany.mock.calls[0][0];
    expect(findCall.where).toEqual({
      OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }],
    });
  });

  it("records a CLEANUP DataManagementLog row after each run", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([]);
    await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });
    expect(prismaMock.dataManagementLog.create).toHaveBeenCalled();
    const createCall = prismaMock.dataManagementLog.create.mock.calls.find(
      (c) =>
        (c[0] as { data?: { action?: string; contentType?: string } })?.data?.action ===
          "CLEANUP" &&
        (c[0] as { data?: { action?: string; contentType?: string } })?.data?.contentType ===
          "ContentQA",
    );
    expect(createCall).toBeDefined();
  });
});

describe("runStrictContentCleanup — strong wrong-content patterns", () => {
  async function expectDeletedForPattern(args: {
    table: "prayer" | "saint" | "marianApparition" | "devotion" | "liturgyEntry" | "parish";
    row: Record<string, unknown>;
  }) {
    const mock = prismaMock[args.table];
    mock.findMany.mockResolvedValue([args.row]);
    await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });
    expect(mock.delete).toHaveBeenCalled();
  }

  it("deletes a prayer that is actually a livestream", async () => {
    await expectDeletedForPattern({
      table: "prayer",
      row: {
        id: "x1",
        slug: "live",
        defaultTitle: "Watch live: prayer event",
        body: "Click here to register now for our livestream. Watch on YouTube.",
        category: "Daily",
        prayerType: "Traditional Catholic prayer",
        externalSourceKey: "https://www.vatican.va/x",
        sourceUrl: "https://www.vatican.va/x",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "x1",
      },
    });
  });

  it("deletes a saint biography that is actually a parish announcement", async () => {
    await expectDeletedForPattern({
      table: "saint",
      row: {
        id: "x2",
        slug: "fake-saint",
        canonicalName: "Saint Mary Parish",
        biography:
          "Welcome to our parish bulletin. Click here for the donation page. Office hours: Mon-Fri.",
        patronages: [],
        feastDay: null,
        feastMonth: null,
        feastDayOfMonth: null,
        externalSourceKey: "https://parish.example/announcement",
        sourceUrl: "https://parish.example/announcement",
        sourceHost: "parish.example",
        status: "PUBLISHED",
        contentChecksum: "x2",
      },
    });
  });
});

describe("runStrictContentCleanup — does not delete valid content with harmless words", () => {
  it("keeps a valid prayer that mentions the word 'Mass' in context", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "ok1",
        slug: "prayer-before-mass",
        defaultTitle: "Prayer Before Mass",
        body: "O Lord, as we prepare to receive your sacred body in the Eucharist, open our hearts to receive your word and your presence. Lord have mercy on us, deliver us, and grant that we may always thank you for this gift. We beseech you through Christ our Lord. Amen.",
        category: "Eucharistic",
        prayerType: "Eucharistic prayer",
        externalSourceKey: "https://www.vatican.va/ok1",
        sourceUrl: "https://www.vatican.va/ok1",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "ok1",
      },
    ]);
    await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });
    expect(prismaMock.prayer.delete).not.toHaveBeenCalled();
    expect(prismaMock.prayer.update).toHaveBeenCalledTimes(1);
  });

  it("keeps a valid saint biography that mentions a parish in passing", async () => {
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "ok2",
        slug: "saint-anthony-padua",
        canonicalName: "Saint Anthony of Padua",
        biography:
          "Saint Anthony of Padua was born in 1195 in Lisbon. He became a Franciscan friar and traveled to many parishes, preaching the gospel. He died in 1231 and is a Doctor of the Church, patron of lost things, and one of the most beloved saints of the Franciscan order.",
        patronages: ["lost things"],
        feastDay: null,
        feastMonth: 6,
        feastDayOfMonth: 13,
        externalSourceKey: "https://www.vatican.va/ok2",
        sourceUrl: "https://www.vatican.va/ok2",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "ok2",
      },
    ]);
    await runStrictContentCleanup({
      policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
    });
    expect(prismaMock.saint.delete).not.toHaveBeenCalled();
    expect(prismaMock.saint.update).toHaveBeenCalledTimes(1);
  });
});
