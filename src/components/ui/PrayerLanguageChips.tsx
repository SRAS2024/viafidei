"use client";

import { useCallback, useEffect, useState } from "react";

import type { PrayerVariant } from "@/lib/content-shared/prayer-language";

/**
 * The one Latin / Greek language control, shared by every place a prayer's
 * text is shown: the prayer page, a guide's, novena's or devotion's prayer
 * dropdowns, and a prayer opened inline from a step or a day.
 *
 * The vernacular is the implicit default and never gets a chip; each other
 * language the prayer carries does. Selecting a chip shows that language and
 * selecting it again returns to the vernacular. The choice is stored in
 * `sessionStorage` and broadcast to every other control on the page, so picking
 * Latin once opens each prayer that has Latin in Latin — on this page and on
 * the next — while a prayer without it stays in the vernacular. A prayer with
 * only one language shows no chips at all, never a chip that toggles nothing.
 */

const STORAGE_KEY = "vf_prayer_lang";
/** Sentinel stored when the reader explicitly toggles back to the vernacular. */
const VERNACULAR = "vernacular";
/** Same-document broadcast: `storage` events only reach OTHER documents. */
const CHANGE_EVENT = "vf:prayer-lang";

function readStoredLanguage(): string | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored && stored !== VERNACULAR ? stored : null;
  } catch {
    return null; // sessionStorage may be unavailable (private mode)
  }
}

/**
 * The reader's chosen prayer language for this session: a language code, or
 * `null` for the vernacular. Starts as `null` on the server and on the first
 * client render (so hydration matches), then adopts the stored choice.
 */
export function usePrayerLanguage(): {
  language: string | null;
  /** Select `code`, or return to the vernacular when `code` is already active. */
  toggle: (code: string, active: string | null) => void;
} {
  const [language, setLanguage] = useState<string | null>(null);

  useEffect(() => {
    setLanguage(readStoredLanguage());
    const onChange = (event: Event) =>
      setLanguage((event as CustomEvent<string | null>).detail ?? null);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const toggle = useCallback((code: string, active: string | null) => {
    const next = code === active ? null : code;
    setLanguage(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next ?? VERNACULAR);
    } catch {
      // Selection still works for this view without storage.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }, []);

  return { language, toggle };
}

export interface LanguageOption {
  code: string;
  label: string;
}

/** The chip row: one real, `aria-pressed` button per selectable language. */
export function PrayerLanguageChips({
  options,
  active,
  onSelect,
  label = "Prayer language",
  size = "md",
  className = "",
}: {
  /** The selectable (non-vernacular) languages. Renders nothing when empty. */
  options: ReadonlyArray<LanguageOption>;
  /** The language currently shown, or `null` for the vernacular. */
  active: string | null;
  onSelect: (code: string) => void;
  /** Accessible name of the group. */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  if (options.length === 0) return null;
  const sizing = size === "sm" ? "!px-2 !py-0.5 text-[11px]" : "!px-3 !py-1 text-xs";
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap ${size === "sm" ? "gap-1" : "gap-2"} ${className}`.trim()}
    >
      {options.map((option) => {
        const pressed = option.code === active;
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(option.code)}
            className={`vf-btn ${sizing} ${pressed ? "vf-btn-primary" : "vf-btn-ghost"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The line under a prayer shown in a machine translation (`unofficial`): the
 * June 2026 Greek of the Creed or the Memorare is not a received liturgical
 * text, and the page must not present it as one. Renders nothing otherwise.
 */
export function UnofficialTranslationNote({
  variant,
  className = "",
}: {
  variant: PrayerVariant | undefined;
  className?: string;
}) {
  if (!variant?.unofficial) return null;
  return (
    <p lang="en" className={`font-sans text-xs text-ink-faint ${className}`.trim()}>
      Unofficial translation, not a liturgical text.
    </p>
  );
}
