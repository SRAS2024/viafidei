/**
 * The pray-along demand statement on a real Postgres: a quality failure with attempts
 * left is retried at once, a clip failed for good gets one more attempt a day after it
 * failed, the request learns which clips are still failed, and the playlist says such a
 * line in the other voice, or marks it missing when neither voice can say it.
 *
 * Times are written as the voice engine writes them, in UTC (worker.py sets its session's
 * time zone), while the local test database's own zone is not UTC: so the day is shown to
 * be counted the same whatever the website's connection's time zone.
 *
 * Touches only the rows it makes (keys ending in this run's tag) and deletes them.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import type { PrayAlongScript } from "@/lib/pray-along/script";
import {
  buildManifest,
  fileClipDemand,
  RENEW_FAILED_AFTER_MS,
  type NeededClip,
} from "@/lib/pray-along/store";
import { clipKey, voiceIdFor } from "@/lib/pray-along/voices";

const TAG = `t${Date.now().toString(36)}`;
const HOUR = 60 * 60 * 1000;

/** A clip of `text` (unique to this run) in Latin or English. */
function needed(
  text: string,
  lang: "la" | "en" = "en",
  voice: "female" | "male" = "female",
): NeededClip {
  const words = `${text} ${TAG}`;
  return {
    key: clipKey(words, lang, voice),
    lang,
    voice,
    voiceId: voiceIdFor(lang, voice),
    text: words,
  };
}

interface Row {
  status: "pending" | "done" | "failed";
  attempts: number;
  lastError: string | null;
  failedAgo?: number;
  claimed?: boolean;
}

/** `ms` ago as a UTC wall-clock time, as the engine writes its timestamps. */
const utcAgo = (ms: number) =>
  Prisma.sql`(${new Date(Date.now() - ms)}::timestamptz AT TIME ZONE 'UTC')`;

/** Writes a row as the voice engine leaves it ("updatedAt" is when it last wrote it). */
async function put(c: NeededClip, row: Row) {
  const updatedAt = utcAgo(row.failedAgo ?? 0);
  const claimedAt = row.claimed ? utcAgo(60_000) : Prisma.sql`NULL`;
  await prisma.$executeRaw`
    INSERT INTO "PrayerAudioClip"
      ("id", "key", "lang", "voice", "voiceId", "text", "status", "priority", "attempts",
       "lastError", "claimedAt", "claimedBy", "audio", "mime", "createdAt", "updatedAt")
    VALUES (${`pac_${c.key}`}, ${c.key}, ${c.lang}, ${c.voice}, ${c.voiceId}, ${c.text},
            ${row.status}, 50, ${row.attempts}, ${row.lastError}, ${claimedAt},
            ${row.claimed ? "mac-test" : null},
            ${row.status === "done" ? Buffer.from([1, 2, 3]) : null},
            ${row.status === "done" ? "audio/mp4" : null}, ${updatedAt}, ${updatedAt})`;
}

async function get(c: NeededClip) {
  return prisma.prayerAudioClip.findUnique({
    where: { key: c.key },
    select: {
      status: true,
      attempts: true,
      lastError: true,
      claimedAt: true,
      claimedBy: true,
      requestedAt: true,
      priority: true,
    },
  });
}

async function clean() {
  await prisma.$executeRaw`DELETE FROM "PrayerAudioClip" WHERE "text" LIKE ${`% ${TAG}`}`;
}

beforeEach(clean);
afterAll(clean);

describe("pray-along demand on Postgres", () => {
  it("retries a quality failure with attempts left at once, Kokoro's at its own pace", async () => {
    const qwen = needed("Saint Peter, pray for us.");
    const kokoro = needed("Sancte Petre, ora pro nobis.", "la");
    for (const c of [qwen, kokoro]) {
      await put(c, {
        status: "failed",
        attempts: 2,
        lastError: "qa:failed:0.2",
        failedAgo: HOUR,
        claimed: true,
      });
    }
    expect(await fileClipDemand([qwen, kokoro])).toEqual(
      new Map([
        [qwen.key, "retrying"],
        [kokoro.key, "retrying"],
      ]),
    );
    expect(await get(qwen)).toMatchObject({
      status: "pending",
      attempts: 2,
      claimedAt: null,
      claimedBy: null,
    });
    expect(await get(kokoro)).toMatchObject({
      status: "pending",
      attempts: 2,
      claimedBy: "mac-test",
    });
  });

  it("leaves a clip failed for good until a day after it failed, and says it is still failed", async () => {
    const spent = needed("Saint Paul, pray for us.");
    const broken = needed("Saint Andrew, pray for us.");
    await put(spent, {
      status: "failed",
      attempts: 5,
      lastError: "qa:failed:0.3",
      failedAgo: HOUR,
    });
    await put(broken, {
      status: "failed",
      attempts: 1,
      lastError: "voice:unknown:x",
      failedAgo: HOUR,
    });
    expect(await fileClipDemand([spent, broken])).toEqual(
      new Map([
        [spent.key, "stuck"],
        [broken.key, "stuck"],
      ]),
    );
    // Untouched but for the request: why it failed, and its attempts, are kept.
    expect(await get(spent)).toMatchObject({
      status: "failed",
      attempts: 5,
      lastError: "qa:failed:0.3",
    });
    expect(await get(broken)).toMatchObject({ status: "failed", attempts: 1 });
    expect((await get(spent))?.requestedAt).not.toBeNull();
  });

  it("gives a clip failed for good one more attempt a day after it failed, Kokoro's too", async () => {
    const spent = needed("Saint James, pray for us.");
    const latin = needed("Amen.", "la");
    const broken = needed("Saint John, pray for us.");
    const day = RENEW_FAILED_AFTER_MS + HOUR;
    await put(spent, {
      status: "failed",
      attempts: 5,
      lastError: "qa:failed:0.3",
      failedAgo: day,
      claimed: true,
    });
    await put(latin, {
      status: "failed",
      attempts: 5,
      lastError: "qa:failed:0.9",
      failedAgo: day,
      claimed: true,
    });
    await put(broken, {
      status: "failed",
      attempts: 6,
      lastError: "attempts:exhausted:5",
      failedAgo: day,
    });
    // Being made again, with why they failed still on record.
    expect([...(await fileClipDemand([spent, latin, broken])).values()]).toEqual([
      "retrying",
      "retrying",
      "retrying",
    ]);
    // One attempt left: the engine's last claim (MAX_ATTEMPTS 5), claim cleared.
    for (const c of [spent, latin, broken]) {
      expect(await get(c)).toMatchObject({
        status: "pending",
        attempts: 4,
        claimedAt: null,
        claimedBy: null,
      });
    }
    // Why it failed stays until the engine writes its next result.
    expect((await get(spent))?.lastError).toBe("qa:failed:0.3");
  });

  it("counts the day in UTC, as the engine writes it, whatever the connection's time zone", async () => {
    // worker.py write_failed: "updatedAt" = LOCALTIMESTAMP in a session set to UTC.
    const [{ zone }] = await prisma.$queryRaw<
      { zone: string }[]
    >`SELECT current_setting('TimeZone') AS zone`;
    const at = async (text: string, hoursAgo: number) => {
      const c = needed(text);
      await put(c, { status: "failed", attempts: 5, lastError: "qa:failed:0.3" });
      await prisma.$executeRaw`UPDATE "PrayerAudioClip"
        SET "updatedAt" = (now() AT TIME ZONE 'UTC') - make_interval(hours => ${hoursAgo}::int)
        WHERE "key" = ${c.key}`;
      return c;
    };
    // Near either side of the day, by more than any zone's offset from UTC would shift it.
    const old = await at("Saint Thomas, pray for us.", 26);
    const recent = await at("Saint Jude, pray for us.", 20);
    expect(await fileClipDemand([old, recent])).toEqual(
      new Map([
        [old.key, "retrying"],
        [recent.key, "stuck"],
      ]),
    );
    expect(await get(old)).toMatchObject({ status: "pending", attempts: 4 });
    expect(await get(recent)).toMatchObject({ status: "failed", attempts: 5 });
    // The proof means most where this connection's zone is not UTC (America/Denver here).
    expect(typeof zone).toBe("string");
  });

  it("does not count a clip the engine was only stopped on as failed", async () => {
    const stopped = needed("Saint Bartholomew, pray for us.");
    const retried = needed("Saint Simon, pray for us.");
    await put(stopped, { status: "pending", attempts: 0, lastError: "interrupted" });
    await put(retried, { status: "pending", attempts: 1, lastError: "qa:failed:0.2" });
    expect(await fileClipDemand([stopped, retried])).toEqual(new Map([[retried.key, "retrying"]]));
  });

  it("never touches a made clip, and files a new one as pending at its place", async () => {
    const made = needed("Saint Mark, pray for us.");
    const fresh = needed("Saint Luke, pray for us.");
    await put(made, { status: "done", attempts: 1, lastError: null });
    // Neither has failed: a made clip is not touched, a new one has no failure on record.
    expect(await fileClipDemand([made, { ...fresh, priority: 3 }])).toEqual(new Map());
    expect(await get(made)).toMatchObject({ status: "done", requestedAt: null, priority: 50 });
    expect(await get(fresh)).toMatchObject({ status: "pending", attempts: 0, priority: 3 });
  });

  it("builds a playlist that says a failed line in the other voice, or marks it missing", async () => {
    const amen = `Amen. ${TAG}`;
    const ave = `Ave Maria. ${TAG}`;
    const script: PrayAlongScript = {
      lang: "la",
      items: [
        { kind: "say", text: ave, lang: "la" },
        { kind: "pause", ms: 700 },
        { kind: "say", text: amen, lang: "la" },
      ],
    };
    const row = (text: string, voice: "female" | "male") => ({
      key: clipKey(text, "la", voice),
      lang: "la" as const,
      voice,
      voiceId: voiceIdFor("la", voice),
      text,
    });
    await put(row(ave, "female"), { status: "done", attempts: 1, lastError: null });
    await put(row(amen, "female"), {
      status: "failed",
      attempts: 5,
      lastError: "qa:failed:0.9",
      failedAgo: HOUR,
    });
    await put(row(amen, "male"), { status: "done", attempts: 1, lastError: null });
    let manifest = await buildManifest(script, "female");
    expect(manifest.items[2]).toMatchObject({
      type: "clip",
      key: row(amen, "male").key,
      ready: true,
    });
    expect(manifest).toMatchObject({ total: 2, ready: 2, missing: 0 });

    // A day after the female Amen failed, a press gives it one more attempt; that same
    // press already hears the male Amen, made, rather than wait for an attempt that may
    // fail again.
    await prisma.$executeRaw`UPDATE "PrayerAudioClip" SET "updatedAt" = ${utcAgo(RENEW_FAILED_AFTER_MS + HOUR)}
      WHERE "key" = ${row(amen, "female").key}`;
    manifest = await buildManifest(script, "female");
    expect(manifest.items[2]).toMatchObject({ key: row(amen, "male").key, ready: true });
    expect(await get(row(amen, "female"))).toMatchObject({ status: "pending", attempts: 4 });
    // That attempt fails too (as the engine would write it, an hour ago).
    await prisma.$executeRaw`UPDATE "PrayerAudioClip" SET "status" = 'failed', "attempts" = 5,
      "updatedAt" = ${utcAgo(HOUR)} WHERE "key" = ${row(amen, "female").key}`;

    await prisma.$executeRaw`UPDATE "PrayerAudioClip" SET "status" = 'failed', "attempts" = 5,
      "lastError" = 'qa:failed:0.8', "updatedAt" = ${utcAgo(HOUR)}
      WHERE "key" = ${row(amen, "male").key}`;
    manifest = await buildManifest(script, "female");
    expect(manifest.items[2]).toEqual({
      type: "clip",
      key: row(amen, "female").key,
      ready: false,
      version: null,
      missing: true,
    });
    expect(manifest).toMatchObject({ total: 2, ready: 1, missing: 1 });
  });
});
