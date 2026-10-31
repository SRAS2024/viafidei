/**
 * The production engine: pinned OPUS-MT models (models.ts), downloaded and
 * verified on first use (hub.ts), run with onnxruntime-node on the CPU by the
 * TypeScript Marian implementation (marian.ts).
 *
 * Only the translator process (scripts/translate-content.ts) builds one. The
 * web server never imports this module, so the runtime and the models are
 * never part of the Next.js bundle or the Railway image.
 */

import path from "node:path";

import { MarianEngine } from "./engine";
import { ensureModelFiles, pruneModels, type Log } from "./hub";
import { MarianModel } from "./marian";
import type { ModelCandidate } from "./models";
import { loadOrt } from "./ort";

export interface RuntimeOptions {
  repoRoot?: string;
  log?: Log;
}

function envInt(name: string, fallback: number, min: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

/** Where models are kept (TRANSLATION_MODEL_DIR, default .cache/translation-models). */
export function translationModelDir(repoRoot = process.cwd()): string {
  return process.env.TRANSLATION_MODEL_DIR || path.join(repoRoot, ".cache", "translation-models");
}

/** CPU threads per model (TRANSLATION_THREADS, default 4) and beam size (TRANSLATION_BEAMS, default 4). */
export function runtimeSettings(): { threads: number; beams: number } {
  return {
    threads: envInt("TRANSLATION_THREADS", 4, 1),
    beams: envInt("TRANSLATION_BEAMS", 4, 1),
  };
}

export async function createMarianEngine(opts: RuntimeOptions = {}): Promise<MarianEngine> {
  const repoRoot = opts.repoRoot ?? process.cwd();
  // The translator is a command-line process: its progress goes to stdout.
  // eslint-disable-next-line no-console
  const log = opts.log ?? console.log;
  const ort = await loadOrt(repoRoot);
  const modelDir = translationModelDir(repoRoot);
  const { threads, beams } = runtimeSettings();

  const ensureFiles = async (candidate: ModelCandidate): Promise<string> => {
    try {
      return await ensureModelFiles(candidate, modelDir, { log });
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "ENOSPC") throw err;
      log("[translation] disk full; removing other downloaded models and retrying");
      await pruneModels(modelDir, [candidate]);
      return ensureModelFiles(candidate, modelDir, { log });
    }
  };

  return new MarianEngine({
    ensureFiles,
    loadModel: (dir, candidate) =>
      MarianModel.load(dir, { ort, threads, targetToken: candidate.targetToken }),
    beams,
    log,
  });
}
