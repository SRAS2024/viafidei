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
 * Each row is stored with that place as a whole number, the same in every run, so the
 * engine keeps this order however the rows arrive: a language is filed as soon as it is
 * planned (English first, so the engine starts at once while the rest are read), and a
 * later run's new rows fall into their places.
 *
 * It never changes a clip that exists: rows are inserted with ON CONFLICT DO NOTHING.
 * It reads the translations the pages have now and asks the translator for nothing more
 * (a page's own visitors do that); the engine plans again once a day when it has nothing
 * to make, so new prayers and new translations follow. Each language's scripts are
 * built once for both voices, several at a time: the database is a network away.
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
import {
  KIND_OFFSET,
  languageBand,
  plannedPlace,
  storedPriority,
} from "../src/lib/pray-along/plan-order";
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
import { setBatchTranslationMode } from "../src/lib/translation/store";
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

/** How many scripts are built at once (each is a few round trips to the database). */
const CONCURRENCY = 8;

/** Runs `jobs` with at most `limit` in flight. */
async function inParallel(jobs: ReadonlyArray<() => Promise<void>>, limit: number) {
  let next = 0;
  const lane = async () => {
    while (next < jobs.length) await jobs[next++]!();
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, lane));
}

type Planned = NeededClip & { priority: number };

async function fileRows(rows: readonly Planned[]): Promise<number> {
  let inserted = 0;
  const now = new Date();
  for (let i = 0; i < rows.length; i += 500) {
    const values = rows
      .slice(i, i + 500)
      .map(
        (c) =>
          Prisma.sql`(${`pac_${c.key}`}, ${c.key}, ${c.lang}, ${c.voice}, ${c.voiceId}, ${c.text}, 'pending', ${storedPriority(c.priority)}, ${now}, ${now})`,
      );
    inserted += await prisma.$executeRaw`
      INSERT INTO "PrayerAudioClip"
        ("id", "key", "lang", "voice", "voiceId", "text", "status", "priority", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("key") DO NOTHING`;
  }
  return inserted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  setBatchTranslationMode();

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

  // English, then Latin and Greek, then the reader languages: a line two languages
  // share keeps the earlier (lower) place.
  const langs = [...args.langs].sort((a, b) => languageBand(a) - languageBand(b));
  const seen = new Set<string>();
  let total = 0;
  let chars = 0;
  let filed = 0;
  for (const lang of langs) {
    const { locale, chosen } = request(lang);
    const pageLang: AudioLang = lang === "el" ? "en" : lang;
    const b = languageBand(lang);
    const wanted = new Map<string, Planned>();
    /** A script in this language, for every voice asked for, at its place in the plan. */
    const add = (script: PrayAlongScript | null | undefined, priority: number) => {
      if (!script || !isIn(script, lang)) return;
      for (const voice of args.voices) {
        script.items.forEach((item, i) => {
          if (item.kind !== "say") return;
          const key = clipKey(item.text, item.lang, voice, item.take ?? 0);
          if (seen.has(key)) return;
          const p = plannedPlace(priority, voice, i);
          const existing = wanted.get(key);
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
      }
    };

    const jobs: Array<() => Promise<void>> = [];
    if (args.kinds.includes("blocks")) {
      const sign = normalizeForSpeech(SIGN_OF_THE_CROSS[lang], lang);
      add({ lang, items: [{ kind: "say", text: sign, lang }] }, b + KIND_OFFSET.blocks);
      BUILDING_BLOCK_PRAYERS.forEach((slug, i) =>
        jobs.push(async () => {
          const built = await scriptForPrayer(slug, chosen, pageLang, locale).catch(() => null);
          add(built?.script, b + KIND_OFFSET.blocks + 1 + i);
        }),
      );
    }
    if (
      args.kinds.includes("rosary") &&
      (lang === "en" || lang === "la" || READER_LANGS.includes(lang))
    ) {
      SETS.forEach((set, i) =>
        jobs.push(async () => {
          const built = await scriptForRosary(set, chosen, pageLang, locale).catch(() => null);
          add(built?.script, b + KIND_OFFSET.rosary + i);
        }),
      );
    }
    if (args.kinds.includes("prayers")) {
      prayers.forEach((p, i) =>
        jobs.push(async () => {
          const built = await scriptForPrayer(p.slug, chosen, pageLang, locale).catch(() => null);
          add(built?.script, b + KIND_OFFSET.prayers + i);
        }),
      );
    }
    if (args.kinds.includes("novenas") && (lang === "en" || READER_LANGS.includes(lang))) {
      novenas.forEach((novena, n) => {
        const payload = novena.payload as Record<string, unknown> | null;
        const days = Array.isArray(payload?.days) ? (payload.days as unknown[]) : [];
        for (let d = 0; d < days.length; d++) {
          jobs.push(async () => {
            const built = await scriptForNovenaDay(novena.slug, d, chosen, pageLang, locale).catch(
              () => null,
            );
            add(built?.script, b + KIND_OFFSET.novenas + n * 20 + d);
          });
        }
      });
    }
    if (args.kinds.includes("guides") && (lang === "en" || READER_LANGS.includes(lang))) {
      guides.forEach((g, i) =>
        jobs.push(async () => {
          const built = await scriptForGuide(g.slug, chosen, pageLang, "joyful", locale).catch(
            () => null,
          );
          add(built?.script, b + KIND_OFFSET.guides + i);
        }),
      );
    }
    await inParallel(jobs, CONCURRENCY);

    const rows = [...wanted.values()].sort((x, y) => x.priority - y.priority);
    for (const row of rows) seen.add(row.key);
    total += rows.length;
    chars += rows.reduce((n, r) => n + r.text.length, 0);
    const inserted = args.dryRun ? 0 : await fileRows(rows);
    filed += inserted;
    // eslint-disable-next-line no-console
    console.log(
      `[voice:plan] ${lang}: ${rows.length} clips${args.dryRun ? "" : `, ${inserted} new`}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `[voice:plan] ${total} distinct clips, ${chars} characters` +
      (args.dryRun ? "" : `; filed ${filed} new (the rest already existed)`),
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[voice:plan] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
