/**
 * The order the voice engine pre-makes clips in, lower first, as the planner
 * (scripts/pray-along-plan.ts) stores it on each row: every language's female voice
 * before any male voice (it is the voice every visitor hears unless a signed-in member
 * chose the male one); within a voice, English, then Latin and Greek, then the reader
 * languages; within a language, the Sign of the Cross and the building-block prayers,
 * the Rosary, every prayer in display order, the novena days, then the guides; within
 * a script, its order. A listener's press is made before all of it, whatever its place.
 *
 * Stored as a whole number that is the same in every run, so the order holds however
 * and whenever the rows are filed.
 */

import type { AudioLang } from "./languages";
import type { Voice } from "./voice-choice";

export function languageBand(lang: AudioLang): number {
  if (lang === "en") return 0;
  if (lang === "la" || lang === "el") return 100_000;
  return 200_000;
}

export function voiceBand(voice: Voice): number {
  return voice === "female" ? 0 : 1_000_000;
}

/** Where each kind of script starts within a language's band. */
export const KIND_OFFSET = {
  /** The Sign of the Cross at 0, the building-block prayers from 1. */
  blocks: 0,
  rosary: 100,
  prayers: 1_000,
  novenas: 10_000,
  guides: 50_000,
} as const;

/** A planned place: band + voice + kind offset + index, and the item's place in its script. */
export function plannedPlace(base: number, voice: Voice, itemIndex: number): number {
  return base + voiceBand(voice) + Math.min(itemIndex, 999) / 1000;
}

/** The whole number a row is stored with (fits a 32-bit column). */
export function storedPriority(planned: number): number {
  return Math.round(planned * 1000);
}
