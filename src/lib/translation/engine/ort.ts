/**
 * onnxruntime-node, loaded on demand.
 *
 * The runtime is NOT a dependency of the web app — the web server never runs
 * a model — so nothing here is imported by a page and the package is never
 * traced into the Next.js standalone bundle. The translator host installs it
 * once (`npm run translate:setup`, which puts it under .cache/, outside the
 * app's own node_modules so `npm ci` never prunes it); a normal install in
 * node_modules works too.
 *
 * Only the small surface the engine uses is typed here.
 */

import { createRequire } from "node:module";
import path from "node:path";

export interface OrtTensor {
  readonly data: Float32Array;
  readonly dims: readonly number[];
}

export interface OrtSession {
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  release?(): Promise<void>;
}

export interface OrtSessionOptions {
  executionProviders: string[];
  graphOptimizationLevel: "disabled" | "basic" | "extended" | "all";
  intraOpNumThreads: number;
  interOpNumThreads: number;
  enableCpuMemArena: boolean;
}

export interface OrtModule {
  InferenceSession: { create(file: string, options: OrtSessionOptions): Promise<OrtSession> };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => OrtTensor;
}

/** The exact runtime version the engine was ported against (The Augustine Journal runs 1.29). */
export const ORT_VERSION = "1.29.0";

/** Where `npm run translate:setup` installs the runtime. */
export function translationRuntimeDir(repoRoot = process.cwd()): string {
  return (
    process.env.TRANSLATION_RUNTIME_DIR || path.join(repoRoot, ".cache", "translation-runtime")
  );
}

/**
 * Load onnxruntime-node, or throw an error that says how to install it. The
 * module name is built at runtime so no bundler ever tries to resolve it.
 */
export async function loadOrt(repoRoot = process.cwd()): Promise<OrtModule> {
  const name = ["onnxruntime", "node"].join("-");
  const candidates = [
    path.join(translationRuntimeDir(repoRoot), "package.json"),
    path.join(repoRoot, "package.json"),
  ];
  const errors: string[] = [];
  for (const anchor of candidates) {
    try {
      const mod = createRequire(anchor)(name) as OrtModule & { default?: OrtModule };
      return mod.InferenceSession ? mod : (mod.default as OrtModule);
    } catch (err) {
      errors.push((err as Error).message.split("\n")[0]!);
    }
  }
  throw new Error(
    `onnxruntime-node is not installed (${errors.join("; ")}). ` +
      `Run \`npm run translate:setup\` on the translator host.`,
  );
}
