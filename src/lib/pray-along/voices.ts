/**
 * Which open model speaks each language for each of the two voices (voices.json,
 * shared with the voice engine), and each clip's identity.
 *
 * Server only (node:crypto). The browser-safe choice of voice is in voice-choice.ts.
 */

import { createHash } from "node:crypto";

import type { AudioLang } from "./languages";
import type { Voice } from "./voice-choice";
import config from "./voices.json";

export { DEFAULT_VOICE, VOICES, isVoice, voiceOrDefault, type Voice } from "./voice-choice";

/** The model and stock voice that speak `lang` as `voice` ("kokoro-82m@1.0:af_heart"). */
export function voiceIdFor(lang: AudioLang, voice: Voice): string {
  const entry = (config.voices as Record<string, Record<Voice, string>>)[lang];
  return entry?.[voice] ?? `pending:${lang}-${voice}`;
}

/** Bumped (in voices.json) to re-key, and so re-make, every clip. */
export const VOICE_FORMAT_VERSION: number = config.formatVersion;

/**
 * A clip's identity: the format version, the voice that speaks the language, the
 * language, the voice, the take and the exact words. The same Hail Mary in the same
 * voice is one clip on every page; a new voice model gives every clip it speaks a new
 * key, so the engine makes them again.
 */
export function clipKey(text: string, lang: AudioLang, voice: Voice, take = 0): string {
  return createHash("sha256")
    .update(
      [String(VOICE_FORMAT_VERSION), voiceIdFor(lang, voice), lang, voice, String(take), text].join(
        "\u0000",
      ),
    )
    .digest("hex")
    .slice(0, 40);
}
