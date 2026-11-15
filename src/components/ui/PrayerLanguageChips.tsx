"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

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

/**
 * What the chips need from the reader's site language, set once by the root layout: the
 * language itself (a reader of the Latin site reads a prayer's Latin first, see
 * `resolvePrayerLanguage`), each prayer language's name in it ("Latín", "라틴어"), and the
 * names of the chip groups. Without a provider (tests, a stray render) it is English.
 */
export interface PrayerLanguageSetup {
  readerLanguage: string;
  /** A prayer language's name in the reader's language, by code ("la" → "Latin"). */
  names: Readonly<Record<string, string>>;
  /** The name of a chip group ("Prayer language"). */
  groupLabel: string;
  /** The name of the chips over a prayer opened in place: "{title} language". */
  groupFor: string;
}

const PrayerLanguageContext = createContext<PrayerLanguageSetup>({
  readerLanguage: "en",
  names: {},
  groupLabel: "Prayer language",
  groupFor: "{title} language",
});

export function PrayerLanguageProvider({
  setup,
  children,
}: {
  setup: PrayerLanguageSetup;
  children: ReactNode;
}) {
  return <PrayerLanguageContext.Provider value={setup}>{children}</PrayerLanguageContext.Provider>;
}

/** The reader's prayer-language setup (see `PrayerLanguageSetup`). */
export function usePrayerLanguageSetup(): PrayerLanguageSetup {
  return useContext(PrayerLanguageContext);
}

export interface LanguageOption {
  code: string;
  label: string;
}

/**
 * The chip row: one real, `aria-pressed` button per selectable language. They are
 * the site's small outlined buttons, and the pressed look comes with `aria-pressed`.
 * Each chip is named in the reader's language ("Latín" on the Spanish site), and the
 * group is named "Prayer language" in it unless the caller names it.
 */
export function PrayerLanguageChips({
  options,
  active,
  onSelect,
  label,
  className = "",
}: {
  /** The selectable (non-vernacular) languages. Renders nothing when empty. */
  options: ReadonlyArray<LanguageOption>;
  /** The language currently shown, or `null` for the vernacular. */
  active: string | null;
  onSelect: (code: string) => void;
  /** Accessible name of the group. */
  label?: string;
  className?: string;
}) {
  const { names, groupLabel } = usePrayerLanguageSetup();
  if (options.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={label ?? groupLabel}
      className={`vf-language-chips ${className}`.trim()}
    >
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          aria-pressed={option.code === active}
          onClick={() => onSelect(option.code)}
          className="vf-btn vf-btn-sm vf-btn-ghost"
        >
          {names[option.code] ?? option.label}
        </button>
      ))}
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
    <p lang="en" className={`vf-fineprint vf-prayer-source ${className}`.trim()}>
      Unofficial translation, not a liturgical text.
    </p>
  );
}
