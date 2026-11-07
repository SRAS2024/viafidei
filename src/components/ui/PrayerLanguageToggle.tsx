"use client";

import { resolvePrayerLanguage, type PrayerVariant } from "@/lib/content-shared/prayer-language";

import type { GuidePrayerData } from "./GuidePrayers";
import {
  PrayerLanguageChips,
  UnofficialTranslationNote,
  usePrayerLanguage,
} from "./PrayerLanguageChips";
import { PrayerLinkedText } from "./PrayerLinkedText";
import { PrayerText } from "./PrayerText";

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
 * The chips sit close above the text they switch, and the text is set as prayer
 * (`PrayerText`) in whichever language is shown. Latin / Greek variants are
 * marked `translate="no"` so device or future auto-translation never rewrites the
 * verbatim liturgical text, and a machine translation says so under the text
 * (`UnofficialTranslationNote`). When the vernacular holds the reader's
 * translation (src/lib/translation), its `lang` is the reader's language, never
 * the English it was translated from.
 *
 * `linkedPrayers` are the prayers the vernacular text names ("pray the Our
 * Father", "three Hail Marys"), as in the Rosary and chaplet prayers: each name
 * opens that prayer in place, with its own language chips. The Latin text's
 * names ("Ave Maria") open them too.
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
  const linked = linkedPrayers && linkedPrayers.length > 0 ? linkedPrayers : null;

  return (
    <div className="vf-prayer-block">
      <PrayerLanguageChips
        options={alternates}
        active={activeCode}
        onSelect={(code) => toggle(code, activeCode)}
      />
      {linked ? (
        // The page's title is the h1; an opened prayer is the next level. This stays
        // in place in every language, so a prayer opened here stays open, focus and
        // all, when the chips inside it switch the text around it.
        <PrayerLinkedText
          text={shown.text}
          prayers={linked}
          matchCase
          headingLevel={2}
          lang={shown.lang ?? shown.code}
          preserve={shown.preserve}
        />
      ) : (
        <PrayerText
          text={shown.text}
          lang={shown.lang ?? shown.code}
          preserve={shown.preserve}
          headingLevel={2}
        />
      )}
      <UnofficialTranslationNote variant={shown} />
    </div>
  );
}
