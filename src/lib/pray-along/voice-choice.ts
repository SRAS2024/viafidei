/**
 * The two voices a listener can choose. Signed-out visitors, and members who never
 * chose, hear the female voice (the owner's rule).
 *
 * Pure and browser-safe: the settings picker imports it.
 */

export const VOICES = ["female", "male"] as const;
export type Voice = (typeof VOICES)[number];
export const DEFAULT_VOICE: Voice = "female";

export function isVoice(value: unknown): value is Voice {
  return value === "female" || value === "male";
}

/** A stored or requested choice as a voice: anything else is the default. */
export function voiceOrDefault(value: unknown): Voice {
  return isVoice(value) ? value : DEFAULT_VOICE;
}
