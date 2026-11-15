-- @idempotent-recoverable
--
-- Pray-along audio: the spoken clips the prayer pages play, and each member's
-- choice of voice.
--
-- WHY: prayers, novena days, the Rosary, litanies and prayer guides get a button
-- that prays them aloud (Sign of the Cross, the prayer, Sign of the Cross). The
-- voices are open models run by the site's own voice engine on the worker host
-- (voice-engine/, like the content translator): it reads the clips a page needs
-- from this table, speaks them, checks each take against its text with a speech
-- recogniser, and stores the audio here. The web server never runs a model; it
-- serves the stored audio, and files a 'pending' row for a clip a listener asked
-- for that is not made yet so the engine makes it first.
--
-- One row per clip `key`: a sha256 over the voice's version, the language, the
-- voice and the exact words, so the same Hail Mary is made once and shared by
-- every page that prays it, and a new voice model re-keys (and so re-makes) its
-- clips. `audio` stays NULL while a row is pending.
--
-- "Profile"."audioVoice" holds a signed-in member's choice, 'female' or 'male';
-- NULL is the default voice (female), which signed-out visitors always hear.
--
-- Deploy safety: a NEW table and its indexes, and one nullable column with no
-- default on "Profile" (no rewrite). Every statement is guarded so a retried
-- deploy cannot fail on "already exists", and lock_timeout bounds the brief lock
-- the column takes. The table is not in scripts/validate-db.js's required set: a
-- database without it simply has no audio yet.
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "PrayerAudioClip" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "audio" BYTEA,
    "mime" TEXT,
    "durationMs" INTEGER,
    "byteLength" INTEGER,
    "engine" TEXT,
    "qaScore" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "requestedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrayerAudioClip_pkey" PRIMARY KEY ("id")
);

-- Pages look clips up by key; the unique index also makes every upsert idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "PrayerAudioClip_key_key" ON "PrayerAudioClip"("key");
-- The engine claims listeners' requests oldest-first, then pre-makes by priority.
CREATE INDEX IF NOT EXISTS "PrayerAudioClip_status_requestedAt_idx" ON "PrayerAudioClip"("status", "requestedAt");
CREATE INDEX IF NOT EXISTS "PrayerAudioClip_status_priority_idx" ON "PrayerAudioClip"("status", "priority");

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "audioVoice" TEXT;
