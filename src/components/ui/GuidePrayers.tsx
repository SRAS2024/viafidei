"use client";

import { useMemo, useState } from "react";

import type { PrayerVariant } from "@/lib/content-shared/prayer-language";
import { Disclosure } from "./Disclosure";

/**
 * The prayers of a guide, rendered at the bottom in the order they are prayed,
 * each as a dropdown (so the full text is readily available), with a single
 * UNIVERSAL language toggle (English / Latin / Greek) that switches every
 * dropdown at once. Latin / Greek text is marked translate="no" so it is never
 * auto-translated.
 */
export interface GuidePrayerData {
  slug: string;
  title: string;
  /** Ordered variants (vernacular first, then Latin / Greek / …). */
  variants: PrayerVariant[];
}

const LANG_ORDER = ["en", "la", "el"];

export function GuidePrayers({ prayers }: { prayers: GuidePrayerData[] }) {
  // Union of the languages available across all the guide's prayers.
  const languages = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of prayers) {
      for (const v of p.variants) if (!map.has(v.code)) map.set(v.code, v.label);
    }
    return [...map.entries()]
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => {
        const ai = LANG_ORDER.indexOf(a.code);
        const bi = LANG_ORDER.indexOf(b.code);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      });
  }, [prayers]);

  const [lang, setLang] = useState<string>("en");

  if (prayers.length === 0) return null;

  const variantFor = (p: GuidePrayerData): PrayerVariant | null =>
    p.variants.find((v) => v.code === lang) ?? p.variants[0] ?? null;

  return (
    <section className="mx-auto max-w-3xl px-4 pb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">Prayers of this guide</h2>
        {languages.length > 1 ? (
          <div role="group" aria-label="Prayer language" className="flex flex-wrap gap-2">
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                aria-pressed={lang === l.code}
                onClick={() => setLang(l.code)}
                className={`vf-btn !px-3 !py-1 text-xs ${
                  lang === l.code ? "vf-btn-primary" : "vf-btn-ghost"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-1 font-serif text-sm text-ink-soft">
        In the order they are prayed — tap a prayer to reveal its full text
        {languages.length > 1 ? " in the chosen language" : ""}.
      </p>
      <div className="mt-4 space-y-3">
        {prayers.map((p, i) => {
          const v = variantFor(p);
          return (
            <Disclosure key={p.slug} eyebrow={`Prayer ${i + 1}`} title={p.title}>
              {v ? (
                <p
                  className="whitespace-pre-line"
                  translate={v.preserve ? "no" : undefined}
                  lang={v.code}
                >
                  {v.text}
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
