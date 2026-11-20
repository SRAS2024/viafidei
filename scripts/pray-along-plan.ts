#!/usr/bin/env tsx
/**
 * Files every pray-along clip the site will need, so the voice engine (voice-engine/)
 * makes them before anyone presses a megaphone. A listener's press is still served
 * first: these rows are filed with no request time, behind any visitor's.
 *
 * Order (lower priority first): the Sign of the Cross and the Rosary's prayers in each
 * language, the four Rosaries, every prayer in the site's display order, the novena
 * days, then the guides; English first, then Latin and Greek, then the reader
 * languages a page has been translated into; the female voice (every visitor's, unless
 * a member chose the male) in all of them before the male voice.
 *
 * It never changes a clip that exists: rows are inserted with ON CONFLICT DO NOTHING.
 * It reads the translations the pages have now and asks the translator for nothing more
 * (a page's own visitors do that); the engine plans again once a day when it has nothing
 * to make, so new prayers and new translations follow.
 *
 * Usage:
 *   npm run voice:plan                         # everything, both voices
 *   npm run voice:plan -- --dry-run            # count only
 *   npm run voice:plan -- --langs=en,la --voices=female --kinds=prayers,rosary
 *
 * Environment: DATABASE_URL (the production database only through
 * scripts/voice/launch.sh, which reads Railway's public URL in memory).
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/db/client";
import { BUILDING_BLOCK_PRAYERS } from "../src/lib/content-shared/prayer-mentions";
import type { MysterySetKey } from "../src/lib/content-shared/rosary";
import { sortPrayersForDisplay } from "../src/lib/content-shared/display-order";
import type { Locale } from "../src/lib/i18n/locales";
import { AUDIO_LANGS, type AudioLang } from "../src/lib/pray-along/languages";
import { SIGN_OF_THE_CROSS } from "../src/lib/pray-along/sign-of-the-cross";
import { normalizeForSpeech } from "../src/lib/pray-along/speech-text";
import type { PrayAlongScript } from "../src/lib/pray-along/script";
import {
  scriptForGuide,
  scriptForNovenaDay,
  scriptForPrayer,
  scriptForRosary,
} from "../src/lib/pray-along/server";
import type { NeededClip } from "../src/lib/pray-along/store";
import { stopFilingDemand } from "../src/lib/translation/store";
import { VOICES, type Voice } from "../src/lib/pray-along/voice-choice";
import { clipKey, voiceIdFor } from "../src/lib/pray-along/voices";

type Kind = "blocks" | "rosary" | "prayers" | "novenas" | "guides";
const KINDS: Kind[] = ["blocks", "rosary", "prayers", "novenas", "guides"];
const SETS: MysterySetKey[] = ["joyful", "sorrowful", "glorious", "luminous"];
/** Reader languages the content translator writes into (the rest stay English). */
const READER_LANGS: AudioLang[] = ["es", "fr", "it", "de", "pt", "pl", "tl", "vi", "zh"];

interface Args {
  langs: AudioLang[];
  voices: Voice[];
  kinds: Kind[];
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { langs: [...AUDIO_LANGS], voices: [...VOICES], kinds: KINDS, dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--langs=")) {
      args.langs = arg
        .slice(8)
        .split(",")
        .filter((l): l is AudioLang => (AUDIO_LANGS as readonly string[]).includes(l));
    } else if (arg.startsWith("--voices=")) {
      args.voices = arg
        .slice(9)
        .split(",")
        .filter((v): v is Voice => (VOICES as readonly string[]).includes(v));
    } else if (arg.startsWith("--kinds=")) {
      args.kinds = arg
        .slice(8)
        .split(",")
        .filter((k): k is Kind => (KINDS as readonly string[]).includes(k as Kind));
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/** Lower first; each language after English is pushed back by a band. */
function band(lang: AudioLang): number {
  if (lang === "en") return 0;
  if (lang === "la" || lang === "el") return 100_000;
  return 200_000;
}

/**
 * Every language's female voice before any male voice: it is the voice every visitor
 * hears unless a signed-in member chose the male one, and a member's press is made
 * first whatever its voice.
 */
function voiceBand(voice: Voice): number {
  return voice === "female" ? 0 : 1_000_000;
}

/** How a language is asked for: the reader's locale and their Latin / Greek choice. */
function request(lang: AudioLang): { locale: Locale; chosen: string | null } {
  if (lang === "la") return { locale: "la", chosen: "la" };
  if (lang === "el") return { locale: "en", chosen: "el" };
  return { locale: lang as Locale, chosen: null };
}

/** True when the script is really in `lang` (a page not yet translated is English). */
function isIn(script: PrayAlongScript, lang: AudioLang): boolean {
  return (
    script.items.some((i) => i.kind === "say" && i.lang === lang && lang !== "en") || lang === "en"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  stopFilingDemand();
  const wanted = new Map<string, NeededClip & { priority: number }>();
  const add = (script: PrayAlongScript | null | undefined, voice: Voice, priority: number) => {
    if (!script) return;
    script.items.forEach((item, i) => {
      if (item.kind !== "say") return;
      const key = clipKey(item.text, item.lang, voice, item.take ?? 0);
      const existing = wanted.get(key);
      const p = priority + Math.min(i, 999) / 1000;
      if (existing) {
        existing.priority = Math.min(existing.priority, p);
        return;
      }
      wanted.set(key, {
        key,
        lang: item.lang,
        voice,
        voiceId: voiceIdFor(item.lang, voice),
        text: item.text,
        priority: p,
      });
    });
  };

  const prayers = sortPrayersForDisplay(
    await prisma.publishedContent.findMany({
      where: { contentType: "PRAYER", isPublished: true },
      select: { slug: true, title: true, payload: true, subtitle: true, contentType: true },
    }),
  );
  const novenas = await prisma.publishedContent.findMany({
    where: { contentType: "NOVENA", isPublished: true },
    select: { slug: true, payload: true },
    orderBy: { slug: "asc" },
  });
  const guides = await prisma.publishedContent.findMany({
    where: { contentType: "GUIDE", isPublished: true },
    select: { slug: true },
    orderBy: { slug: "asc" },
  });

  for (const lang of args.langs) {
    const { locale, chosen } = request(lang);
    const pageLang: AudioLang = lang === "el" ? "en" : lang;
    for (const voice of args.voices) {
      const b = band(lang) + voiceBand(voice);
      if (args.kinds.includes("blocks")) {
        const sign = normalizeForSpeech(SIGN_OF_THE_CROSS[lang], lang);
        add({ lang, items: [{ kind: "say", text: sign, lang }] }, voice, b);
        for (const [i, slug] of BUILDING_BLOCK_PRAYERS.entries()) {
          const built = await scriptForPrayer(slug, chosen, pageLang, locale).catch(() => null);
          if (built && isIn(built.script, lang)) add(built.script, voice, b + 1 + i);
        }
      }
      if (
        args.kinds.includes("rosary") &&
        (lang === "en" || lang === "la" || READER_LANGS.includes(lang))
      ) {
        for (const [i, set] of SETS.entries()) {
          const built = await scriptForRosary(set, chosen, pageLang, locale).catch(() => null);
          if (built && isIn(built.script, lang)) add(built.script, voice, b + 100 + i);
        }
      }
      if (args.kinds.includes("prayers")) {
        for (const [i, p] of prayers.entries()) {
          const built = await scriptForPrayer(p.slug, chosen, pageLang, locale).catch(() => null);
          if (built && isIn(built.script, lang)) add(built.script, voice, b + 1_000 + i);
        }
      }
      if (args.kinds.includes("novenas") && (lang === "en" || READER_LANGS.includes(lang))) {
        for (const [n, novena] of novenas.entries()) {
          const days = Array.isArray(
            novena.payload && (novena.payload as Record<string, unknown>).days,
          )
            ? ((novena.payload as Record<string, unknown>).days as unknown[])
            : [];
          for (let d = 0; d < days.length; d++) {
            const built = await scriptForNovenaDay(novena.slug, d, chosen, pageLang, locale).catch(
              () => null,
            );
            if (built && isIn(built.script, lang))
              add(built.script, voice, b + 10_000 + n * 20 + d);
          }
        }
      }
      if (args.kinds.includes("guides") && (lang === "en" || READER_LANGS.includes(lang))) {
        for (const [i, g] of guides.entries()) {
          const built = await scriptForGuide(g.slug, chosen, pageLang, "joyful", locale).catch(
            () => null,
          );
          if (built && isIn(built.script, lang)) add(built.script, voice, b + 50_000 + i);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[voice:plan] ${lang}: ${wanted.size} clips so far`);
  }

  const rows = [...wanted.values()].sort((a, b) => a.priority - b.priority);
  const chars = rows.reduce((n, r) => n + r.text.length, 0);
  // eslint-disable-next-line no-console
  console.log(`[voice:plan] ${rows.length} distinct clips, ${chars} characters`);
  if (args.dryRun) return;

  let inserted = 0;
  const now = new Date();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map(
      (c, j) =>
        Prisma.sql`(${`pac_${c.key}`}, ${c.key}, ${c.lang}, ${c.voice}, ${c.voiceId}, ${c.text}, 'pending', ${1000 + i + j}, ${now}, ${now})`,
    );
    inserted += await prisma.$executeRaw`
      INSERT INTO "PrayerAudioClip"
        ("id", "key", "lang", "voice", "voiceId", "text", "status", "priority", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("key") DO NOTHING`;
  }
  // eslint-disable-next-line no-console
  console.log(`[voice:plan] filed ${inserted} new clips (the rest already existed)`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[voice:plan] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
