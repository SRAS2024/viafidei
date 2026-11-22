/**
 * A line the listener's voice has failed for good is said in the other voice, so the
 * prayer is still prayed in full: played if that clip is made, filed for the engine to
 * make first if not. A line neither voice can say is marked missing, so the player can
 * say so at once. A prayer with no failed line costs one read and one write, as before.
 */
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn(), prayerAudioClip: { findMany: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/db/client", () => db);

import type { PrayAlongScript } from "@/lib/pray-along/script";
import { buildManifest, clipVersion } from "@/lib/pray-along/store";
import { clipKey } from "@/lib/pray-along/voices";

const AVE = "Ave Maria, gratia plena.";
const AMEN = "Amen.";
const NOMINE = "In nomine Patris.";
const script: PrayAlongScript = {
  lang: "la",
  items: [
    { kind: "say", text: AVE, lang: "la" },
    { kind: "pause", ms: 700 },
    { kind: "say", text: AMEN, lang: "la" },
    { kind: "pause", ms: 1100 },
    { kind: "say", text: NOMINE, lang: "la" },
    { kind: "say", text: AMEN, lang: "la" },
  ],
};
const female = (text: string) => clipKey(text, "la", "female");
const male = (text: string) => clipKey(text, "la", "male");
const MADE = new Date("2026-11-21T09:30:00.123Z");
const V = clipVersion(MADE);

/**
 * The rows the database holds, by key, as they stand once a request has filed its
 * demand; "retrying" is a row pending again after a failure (it has a lastError).
 */
let rows: Map<string, "done" | "pending" | "failed" | "retrying">;

/** The keys a fileClipDemand statement files, in order, and the values it binds. */
function filed(call: number): { keys: string[]; values: unknown[] } {
  const [strings, ...values] = db.prisma.$queryRaw.mock.calls[call]! as unknown as [
    TemplateStringsArray,
    ...unknown[],
  ];
  const sql = Prisma.sql(strings, ...values);
  return {
    keys: sql.values.filter((v): v is string => typeof v === "string" && /^[0-9a-f]{40}$/.test(v)),
    values: sql.values,
  };
}

/** The value bound right after `key` in its row: lang, voice, voiceId, text, priority… */
function rowOf(call: number, key: string) {
  const { values } = filed(call);
  const at = values.indexOf(key);
  return {
    lang: values[at + 1],
    voice: values[at + 2],
    voiceId: values[at + 3],
    text: values[at + 4],
    priority: values[at + 5],
    requestedAt: values[at + 6],
  };
}

beforeEach(() => {
  rows = new Map();
  db.prisma.prayerAudioClip.findMany.mockReset();
  db.prisma.prayerAudioClip.findMany.mockImplementation(
    async ({ where }: { where: { key: { in: string[] } } }) =>
      where.key.in
        .filter((key) => rows.get(key) === "done")
        .map((key) => ({ key, updatedAt: MADE })),
  );
  db.prisma.$queryRaw.mockReset();
  // RETURNING: each filed row as it now stands (a new row is pending, with no failure).
  db.prisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values) => {
    const sql = Prisma.sql(strings, ...values);
    return sql.values
      .filter((v): v is string => typeof v === "string" && /^[0-9a-f]{40}$/.test(v))
      .map((key) => {
        const row = rows.get(key);
        return {
          key,
          status: row === "retrying" ? "pending" : (row ?? "pending"),
          failedBefore: row === "failed" || row === "retrying",
        };
      });
  });
});

describe("a line the listener's voice can never say", () => {
  it("is said in the other voice when that is made, every time the prayer says it", async () => {
    rows.set(female(AVE), "done").set(female(AMEN), "failed").set(female(NOMINE), "done");
    rows.set(male(AMEN), "done");
    const manifest = await buildManifest(script, "female");
    expect(manifest.items).toEqual([
      { type: "clip", key: female(AVE), ready: true, version: V },
      { type: "pause", ms: 700 },
      { type: "clip", key: male(AMEN), ready: true, version: V },
      { type: "pause", ms: 1100 },
      { type: "clip", key: female(NOMINE), ready: true, version: V },
      { type: "clip", key: male(AMEN), ready: true, version: V },
    ]);
    expect(manifest).toMatchObject({ voice: "female", total: 3, ready: 3, missing: 0 });
    // The failed line was filed as usual; the other voice's line was made, so not filed.
    expect(db.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(filed(0).keys).toEqual([female(AMEN)]);
  });

  it("is filed in the other voice for the engine to make first, at the failed line's place", async () => {
    rows.set(female(AMEN), "failed");
    const manifest = await buildManifest(script, "female");
    expect(manifest.items.filter((i) => i.type === "clip")).toEqual([
      { type: "clip", key: female(AVE), ready: false, version: null },
      { type: "clip", key: male(AMEN), ready: false, version: null },
      { type: "clip", key: female(NOMINE), ready: false, version: null },
      { type: "clip", key: male(AMEN), ready: false, version: null },
    ]);
    expect(manifest).toMatchObject({ total: 3, ready: 0, missing: 0 });
    expect(db.prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(filed(0).keys).toEqual([female(AVE), female(AMEN), female(NOMINE)]);
    expect(filed(1).keys).toEqual([male(AMEN)]);
    // The male "Amen." is a male clip of the same words, in the same request (one time,
    // so the engine, newest request first, takes both batches as one), at the place of
    // the line it stands in for: second, after the Ave and before the Sign of the Cross.
    const standIn = rowOf(1, male(AMEN));
    expect(standIn).toMatchObject({
      lang: "la",
      voice: "male",
      voiceId: "kokoro-82m:latin-ipa:im_nicola",
      text: AMEN,
      priority: rowOf(0, female(AMEN)).priority,
    });
    expect(rowOf(0, female(AMEN)).priority).toBe(1);
    expect(standIn.requestedAt).toEqual(rowOf(0, female(AVE)).requestedAt);
  });

  it("works the same way for a member who chose the male voice", async () => {
    rows.set(male(AVE), "done").set(male(AMEN), "done").set(male(NOMINE), "failed");
    rows.set(female(NOMINE), "done");
    const manifest = await buildManifest(script, "male");
    expect(manifest.items.filter((i) => i.type === "clip").map((i) => i.key)).toEqual([
      male(AVE),
      male(AMEN),
      female(NOMINE),
      male(AMEN),
    ]);
    expect(manifest).toMatchObject({ voice: "male", ready: 3, missing: 0 });
  });

  it("is marked missing only when neither voice can say it", async () => {
    rows.set(female(AVE), "done").set(female(NOMINE), "done");
    rows.set(female(AMEN), "failed").set(male(AMEN), "failed");
    const manifest = await buildManifest(script, "female");
    const amen = { type: "clip", key: female(AMEN), ready: false, version: null, missing: true };
    expect(manifest.items.filter((i) => i.type === "clip")).toEqual([
      { type: "clip", key: female(AVE), ready: true, version: V },
      amen,
      { type: "clip", key: female(NOMINE), ready: true, version: V },
      amen,
    ]);
    expect(manifest).toMatchObject({ total: 3, ready: 2, missing: 1 });
  });

  it("is said in the other voice while it is made again after a failure, when that is made", async () => {
    // The attempt a day after the Amen failed for good (or a retry after a failed take).
    rows.set(female(AVE), "done").set(female(AMEN), "retrying").set(female(NOMINE), "done");
    rows.set(male(AMEN), "done");
    const manifest = await buildManifest(script, "female");
    expect(manifest.items.filter((i) => i.type === "clip").map((i) => i.key)).toEqual([
      female(AVE),
      male(AMEN),
      female(NOMINE),
      male(AMEN),
    ]);
    expect(manifest).toMatchObject({ ready: 3, missing: 0 });
  });

  it("waits for its own retry when the other voice is not made, filing nothing more", async () => {
    rows.set(female(AVE), "done").set(female(AMEN), "retrying").set(female(NOMINE), "done");
    const manifest = await buildManifest(script, "female");
    expect(manifest.items[2]).toEqual({
      type: "clip",
      key: female(AMEN),
      ready: false,
      version: null,
    });
    expect(manifest).toMatchObject({ ready: 2, missing: 0 });
    // Only the request's own filing: the retry may well pass, so the other voice waits its turn.
    expect(db.prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("waits for the other voice being made again when its own voice failed for good", async () => {
    rows.set(female(AVE), "done").set(female(AMEN), "failed").set(male(AMEN), "retrying");
    rows.set(female(NOMINE), "done");
    const manifest = await buildManifest(script, "female");
    expect(manifest.items[2]).toEqual({
      type: "clip",
      key: male(AMEN),
      ready: false,
      version: null,
    });
    expect(manifest).toMatchObject({ ready: 2, missing: 0 });
  });

  it("costs one read and one write when no line has failed", async () => {
    rows.set(female(AVE), "done").set(female(AMEN), "pending");
    const manifest = await buildManifest(script, "female");
    expect(db.prisma.prayerAudioClip.findMany).toHaveBeenCalledTimes(1);
    expect(db.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(manifest.items.some((i) => i.type === "clip" && i.missing)).toBe(false);
    expect(manifest).toMatchObject({ total: 3, ready: 1, missing: 0 });
  });

  it("is never called missing when the database fails: the player waits, as before", async () => {
    db.prisma.$queryRaw.mockRejectedValue(new Error("down"));
    const manifest = await buildManifest(script, "female");
    expect(manifest.items.filter((i) => i.type === "clip")).toEqual([
      { type: "clip", key: female(AVE), ready: false, version: null },
      { type: "clip", key: female(AMEN), ready: false, version: null },
      { type: "clip", key: female(NOMINE), ready: false, version: null },
      { type: "clip", key: female(AMEN), ready: false, version: null },
    ]);
    expect(db.prisma.prayerAudioClip.findMany).toHaveBeenCalledTimes(1);
  });
});
