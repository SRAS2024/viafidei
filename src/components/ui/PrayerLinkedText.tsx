"use client";

import { Fragment, useMemo, useState } from "react";

import type { PrayerVariant } from "@/lib/content-shared/prayer-language";
import type { GuidePrayerData } from "./GuidePrayers";

/**
 * Step text with its prayers made inline-expandable.
 *
 * Whenever a guide/novena step names a prayer the guide actually uses (e.g. "pray
 * the Our Father", "end with a Glory Be"), that name becomes a button: clicking it
 * drops the full prayer open right under the step, so the text is readily available
 * without scrolling to the bottom list. Each opened prayer carries its own
 * English / Latin / Greek toggle; Latin and Greek are marked translate="no" so
 * they are never auto-translated. Falls back to plain text when nothing matches —
 * so it is safe to use anywhere (other content types pass no prayers and render
 * exactly as before).
 */

const LANG_ORDER = ["en", "la", "el"];

/**
 * Alternate names a prayer is referred to by inside step prose, keyed by slug.
 * The prayer's own title (and any parenthetical in it, e.g. "(Salve Regina)") is
 * always matched too; these only add the forms a title can't yield — Latin
 * incipits, traditional English names, and the abbreviations guides use.
 */
const PRAYER_ALIASES: Record<string, string[]> = {
  "apostles-creed": ["Apostle's Creed"],
  "our-father": ["Lord's Prayer", "Pater Noster"],
  "hail-mary": ["Ave Maria"],
  "glory-be": ["Gloria Patri", "Doxology"],
  "salve-regina": ["Salve Regina"],
  "prayer-to-saint-michael": ["Prayer to Saint Michael", "St. Michael Prayer"],
  "veni-creator-spiritus": ["Veni Creator"],
};

/** Fold the various apostrophes to a straight one so matching is robust. */
function foldApostrophes(s: string): string {
  return s.replace(/[‘’ʼ]/g, "'");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names a prayer may be referred to by — its title (cleaned) plus aliases. */
function candidateNames(p: GuidePrayerData): string[] {
  const names = new Set<string>();
  const title = p.title.trim();
  // The bare title, only when it has no parenthetical (those are split out below).
  if (!/[()]/.test(title)) names.add(title);
  const noParen = title
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (noParen) names.add(noParen);
  for (const m of title.matchAll(/\(([^)]+)\)/g)) {
    const inner = m[1].trim();
    if (inner) names.add(inner);
  }
  for (const a of PRAYER_ALIASES[p.slug] ?? []) names.add(a);
  return [...names].filter((n) => n.length >= 3 && !/[()]/.test(n));
}

interface Segment {
  text: string;
  prayer?: GuidePrayerData;
}

function tokenize(
  text: string,
  prayers: GuidePrayerData[],
): { segments: Segment[]; matched: GuidePrayerData[] } {
  const nameMap = new Map<string, GuidePrayerData>();
  for (const p of prayers) {
    for (const n of candidateNames(p)) {
      const key = foldApostrophes(n).toLowerCase();
      if (!nameMap.has(key)) nameMap.set(key, p);
    }
  }
  const names = [...nameMap.keys()].sort((a, b) => b.length - a.length);
  if (names.length === 0) return { segments: [{ text }], matched: [] };

  // Longest names first so "Hail Holy Queen" wins over a shorter overlap; the
  // optional trailing "s" lets "Hail Marys" match the "Hail Mary" entry.
  const pattern = new RegExp(`\\b(${names.map(escapeRegExp).join("|")})(s)?\\b`, "gi");
  const folded = foldApostrophes(text); // 1:1 length-preserving → indices align

  const segments: Segment[] = [];
  const matched = new Map<string, GuidePrayerData>();
  let last = 0;
  for (const m of folded.matchAll(pattern)) {
    const idx = m.index ?? 0;
    const whole = m[0];
    const base = foldApostrophes(whole).toLowerCase();
    const prayer =
      nameMap.get(base) ??
      nameMap.get(base.replace(/s$/, "")) ??
      nameMap.get(base.replace(/es$/, ""));
    if (idx > last) segments.push({ text: text.slice(last, idx) });
    if (prayer) {
      segments.push({ text: text.slice(idx, idx + whole.length), prayer });
      matched.set(prayer.slug, prayer);
    } else {
      segments.push({ text: text.slice(idx, idx + whole.length) });
    }
    last = idx + whole.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return { segments, matched: [...matched.values()] };
}

function InlinePrayerPanel({ prayer }: { prayer: GuidePrayerData }) {
  const languages = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of prayer.variants) if (!seen.has(v.code)) seen.set(v.code, v.label);
    return [...seen.entries()]
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => {
        const ai = LANG_ORDER.indexOf(a.code);
        const bi = LANG_ORDER.indexOf(b.code);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      });
  }, [prayer.variants]);

  const [lang, setLang] = useState(languages[0]?.code ?? "en");
  const v: PrayerVariant | null =
    prayer.variants.find((x) => x.code === lang) ?? prayer.variants[0] ?? null;

  return (
    <div
      id={`prayer-panel-${prayer.slug}`}
      className="rounded-sm border border-ink/10 bg-paper-bright/60 p-4 shadow-paper"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base text-ink">{prayer.title}</h3>
        {languages.length > 1 ? (
          <div
            role="group"
            aria-label={`${prayer.title} language`}
            className="flex flex-wrap gap-1"
          >
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                aria-pressed={lang === l.code}
                onClick={() => setLang(l.code)}
                className={`vf-btn !px-2 !py-0.5 text-[11px] ${
                  lang === l.code ? "vf-btn-primary" : "vf-btn-ghost"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {v ? (
        <p
          className="mt-2 whitespace-pre-line font-serif text-sm leading-relaxed text-ink-soft"
          translate={v.preserve ? "no" : undefined}
          lang={v.code}
        >
          {v.text}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">Text not available.</p>
      )}
    </div>
  );
}

export function PrayerLinkedText({ text, prayers }: { text: string; prayers: GuidePrayerData[] }) {
  const { segments, matched } = useMemo(() => tokenize(text, prayers), [text, prayers]);
  const [open, setOpen] = useState<Set<string>>(new Set());

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

  // Panels in the order the prayers first appear in the step, only those open.
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
              aria-controls={`prayer-panel-${seg.prayer.slug}`}
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
            <InlinePrayerPanel key={p.slug} prayer={p} />
          ))}
        </div>
      ) : null}
    </>
  );
}
