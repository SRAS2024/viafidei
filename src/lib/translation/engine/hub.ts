/**
 * Downloads model files from Hugging Face at a pinned revision and verifies
 * every one before use — the SHA-256 of large (LFS) files, the git blob SHA-1
 * of small ones — so a model can never change underneath the site and a
 * corrupted or truncated download is never loaded.
 *
 * Ported from The Augustine Journal (src/lib/translation/hub.js).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { ModelCandidate, ModelFile } from "./models";

const HUB = "https://huggingface.co";

export type Log = (...args: unknown[]) => void;

/** One directory per candidate: "Helsinki-NLP--opus-mt-en-es@fdaddf76f50f". */
export function modelDirName(candidate: Pick<ModelCandidate, "repo" | "revision">): string {
  return `${candidate.repo.replace(/[^\w.-]+/g, "--")}@${candidate.revision.slice(0, 12)}`;
}

function expectedDigest(expected: ModelFile): { algorithm: "sha256" | "sha1"; hex: string } {
  if (expected.sha256) return { algorithm: "sha256", hex: expected.sha256 };
  if (expected.gitSha1) return { algorithm: "sha1", hex: expected.gitSha1 };
  throw new Error("model file has neither sha256 nor gitSha1");
}

/** A hash primed the way the expected digest was computed (git blobs hash a header first). */
function newHash(expected: ModelFile): crypto.Hash {
  const { algorithm } = expectedDigest(expected);
  const hash = crypto.createHash(algorithm);
  if (algorithm === "sha1") hash.update(`blob ${expected.size}\0`);
  return hash;
}

async function hashFile(file: string, expected: ModelFile): Promise<string> {
  const hash = newHash(expected);
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}

/** Is `file` present with the expected size and digest? Success is remembered in a marker. */
export async function verifiedFile(file: string, expected: ModelFile): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(file);
    if (stat.size !== expected.size) return false;
    const { hex } = expectedDigest(expected);
    // Hashing a 600 MB file takes seconds; remember success next to it.
    const marker = `${file}.verified`;
    try {
      const recorded = await fs.promises.readFile(marker, "utf8");
      const markerStat = await fs.promises.stat(marker);
      if (recorded.trim() === hex && markerStat.mtimeMs >= stat.mtimeMs) return true;
    } catch {
      /* no marker yet */
    }
    if ((await hashFile(file, expected)) !== hex) return false;
    await fs.promises.writeFile(marker, hex);
    return true;
  } catch {
    return false;
  }
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function download(
  url: string,
  dest: string,
  expected: ModelFile,
  opts: { log?: Log; fetcher: Fetcher },
): Promise<void> {
  const part = `${dest}.part`;
  const res = await opts.fetcher(url, {
    headers: { "User-Agent": "viafidei-translation/1" },
    redirect: "follow",
    signal: AbortSignal.timeout(30 * 60_000),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const hash = newHash(expected);
  let size = 0;
  const measure = new Transform({
    transform(chunk: Buffer, _enc, done) {
      hash.update(chunk);
      size += chunk.length;
      done(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    measure,
    fs.createWriteStream(part),
  );
  const digest = hash.digest("hex");
  const { hex } = expectedDigest(expected);
  if (size !== expected.size || digest !== hex) {
    await fs.promises.rm(part, { force: true });
    throw new Error(
      `Checksum mismatch for ${path.basename(dest)} (got ${size} bytes, ${digest.slice(0, 12)}…)`,
    );
  }
  await fs.promises.rename(part, dest);
  await fs.promises.writeFile(`${dest}.verified`, hex);
  opts.log?.(`[translation] downloaded ${path.basename(dest)} (${(size / 1e6).toFixed(0)} MB)`);
}

/**
 * Make sure every file of a model candidate is present and verified, and
 * return the directory holding them. Retries a failed download with backoff.
 */
export async function ensureModelFiles(
  candidate: ModelCandidate,
  rootDir: string,
  opts: { log?: Log; retries?: number; fetcher?: Fetcher; backoffMs?: number } = {},
): Promise<string> {
  const { log, retries = 3, fetcher = fetch, backoffMs = 2_000 } = opts;
  const dir = path.join(rootDir, modelDirName(candidate));
  await fs.promises.mkdir(dir, { recursive: true });
  for (const [name, expected] of Object.entries(candidate.files)) {
    const dest = path.join(dir, name);
    if (await verifiedFile(dest, expected)) continue;
    const url = `${HUB}/${candidate.repo}/resolve/${candidate.revision}/${name}`;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await download(url, dest, expected, { log, fetcher });
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        log?.(
          `[translation] download of ${candidate.repo}/${name} failed (attempt ${attempt}/${retries}): ${(err as Error).message}`,
        );
        if (attempt < retries) await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
      }
    }
    if (lastError) throw lastError;
  }
  return dir;
}

/** Delete downloaded models other than the ones listed (frees disk space). */
export async function pruneModels(
  rootDir: string,
  keep: ReadonlyArray<Pick<ModelCandidate, "repo" | "revision">>,
): Promise<string[]> {
  const keepNames = new Set(keep.map(modelDirName));
  let entries: string[] = [];
  try {
    entries = await fs.promises.readdir(rootDir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of entries) {
    if (keepNames.has(name)) continue;
    await fs.promises.rm(path.join(rootDir, name), { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}
