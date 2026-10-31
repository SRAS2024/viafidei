"use client";

import { Fragment, useId, useMemo, useState } from "react";

import { resolvePrayerLanguage } from "@/lib/content-shared/prayer-language";
import { tokenizePrayerMentions } from "@/lib/content-shared/prayer-mentions";

import type { GuidePrayerData } from "./GuidePrayers";
import {
  PrayerLanguageChips,
  UnofficialTranslationNote,
  usePrayerLanguage,
} from "./PrayerLanguageChips";

/**
 * Text with the prayers it names made inline-expandable.
 *
 * Whenever a step, a day, an instruction or a Rosary/chaplet prayer names one of
 * the prayers supplied (e.g. "pray the Our Father", "end with a Glory Be"), that
 * name becomes a button: clicking it drops the full prayer open right under the
 * text, so it is readily available without scrolling to a list. Each opened
 * prayer carries the shared Latin / Greek language chips (`PrayerLanguageChips`);
 * Latin and Greek are marked translate="no" so they are never auto-translated.
 * Falls back to plain text when nothing matches — so it is safe to use anywhere.
 *
 * Which spans count as a prayer's name is decided by `tokenizePrayerMentions`;
 * pass `matchCase` when the text is itself prayer (see that module).
 *
 * Each panel's id is unique to its text (`useId`), so the same prayer opened
 * from two days of a novena is two panels with two ids, and each toggle's
 * `aria-controls` names its own. The panel title's heading level follows the
 * text's place in the page (`headingLevel`): an h2 straight under a prayer
 * page's h1, an h4 inside a guide step headed h3.
 */

type PanelHeadingLevel = 2 | 3 | 4;

function InlinePrayerPanel({
  prayer,
  id,
  headingLevel,
}: {
  prayer: GuidePrayerData;
  id: string;
  headingLevel: PanelHeadingLevel;
}) {
  const { language, toggle } = usePrayerLanguage();
  const { vernacular, alternates, shown } = resolvePrayerLanguage(prayer.variants, language);
  const activeCode = shown && shown !== vernacular ? shown.code : null;
  const Heading = `h${headingLevel}` as const;

  return (
    <div id={id} className="rounded-sm border border-ink/10 bg-paper-bright/60 p-4 shadow-paper">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading className="font-display text-base text-ink">{prayer.title}</Heading>
        <PrayerLanguageChips
          options={alternates}
          active={activeCode}
          onSelect={(code) => toggle(code, activeCode)}
          label={`${prayer.title} language`}
          size="sm"
        />
      </div>
      {shown ? (
        <>
          <p
            className="mt-2 whitespace-pre-line font-serif text-sm leading-relaxed text-ink-soft"
            translate={shown.preserve ? "no" : undefined}
            lang={shown.code}
          >
            {shown.text}
          </p>
          <UnofficialTranslationNote variant={shown} className="mt-2" />
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">Text not available.</p>
      )}
    </div>
  );
}

export function PrayerLinkedText({
  text,
  prayers,
  matchCase = false,
  headingLevel = 3,
}: {
  text: string;
  prayers: GuidePrayerData[];
  /** The text is itself prayer: only capitalised names count (see prayer-mentions). */
  matchCase?: boolean;
  /** Heading level of an opened prayer's title: one below the text's own section. */
  headingLevel?: PanelHeadingLevel;
}) {
  const { segments, matched } = useMemo(
    () => tokenizePrayerMentions(text, prayers, { matchCase }),
    [text, prayers, matchCase],
  );
  const [open, setOpen] = useState<Set<string>>(new Set());
  const baseId = useId();
  const panelId = (slug: string) => `${baseId}-prayer-${slug}`;

  if (matched.length === 0) {
    return <p className="whitespace-pre-line">{text}</p>;
  }

  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  // Panels in the order the prayers first appear in the text, only those open.
  const openPrayers = matched.filter((p) => open.has(p.slug));

  return (
    <>
      <p className="whitespace-pre-line">
        {segments.map((seg, i) =>
          seg.prayer ? (
            <button
              key={i}
              type="button"
              onClick={() => toggle(seg.prayer!.slug)}
              aria-expanded={open.has(seg.prayer.slug)}
              aria-controls={panelId(seg.prayer.slug)}
              className="font-medium text-ink underline decoration-dotted decoration-1 underline-offset-2 transition-colors hover:text-ink-strong"
            >
              {seg.text}
              <span aria-hidden className="ml-0.5 text-[0.7em] text-ink-faint">
                {open.has(seg.prayer.slug) ? "▴" : "▾"}
              </span>
            </button>
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          ),
        )}
      </p>
      {openPrayers.length > 0 ? (
        <div className="mt-3 space-y-2">
          {openPrayers.map((p) => (
            <InlinePrayerPanel
              key={p.slug}
              prayer={p}
              id={panelId(p.slug)}
              headingLevel={headingLevel}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
