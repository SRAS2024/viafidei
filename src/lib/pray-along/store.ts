/**
 * The stored pray-along clips: which are made, filing the ones a listener needs, and
 * reading a clip's audio. The voice engine (voice-engine/) makes and writes them.
 *
 * Every function fails soft: a database without the table (a deploy whose migration
 * has not run, a test database) has no audio, it does not break a page.
 *
 * Server only.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

import type { AudioLang } from "./languages";
import { clipKey, voiceIdFor, type Voice } from "./voices";
import type { PrayAlongScript } from "./script";

/** A clip a script needs, with its identity. */
export interface NeededClip {
  key: string;
  lang: AudioLang;
  voice: Voice;
  voiceId: string;
  text: string;
}

/**
 * A clip a listener is waiting for, with its place in their prayer (the engine makes the
 * lowest first); without one, its place in the list filed.
 */
export type DemandedClip = NeededClip & { priority?: number };

/**
 * What the player is given: the clips and pauses in order, and which clips are ready. A
 * ready clip carries the version of its audio (clipVersion), null until it is made. A
 * line the listener's voice can never say is said in the other voice (see
 * buildManifest); a line neither voice can say is `missing`, so the player says so at
 * once instead of waiting for audio that will not come.
 */
export type ManifestItem =
  | { type: "clip"; key: string; ready: boolean; version: string | null; missing?: true }
  | { type: "pause"; ms: number };

export interface Manifest {
  lang: AudioLang;
  voice: Voice;
  items: ManifestItem[];
  /**
   * Distinct lines, how many of them are ready to play (in either voice), and how many
   * neither voice can say.
   */
  total: number;
  ready: number;
  missing: number;
}

/** The clips a script says, each once, in the order first said. */
export function clipsOf(script: PrayAlongScript, voice: Voice): NeededClip[] {
  const seen = new Map<string, NeededClip>();
  for (const item of script.items) {
    if (item.kind !== "say") continue;
    const key = clipKey(item.text, item.lang, voice, item.take ?? 0);
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        lang: item.lang,
        voice,
        voiceId: voiceIdFor(item.lang, voice),
        text: item.text,
      });
    }
  }
  return [...seen.values()];
}

/**
 * The version of a made clip's audio, which its URL names: the row's "updatedAt" in
 * milliseconds, in base 36 (8 characters). A clip keeps its key when it is made again
 * after an engine fix, so the key alone cannot tell old audio from new. Only the voice
 * engine's write_done (worker.py) writes the audio, and it moves "updatedAt" in the same
 * statement; nothing writes a made row otherwise (a listener's demand and the planner
 * leave 'done' rows alone, and a remake goes through 'pending'). So the version changes
 * each time the audio is written, and at no other time while it is served. A hash of
 * the audio would mean reading every clip's bytes for each playlist, or a new column
 * the engine fills; "updatedAt" is on the row the playlist reads already. Anything
 * that writes a clip's audio by hand must move "updatedAt" with it.
 */
export function clipVersion(updatedAt: Date): string {
  return updatedAt.getTime().toString(36);
}

/** The keys among `keys` whose audio is made, each with its version (clipVersion). */
export async function readyClipVersions(keys: readonly string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  try {
    const rows = await prisma.prayerAudioClip.findMany({
      where: { key: { in: [...keys] }, status: "done" },
      select: { key: true, updatedAt: true },
    });
    return new Map(rows.map((r) => [r.key, clipVersion(r.updatedAt)]));
  } catch {
    return new Map();
  }
}

/** At most this many clips are filed per request: a long novena day files the rest on its next. */
const MAX_DEMAND_PER_REQUEST = 600;

/**
 * A clip that failed its quality check is tried again when a listener asks for it,
 * until it has had this many claims (the engine's own limit, voice-engine/worker.py
 * MAX_ATTEMPTS). Each retry is made with new seeds (worker.py seed_key_for). That gives
 * the sampled voices (Qwen3-TTS, VoxCPM2) different takes, but not Kokoro (Latin): its
 * takes differ only by a fixed ladder of speeds (engine.py take_params), and its seed
 * moves nothing but the vocoder's noise, so a Latin retry is nearly the same four takes
 * again. Any other failure waits for RENEW_FAILED_AFTER_MS.
 */
export const RETRY_FAILED_BELOW_ATTEMPTS = 5;

/**
 * A clip that has failed for good (out of retries, or failed for a reason a retry
 * cannot change by itself: worker.py `voice:`, `text:`, `attempts:exhausted:`) gets one
 * more attempt when a listener asks for it once this long has passed since it failed
 * (its "updatedAt", which only the engine's write_failed moves on a failed row). A fix
 * to the voice engine then reaches it without anyone resetting the row by hand, and a
 * clip that can never pass costs at most one attempt a day.
 *
 * One attempt, not a new round: attempts go back to RETRY_FAILED_BELOW_ATTEMPTS - 1 at
 * most, so the claim is the engine's last (worker.py MAX_ATTEMPTS). A claim's seeds
 * come from the key and the attempt number alone (worker.py seed_key_for), so without
 * an engine change any attempt repeats takes that already failed; after a change, one
 * attempt of up to four takes is the test.
 */
export const RENEW_FAILED_AFTER_MS = 24 * 60 * 60 * 1000;
const RENEWED_ATTEMPTS = RETRY_FAILED_BELOW_ATTEMPTS - 1;

/**
 * How a filed clip stands when the engine has failed it:
 * - "stuck": still failed after the request filed it; the engine will not make it for now.
 * - "retrying": pending again after a failure (a retry, a renewal, an engine error, a
 *   reset by hand), so it has a `lastError` other than a stopped engine's "interrupted"
 *   (worker.py release, which counts no attempt); it may pass this time, or fail again.
 */
export type ClipTrouble = "stuck" | "retrying";

/**
 * Files the clips a listener is waiting for, so the engine makes them first: a new row
 * is 'pending' and requested now; a pending row has its request time moved up; a row
 * that failed its quality check is pending again with its last claim cleared (see
 * RETRY_FAILED_BELOW_ATTEMPTS), so the engine can try it while the listener waits
 * (a Kokoro clip keeps its claim's pace); a row that failed for good a day ago or more
 * is pending again with one attempt left and its claim cleared (RENEW_FAILED_AFTER_MS).
 * A made clip is left alone.
 *
 * Returns the filed clips the engine has failed, by key, and how each stands
 * (ClipTrouble); a clip not in it is made, new, or pending with no failure on record.
 * Never throws: when the database fails, it returns none.
 */
export async function fileClipDemand(
  clips: readonly DemandedClip[],
  now: Date = new Date(),
): Promise<Map<string, ClipTrouble>> {
  const batch = clips.slice(0, MAX_DEMAND_PER_REQUEST);
  if (batch.length === 0) return new Map();
  try {
    // `priority` is the clip's place in the script, so the engine makes a waiting
    // listener's clips in the order they will be heard.
    const values = batch.map(
      (c, i) =>
        Prisma.sql`(${`pac_${c.key}`}, ${c.key}, ${c.lang}, ${c.voice}, ${c.voiceId}, ${c.text}, 'pending', ${c.priority ?? i}, ${now}, ${now}, ${now})`,
    );
    // A quality failure filed again loses its last claim too. The engine skips a row
    // claimed in the last 10 minutes (worker.py CLAIM_STALE_MIN), far longer than the
    // player waits for a clip (player.ts MAX_WAIT_MS, 2 minutes), so a retry still
    // holding the failed attempt's claim could not start while the listener waits. A
    // failed row is never being worked on, so no worker loses anything. A pending row
    // keeps its claim: the worker making it stores its result only in a row it still
    // holds, and no second worker starts on it.
    // Except Kokoro (Latin): its retries are nearly the same takes (see
    // RETRY_FAILED_BELOW_ATTEMPTS), so its claim keeps the engine's 10-minute pace. With
    // it cleared, one listener's polls (player.ts, every 2.5 s) would spend every
    // attempt in half a minute on those same takes, and a later fix to the engine would
    // find the row out of attempts.
    // A row failed for good a day ago or more gets one more attempt (RENEW_FAILED_AFTER_MS):
    // attempts down to one below the limit at most (worker.py fails a claim past
    // MAX_ATTEMPTS at once, as attempts:exhausted), and its claim cleared, Kokoro's too,
    // so the attempt starts while the listener waits. Its "updatedAt" is when it failed:
    // the engine's write_failed moves it, and this statement never does. The engine
    // writes it in UTC (worker.py sets its session's time zone), so the cutoff is a UTC
    // wall-clock time too, whatever this connection's time zone (Prisma binds a Date as
    // timestamptz, which Postgres would otherwise compare in the session's zone).
    // Postgres works out every SET expression from the row as it was before this
    // update, so all the CASEs below test the old status and always agree.
    const cutoff = new Date(now.getTime() - RENEW_FAILED_AFTER_MS);
    const failed = Prisma.sql`"PrayerAudioClip"."status" = 'failed'`;
    const retry = Prisma.sql`${failed}
      AND "PrayerAudioClip"."lastError" LIKE 'qa:%'
      AND "PrayerAudioClip"."attempts" < ${RETRY_FAILED_BELOW_ATTEMPTS}`;
    const renew = Prisma.sql`${failed}
      AND "PrayerAudioClip"."updatedAt" < (${cutoff}::timestamptz AT TIME ZONE 'UTC')`;
    const again = Prisma.sql`(${retry}) OR (${renew})`;
    const clearClaim = Prisma.sql`(${retry} AND "PrayerAudioClip"."voiceId" NOT LIKE 'kokoro-%') OR (${renew})`;
    // RETURNING gives every row this statement inserted or updated (a made row is not
    // updated, so it is not returned) as it now stands. A new row has no "lastError"; a
    // pending row with one is being made again after a failure, unless the engine was
    // only stopped mid-clip ("interrupted": worker.py release counts no attempt).
    const rows = await prisma.$queryRaw<{ key: string; status: string; failedBefore: boolean }[]>`
      INSERT INTO "PrayerAudioClip"
        ("id", "key", "lang", "voice", "voiceId", "text", "status", "priority", "requestedAt", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("key") DO UPDATE
        SET "requestedAt" = EXCLUDED."requestedAt",
            "priority" = LEAST("PrayerAudioClip"."priority", EXCLUDED."priority"),
            "status" = CASE WHEN ${again} THEN 'pending' ELSE "PrayerAudioClip"."status" END,
            "attempts" = CASE WHEN ${renew} THEN LEAST("PrayerAudioClip"."attempts", ${RENEWED_ATTEMPTS}) ELSE "PrayerAudioClip"."attempts" END,
            "claimedAt" = CASE WHEN ${clearClaim} THEN NULL ELSE "PrayerAudioClip"."claimedAt" END,
            "claimedBy" = CASE WHEN ${clearClaim} THEN NULL ELSE "PrayerAudioClip"."claimedBy" END
        WHERE "PrayerAudioClip"."status" <> 'done'
      RETURNING "key", "status",
        ("lastError" IS NOT NULL AND "lastError" <> 'interrupted') AS "failedBefore"`;
    const trouble = new Map<string, ClipTrouble>();
    for (const r of rows) {
      if (r.status === "failed") trouble.set(r.key, "stuck");
      else if (r.failedBefore) trouble.set(r.key, "retrying");
    }
    return trouble;
  } catch {
    // No table yet, or a transient error: the page still plays what is made.
    return new Map();
  }
}

/** The same words in the other voice, for a line the listener's voice has failed. */
interface StandIn {
  key: string;
  /** Its audio's version once it is made, else null. */
  version: string | null;
  /** True when the other voice has failed for good on it too. */
  stuck: boolean;
}

/**
 * For each line the engine has failed in the listener's voice (`trouble`, by key in
 * `voice`), the same words in the other voice: made, or else, for a line failed for good,
 * filed now so the engine makes it first (at the failed line's place in the prayer,
 * `place`, so the prayer is still made in the order it is heard), or failed for good too.
 * A line being made again is not filed in the other voice: its own retry may well pass.
 */
async function standInsFor(
  script: PrayAlongScript,
  voice: Voice,
  trouble: ReadonlyMap<string, ClipTrouble>,
  place: ReadonlyMap<string, number>,
  now: Date,
): Promise<Map<string, StandIn>> {
  const other: Voice = voice === "female" ? "male" : "female";
  const wanted = new Map<string, DemandedClip>();
  for (const item of script.items) {
    if (item.kind !== "say") continue;
    const own = clipKey(item.text, item.lang, voice, item.take ?? 0);
    if (!trouble.has(own) || wanted.has(own)) continue;
    wanted.set(own, {
      key: clipKey(item.text, item.lang, other, item.take ?? 0),
      lang: item.lang,
      voice: other,
      voiceId: voiceIdFor(item.lang, other),
      text: item.text,
      priority: place.get(own),
    });
  }
  const ready = await readyClipVersions([...wanted.values()].map((c) => c.key));
  const toMake = [...wanted].filter(
    ([own, c]) => trouble.get(own) === "stuck" && !ready.has(c.key),
  );
  const theirs = await fileClipDemand(
    toMake.map(([, c]) => c),
    now,
  );
  const out = new Map<string, StandIn>();
  for (const [own, c] of wanted) {
    out.set(own, {
      key: c.key,
      version: ready.get(c.key) ?? null,
      stuck: theirs.get(c.key) === "stuck",
    });
  }
  return out;
}

/**
 * The manifest for a script in a voice: clip keys and pauses, with readiness; files demand.
 *
 * A line the listener's voice has failed is said in the other voice, so the prayer is
 * still prayed in full and at once:
 * - failed for good (still failed after this request filed it, see fileClipDemand): the
 *   other voice's clip plays if it is made, and is filed for the engine to make first if
 *   it is not; a line neither voice can say is listed `missing`;
 * - being made again after a failure (a retry, or the attempt a day later): the other
 *   voice's clip plays if it is made, else the player waits for the retry, as for any
 *   clip being made.
 * Only rows the engine has failed take this path, so a prayer whose clips are made or
 * being made for the first time costs one read and one write, as before.
 */
export async function buildManifest(script: PrayAlongScript, voice: Voice): Promise<Manifest> {
  const now = new Date();
  const clips = clipsOf(script, voice);
  const ready = await readyClipVersions(clips.map((c) => c.key));
  const notReady = clips.filter((c) => !ready.has(c.key));
  const trouble = await fileClipDemand(notReady, now);
  const standIns =
    trouble.size > 0
      ? await standInsFor(script, voice, trouble, new Map(notReady.map((c, i) => [c.key, i])), now)
      : new Map<string, StandIn>();

  type ClipItem = Extract<ManifestItem, { type: "clip" }>;
  /** What the player is given for each distinct line, by its key in the listener's voice. */
  const lines = new Map<string, ClipItem>();
  for (const { key } of clips) {
    const version = ready.get(key);
    const state = trouble.get(key);
    const standIn = standIns.get(key);
    const own: ClipItem = { type: "clip", key, ready: false, version: null };
    if (version !== undefined) lines.set(key, { type: "clip", key, ready: true, version });
    else if (!state || !standIn) lines.set(key, own);
    else if (standIn.version !== null) {
      lines.set(key, { type: "clip", key: standIn.key, ready: true, version: standIn.version });
    } else if (state === "retrying") lines.set(key, own);
    else if (!standIn.stuck) {
      lines.set(key, { type: "clip", key: standIn.key, ready: false, version: null });
    } else lines.set(key, { ...own, missing: true });
  }

  const items: ManifestItem[] = script.items.map((item) =>
    item.kind === "pause"
      ? { type: "pause", ms: item.ms }
      : { ...lines.get(clipKey(item.text, item.lang, voice, item.take ?? 0))! },
  );
  const all = [...lines.values()];
  return {
    lang: script.lang,
    voice,
    items,
    total: clips.length,
    ready: all.filter((l) => l.ready).length,
    missing: all.filter((l) => l.missing).length,
  };
}

/**
 * A made clip's audio and its version (clipVersion), or null. Both come from one read
 * of the row, so the version is always that of these bytes.
 */
export async function readClipAudio(
  key: string,
): Promise<{ audio: Uint8Array<ArrayBuffer>; mime: string; version: string } | null> {
  try {
    const row = await prisma.prayerAudioClip.findUnique({
      where: { key },
      select: { audio: true, mime: true, status: true, updatedAt: true },
    });
    if (!row || row.status !== "done" || !row.audio) return null;
    return {
      audio: Uint8Array.from(row.audio),
      mime: row.mime ?? "audio/mp4",
      version: clipVersion(row.updatedAt),
    };
  } catch {
    return null;
  }
}

/**
 * The version of a made clip's audio, or null: a small read that leaves the audio out,
 * so the clip route can check that a copy it holds in memory is still the current one.
 */
export async function readClipVersion(key: string): Promise<string | null> {
  try {
    const row = await prisma.prayerAudioClip.findUnique({
      where: { key },
      select: { status: true, updatedAt: true },
    });
    return row && row.status === "done" ? clipVersion(row.updatedAt) : null;
  } catch {
    return null;
  }
}
