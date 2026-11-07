/**
 * Curated re-publish-on-change (seed-curated-content.ts → syncCuratedUpdates).
 *
 * The curated knowledge base is the worker's ground truth. When an entry that
 * is ALREADY live is improved in the repository, the live row must follow —
 * through the content-protection gate (snapshot + version bump), bounded per
 * pass, and only when the corpus fingerprint actually changed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/checklist", () => ({
  ALL_CURATED_ENTRIES: [],
  validatePayload: vi.fn(() => ({ ok: true })),
}));

import {
  curatedKnowledgeFingerprint,
  mergeCuratedPayload,
  syncCuratedUpdates,
} from "@/lib/admin-worker/seed-curated-content";

import { asStoredInJsonb } from "../helpers/jsonb-order";

interface Row {
  id: string;
  contentType: string;
  slug: string;
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown>;
  version: number;
  contentChecksum: string | null;
}

function fakePrisma(rows: Row[]) {
  const memory = new Map<string, unknown>();
  const versions: unknown[] = [];
  return {
    rows,
    versions,
    memory,
    publishedContent: {
      findMany: vi.fn(
        async ({ where }: { where: { contentType: string; slug: { in: string[] } } }) =>
          rows
            .filter((r) => r.contentType === where.contentType && where.slug.in.includes(r.slug))
            .map((r) => ({ ...r })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const r = rows.find((x) => x.id === where.id);
        return r ? { ...r } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const r = rows.find((x) => x.id === where.id)!;
        if (typeof (data as { version?: { increment: number } }).version === "object") {
          r.version += (data as { version: { increment: number } }).version.increment;
        } else {
          Object.assign(r, data);
        }
        return { ...r };
      }),
    },
    publishedContentVersion: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        versions.push(data);
        return { id: `v${versions.length}` };
      }),
    },
    checklistItem: { updateMany: vi.fn(async () => ({ count: 1 })) },
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = memory.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v } : null;
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          create: { memoryValue: unknown };
        }) => {
          memory.set(where.memoryType_memoryKey.memoryKey, create.memoryValue);
          return {};
        },
      ),
    },
  };
}

const guideEntry = (summary: string) => ({
  contentType: "GUIDE" as const,
  slug: "how-to-pray-the-rosary",
  authorityLevel: "USCCB" as const,
  citations: ["https://www.usccb.org/", "https://www.vatican.va/"],
  payload: {
    slug: "how-to-pray-the-rosary",
    title: "How to Pray the Holy Rosary",
    kind: "rosary",
    summary,
    steps: [{ order: 1, title: "Begin", body: "Make the Sign of the Cross and pray the Creed." }],
    citations: ["https://www.usccb.org/", "https://www.vatican.va/"],
  },
});

describe("mergeCuratedPayload", () => {
  it("keeps worker enrichments, lets curated fields win, drops fields the entry removed", () => {
    const merged = mergeCuratedPayload(
      { body: "old", latin: "Pater noster", contentSubtype: "common_prayer", stale: "x" },
      { body: "new" },
    );
    expect(merged).toEqual({ body: "new", latin: "Pater noster", contentSubtype: "common_prayer" });
  });

  it("a curated Latin text overrides a machine-built one", () => {
    expect(mergeCuratedPayload({ latin: "machine" }, { latin: "curated" }).latin).toBe("curated");
  });
});

describe("curatedKnowledgeFingerprint", () => {
  it("is stable for identical corpora and changes when any entry changes", () => {
    const a = curatedKnowledgeFingerprint([guideEntry("A short guide to the Rosary.")]);
    const b = curatedKnowledgeFingerprint([guideEntry("A short guide to the Rosary.")]);
    const c = curatedKnowledgeFingerprint([guideEntry("A much better guide to the Rosary.")]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("changes when only a field inside a step changes", () => {
    const entry = guideEntry("A short guide to the Rosary.");
    const edited = {
      ...entry,
      payload: {
        ...entry.payload,
        steps: [{ ...entry.payload.steps[0]!, body: "Kneel, then pray the Creed." }],
      },
    };
    expect(curatedKnowledgeFingerprint([edited])).not.toBe(curatedKnowledgeFingerprint([entry]));
  });

  it("does not change when a source file only writes the keys in another order", () => {
    const entry = guideEntry("A short guide to the Rosary.");
    const reordered = { ...entry, payload: asStoredInJsonb(entry.payload) };
    expect(JSON.stringify(reordered.payload)).not.toBe(JSON.stringify(entry.payload));
    expect(curatedKnowledgeFingerprint([reordered])).toBe(curatedKnowledgeFingerprint([entry]));
  });
});

describe("syncCuratedUpdates", () => {
  let rows: Row[];
  beforeEach(() => {
    rows = [
      {
        id: "g1",
        contentType: "GUIDE",
        slug: "how-to-pray-the-rosary",
        title: "How to Pray the Holy Rosary",
        subtitle: "A guide to Catholic life and practice",
        payload: { ...guideEntry("A short guide to the Rosary.").payload, contentSubtype: null },
        version: 1,
        contentChecksum: "old",
      },
    ];
  });

  it("re-publishes a live entry whose curated text changed, versioned and reversible", async () => {
    const prisma = fakePrisma(rows);
    const entries = [guideEntry("A much better, step-by-step guide to the Rosary.")];
    const res = await syncCuratedUpdates(prisma as never, { entries, limit: 25 });

    expect(res.checked).toBe(1);
    expect(res.updated).toBe(1);
    expect(res.remaining).toBe(0);
    expect(res.errors).toEqual([]);
    const row = rows[0]!;
    expect(row.payload.summary).toBe("A much better, step-by-step guide to the Rosary.");
    expect(row.version).toBe(2);
    expect(prisma.versions).toHaveLength(1);
    expect(row.contentChecksum).not.toBe("old");
    // The fingerprint is remembered once nothing is pending…
    expect(prisma.memory.get("curated-knowledge-fingerprint")).toEqual({
      fingerprint: curatedKnowledgeFingerprint(entries),
    });
    // …so the next pass is a no-op without touching the catalog.
    const again = await syncCuratedUpdates(prisma as never, { entries, limit: 25 });
    expect(again.checked).toBe(0);
    expect(prisma.publishedContent.findMany).toHaveBeenCalledTimes(1);
  });

  it("carries a correction made only inside a step, on the worker's own call", async () => {
    // No force, and the corpus already recorded as synced: this is what every pass does.
    const prisma = fakePrisma(rows);
    const synced = [guideEntry("A short guide to the Rosary.")];
    const settled = await syncCuratedUpdates(prisma as never, { entries: synced });
    expect(settled).toMatchObject({ checked: 1, updated: 0, errors: [] });

    const steps = [{ order: 1, title: "Begin", body: "Kneel, then pray the Creed." }];
    const entries = [{ ...synced[0]!, payload: { ...synced[0]!.payload, steps } }];
    const res = await syncCuratedUpdates(prisma as never, { entries });
    expect(res).toMatchObject({ checked: 1, updated: 1, remaining: 0, errors: [] });
    expect(rows[0]!.payload.steps).toEqual(steps);
    expect(rows[0]!.version).toBe(2);
    expect(prisma.versions).toHaveLength(1);

    // Remembered, so the next pass does not go looking again.
    const again = await syncCuratedUpdates(prisma as never, { entries });
    expect(again.checked).toBe(0);
  });

  it("does nothing when the live row already matches the curated entry", async () => {
    const prisma = fakePrisma(rows);
    const entries = [guideEntry("A short guide to the Rosary.")];
    const res = await syncCuratedUpdates(prisma as never, { entries });
    expect(res.checked).toBe(1);
    expect(res.updated).toBe(0);
    expect(prisma.versions).toHaveLength(0);
    expect(rows[0]!.version).toBe(1);
  });

  it("leaves a live row alone when jsonb has only reordered its keys", async () => {
    // Every guide's steps and every sacrament's matterAndForm look like this once stored,
    // and a comparison that minds key order re-published them all on every sync.
    const entries = [guideEntry("A short guide to the Rosary.")];
    const stored = asStoredInJsonb(rows[0]!.payload);
    expect(JSON.stringify(stored)).not.toBe(JSON.stringify(rows[0]!.payload));
    expect(Object.keys((stored.steps as Record<string, unknown>[])[0]!)).toEqual([
      "body",
      "order",
      "title",
    ]);
    rows[0]!.payload = stored;

    const prisma = fakePrisma(rows);
    const res = await syncCuratedUpdates(prisma as never, { entries, force: true });
    expect(res).toMatchObject({ checked: 1, updated: 0, remaining: 0, errors: [] });
    expect(prisma.versions).toHaveLength(0);
    expect(rows[0]!.version).toBe(1);
    expect(rows[0]!.contentChecksum).toBe("old");
  });

  it("a second sync after a real change updates nothing", async () => {
    const entries = [
      {
        ...guideEntry("A short guide to the Rosary."),
        payload: {
          ...guideEntry("A short guide to the Rosary.").payload,
          steps: [{ order: 1, title: "Begin", body: "Kneel, then pray the Creed." }],
        },
      },
    ];
    rows[0]!.payload = asStoredInJsonb(rows[0]!.payload);
    const prisma = fakePrisma(rows);

    // A real change inside a step, under keys jsonb has reordered, still goes through.
    const first = await syncCuratedUpdates(prisma as never, { entries, force: true });
    expect(first.updated).toBe(1);
    expect(prisma.versions).toHaveLength(1);
    expect(rows[0]!.version).toBe(2);

    // What was just written comes back from the column reordered, and is left alone.
    rows[0]!.payload = asStoredInJsonb(rows[0]!.payload);
    const second = await syncCuratedUpdates(prisma as never, { entries, force: true });
    expect(second).toMatchObject({ checked: 1, updated: 0, remaining: 0, errors: [] });
    expect(prisma.versions).toHaveLength(1);
    expect(rows[0]!.version).toBe(2);
  });

  it("is bounded per pass and keeps draining until nothing is pending", async () => {
    rows.push({
      ...rows[0]!,
      id: "g2",
      slug: "how-to-go-to-confession",
      title: "How to Go to Confession",
      payload: {
        ...rows[0]!.payload,
        slug: "how-to-go-to-confession",
        title: "How to Go to Confession",
      },
    });
    const prisma = fakePrisma(rows);
    const entries = [
      guideEntry("Rewritten rosary guide."),
      {
        ...guideEntry("Rewritten confession guide."),
        slug: "how-to-go-to-confession",
        payload: {
          ...guideEntry("Rewritten confession guide.").payload,
          slug: "how-to-go-to-confession",
          title: "How to Go to Confession",
          kind: "confession",
        },
      },
    ];
    const first = await syncCuratedUpdates(prisma as never, { entries, limit: 1 });
    expect(first.updated).toBe(1);
    expect(first.remaining).toBe(1);
    expect(prisma.memory.has("curated-knowledge-fingerprint")).toBe(false);

    const second = await syncCuratedUpdates(prisma as never, { entries, limit: 1 });
    expect(second.updated).toBe(1);
    expect(second.remaining).toBe(0);
    expect(prisma.memory.has("curated-knowledge-fingerprint")).toBe(true);
  });
});
