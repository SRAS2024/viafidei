"use client";

import { useEffect, useState } from "react";

import type { PrayerVariant } from "@/lib/content-shared/prayer-language";

/**
 * Session-persisted language selector for a prayer's text.
 *
 * The vernacular text is the implicit default and is NOT shown as a button —
 * the page already renders in the reader's language. Every OTHER language the
 * prayer carries gets a chip: the liturgical languages (Latin / Greek) and any
 * vernacular translation the payload supplies (Spanish, Italian, …), which the
 * schema and `buildPrayerVariants` have always accepted but which could not be
 * selected. Selecting a chip shows that language; selecting it again (or never
 * selecting one) falls back to the vernacular. A prayer with only one language
 * — including a Latin-only prayer — shows no chips at all, rather than a chip
 * that toggles nothing. The choice is stored in `sessionStorage` so it carries
 * across every prayer for the rest of the session: pick Latin once and each
 * prayer that offers Latin opens in Latin, falling back to the vernacular when
 * a given prayer doesn't have that language.
 *
 * Latin / Greek variants are marked `translate="no"` so device or future
 * auto-translation never rewrites the verbatim liturgical text.
 */
const STORAGE_KEY = "vf_prayer_lang";
/** Sentinel stored when the reader explicitly toggles back to the vernacular. */
const VERNACULAR = "vernacular";

export function PrayerLanguageToggle({ variants }: { variants: PrayerVariant[] }) {
  // The vernacular is the first non-preserved variant (English/Spanish/…);
  // everything else the prayer carries — Latin, Greek, and any translation —
  // is selectable.
  const vernacular = variants.find((v) => !v.preserve) ?? variants[0];
  const alternates = variants.filter((v) => v.code !== vernacular?.code);

  // `null` → render the vernacular. Otherwise an alternate language code.
  const [code, setCode] = useState<string | null>(null);

  // On mount, restore the session-persisted choice when this prayer offers it.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === VERNACULAR) setCode(null);
    else if (stored && alternates.some((v) => v.code === stored)) setCode(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  const select = (next: string) => {
    // Re-selecting the active chip toggles back to the vernacular.
    const value = next === code ? null : next;
    setCode(value);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, value ?? VERNACULAR);
    } catch {
      // sessionStorage may be unavailable (private mode); selection still works for this view.
    }
  };

  const active = (code ? alternates.find((v) => v.code === code) : null) ?? vernacular;
  if (!active) return null;

  return (
    <div>
      {alternates.length > 0 && (
        <div role="group" aria-label="Prayer language" className="mb-4 flex flex-wrap gap-2">
          {alternates.map((v) => {
            const isActive = v.code === code;
            return (
              <button
                key={v.code}
                type="button"
                onClick={() => select(v.code)}
                aria-pressed={isActive}
                className={`vf-btn !py-1 !px-3 text-xs ${
                  isActive ? "vf-btn-primary" : "vf-btn-ghost"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}
      <p
        lang={active.code}
        translate={active.preserve ? "no" : undefined}
        className="whitespace-pre-line font-serif text-lg leading-relaxed text-ink"
      >
        {active.text}
      </p>
    </div>
  );
}
