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

/** What the player is given: the clips and pauses in order, and which clips are ready. */
export type ManifestItem =
  | { type: "clip"; key: string; ready: boolean }
  | { type: "pause"; ms: number };

export interface Manifest {
  lang: AudioLang;
  voice: Voice;
  items: ManifestItem[];
  /** Distinct clips, and how many of them are ready to play. */
  total: number;
  ready: number;
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

/** The keys among `keys` whose audio is made. */
export async function readyClipKeys(keys: readonly string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  try {
    const rows = await prisma.prayerAudioClip.findMany({
      where: { key: { in: [...keys] }, status: "done" },
      select: { key: true },
    });
    return new Set(rows.map((r) => r.key));
  } catch {
    return new Set();
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
 * again. Any other failure stays failed.
 */
export const RETRY_FAILED_BELOW_ATTEMPTS = 5;

/**
 * Files the clips a listener is waiting for, so the engine makes them first: a new row
 * is 'pending' and requested now; a pending row has its request time moved up; a row
 * that failed its quality check is pending again with its last claim cleared (see
 * RETRY_FAILED_BELOW_ATTEMPTS), so the engine can try it while the listener waits
 * (a Kokoro clip keeps its claim's pace). A made clip is left alone. Never throws.
 */
export async function fileClipDemand(clips: readonly NeededClip[]): Promise<void> {
  const batch = clips.slice(0, MAX_DEMAND_PER_REQUEST);
  if (batch.length === 0) return;
  const now = new Date();
  try {
    // `priority` is the clip's place in the script, so the engine makes a waiting
    // listener's clips in the order they will be heard.
    const values = batch.map(
      (c, i) =>
        Prisma.sql`(${`pac_${c.key}`}, ${c.key}, ${c.lang}, ${c.voice}, ${c.voiceId}, ${c.text}, 'pending', ${i}, ${now}, ${now}, ${now})`,
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
    // Postgres works out every SET expression from the row as it was before this
    // update, so all the CASEs below test the old status and always agree.
    const retry = Prisma.sql`"PrayerAudioClip"."status" = 'failed'
      AND "PrayerAudioClip"."lastError" LIKE 'qa:%'
      AND "PrayerAudioClip"."attempts" < ${RETRY_FAILED_BELOW_ATTEMPTS}`;
    const retryNow = Prisma.sql`${retry} AND "PrayerAudioClip"."voiceId" NOT LIKE 'kokoro-%'`;
    await prisma.$executeRaw`
      INSERT INTO "PrayerAudioClip"
        ("id", "key", "lang", "voice", "voiceId", "text", "status", "priority", "requestedAt", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("key") DO UPDATE
        SET "requestedAt" = EXCLUDED."requestedAt",
            "priority" = LEAST("PrayerAudioClip"."priority", EXCLUDED."priority"),
            "status" = CASE WHEN ${retry} THEN 'pending' ELSE "PrayerAudioClip"."status" END,
            "claimedAt" = CASE WHEN ${retryNow} THEN NULL ELSE "PrayerAudioClip"."claimedAt" END,
            "claimedBy" = CASE WHEN ${retryNow} THEN NULL ELSE "PrayerAudioClip"."claimedBy" END
        WHERE "PrayerAudioClip"."status" <> 'done'`;
  } catch {
    // No table yet, or a transient error: the page still plays what is made.
  }
}

/** The manifest for a script in a voice: clip keys and pauses, with readiness; files demand. */
export async function buildManifest(script: PrayAlongScript, voice: Voice): Promise<Manifest> {
  const clips = clipsOf(script, voice);
  const ready = await readyClipKeys(clips.map((c) => c.key));
  const missing = clips.filter((c) => !ready.has(c.key));
  if (missing.length > 0) await fileClipDemand(missing);
  const items: ManifestItem[] = script.items.map((item) =>
    item.kind === "pause"
      ? { type: "pause", ms: item.ms }
      : (() => {
          const key = clipKey(item.text, item.lang, voice, item.take ?? 0);
          return { type: "clip", key, ready: ready.has(key) } as const;
        })(),
  );
  return { lang: script.lang, voice, items, total: clips.length, ready: ready.size };
}

/** A made clip's audio, or null. */
export async function readClipAudio(
  key: string,
): Promise<{ audio: Uint8Array<ArrayBuffer>; mime: string } | null> {
  try {
    const row = await prisma.prayerAudioClip.findUnique({
      where: { key },
      select: { audio: true, mime: true, status: true },
    });
    if (!row || row.status !== "done" || !row.audio) return null;
    return { audio: Uint8Array.from(row.audio), mime: row.mime ?? "audio/mp4" };
  } catch {
    return null;
  }
}
