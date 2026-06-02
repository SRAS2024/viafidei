"use client";

import { useEffect, useState } from "react";

import type { PrayerVariant } from "@/lib/content-shared/prayer-language";

/**
 * Session-persisted language selector for a prayer's text.
 *
 * When a prayer offers more than one language (e.g. English + Latin), this
 * renders a small toggle above the text. The chosen language is stored in
 * `sessionStorage` so it carries across every prayer for the rest of the
 * session — open another prayer and it shows in the same language when that
 * language is available, otherwise it falls back to the prayer's first
 * (vernacular) variant.
 *
 * Latin / Greek variants are marked `translate="no"` so device or future
 * auto-translation never rewrites the verbatim liturgical text.
 */
const STORAGE_KEY = "vf_prayer_lang";

export function PrayerLanguageToggle({ variants }: { variants: PrayerVariant[] }) {
  const [code, setCode] = useState<string>(variants[0]?.code ?? "en");

  // On mount, prefer the session-persisted language when this prayer has it.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && variants.some((v) => v.code === stored)) setCode(stored);
  }, [variants]);

  const select = (next: string) => {
    setCode(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sessionStorage may be unavailable (private mode); selection still works for this view.
    }
  };

  const active = variants.find((v) => v.code === code) ?? variants[0];
  if (!active) return null;

  return (
    <div>
      {variants.length > 1 && (
        <div role="group" aria-label="Prayer language" className="mb-4 flex flex-wrap gap-2">
          {variants.map((v) => {
            const isActive = v.code === active.code;
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
