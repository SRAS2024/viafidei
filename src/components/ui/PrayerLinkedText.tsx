"use client";

import { Fragment, useId, useState, type ReactNode } from "react";

import type { PrayerLineKind } from "@/lib/content-shared/prayer-format";
import { resolvePrayerLanguage } from "@/lib/content-shared/prayer-language";
import { tokenizePrayerMentions } from "@/lib/content-shared/prayer-mentions";

import type { GuidePrayerData } from "./GuidePrayers";
import {
  PrayerLanguageChips,
  UnofficialTranslationNote,
  usePrayerLanguage,
} from "./PrayerLanguageChips";
import { PrayerText, type PrayerHeadingLevel } from "./PrayerText";

/**
 * Text with the prayers it names made inline-expandable.
 *
 * Whenever a step, a day, an instruction or a Rosary/chaplet prayer names one of
 * the prayers supplied (e.g. "pray the Our Father", "end with a Glory Be"), that
 * name becomes a link-styled button: pressing it drops the full prayer open right
 * under the text, so it is readily available without scrolling to a list, and a
 * screen reader meets it next. Each opened prayer has the look of a disclosure,
 * its text set as prayer (`PrayerText`) at full size, with the shared Latin /
 * Greek language chips (`PrayerLanguageChips`); Latin and Greek are marked
 * translate="no" so they are never auto-translated. Falls back to plain text when
 * nothing matches, so it is safe to use anywhere.
 *
 * Which spans count as a prayer's name is decided by `tokenizePrayerMentions`.
 * Pass `matchCase` when the text is itself prayer (see that module): it is then
 * set as prayer too, and a named prayer opens under the stanza that names it, so
 * the second "(Hail Mary)" of the Angelus opens under the second versicle. In an
 * instruction the prayers open under the paragraph, in the order they are named.
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
    <div id={id} className="vf-disclosure vf-inline-prayer">
      <div className="vf-inline-prayer-head">
        <Heading className="vf-disclosure-title">{prayer.title}</Heading>
        <PrayerLanguageChips
          options={alternates}
          active={activeCode}
          onSelect={(code) => toggle(code, activeCode)}
          label={`${prayer.title} language`}
        />
      </div>
      <div className="vf-disclosure-body">
        {shown ? (
          <>
            <PrayerText
              text={shown.text}
              // The reader's language when the vernacular holds their translation.
              lang={shown.lang ?? shown.code}
              preserve={shown.preserve}
              headingLevel={(headingLevel + 1) as PrayerHeadingLevel}
            />
            <UnofficialTranslationNote variant={shown} />
          </>
        ) : (
          <p className="vf-fineprint">Text not available.</p>
        )}
      </div>
    </div>
  );
}

/** The link that opens a prayer: a real button, named by the words in the text. */
function PrayerToggle({
  label,
  expanded,
  controls,
  onToggle,
}: {
  label: string;
  expanded: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className="vf-link vf-inline-prayer-toggle"
    >
      {label}
      <svg
        aria-hidden="true"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="vf-inline-prayer-chevron"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

const ONLY_PUNCTUATION = /^[\s\p{P}]+$/u;

interface OpenedPrayer {
  slug: string;
  place: number | null;
}

/**
 * In text that is itself prayer, a spoken line opening with a prayer's name and
 * going on is saying the words, not naming the prayer: "Glory be to Thee, O Lord"
 * and the Our Father given in full. "Glory be to the Father, etc." still points.
 */
function saysTheWords(words: string, kind: PrayerLineKind, next: string | undefined): boolean {
  if (kind !== "spoken" && kind !== "versicle" && kind !== "response") return false;
  return !!next && /^[,;]?\s+\S/.test(next) && !/\betc\.?$/.test(words);
}

export function PrayerLinkedText({
  text,
  prayers,
  matchCase = false,
  headingLevel = 3,
  lang,
  preserve = false,
}: {
  text: string;
  prayers: GuidePrayerData[];
  /** The text is itself prayer: only capitalised names count (see prayer-mentions). */
  matchCase?: boolean;
  /** Heading level of an opened prayer's title: one below the text's own section. */
  headingLevel?: PanelHeadingLevel;
  /** When the text is itself prayer: the language it is written in. */
  lang?: string;
  /** When the text is itself prayer: it must stay verbatim (Latin / Greek). */
  preserve?: boolean;
}) {
  // The prayers opened so far, by panel. `place` tells panels of one prayer apart:
  // the stanza that opened it when the text is itself prayer.
  const [open, setOpen] = useState<ReadonlyMap<string, OpenedPrayer>>(new Map());
  const baseId = useId();
  const panelKey = (slug: string, place: number | null) =>
    place === null ? slug : `${slug}-${place}`;
  const panelId = (key: string) => `${baseId}-prayer-${key}`;

  const toggle = (slug: string, place: number | null) =>
    setOpen((prev) => {
      const next = new Map(prev);
      const key = panelKey(slug, place);
      if (next.has(key)) next.delete(key);
      else next.set(key, { slug, place });
      return next;
    });

  /** A stretch of the text, with the prayers it names as links. */
  const linkedWords = (words: string, place: number | null, kind?: PrayerLineKind): ReactNode => {
    const { segments } = tokenizePrayerMentions(words, prayers, { matchCase });
    return segments.map((segment, i) => {
      const said = i === 0 && kind && saysTheWords(words, kind, segments[1]?.text);
      if (!segment.prayer || said) {
        // A link splits the text it sits in, and a screen reader would stop on what
        // is left of it, so the "(" and ")." around a name are not read on their own.
        return segments.length > 1 && ONLY_PUNCTUATION.test(segment.text) ? (
          <span key={i} aria-hidden="true">
            {segment.text}
          </span>
        ) : (
          <Fragment key={i}>{segment.text}</Fragment>
        );
      }
      const { slug } = segment.prayer;
      const key = panelKey(slug, place);
      return (
        <PrayerToggle
          key={i}
          label={segment.text}
          expanded={open.has(key)}
          controls={panelId(key)}
          onToggle={() => toggle(slug, place)}
        />
      );
    });
  };

  /** Of `list`, in its order, the prayers that are open where `isHere` says. */
  const panels = (
    list: readonly GuidePrayerData[],
    isHere: (opened: OpenedPrayer) => boolean,
  ): ReactNode[] =>
    list.flatMap((prayer) =>
      [...open.values()]
        .filter((opened) => opened.slug === prayer.slug && isHere(opened))
        .map((opened) => {
          const key = panelKey(prayer.slug, opened.place);
          return (
            <InlinePrayerPanel
              key={key}
              prayer={prayer}
              id={panelId(key)}
              headingLevel={headingLevel}
            />
          );
        }),
    );

  if (matchCase) {
    return (
      <PrayerText
        text={text}
        lang={lang}
        preserve={preserve}
        headingLevel={headingLevel}
        renderText={linkedWords}
        // What is open stays open under its stanza, whatever the text says there now.
        // The chips inside an opened prayer switch the text around it, and a prayer
        // that vanished then would take the reader's place and keyboard focus with it.
        afterStanza={(stanza, isLast) =>
          panels(
            prayers,
            ({ place }) => place !== null && (place === stanza || (isLast && place > stanza)),
          )
        }
      />
    );
  }

  const named = tokenizePrayerMentions(text, prayers, { matchCase }).matched;
  if (named.length === 0) {
    return <p className="whitespace-pre-line">{text}</p>;
  }
  return (
    <>
      <p className="whitespace-pre-line">{linkedWords(text, null)}</p>
      {panels(named, () => true)}
    </>
  );
}
