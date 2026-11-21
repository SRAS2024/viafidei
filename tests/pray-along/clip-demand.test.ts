/**
 * A listener's request files the clips they are waiting for, and files a clip that
 * failed its quality check as pending again (up to the engine's limit) with its last
 * claim cleared, so the engine can start the retry while the listener still waits;
 * a Kokoro (Latin) clip, whose retries are nearly the same takes, keeps its claim.
 */
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ prisma: { $executeRaw: vi.fn(), prayerAudioClip: {} } }));
vi.mock("@/lib/db/client", () => db);

import {
  fileClipDemand,
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

/**
 * The statement, for reading: the mock is called as a tagged template (the SQL's fixed
 * parts, then the values between them, nested fragments among them), Prisma.sql joins
 * them as Prisma does, and each bound value is written in where its $n stands,
 * JSON-quoted. Not valid SQL, and not what Postgres receives (it gets the $n and the
 * values apart), but the same statement.
 */
function statement(): string {
  const [strings, ...values] = db.prisma.$executeRaw.mock.calls[0]! as unknown as [
    TemplateStringsArray,
    ...unknown[],
  ];
  const sql = Prisma.sql(strings, ...values);
  return sql.text
    .replace(/\$(\d+)/g, (_, n: string) => JSON.stringify(sql.values[Number(n) - 1]))
    .replace(/\s+/g, " ");
}

/** What makes a row a retry, read from the existing row: the row as it was before this update. */
const RETRY =
  `"PrayerAudioClip"."status" = 'failed' AND "PrayerAudioClip"."lastError" LIKE 'qa:%' ` +
  `AND "PrayerAudioClip"."attempts" < ${RETRY_FAILED_BELOW_ATTEMPTS}`;

/** A retry whose claim is cleared: any voice but Kokoro, whose retries are nearly the same takes. */
const RETRY_NOW = `${RETRY} AND "PrayerAudioClip"."voiceId" NOT LIKE 'kokoro-%'`;

beforeEach(() => {
  db.prisma.$executeRaw.mockReset();
  db.prisma.$executeRaw.mockResolvedValue(1);
});

describe("fileClipDemand", () => {
  it("requeues only a quality failure, only below the engine's attempt limit, never a made clip", async () => {
    await fileClipDemand([clip, { ...clip, key: "b".repeat(40) }]);
    // The whole request, retries included, is one statement.
    expect(db.prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const sql = statement();
    expect(sql).toContain(
      `"status" = CASE WHEN ${RETRY} THEN 'pending' ELSE "PrayerAudioClip"."status" END`,
    );
    expect(sql).toContain(`WHERE "PrayerAudioClip"."status" <> 'done'`);
    expect(RETRY_FAILED_BELOW_ATTEMPTS).toBe(5);
  });

  it("clears a requeued failure's last claim, so the engine can start the retry at once", async () => {
    await fileClipDemand([clip]);
    const sql = statement();
    // The engine skips a row claimed in the last 10 minutes; the player waits 2. The
    // status's test, without Kokoro, decides the claim, and Postgres works out every SET
    // expression from the row as it was, so these still see 'failed' while "status" turns
    // 'pending'.
    expect(sql).toContain(
      `"claimedAt" = CASE WHEN ${RETRY_NOW} THEN NULL ELSE "PrayerAudioClip"."claimedAt" END`,
    );
    expect(sql).toContain(
      `"claimedBy" = CASE WHEN ${RETRY_NOW} THEN NULL ELSE "PrayerAudioClip"."claimedBy" END`,
    );
  });

  it("writes exactly these columns of an existing row and nothing else", async () => {
    await fileClipDemand([clip]);
    // The whole SET list, so an extra write fails here: resetting "attempts" would let a
    // clip that can never pass be retried for ever; clearing "lastError" would lose why it
    // failed.
    const set = statement()
      .split(" DO UPDATE SET ")[1]!
      .split(` WHERE "PrayerAudioClip"."status" <> 'done'`)[0]!
      .trim();
    expect(set).toBe(
      `"requestedAt" = EXCLUDED."requestedAt", ` +
        `"priority" = LEAST("PrayerAudioClip"."priority", EXCLUDED."priority"), ` +
        `"status" = CASE WHEN ${RETRY} THEN 'pending' ELSE "PrayerAudioClip"."status" END, ` +
        `"claimedAt" = CASE WHEN ${RETRY_NOW} THEN NULL ELSE "PrayerAudioClip"."claimedAt" END, ` +
        `"claimedBy" = CASE WHEN ${RETRY_NOW} THEN NULL ELSE "PrayerAudioClip"."claimedBy" END`,
    );
  });

  it("leaves every other row's claim alone, so a clip being made keeps its worker", async () => {
    await fileClipDemand([clip]);
    const sql = statement();
    // Nothing else writes the claim (a new row starts without one), and no column takes
    // its status or claim from the proposed row instead of the existing one.
    expect(sql.match(/"claimed(At|By)" =/g)).toHaveLength(2);
    expect(sql).toContain(
      `("id", "key", "lang", "voice", "voiceId", "text", "status", "priority", "requestedAt", "createdAt", "updatedAt")`,
    );
    expect(sql).not.toMatch(/EXCLUDED\."(status|claimedAt|claimedBy|lastError|attempts)"/);
  });

  it("never throws when the database fails", async () => {
    db.prisma.$executeRaw.mockRejectedValue(new Error("down"));
    await expect(fileClipDemand([clip])).resolves.toBeUndefined();
  });
});
