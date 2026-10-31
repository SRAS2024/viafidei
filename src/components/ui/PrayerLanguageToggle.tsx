"use client";

import { resolvePrayerLanguage, type PrayerVariant } from "@/lib/content-shared/prayer-language";

import type { GuidePrayerData } from "./GuidePrayers";
import { PrayerLanguageChips, usePrayerLanguage } from "./PrayerLanguageChips";
import { PrayerLinkedText } from "./PrayerLinkedText";

/**
 * A prayer's text with its language selector (the prayer page).
 *
 * The vernacular text is the implicit default and is NOT shown as a button —
 * the page already renders in the reader's language. Every OTHER language the
 * prayer carries gets a chip: the liturgical languages (Latin / Greek) and any
 * vernacular translation the payload supplies (Spanish, Italian, …). Selecting
 * a chip shows that language; selecting it again (or never selecting one)
 * falls back to the vernacular. A prayer with only one language — including a
 * Latin-only prayer — shows no chips at all, rather than a chip that toggles
 * nothing. The choice is the session-wide one from `usePrayerLanguage`, so it
 * carries across every prayer — and every guide, novena and devotion dropdown —
 * for the rest of the session, falling back to the vernacular when a given
 * prayer doesn't have that language.
 *
 * Latin / Greek variants are marked `translate="no"` so device or future
 * auto-translation never rewrites the verbatim liturgical text.
 *
 * `linkedPrayers` are the prayers the vernacular text names ("pray the Our
 * Father", "three Hail Marys"), as in the Rosary and chaplet prayers: each name
 * opens that prayer in place, with its own language chips.
 */
export function PrayerLanguageToggle({
  variants,
  linkedPrayers,
}: {
  variants: PrayerVariant[];
  linkedPrayers?: GuidePrayerData[];
}) {
  const { language, toggle } = usePrayerLanguage();
  const { vernacular, alternates, shown } = resolvePrayerLanguage(variants, language);
  if (!shown) return null;

  const activeCode = shown === vernacular ? null : shown.code;
  const linked =
    shown === vernacular && linkedPrayers && linkedPrayers.length > 0 ? linkedPrayers : null;

  return (
    <div>
      <PrayerLanguageChips
        options={alternates}
        active={activeCode}
        onSelect={(code) => toggle(code, activeCode)}
        className="mb-4"
      />
      {linked ? (
        <div lang={shown.code} className="font-serif text-lg leading-relaxed text-ink">
          <PrayerLinkedText text={shown.text} prayers={linked} matchCase />
        </div>
      ) : (
        <p
          lang={shown.code}
          translate={shown.preserve ? "no" : undefined}
          className="whitespace-pre-line font-serif text-lg leading-relaxed text-ink"
        >
          {shown.text}
        </p>
      )}
    </div>
  );
}
