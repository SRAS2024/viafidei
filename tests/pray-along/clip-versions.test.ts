/**
 * A made clip's version, which its URL names: its row's "updatedAt", which the voice
 * engine moves each time it writes the audio. The playlist reads it with readiness, the
 * clip route with the audio, and alone to check a copy it holds in memory.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    $executeRaw: vi.fn(),
    prayerAudioClip: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db/client", () => db);

import type { PrayAlongScript } from "@/lib/pray-along/script";
import {
  buildManifest,
  clipVersion,
  readClipAudio,
  readClipVersion,
  readyClipVersions,
} from "@/lib/pray-along/store";
import { clipKey } from "@/lib/pray-along/voices";

const KEY = "a".repeat(40);
/** When the clip was made, and when it was made again after an engine fix. */
const MADE = new Date("2026-11-21T09:30:00.123Z");
const REMADE = new Date("2026-11-21T14:05:41.007Z");

beforeEach(() => {
  db.prisma.$executeRaw.mockReset().mockResolvedValue(1);
  db.prisma.prayerAudioClip.findMany.mockReset().mockResolvedValue([]);
  db.prisma.prayerAudioClip.findUnique.mockReset().mockResolvedValue(null);
});

describe("clip versions", () => {
  it("are the row's updatedAt to the millisecond, short, and new each time it moves", () => {
    expect(clipVersion(MADE)).toBe(MADE.getTime().toString(36));
    expect(clipVersion(MADE)).toMatch(/^[0-9a-z]{8}$/);
    expect(clipVersion(new Date(MADE.getTime()))).toBe(clipVersion(MADE));
    expect(clipVersion(new Date(MADE.getTime() + 1))).not.toBe(clipVersion(MADE));
    expect(clipVersion(REMADE)).not.toBe(clipVersion(MADE));
  });

  it("are read with readiness for made clips only, without their audio", async () => {
    db.prisma.prayerAudioClip.findMany.mockResolvedValue([{ key: KEY, updatedAt: MADE }]);
    const ready = await readyClipVersions([KEY, "b".repeat(40)]);
    expect([...ready]).toEqual([[KEY, clipVersion(MADE)]]);
    expect(db.prisma.prayerAudioClip.findMany).toHaveBeenCalledWith({
      where: { key: { in: [KEY, "b".repeat(40)] }, status: "done" },
      select: { key: true, updatedAt: true },
    });
    // No keys, no query; a database without the table has nothing made.
    db.prisma.prayerAudioClip.findMany.mockClear();
    expect((await readyClipVersions([])).size).toBe(0);
    expect(db.prisma.prayerAudioClip.findMany).not.toHaveBeenCalled();
    db.prisma.prayerAudioClip.findMany.mockRejectedValue(new Error("no such table"));
    expect((await readyClipVersions([KEY])).size).toBe(0);
  });

  it("reach the playlist for each made clip, and none for a clip not made yet", async () => {
    const script: PrayAlongScript = {
      lang: "en",
      items: [
        { kind: "say", text: "Amen.", lang: "en" },
        { kind: "pause", ms: 600 },
        { kind: "say", text: "Hail Mary, full of grace.", lang: "en" },
        { kind: "say", text: "Amen.", lang: "en" },
      ],
    };
    const amen = clipKey("Amen.", "en", "female");
    const hail = clipKey("Hail Mary, full of grace.", "en", "female");
    db.prisma.prayerAudioClip.findMany.mockResolvedValue([{ key: amen, updatedAt: REMADE }]);
    const manifest = await buildManifest(script, "female");
    expect(manifest.items).toEqual([
      { type: "clip", key: amen, ready: true, version: clipVersion(REMADE) },
      { type: "pause", ms: 600 },
      { type: "clip", key: hail, ready: false, version: null },
      { type: "clip", key: amen, ready: true, version: clipVersion(REMADE) },
    ]);
    expect(manifest).toMatchObject({ total: 2, ready: 1 });
    // The clip not made yet is filed for the engine, as before.
    expect(db.prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("are read with the audio in one read, so a version is always that of its bytes", async () => {
    db.prisma.prayerAudioClip.findUnique.mockResolvedValue({
      audio: Buffer.from([1, 2, 3]),
      mime: "audio/mp4",
      status: "done",
      updatedAt: REMADE,
    });
    expect(await readClipAudio(KEY)).toEqual({
      audio: Uint8Array.from([1, 2, 3]),
      mime: "audio/mp4",
      version: clipVersion(REMADE),
    });
    expect(db.prisma.prayerAudioClip.findUnique).toHaveBeenCalledTimes(1);
    expect(db.prisma.prayerAudioClip.findUnique).toHaveBeenCalledWith({
      where: { key: KEY },
      select: { audio: true, mime: true, status: true, updatedAt: true },
    });
  });

  it("are read alone, without the audio, to check a copy held in memory", async () => {
    db.prisma.prayerAudioClip.findUnique.mockResolvedValue({ status: "done", updatedAt: MADE });
    expect(await readClipVersion(KEY)).toBe(clipVersion(MADE));
    expect(db.prisma.prayerAudioClip.findUnique).toHaveBeenCalledWith({
      where: { key: KEY },
      select: { status: true, updatedAt: true },
    });
  });

  it("are none for a clip that is not made, and a failing database has none", async () => {
    // A made clip reset to be made again keeps its old audio until then: not served.
    db.prisma.prayerAudioClip.findUnique.mockResolvedValue({
      audio: Buffer.from([1]),
      mime: "audio/mp4",
      status: "pending",
      updatedAt: MADE,
    });
    expect(await readClipAudio(KEY)).toBeNull();
    expect(await readClipVersion(KEY)).toBeNull();
    db.prisma.prayerAudioClip.findUnique.mockResolvedValue(null);
    expect(await readClipAudio(KEY)).toBeNull();
    expect(await readClipVersion(KEY)).toBeNull();
    db.prisma.prayerAudioClip.findUnique.mockRejectedValue(new Error("down"));
    expect(await readClipAudio(KEY)).toBeNull();
    expect(await readClipVersion(KEY)).toBeNull();
  });
});
