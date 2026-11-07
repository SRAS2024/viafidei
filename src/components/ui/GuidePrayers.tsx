"use client";

import { useMemo } from "react";

import {
  resolvePrayerLanguage,
  type PrayerWithVariants,
} from "@/lib/content-shared/prayer-language";
import { Disclosure } from "./Disclosure";
import {
  PrayerLanguageChips,
  UnofficialTranslationNote,
  usePrayerLanguage,
  type LanguageOption,
} from "./PrayerLanguageChips";
import { PrayerText } from "./PrayerText";

/**
 * The prayers of a guide, novena, devotion or chaplet, each as a dropdown (so
 * the full text is readily available), with one UNIVERSAL set of language
 * chips (Latin / Greek / …) that switches every dropdown at once. It is the
 * same session-wide choice as the prayer page's chips (`usePrayerLanguage`),
 * so Latin picked anywhere opens here in Latin; a prayer without the chosen
 * language shows its vernacular text. Latin / Greek text is marked
 * translate="no" so it is never auto-translated, and a machine translation
 * says so under the text.
 *
 * An `ordered` list is the sequence in which the prayers are prayed, so each
 * is numbered ("Prayer 1"). A set that is not a sequence (a Marian title's
 * prayers, which are alternatives) is listed without numbers or that claim.
 */
export type GuidePrayerData = PrayerWithVariants;

const LANG_ORDER = ["la", "el"];

export function GuidePrayers({
  prayers,
  heading = "Prayers of this guide",
  ordered = true,
}: {
  prayers: GuidePrayerData[];
  /** Section heading ("Prayers of this novena", "Prayers of this devotion", …). */
  heading?: string;
  /** The list is the order in which the prayers are prayed (default). */
  ordered?: boolean;
}) {
  // Every language some prayer offers beyond its own vernacular — the chips.
  const languages = useMemo<LanguageOption[]>(() => {
    const map = new Map<string, string>();
    for (const p of prayers) {
      for (const v of resolvePrayerLanguage(p.variants, null).alternates) {
        if (!map.has(v.code)) map.set(v.code, v.label);
      }
    }
    return [...map.entries()]
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => {
        const ai = LANG_ORDER.indexOf(a.code);
        const bi = LANG_ORDER.indexOf(b.code);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      });
  }, [prayers]);

  const { language, toggle } = usePrayerLanguage();

  if (prayers.length === 0) return null;

  // The chip that reads as pressed is the chosen language, when this list offers it.
  const activeCode = language && languages.some((l) => l.code === language) ? language : null;

  return (
    <section className="vf-detail-section vf-prayer-list">
      <h2 className="vf-subhead">{heading}</h2>
      <PrayerLanguageChips
        options={languages}
        active={activeCode}
        onSelect={(code) => toggle(code, activeCode)}
      />
      <p className="vf-detail-note">
        {ordered ? "In the order they are prayed — tap" : "Tap"} a prayer to reveal its full text
        {languages.length > 0 ? " in the chosen language" : ""}.
      </p>
      <div className="vf-disclosure-list">
        {prayers.map((p, i) => {
          const { shown } = resolvePrayerLanguage(p.variants, language);
          return (
            <Disclosure
              key={p.slug}
              eyebrow={ordered ? `Prayer ${i + 1}` : undefined}
              title={p.title}
            >
              {shown ? (
                <>
                  <PrayerText
                    text={shown.text}
                    // The reader's language when the vernacular holds their
                    // translation (src/lib/translation), never "en".
                    lang={shown.lang ?? shown.code}
                    preserve={shown.preserve}
                  />
                  <UnofficialTranslationNote variant={shown} className="mt-2" />
                </>
              ) : (
                <p className="text-ink-faint">Text not available.</p>
              )}
            </Disclosure>
          );
        })}
      </div>
    </section>
  );
}
