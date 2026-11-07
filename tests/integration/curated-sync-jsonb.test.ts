/**
 * Integration proof: a curated entry's nested objects can go through a REAL jsonb
 * column, where Postgres puts their keys in its own order, without the curated sync
 * taking that for an edit. The unit tests imitate the reordering; this is the column.
 * Before the comparison ignored key order, every guide (steps) and every sacrament
 * (matterAndForm) was re-published with a new version row on every sync.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { syncCuratedUpdates } from "@/lib/admin-worker/seed-curated-content";
import { ALL_CURATED_ENTRIES } from "@/lib/checklist";
import type { CuratedEntry } from "@/lib/checklist/knowledge";
import { prisma } from "@/lib/db/client";

function testEntry(contentType: string): CuratedEntry {
  const real = ALL_CURATED_ENTRIES.find((entry) => entry.contentType === contentType)!;
  const slug = `test-jsonb-key-order-${contentType.toLowerCase()}`;
  return { ...real, slug, payload: { ...real.payload, slug } };
}

const GUIDE = testEntry("GUIDE");
const SACRAMENT = testEntry("SACRAMENT");
const ENTRIES = [GUIDE, SACRAMENT];
const SLUGS = ENTRIES.map((entry) => entry.slug);

async function cleanup() {
  await prisma.publishedContentVersion.deleteMany({ where: { slug: { in: SLUGS } } });
  await prisma.publishedContent.deleteMany({ where: { slug: { in: SLUGS } } });
  await prisma.checklistItem.deleteMany({ where: { canonicalSlug: { in: SLUGS } } });
  await prisma.adminWorkerLog.deleteMany({ where: { eventName: "curated_knowledge_sync" } });
  await prisma.adminWorkerMemory.deleteMany({
    where: { memoryKey: "curated-knowledge-fingerprint" },
  });
}

async function publish(entry: CuratedEntry) {
  const item = await prisma.checklistItem.create({
    data: {
      contentType: entry.contentType,
      canonicalName: entry.slug,
      canonicalSlug: entry.slug,
      approvalStatus: "APPROVED_FOR_BUILD",
    },
  });
  await prisma.publishedContent.create({
    data: {
      checklistItemId: item.id,
      contentType: entry.contentType,
      slug: entry.slug,
      title: String(entry.payload.title),
      payload: entry.payload as never,
      authorityLevel: entry.authorityLevel,
      isPublished: true,
    },
  });
}

const stored = (entry: CuratedEntry) =>
  prisma.publishedContent.findFirstOrThrow({ where: { slug: entry.slug } });

const versionRows = () => prisma.publishedContentVersion.count({ where: { slug: { in: SLUGS } } });

describe("curated sync against a real jsonb column (integration)", () => {
  beforeEach(async () => {
    await cleanup();
    await publish(GUIDE);
    await publish(SACRAMENT);
  });
  afterAll(cleanup);

  it("the column really does hand the keys back in another order", async () => {
    const written = GUIDE.payload.steps as Record<string, unknown>[];
    const row = (await stored(GUIDE)).payload as { steps: Record<string, unknown>[] };
    expect(row.steps).toEqual(written);
    expect(Object.keys(row.steps[0]!)).not.toEqual(Object.keys(written[0]!));
  });

  it("leaves rows alone when only the column has reordered their keys", async () => {
    const res = await syncCuratedUpdates(prisma, { entries: ENTRIES, force: true });
    expect(res).toMatchObject({ checked: 2, updated: 0, remaining: 0, errors: [] });
    expect(await versionRows()).toBe(0);
    expect((await stored(GUIDE)).version).toBe(1);
    expect((await stored(SACRAMENT)).version).toBe(1);
  });

  it("a real change inside a step goes through once, and the next sync updates nothing", async () => {
    const steps = (GUIDE.payload.steps as Record<string, unknown>[]).map((step, index) =>
      index === 0 ? { ...step, body: `${String(step.body)} Then kneel.` } : step,
    );
    const changed = { ...GUIDE, payload: { ...GUIDE.payload, steps } };
    const entries = [changed, SACRAMENT];

    const first = await syncCuratedUpdates(prisma, { entries, force: true });
    expect(first).toMatchObject({ checked: 2, updated: 1, errors: [] });
    expect(await versionRows()).toBe(1);
    const row = await stored(GUIDE);
    expect(row.version).toBe(2);
    expect((row.payload as { steps: unknown[] }).steps).toEqual(steps);

    const second = await syncCuratedUpdates(prisma, { entries, force: true });
    expect(second).toMatchObject({ checked: 2, updated: 0, errors: [] });
    expect(await versionRows()).toBe(1);
    expect((await stored(GUIDE)).version).toBe(2);
  });

  it("the worker's own call carries a correction made only inside a nested field", async () => {
    // No force, and the corpus already recorded as synced: this is what every pass does.
    const settled = await syncCuratedUpdates(prisma, { entries: ENTRIES });
    expect(settled).toMatchObject({ checked: 2, updated: 0, errors: [] });
    expect(await syncCuratedUpdates(prisma, { entries: ENTRIES })).toMatchObject({ checked: 0 });

    const matterAndForm = {
      ...(SACRAMENT.payload.matterAndForm as Record<string, unknown>),
      form: "A corrected form.",
    };
    const corrected = { ...SACRAMENT, payload: { ...SACRAMENT.payload, matterAndForm } };
    const entries = [GUIDE, corrected];

    const res = await syncCuratedUpdates(prisma, { entries });
    expect(res).toMatchObject({ checked: 2, updated: 1, remaining: 0, errors: [] });
    const row = await stored(SACRAMENT);
    expect((row.payload as { matterAndForm: unknown }).matterAndForm).toEqual(matterAndForm);
    expect(row.version).toBe(2);
    expect(await versionRows()).toBe(1);

    expect(await syncCuratedUpdates(prisma, { entries })).toMatchObject({ checked: 0, updated: 0 });
    expect(await versionRows()).toBe(1);
  });
});
