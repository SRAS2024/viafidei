/**
 * The translation engine: OPUS-MT models per language pair, loaded one at a
 * time on demand, with The Augustine Journal's recovery ladder for bad output
 * (src/lib/translation/worker.js there):
 *
 *   beam search → greedy decoding → the pair's fallback model → null
 *
 * A sentence the caller does not accept at any rung comes back as null and
 * keeps its English. The engine runs inside the translator process
 * (scripts/translate-content.ts), never inside the web server.
 */

import { candidatesFor, modelKey, type LanguagePair, type ModelCandidate } from "./models";
import type { Log } from "./hub";

/** What the engine needs from a loaded model (MarianModel, or a stub in tests). */
export interface LoadedModel {
  translate(texts: readonly string[], opts?: { beams?: number }): Promise<string[]>;
  release(): Promise<void>;
}

export interface EngineResult {
  /** One per input: the accepted translation, or null. */
  outputs: Array<string | null>;
  /** modelKey of the model that produced each accepted output (null for a null output). */
  models: Array<string | null>;
}

export interface TranslateCall {
  /** Is this output acceptable for input `index`? Defaults to "not empty". */
  accept?: (index: number, output: string) => boolean;
}

export interface TranslationEngine {
  /** Translate `texts` for one pair. Rejects only when no model for the pair can run at all. */
  translate(
    pair: LanguagePair,
    texts: readonly string[],
    call?: TranslateCall,
  ): Promise<EngineResult>;
  /** Pairs this engine has models for. */
  supports(pair: LanguagePair): boolean;
  release(): Promise<void>;
}

export interface MarianEngineOptions {
  /** Download and verify a candidate's files; returns their directory. */
  ensureFiles: (candidate: ModelCandidate) => Promise<string>;
  /** Load a model from a directory (MarianModel.load with onnxruntime in production). */
  loadModel: (dir: string, candidate: ModelCandidate) => Promise<LoadedModel>;
  beams?: number;
  log?: Log;
  /** Override the manifest (tests). */
  candidates?: (pair: LanguagePair) => ModelCandidate[];
}

export class MarianEngine implements TranslationEngine {
  private loaded: { pair: LanguagePair; key: string; model: LoadedModel } | null = null;
  private readonly beams: number;
  private readonly log: Log;
  private readonly candidates: (pair: LanguagePair) => ModelCandidate[];
  /** Candidates that failed to download or load in this process (not retried until restart). */
  private readonly unusable = new Set<string>();

  constructor(private readonly opts: MarianEngineOptions) {
    this.beams = Math.max(1, opts.beams ?? 4);
    this.log = opts.log ?? (() => {});
    this.candidates = opts.candidates ?? candidatesFor;
  }

  supports(pair: LanguagePair): boolean {
    return this.candidates(pair).length > 0;
  }

  private async open(candidate: ModelCandidate): Promise<LoadedModel> {
    const started = Date.now();
    const dir = await this.opts.ensureFiles(candidate);
    const model = await this.opts.loadModel(dir, candidate);
    this.log(`[translation] loaded ${modelKey(candidate)} in ${Date.now() - started} ms`);
    return model;
  }

  /** The pair's first usable model, loaded (and the previous pair's released). */
  private async primary(pair: LanguagePair): Promise<{ key: string; model: LoadedModel }> {
    if (this.loaded?.pair === pair) return this.loaded;
    await this.releaseLoaded();
    const errors: string[] = [];
    for (const candidate of this.candidates(pair)) {
      const key = modelKey(candidate);
      if (this.unusable.has(key)) continue;
      try {
        const model = await this.open(candidate);
        this.loaded = { pair, key, model };
        return this.loaded;
      } catch (err) {
        this.unusable.add(key);
        errors.push(`${key}: ${(err as Error).message}`);
        this.log(`[translation] cannot use ${key} for ${pair}: ${(err as Error).message}`);
      }
    }
    throw new Error(
      `No translation model could be loaded for ${pair}` +
        (errors.length ? ` (${errors.join("; ")})` : ""),
    );
  }

  private async releaseLoaded(): Promise<void> {
    const current = this.loaded;
    this.loaded = null;
    await current?.model.release().catch(() => {});
  }

  async translate(
    pair: LanguagePair,
    texts: readonly string[],
    call: TranslateCall = {},
  ): Promise<EngineResult> {
    const accept = call.accept ?? ((_: number, out: string) => out.trim().length > 0);
    const outputs: Array<string | null> = texts.map(() => null);
    const models: Array<string | null> = texts.map(() => null);
    if (texts.length === 0) return { outputs, models };

    const { key, model } = await this.primary(pair);
    const first = await model.translate(texts, { beams: this.beams });
    let open: number[] = [];
    first.forEach((out, i) => {
      if (accept(i, out)) {
        outputs[i] = out;
        models[i] = key;
      } else open.push(i);
    });

    // Beam search very rarely loops or embellishes; greedy decoding often does not.
    if (open.length && this.beams > 1) {
      const retried = await model.translate(
        open.map((i) => texts[i]!),
        { beams: 1 },
      );
      open = open.filter((index, j) => {
        if (!accept(index, retried[j]!)) return true;
        outputs[index] = retried[j]!;
        models[index] = key;
        return false;
      });
    }

    // Then the pair's other model, loaded only for these sentences.
    if (open.length) {
      for (const candidate of this.candidates(pair)) {
        const altKey = modelKey(candidate);
        if (altKey === key || this.unusable.has(altKey) || !open.length) continue;
        let alt: LoadedModel | null = null;
        try {
          alt = await this.open(candidate);
          const res = await alt.translate(
            open.map((i) => texts[i]!),
            { beams: this.beams },
          );
          open = open.filter((index, j) => {
            if (!accept(index, res[j]!)) return true;
            outputs[index] = res[j]!;
            models[index] = altKey;
            return false;
          });
        } catch (err) {
          this.unusable.add(altKey);
          this.log(
            `[translation] fallback ${altKey} for ${pair} unavailable: ${(err as Error).message}`,
          );
        } finally {
          await alt?.release().catch(() => {});
        }
      }
    }
    return { outputs, models };
  }

  async release(): Promise<void> {
    await this.releaseLoaded();
  }
}
