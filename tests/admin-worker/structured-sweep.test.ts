/**
 * The operator sweep (scripts/booster/saint-sweep.ts → structured/sweep.ts).
 * Pins:
 *   - it runs the worker's own pass page after page, on the BOOSTER cursor and
 *     as the lease holder, until the corpus ends, and finishes each page in
 *     one pass (limit = page size);
 *   - it resumes from the stored offset; --restart rewinds, --wake keeps it;
 *   - it renews the lease every page, releases it at the end, and never starts
 *     while someone else holds it;
 *   - it waits out a cooling Query Service and stops (resumably) when it does
 *     not come back; it pauses on a Wikipedia outage and stops after five;
 *   - it stops after --max-pages, or after the page in hand on Ctrl-C;
 *   - it says why a resting cursor will not sweep;
 *   - it warns when the running worker ignores the lease;
 *   - it logs a start and an end row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/ingest", () => ({
  runStructuredIngest: vi.fn(),
  readStructuredCursor: vi.fn(async () => ({
    offset: 400,
    exhaustedUntil: null,
    lastFullSweepAt: null,
    lastPageSize: 200,
  })),
  rewindStructuredCursor: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/structured/lease", () => ({
  acquireIngestorLease: vi.fn(async (_p: unknown, _id: string, holder: string) => ({
    ok: true,
    lease: { holder, until: Date.now() + 60_000 },
  })),
  releaseIngestorLease: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/structured/source-cooldown", () => ({
  readSourceCooldownMs: vi.fn(async () => 0),
}));
vi.mock("@/lib/admin-worker/logs", () => ({ writeAdminWorkerLog: vi.fn(async () => undefined) }));

import type { PrismaClient } from "@prisma/client";

import {
  readStructuredCursor,
  rewindStructuredCursor,
  runStructuredIngest,
  type StructuredIngestResult,
} from "@/lib/admin-worker/structured/ingest";
import { acquireIngestorLease, releaseIngestorLease } from "@/lib/admin-worker/structured/lease";
import { readSourceCooldownMs } from "@/lib/admin-worker/structured/source-cooldown";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";
import { boosterCursorId, runStructuredSweep } from "@/lib/admin-worker/structured/sweep";

const mockedIngest = vi.mocked(runStructuredIngest);
const mockedAcquire = vi.mocked(acquireIngestorLease);
const mockedRelease = vi.mocked(releaseIngestorLease);
const mockedRewind = vi.mocked(rewindStructuredCursor);
const mockedCooldown = vi.mocked(readSourceCooldownMs);
const mockedLog = vi.mocked(writeAdminWorkerLog);

function pass(over: Partial<StructuredIngestResult> = {}): StructuredIngestResult {
  return {
    ingestorId: "wikidata-saints",
    contentType: "SAINT",
    fetched: 200,
    published: 10,
    alreadyPublished: 50,
    skipped: 140,
    failed: 0,
    skipReasons: { feast_uncorroborated: 100, description_too_short: 40 },
    skipSamples: [],
    pagesSkipped: 0,
    discoveredSources: 0,
    rejectionsDeferred: 0,
    rejectionsRemembered: 140,
    exhausted: false,
    endOfCorpus: false,
    nextOffset: 600,
    pageHeld: false,
    pageHeldReason: null,
    leasedTo: null,
    restingUntil: null,
    sourceCooling: false,
    sourceFailure: null,
    sourceUnusable: false,
    errors: [],
    ...over,
  } as StructuredIngestResult;
}

/** A clock that only moves when the sweep sleeps. */
function fakeClock() {
  let t = 1_800_000_000_000;
  return {
    now: () => t,
    sleep: vi.fn(async (ms: number) => {
      t += ms;
    }),
  };
}

function makePrisma(workerLogAt: Date | null = null) {
  const findFirst = vi.fn(async () => (workerLogAt ? { createdAt: workerLogAt } : null));
  return { prisma: { adminWorkerLog: { findFirst } } as unknown as PrismaClient, findFirst };
}

beforeEach(() => {
  mockedIngest.mockReset();
  mockedAcquire.mockClear();
  mockedRelease.mockClear();
  mockedRewind.mockClear();
  mockedCooldown.mockReset();
  mockedCooldown.mockResolvedValue(0);
  mockedLog.mockClear();
  vi.mocked(readStructuredCursor).mockClear();
});

describe("structured sweep", () => {
  it("walks page after page on the booster cursor until the corpus ends", async () => {
    mockedIngest
      .mockResolvedValueOnce(pass({ nextOffset: 600, published: 12 }))
      .mockResolvedValueOnce(pass({ nextOffset: 800, published: 7 }))
      .mockResolvedValueOnce(pass({ nextOffset: 0, published: 3, endOfCorpus: true }));
    const clock = fakeClock();
    const { prisma } = makePrisma();

    const out = await runStructuredSweep(prisma, {
      contentType: "SAINT",
      batch: 200,
      holder: "sweep:test",
      ...clock,
    });

    expect(out.stop).toBe("corpus_exhausted");
    expect(out.pages).toBe(3);
    expect(out.published).toBe(22);
    expect(out.startOffset).toBe(400); // resumed from the stored cursor
    expect(out.endOffset).toBe(0);
    expect(out.skipReasons.feast_uncorroborated).toBe(300);
    for (const call of mockedIngest.mock.calls) {
      expect(call[1]).toMatchObject({
        contentType: "SAINT",
        cursorId: boosterCursorId("wikidata-saints"),
        leaseHolder: "sweep:test",
        batch: 200,
        limit: 200,
      });
    }
    expect(boosterCursorId("wikidata-saints")).toBe("wikidata-saints@booster");
    // The lease is taken, renewed before every page, and released.
    expect(mockedAcquire).toHaveBeenCalledTimes(4);
    expect(mockedRelease).toHaveBeenCalledWith(prisma, "wikidata-saints", "sweep:test");
    // A start row and an end row.
    const phases = mockedLog.mock.calls.map((c) => (c[1].safeMetadata as { phase?: string }).phase);
    expect(phases).toEqual(["start", "end"]);
    expect(mockedLog.mock.calls[1][1].message).toMatch(/22 published over 3 page/);
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("rewinds on --restart and only wakes on --wake", async () => {
    mockedIngest.mockResolvedValue(pass({ endOfCorpus: true }));
    const { prisma } = makePrisma();
    await runStructuredSweep(prisma, { contentType: "SAINT", restart: true, ...fakeClock() });
    expect(mockedRewind).toHaveBeenLastCalledWith(prisma, "wikidata-saints@booster", {
      keepOffset: false,
    });
    await runStructuredSweep(prisma, { contentType: "SAINT", wake: true, ...fakeClock() });
    expect(mockedRewind).toHaveBeenLastCalledWith(prisma, "wikidata-saints@booster", {
      keepOffset: true,
    });
  });

  it("never starts while another process holds the lease", async () => {
    mockedAcquire.mockResolvedValueOnce({
      ok: false,
      lease: { holder: "other", until: Date.now() + 60_000 },
    });
    const { prisma } = makePrisma();
    const out = await runStructuredSweep(prisma, { contentType: "SAINT", ...fakeClock() });
    expect(out.stop).toBe("leased_elsewhere");
    expect(mockedIngest).not.toHaveBeenCalled();
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it("stops after --max-pages, and after the page in hand when asked to stop", async () => {
    mockedIngest.mockResolvedValue(pass());
    const { prisma } = makePrisma();
    const capped = await runStructuredSweep(prisma, {
      contentType: "SAINT",
      maxPages: 2,
      ...fakeClock(),
    });
    expect(capped).toMatchObject({ stop: "max_pages", pages: 2 });

    let stop = false;
    mockedIngest.mockReset();
    mockedIngest.mockImplementation(async () => {
      stop = true; // Ctrl-C arrives while the page is in hand
      return pass();
    });
    const stopped = await runStructuredSweep(prisma, {
      contentType: "SAINT",
      shouldStop: () => stop,
      ...fakeClock(),
    });
    expect(stopped).toMatchObject({ stop: "stopped", pages: 1 });
    expect(mockedRelease).toHaveBeenCalledTimes(2);
  });

  it("waits out a cooling Query Service, then carries on", async () => {
    mockedCooldown.mockResolvedValue(90_000);
    mockedIngest
      .mockResolvedValueOnce(pass({ sourceCooling: true, fetched: 0, nextOffset: null }))
      .mockResolvedValueOnce(pass({ endOfCorpus: true }));
    const clock = fakeClock();
    const out = await runStructuredSweep(makePrisma().prisma, { contentType: "SAINT", ...clock });
    expect(clock.sleep).toHaveBeenCalledWith(90_000);
    expect(out).toMatchObject({ stop: "corpus_exhausted", pages: 1 });
  });

  it("stops, resumably, when the Query Service does not come back", async () => {
    mockedIngest.mockResolvedValue(
      pass({ sourceFailure: "timeout", fetched: 0, nextOffset: null }),
    );
    const out = await runStructuredSweep(makePrisma().prisma, {
      contentType: "SAINT",
      ...fakeClock(),
    });
    expect(out.stop).toBe("source_unavailable");
    expect(out.pages).toBe(0);
    expect(mockedRelease).toHaveBeenCalled();
  });

  it("pauses on a Wikipedia outage and gives up after five held pages", async () => {
    mockedIngest.mockResolvedValue(
      pass({ pageHeld: true, pageHeldReason: "source_failures", published: 0 }),
    );
    const clock = fakeClock();
    const out = await runStructuredSweep(makePrisma().prisma, { contentType: "SAINT", ...clock });
    expect(out).toMatchObject({ stop: "wikipedia_unavailable", pages: 5 });
    expect(clock.sleep).toHaveBeenCalledTimes(4);
  });

  it("keeps going straight away when a page only ran out of budget", async () => {
    mockedIngest
      .mockResolvedValueOnce(pass({ pageHeld: true, pageHeldReason: "budget" }))
      .mockResolvedValueOnce(pass({ endOfCorpus: true }));
    const clock = fakeClock();
    const out = await runStructuredSweep(makePrisma().prisma, { contentType: "SAINT", ...clock });
    expect(out).toMatchObject({ stop: "corpus_exhausted", pages: 2 });
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("says why a resting cursor will not sweep", async () => {
    const until = Date.now() + 3_600_000;
    mockedIngest.mockResolvedValueOnce(pass({ restingUntil: until, fetched: 0 }));
    const swept = await runStructuredSweep(makePrisma().prisma, {
      contentType: "SAINT",
      ...fakeClock(),
    });
    expect(swept.stop).toBe("resting");
    expect(swept.detail).toMatch(/--restart/);

    mockedIngest
      .mockResolvedValueOnce(pass({ sourceFailure: "http", fetched: 0, nextOffset: null }))
      .mockResolvedValueOnce(pass({ restingUntil: until, fetched: 0 }));
    const unusable = await runStructuredSweep(makePrisma().prisma, {
      contentType: "SAINT",
      ...fakeClock(),
    });
    expect(unusable.stop).toBe("resting");
    expect(unusable.detail).toMatch(/unusable.*--wake/);
  });

  it("warns once when the running worker ignores the lease", async () => {
    mockedIngest.mockResolvedValueOnce(pass()).mockResolvedValueOnce(pass({ endOfCorpus: true }));
    const { prisma, findFirst } = makePrisma(new Date("2026-11-01T00:00:00Z"));
    const lines: string[] = [];
    const out = await runStructuredSweep(prisma, {
      contentType: "SAINT",
      log: (l) => lines.push(l),
      ...fakeClock(),
    });
    expect(out.workerIgnoringLease).toBe("2026-11-01T00:00:00.000Z");
    expect(lines.filter((l) => /WARNING/.test(l))).toHaveLength(1);
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0]).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({
          eventName: "structured_knowledge_ingest",
          message: { startsWith: "Structured-knowledge ingest (wikidata-saints):" },
        }),
      }),
    ]);
  });

  it("refuses a content type with no structured ingestor", async () => {
    const out = await runStructuredSweep(makePrisma().prisma, {
      contentType: "NOVENA",
      ...fakeClock(),
    });
    expect(out.stop).toBe("unknown_content_type");
    expect(mockedAcquire).not.toHaveBeenCalled();
  });
});
