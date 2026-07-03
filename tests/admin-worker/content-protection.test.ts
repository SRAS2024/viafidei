/**
 * Published-content protection (adaptive-worker Phase E).
 *
 * Pins the core guarantee: the worker never silently destroys good published
 * content. Additive "enrich" edits apply (with a reversible snapshot + version
 * bump); destructive "replace"/"shrink" edits are refused unless explicitly
 * allowed AND backed by quality + evidence; and every applied edit is
 * restorable from its snapshot.
 */
import { describe, expect, it } from "vitest";

import {
  applyProtectedContentUpdate,
  evaluateContentChange,
  restorePublishedContentVersion,
  snapshotPublishedContent,
} from "@/lib/admin-worker/content-protection";

// ── evaluateContentChange (pure) ──────────────────────────────────────────────

describe("evaluateContentChange", () => {
  it("filling an empty field is enrich (additive)", () => {
    const a = evaluateContentChange({ body: "text", latin: "" }, { body: "text", latin: "Pater" });
    expect(a.kind).toBe("enrich");
    expect(a.addedFields).toEqual(["latin"]);
    expect(a.shrunkFields).toEqual([]);
  });

  it("adding a brand-new field is enrich", () => {
    const a = evaluateContentChange({ body: "text" }, { body: "text", greek: "Πάτερ" });
    expect(a.kind).toBe("enrich");
    expect(a.addedFields).toEqual(["greek"]);
  });

  it("extending an existing string is enrich (not destructive)", () => {
    const a = evaluateContentChange({ body: "Hail Mary" }, { body: "Hail Mary, full of grace" });
    expect(a.kind).toBe("enrich");
    expect(a.extendedFields).toEqual(["body"]);
  });

  it("appending to an array is enrich", () => {
    const a = evaluateContentChange({ tags: ["a"] }, { tags: ["a", "b"] });
    expect(a.kind).toBe("enrich");
    expect(a.extendedFields).toEqual(["tags"]);
  });

  it("emptying a non-empty field is replace (destructive)", () => {
    const a = evaluateContentChange({ body: "important text" }, { body: "" });
    expect(a.kind).toBe("replace");
    expect(a.shrunkFields).toEqual(["body"]);
  });

  it("replacing a field with different non-empty content is replace", () => {
    const a = evaluateContentChange({ body: "original" }, { body: "totally different" });
    expect(a.kind).toBe("replace");
    expect(a.changedFields).toEqual(["body"]);
  });

  it("shortening a field is replace (destructive)", () => {
    const a = evaluateContentChange({ body: "the full original prayer text" }, { body: "short" });
    expect(a.kind).toBe("replace");
    expect(a.changedFields).toContain("body");
  });

  it("no change is noop", () => {
    const a = evaluateContentChange({ body: "same" }, { body: "same" });
    expect(a.kind).toBe("noop");
  });

  it("changes to meta fields (machineTranslated) don't count as destructive", () => {
    const a = evaluateContentChange(
      { body: "text", machineTranslated: ["latin"] },
      { body: "text", machineTranslated: ["greek"] },
    );
    expect(a.kind).toBe("noop");
    expect(a.changedFields).toEqual([]);
  });
});

// ── Fake Prisma for the DB-touching functions ────────────────────────────────

interface Content {
  id: string;
  contentType: string;
  slug: string;
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown>;
  contentChecksum: string | null;
  version: number;
}

function fakePrisma(content: Content[]) {
  const rows = new Map(content.map((c) => [c.id, { ...c }]));
  const versions: Record<string, unknown>[] = [];
  let vid = 0;
  const logs: Record<string, unknown>[] = [];
  return {
    rows,
    versions,
    logs,
    publishedContent: {
      findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error("not found");
        if (data.version && typeof data.version === "object") {
          row.version += (data.version as { increment: number }).increment;
        }
        if (typeof data.payload !== "undefined")
          row.payload = data.payload as Record<string, unknown>;
        if (typeof data.title === "string") row.title = data.title;
        if ("subtitle" in data) row.subtitle = data.subtitle as string | null;
        if ("contentChecksum" in data) row.contentChecksum = data.contentChecksum as string | null;
        return row;
      },
    },
    publishedContentVersion: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `v${++vid}`, ...data };
        versions.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        versions.find((v) => v.id === where.id) ?? null,
    },
    adminWorkerLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data);
        return data;
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakePrisma = any;

function baseContent(overrides: Partial<Content> = {}): Content {
  return {
    id: "c1",
    contentType: "PRAYER",
    slug: "hail-mary",
    title: "Hail Mary",
    subtitle: null,
    payload: { body: "Hail Mary, full of grace", latin: "" },
    contentChecksum: "old",
    version: 1,
    ...overrides,
  };
}

describe("snapshotPublishedContent", () => {
  it("captures the current row and bumps version", async () => {
    const prisma = fakePrisma([baseContent()]);
    const id = await snapshotPublishedContent(prisma as FakePrisma, "c1", { reason: "test" });
    expect(id).toBeTruthy();
    expect(prisma.versions).toHaveLength(1);
    expect(prisma.versions[0].version).toBe(1); // snapshot preserves pre-edit version
    expect(prisma.rows.get("c1")?.version).toBe(2); // live row bumped
  });

  it("returns null for a missing row", async () => {
    const prisma = fakePrisma([]);
    const id = await snapshotPublishedContent(prisma as FakePrisma, "missing");
    expect(id).toBeNull();
  });
});

describe("applyProtectedContentUpdate", () => {
  it("applies an enrich edit with a reversible snapshot + version bump", async () => {
    const prisma = fakePrisma([baseContent()]);
    const res = await applyProtectedContentUpdate(prisma as FakePrisma, {
      contentId: "c1",
      proposedPayload: { body: "Hail Mary, full of grace", latin: "Ave Maria" },
      reason: "backfill",
    });
    expect(res.applied).toBe(true);
    expect(res.kind).toBe("enrich");
    expect(prisma.versions).toHaveLength(1); // snapshot taken (reversible)
    expect(prisma.rows.get("c1")?.payload.latin).toBe("Ave Maria");
    expect(prisma.rows.get("c1")?.version).toBe(2);
  });

  it("REFUSES a destructive overwrite when not backed by quality/evidence", async () => {
    const prisma = fakePrisma([baseContent()]);
    const res = await applyProtectedContentUpdate(prisma as FakePrisma, {
      contentId: "c1",
      proposedPayload: { body: "", latin: "" }, // wipes the body
    });
    expect(res.applied).toBe(false);
    expect(res.blocked).toBe(true);
    expect(res.kind).toBe("replace");
    // Good content preserved untouched; no snapshot/version churn.
    expect(prisma.rows.get("c1")?.payload.body).toBe("Hail Mary, full of grace");
    expect(prisma.rows.get("c1")?.version).toBe(1);
    // The refusal is logged for review/repair.
    expect(prisma.logs.some((l) => l.eventName === "protected_update_blocked")).toBe(true);
  });

  it("allows a destructive change only when explicitly allowed AND backed", async () => {
    const prisma = fakePrisma([baseContent()]);
    const res = await applyProtectedContentUpdate(prisma as FakePrisma, {
      contentId: "c1",
      proposedPayload: { body: "A corrected, authoritative version", latin: "" },
      allowReplace: true,
      qualityScore: 0.92,
      evidenceCount: 2,
    });
    expect(res.applied).toBe(true);
    expect(res.kind).toBe("replace");
    expect(prisma.rows.get("c1")?.payload.body).toBe("A corrected, authoritative version");
    expect(prisma.versions).toHaveLength(1); // still snapshotted → reversible
  });

  it("does nothing on a noop", async () => {
    const prisma = fakePrisma([baseContent()]);
    const res = await applyProtectedContentUpdate(prisma as FakePrisma, {
      contentId: "c1",
      proposedPayload: { body: "Hail Mary, full of grace", latin: "" },
    });
    expect(res.applied).toBe(false);
    expect(res.kind).toBe("noop");
    expect(prisma.versions).toHaveLength(0);
  });
});

describe("restorePublishedContentVersion", () => {
  it("restores a prior snapshot's payload/title onto the live row", async () => {
    const prisma = fakePrisma([baseContent()]);
    // Enrich once (creates a snapshot of the original), then overwrite-with-backing.
    await applyProtectedContentUpdate(prisma as FakePrisma, {
      contentId: "c1",
      proposedPayload: { body: "Hail Mary, full of grace", latin: "Ave Maria" },
    });
    const firstSnapshotId = prisma.versions[0].id as string;
    await applyProtectedContentUpdate(prisma as FakePrisma, {
      contentId: "c1",
      proposedPayload: { body: "different body entirely", latin: "Ave Maria" },
      allowReplace: true,
      qualityScore: 0.9,
      evidenceCount: 1,
    });
    expect(prisma.rows.get("c1")?.payload.body).toBe("different body entirely");

    // Restore the original snapshot → the pre-edit body comes back.
    const ok = await restorePublishedContentVersion(prisma as FakePrisma, firstSnapshotId);
    expect(ok).toBe(true);
    expect(prisma.rows.get("c1")?.payload.body).toBe("Hail Mary, full of grace");
    expect(prisma.logs.some((l) => l.eventName === "content_version_restored")).toBe(true);
  });

  it("returns false for a missing version", async () => {
    const prisma = fakePrisma([baseContent()]);
    expect(await restorePublishedContentVersion(prisma as FakePrisma, "nope")).toBe(false);
  });
});
