#!/usr/bin/env tsx
/**
 * The content translator (src/lib/translation/translator.ts) as a long-running
 * process for the Mac worker host — the web server on Railway only reads the
 * translations it stores.
 *
 * Each pass first serves visitor demand (units a page needed and did not
 * find), then pre-translates whatever published content is not cached yet,
 * yielding to new demand between small batches. Models are downloaded from
 * Hugging Face at pinned revisions on first use and verified (about 0.3–0.6 GB
 * per language pair; see src/lib/translation/engine/models.ts).
 *
 * Setup once on the host: `npm run translate:setup` (installs onnxruntime-node
 * under .cache/translation-runtime, outside the app's node_modules).
 *
 * Usage:
 *   npm run translate                       # run forever
 *   npm run translate -- --once             # one pass, then exit
 *   npm run translate -- --demand-only      # visitors' requests only
 *   npm run translate -- --langs=es,fr      # pre-translate these languages
 *   npm run translate -- --budget=500       # at most 500 units per pass
 *   npm run translate -- --status           # print cache counts and exit
 *
 * Environment: DATABASE_URL (required), TRANSLATION_MODEL_DIR,
 * TRANSLATION_THREADS (default 4), TRANSLATION_BEAMS (default 4),
 * TRANSLATION_DISABLED=1 (exit at once).
 */

import os from "node:os";
import path from "node:path";

import { prisma } from "../src/lib/db/client";
import { createMarianEngine } from "../src/lib/translation/engine/runtime";
import { isMtLocale, type MtLocale } from "../src/lib/translation/languages";
import { translationCounts, translationDisabled } from "../src/lib/translation/store";
import { runTranslatorPass } from "../src/lib/translation/translator";

const REPO_ROOT = path.resolve(__dirname, "..");
const IDLE_SLEEP_MS = 60_000;
const BUSY_SLEEP_MS = 2_000;

interface Args {
  once: boolean;
  demandOnly: boolean;
  status: boolean;
  langs?: MtLocale[];
  budget?: number;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { once: false, demandOnly: false, status: false };
  for (const arg of argv) {
    if (arg === "--once") args.once = true;
    else if (arg === "--demand-only") args.demandOnly = true;
    else if (arg === "--status") args.status = true;
    else if (arg.startsWith("--langs=")) {
      const langs = arg
        .slice("--langs=".length)
        .split(",")
        .map((l) => l.trim());
      const bad = langs.filter((l) => !isMtLocale(l));
      if (bad.length) throw new Error(`Unknown language(s): ${bad.join(", ")}`);
      args.langs = langs as MtLocale[];
    } else if (arg.startsWith("--budget=")) {
      const n = Number(arg.slice("--budget=".length));
      if (!Number.isInteger(n) || n < 1) throw new Error(`--budget must be a positive integer`);
      args.budget = n;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sleep in short steps so a stop signal is honoured within a second. */
async function nap(ms: number, stopped: () => boolean): Promise<void> {
  const end = Date.now() + ms;
  while (!stopped() && Date.now() < end) await sleep(Math.min(1_000, end - Date.now()));
}

async function printStatus(): Promise<void> {
  const rows = await translationCounts(prisma);
  if (!rows.length) {
    console.log("[translation] the cache is empty");
    return;
  }
  for (const r of rows)
    console.log(`[translation] ${r.lang.padEnd(3)} ${r.status.padEnd(12)} ${r.count}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (translationDisabled()) {
    console.log("[translation] TRANSLATION_DISABLED is set; nothing to do");
    return;
  }
  if (args.status) {
    await printStatus();
    return;
  }

  let stopping = false;
  const stop = () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log("[translation] stopping after the current batch (signal again to force)");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const engine = await createMarianEngine({ repoRoot: REPO_ROOT });
  const deps = {
    db: prisma,
    engine,
    claimant: `translator@${os.hostname()}`,
    log: (...parts: unknown[]) => console.log(...parts),
  };
  try {
    while (!stopping) {
      const started = Date.now();
      let idle = true;
      try {
        const { demand, pretranslation } = await runTranslatorPass(deps, {
          demandOnly: args.demandOnly,
          langs: args.langs,
          maxUnits: args.budget ?? 400,
        });
        const p = pretranslation;
        idle = demand === 0 && (!p || p.translated + p.untranslated === 0);
        if (!idle || args.once) {
          console.log(
            `[translation] pass: ${demand} demand, ` +
              (p
                ? `${p.translated} translated, ${p.untranslated} kept as written, ${p.remaining} remaining`
                : "pre-translation skipped") +
              ` (${Math.round((Date.now() - started) / 1000)} s)`,
          );
        }
      } catch (err) {
        console.error("[translation] pass failed:", (err as Error).message);
      }
      if (args.once) break;
      await nap(idle ? IDLE_SLEEP_MS : BUSY_SLEEP_MS, () => stopping);
    }
  } finally {
    await engine.release();
  }
}

main()
  .catch((err) => {
    console.error("[translation]", (err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
