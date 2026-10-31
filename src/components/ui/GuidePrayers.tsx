"use client";

import { useMemo } from "react";

import {
  resolvePrayerLanguage,
  type PrayerWithVariants,
} from "@/lib/content-shared/prayer-language";
import { Disclosure } from "./Disclosure";
import { PrayerLanguageChips, usePrayerLanguage, type LanguageOption } from "./PrayerLanguageChips";

/**
 * The prayers of a guide, novena, devotion or chaplet, in the order they are
 * prayed, each as a dropdown (so the full text is readily available), with one
 * UNIVERSAL set of language chips (Latin / Greek / …) that switches every
 * dropdown at once. It is the same session-wide choice as the prayer page's
 * chips (`usePrayerLanguage`), so Latin picked anywhere opens here in Latin;
 * a prayer without the chosen language shows its vernacular text. Latin /
 * Greek text is marked translate="no" so it is never auto-translated.
 */
export type GuidePrayerData = PrayerWithVariants;

const LANG_ORDER = ["la", "el"];

export function GuidePrayers({
  prayers,
  heading = "Prayers of this guide",
}: {
  prayers: GuidePrayerData[];
  /** Section heading ("Prayers of this novena", "Prayers of this devotion", …). */
  heading?: string;
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
    <section className="mx-auto max-w-3xl px-4 pb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">{heading}</h2>
        <PrayerLanguageChips
          options={languages}
          active={activeCode}
          onSelect={(code) => toggle(code, activeCode)}
        />
      </div>
      <p className="mt-1 font-serif text-sm text-ink-soft">
        In the order they are prayed — tap a prayer to reveal its full text
        {languages.length > 0 ? " in the chosen language" : ""}.
      </p>
      <div className="mt-4 space-y-3">
        {prayers.map((p, i) => {
          const { shown } = resolvePrayerLanguage(p.variants, language);
          return (
            <Disclosure key={p.slug} eyebrow={`Prayer ${i + 1}`} title={p.title}>
              {shown ? (
                <p
                  className="whitespace-pre-line"
                  translate={shown.preserve ? "no" : undefined}
                  lang={shown.code}
                >
                  {shown.text}
                </p>
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
