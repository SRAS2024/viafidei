/**
 * A listener's request files the clips they are waiting for, and files a clip that
 * failed its quality check as pending again (up to the engine's limit) with its last
 * claim cleared, so the engine can start the retry while the listener still waits;
 * a Kokoro (Latin) clip, whose retries are nearly the same takes, keeps its claim. A
 * clip that failed for good gets one more attempt a day after it failed, so a
 * fix to the engine reaches it without anyone resetting it by hand. The request learns
 * which of its clips the engine has failed (still failed, or being made again), so the
 * playlist can say those lines in the other voice.
 */
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ prisma: { $queryRaw: vi.fn(), prayerAudioClip: {} } }));
vi.mock("@/lib/db/client", () => db);

import {
  fileClipDemand,
  RENEW_FAILED_AFTER_MS,
  RETRY_FAILED_BELOW_ATTEMPTS,
  type NeededClip,
} from "@/lib/pray-along/store";

const clip: NeededClip = {
  key: "a".repeat(40),
  lang: "en",
  voice: "female",
  voiceId: "qwen3-tts-1.7b-base:lock:en-female-v1",
  text: "Saint Peter, pray for us.",
};
const other: NeededClip = { ...clip, key: "b".repeat(40), text: "Saint Paul, pray for us." };

/** The request's time, and a day before it: a row that failed before then gets one more attempt. */
const NOW = new Date("2026-11-22T02:00:00.000Z");
const DAY_BEFORE = new Date(NOW.getTime() - RENEW_FAILED_AFTER_MS);

/**
 * The statement, for reading: the mock is called as a tagged template (the SQL's fixed
 * parts, then the values between them, nested fragments among them), Prisma.sql joins
 * them as Prisma does, and each bound value is written in where its $n stands,
 * JSON-quoted. Not valid SQL, and not what Postgres receives (it gets the $n and the
 * values apart), but the same statement.
 */
function statement(call = 0): string {
  const [strings, ...values] = db.prisma.$queryRaw.mock.calls[call]! as unknown as [
    TemplateStringsArray,
    ...unknown[],
  ];
  const sql = Prisma.sql(strings, ...values);
  return sql.text
    .replace(/\$(\d+)/g, (_, n: string) => JSON.stringify(sql.values[Number(n) - 1]))
    .replace(/\s+/g, " ")
    .trim();
}

/** What the tests below read from the existing row: the row as it was before this update. */
const FAILED = `"PrayerAudioClip"."status" = 'failed'`;
/** A quality failure with attempts left: tried again at once. */
const RETRY =
  `${FAILED} AND "PrayerAudioClip"."lastError" LIKE 'qa:%' ` +
  `AND "PrayerAudioClip"."attempts" < ${RETRY_FAILED_BELOW_ATTEMPTS}`;
/**
 * Any failure a day old or more: one more attempt. The engine writes "updatedAt" in UTC,
 * so the cutoff is read as a UTC wall-clock time, whatever the connection's time zone.
 */
const RENEW =
  `${FAILED} AND "PrayerAudioClip"."updatedAt" < ` +
  `(${JSON.stringify(DAY_BEFORE)}::timestamptz AT TIME ZONE 'UTC')`;
/** Pending again: either of them. */
const AGAIN = `(${RETRY}) OR (${RENEW})`;
/** Claim cleared: a retry in any voice but Kokoro, whose retries are nearly the same takes, or a renewal. */
const CLEAR_CLAIM = `(${RETRY} AND "PrayerAudioClip"."voiceId" NOT LIKE 'kokoro-%') OR (${RENEW})`;

beforeEach(() => {
  db.prisma.$queryRaw.mockReset();
  // RETURNING: the rows it filed; a new row is pending.
  db.prisma.$queryRaw.mockResolvedValue([]);
});

describe("fileClipDemand", () => {
  it("requeues a quality failure below the engine's limit and any failure a day old, never a made clip", async () => {
    await fileClipDemand([clip, other], NOW);
    // The whole request, retries and renewals included, is one statement.
    expect(db.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = statement();
    expect(sql).toContain(
      `"status" = CASE WHEN ${AGAIN} THEN 'pending' ELSE "PrayerAudioClip"."status" END`,
    );
    expect(sql).toContain(`WHERE "PrayerAudioClip"."status" <> 'done'`);
    expect(RETRY_FAILED_BELOW_ATTEMPTS).toBe(5);
    expect(RENEW_FAILED_AFTER_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("clears a requeued failure's last claim, so the engine can start the retry at once", async () => {
    await fileClipDemand([clip], NOW);
    const sql = statement();
    // The engine skips a row claimed in the last 10 minutes; the player waits 2. The
    // status's test, without Kokoro, decides the claim, and Postgres works out every SET
    // expression from the row as it was, so these still see 'failed' while "status" turns
    // 'pending'. A renewal clears Kokoro's claim too: it comes at most once a day.
    expect(sql).toContain(
      `"claimedAt" = CASE WHEN ${CLEAR_CLAIM} THEN NULL ELSE "PrayerAudioClip"."claimedAt" END`,
    );
    expect(sql).toContain(
      `"claimedBy" = CASE WHEN ${CLEAR_CLAIM} THEN NULL ELSE "PrayerAudioClip"."claimedBy" END`,
    );
  });

  it("gives a clip failed for good one more attempt, a day after it failed and not before", async () => {
    await fileClipDemand([clip], NOW);
    // One below the engine's limit (it fails at once a claim past it, attempts:exhausted):
    // its seeds repeat the last attempt's, so more would only repeat failed takes.
    expect(statement()).toContain(
      `"attempts" = CASE WHEN ${RENEW} THEN LEAST("PrayerAudioClip"."attempts", ` +
        `${RETRY_FAILED_BELOW_ATTEMPTS - 1}) ELSE "PrayerAudioClip"."attempts" END`,
    );
    // The day is counted back from the request's own time.
    const later = new Date(NOW.getTime() + 60_000);
    await fileClipDemand([clip], later);
    expect(statement(1)).toContain(
      `"updatedAt" < (${JSON.stringify(new Date(later.getTime() - RENEW_FAILED_AFTER_MS))}` +
        `::timestamptz AT TIME ZONE 'UTC')`,
    );
  });

  it("writes exactly these columns of an existing row and nothing else", async () => {
    await fileClipDemand([clip], NOW);
    // The whole SET list, so an extra write fails here. "attempts" moves back only for the
    // daily renewal, and only to the last attempt: at any other time, or further, a clip
    // that can never pass would be tried again and again while a listener waits.
    // Clearing "lastError" would lose why it failed, and moving "updatedAt" would put its
    // next renewal off.
    const set = statement()
      .split(" DO UPDATE SET ")[1]!
      .split(` WHERE "PrayerAudioClip"."status" <> 'done'`)[0]!
      .trim();
    expect(set).toBe(
      `"requestedAt" = EXCLUDED."requestedAt", ` +
        `"priority" = LEAST("PrayerAudioClip"."priority", EXCLUDED."priority"), ` +
        `"status" = CASE WHEN ${AGAIN} THEN 'pending' ELSE "PrayerAudioClip"."status" END, ` +
        `"attempts" = CASE WHEN ${RENEW} THEN LEAST("PrayerAudioClip"."attempts", ` +
        `${RETRY_FAILED_BELOW_ATTEMPTS - 1}) ELSE "PrayerAudioClip"."attempts" END, ` +
        `"claimedAt" = CASE WHEN ${CLEAR_CLAIM} THEN NULL ELSE "PrayerAudioClip"."claimedAt" END, ` +
        `"claimedBy" = CASE WHEN ${CLEAR_CLAIM} THEN NULL ELSE "PrayerAudioClip"."claimedBy" END`,
    );
  });

  it("leaves every other row's claim alone, so a clip being made keeps its worker", async () => {
    await fileClipDemand([clip], NOW);
    const sql = statement();
    // Nothing else writes the claim (a new row starts without one), and no column takes
    // its status, claim or attempts from the proposed row instead of the existing one.
    expect(sql.match(/"claimed(At|By)" =/g)).toHaveLength(2);
    expect(sql).toContain(
      `("id", "key", "lang", "voice", "voiceId", "text", "status", "priority", "requestedAt", "createdAt", "updatedAt")`,
    );
    expect(sql).not.toMatch(/EXCLUDED\."(status|claimedAt|claimedBy|lastError|attempts)"/);
  });

  it("files each clip at its place in the prayer, or at the place it is given", async () => {
    await fileClipDemand([clip, other], NOW);
    const at = (key: string, priority: number) =>
      `${JSON.stringify(key)}, "en", "female", "qwen3-tts-1.7b-base:lock:en-female-v1", ` +
      `${JSON.stringify(key === clip.key ? clip.text : other.text)}, 'pending', ${priority}, ` +
      `${JSON.stringify(NOW)}, ${JSON.stringify(NOW)}, ${JSON.stringify(NOW)})`;
    expect(statement()).toContain(at(clip.key, 0));
    expect(statement()).toContain(at(other.key, 1));
    // A line said in the other voice is filed at the place of the line it stands in for.
    await fileClipDemand([{ ...other, priority: 7 }], NOW);
    expect(statement(1)).toContain(at(other.key, 7));
  });

  it("says which of its clips the engine has failed, and how each stands now", async () => {
    const third = { ...clip, key: "c".repeat(40), text: "Saint Andrew, pray for us." };
    db.prisma.$queryRaw.mockResolvedValue([
      { key: clip.key, status: "pending", failedBefore: false },
      { key: other.key, status: "failed", failedBefore: true },
      { key: third.key, status: "pending", failedBefore: true },
    ]);
    // Still failed: stuck. Pending again with a failure on record: being retried. New, or
    // pending with no failure: not in it.
    expect(await fileClipDemand([clip, other, third], NOW)).toEqual(
      new Map([
        [other.key, "stuck"],
        [third.key, "retrying"],
      ]),
    );
    // RETURNING gives every row it inserted or updated, as it now stands; a made row is
    // never updated, so it is never among them.
    expect(statement()).toMatch(
      /WHERE "PrayerAudioClip"\."status" <> 'done' RETURNING "key", "status", \("lastError" IS NOT NULL AND "lastError" <> 'interrupted'\) AS "failedBefore"$/,
    );
  });

  it("asks nothing for no clips, and never throws when the database fails", async () => {
    expect((await fileClipDemand([], NOW)).size).toBe(0);
    expect(db.prisma.$queryRaw).not.toHaveBeenCalled();
    db.prisma.$queryRaw.mockRejectedValue(new Error("down"));
    // A failing database knows of no failed clip: the player waits, as it always has.
    await expect(fileClipDemand([clip], NOW)).resolves.toEqual(new Map());
  });
});
