import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarianEngine, type LoadedModel } from "@/lib/translation/engine/engine";
import { embeddingNames } from "@/lib/translation/engine/marian";
import {
  ensureModelFiles,
  modelDirName,
  pruneModels,
  verifiedFile,
} from "@/lib/translation/engine/hub";
import {
  MODELS,
  candidatesFor,
  modelKey,
  type ModelCandidate,
} from "@/lib/translation/engine/models";
import { hasContentModel, MT_TARGET_LOCALES } from "@/lib/translation/languages";

/* ------------------------------------------------------------------ */
/*  Stub models                                                       */
/* ------------------------------------------------------------------ */

const candidate = (repo: string): ModelCandidate => ({
  repo,
  revision: `${repo.replace(/\W/g, "").padEnd(12, "0")}ffff`,
  targetToken: null,
  files: {},
});

/** A model that answers from a table per beam setting; records every call. */
function stubModel(
  name: string,
  answer: (text: string, beams: number) => string,
  calls: Array<{ model: string; texts: string[]; beams: number }>,
): LoadedModel & { released: boolean } {
  return {
    released: false,
    async translate(texts, opts) {
      const beams = opts?.beams ?? 4;
      calls.push({ model: name, texts: [...texts], beams });
      return texts.map((t) => answer(t, beams));
    },
    async release() {
      this.released = true;
    },
  };
}

describe("MarianEngine (stub models)", () => {
  const primary = candidate("test/primary");
  const fallback = candidate("test/fallback");
  let calls: Array<{ model: string; texts: string[]; beams: number }>;
  let loaded: Array<LoadedModel & { released: boolean }>;

  const engineWith = (
    answers: Record<string, (text: string, beams: number) => string>,
    opts: { failLoad?: string[] } = {},
  ) =>
    new MarianEngine({
      candidates: (pair) =>
        pair === "en>es" ? [primary, fallback] : pair === "en>fr" ? [primary] : [],
      ensureFiles: async (c) => `/models/${modelDirName(c)}`,
      loadModel: async (_dir, c) => {
        if (opts.failLoad?.includes(c.repo)) throw new Error(`cannot load ${c.repo}`);
        const m = stubModel(c.repo, answers[c.repo]!, calls);
        loaded.push(m);
        return m;
      },
      beams: 4,
    });

  beforeEach(() => {
    calls = [];
    loaded = [];
  });

  it("translates with the primary model and reports which model produced each output", async () => {
    const engine = engineWith({ "test/primary": (t) => `ES:${t}` });
    const res = await engine.translate("en>es", ["One.", "Two."]);
    expect(res.outputs).toEqual(["ES:One.", "ES:Two."]);
    expect(res.models).toEqual([modelKey(primary), modelKey(primary)]);
    expect(calls).toEqual([{ model: "test/primary", texts: ["One.", "Two."], beams: 4 }]);
  });

  it("retries rejected sentences greedily, then with the fallback model, then gives up", async () => {
    const engine = engineWith({
      "test/primary": (t, beams) => (t === "greedy fixes" && beams === 1 ? "ok-greedy" : "bad"),
      "test/fallback": (t) => (t === "fallback fixes" ? "ok-fallback" : "bad"),
    });
    const res = await engine.translate(
      "en>es",
      ["greedy fixes", "fallback fixes", "nothing fixes"],
      {
        accept: (_i, out) => out.startsWith("ok"),
      },
    );
    expect(res.outputs).toEqual(["ok-greedy", "ok-fallback", null]);
    expect(res.models).toEqual([modelKey(primary), modelKey(fallback), null]);
    expect(calls.map((c) => [c.model, c.beams, c.texts.length])).toEqual([
      ["test/primary", 4, 3],
      ["test/primary", 1, 3],
      ["test/fallback", 4, 2],
    ]);
    // The fallback is loaded only for those sentences and released at once.
    expect(loaded[1]!.released).toBe(true);
    expect(loaded[0]!.released).toBe(false);
  });

  it("keeps one model loaded at a time, releasing it on a pair change", async () => {
    const engine = engineWith({ "test/primary": (t) => `X:${t}` });
    await engine.translate("en>es", ["a"]);
    await engine.translate("en>es", ["b"]);
    expect(loaded).toHaveLength(1);
    await engine.translate("en>fr", ["c"]);
    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.released).toBe(true);
    await engine.release();
    expect(loaded[1]!.released).toBe(true);
  });

  it("falls back to the next candidate when the first cannot be loaded, and remembers", async () => {
    const engine = engineWith({ "test/fallback": (t) => `F:${t}` }, { failLoad: ["test/primary"] });
    expect((await engine.translate("en>es", ["a"])).outputs).toEqual(["F:a"]);
    expect((await engine.translate("en>es", ["b"])).models).toEqual([modelKey(fallback)]);
  });

  it("rejects a pair it has no model for, and supports() says so", async () => {
    const engine = engineWith({});
    expect(engine.supports("en>es")).toBe(true);
    expect(engine.supports("en>la")).toBe(false);
    await expect(engine.translate("en>la", ["a"])).rejects.toThrow(/No translation model/);
    expect(await engine.translate("en>es", [])).toEqual({ outputs: [], models: [] });
  });
});

describe("embeddingNames", () => {
  const has = (...names: string[]) => ({ has: (n: string) => names.includes(n) });
  it("uses the shared matrix wherever a conversion stored it", () => {
    const shared = "model.shared.weight";
    expect(embeddingNames(has(shared, "lm_head.weight"))).toEqual({
      inputEmbedding: shared,
      decoderEmbedding: shared,
      outputEmbedding: shared,
    });
    // opus-mt-ar-en's safetensors keeps the tied matrix only under the decoder's name.
    const dec = "model.decoder.embed_tokens.weight";
    expect(embeddingNames(has(dec))).toEqual({
      inputEmbedding: dec,
      decoderEmbedding: dec,
      outputEmbedding: dec,
    });
    expect(embeddingNames(has("model.encoder.embed_tokens.weight", dec, "lm_head.weight"))).toEqual(
      {
        inputEmbedding: "model.encoder.embed_tokens.weight",
        decoderEmbedding: dec,
        outputEmbedding: "lm_head.weight",
      },
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Model manifest                                                    */
/* ------------------------------------------------------------------ */

describe("model manifest", () => {
  it("pins a model for nine of the ten target languages, and only English → target pairs", () => {
    for (const lang of MT_TARGET_LOCALES) {
      // Korean has no working English→Korean model (see models.ts).
      expect(candidatesFor(`en>${lang}`).length > 0, lang).toBe(lang !== "ko");
      expect(hasContentModel(lang), lang).toBe(lang !== "ko");
    }
    expect(hasContentModel("en")).toBe(false);
    expect(hasContentModel("la")).toBe(false);
    // Parish names are transliterated, never translated (rules.ts, rule b), and
    // Latin and Greek are never a target: no other pair may be pinned.
    expect(Object.keys(MODELS).sort()).toEqual(
      MT_TARGET_LOCALES.filter((l) => l !== "ko")
        .map((l) => `en>${l}`)
        .sort(),
    );
  });

  it("pins every file by size and digest at a full commit revision", () => {
    for (const [pair, list] of Object.entries(MODELS)) {
      for (const c of list) {
        expect(c.revision, pair).toMatch(/^[0-9a-f]{40}$/);
        const names = Object.keys(c.files);
        expect(names, pair).toEqual(
          expect.arrayContaining(["config.json", "vocab.json", "source.spm"]),
        );
        expect(
          names.some((n) => n === "model.safetensors" || n === "pytorch_model.bin"),
          pair,
        ).toBe(true);
        for (const f of Object.values(c.files)) {
          expect(f.size).toBeGreaterThan(0);
          expect(Boolean(f.sha256) || Boolean(f.gitSha1), pair).toBe(true);
          if (f.sha256) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
          if (f.gitSha1) expect(f.gitSha1).toMatch(/^[0-9a-f]{40}$/);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Hub: download and verification                                    */
/* ------------------------------------------------------------------ */

describe("hub", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vf-hub-"));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const big = Buffer.from("weights ".repeat(1000));
  const small = Buffer.from('{"d_model": 512}');
  const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
  const gitSha1 = (b: Buffer) =>
    crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");
  const model: ModelCandidate = {
    repo: "test/model",
    revision: "0123456789abcdef0123456789abcdef01234567",
    targetToken: null,
    files: {
      "config.json": { size: small.length, gitSha1: gitSha1(small) },
      "model.safetensors": { size: big.length, sha256: sha256(big) },
    },
  };
  const fetcherFor = (bodies: Record<string, Buffer>) =>
    vi.fn(async (url: string) => {
      const name = url.split("/").pop()!;
      const body = bodies[name];
      return body ? new Response(body) : new Response("missing", { status: 404 });
    });

  it("downloads, verifies by SHA-256 or git blob SHA-1, and does not download twice", async () => {
    const fetcher = fetcherFor({ "config.json": small, "model.safetensors": big });
    const dir = await ensureModelFiles(model, root, { fetcher, backoffMs: 1 });
    expect(dir).toBe(path.join(root, "test--model@0123456789ab"));
    expect(fs.readFileSync(path.join(dir, "model.safetensors"))).toEqual(big);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://huggingface.co/test/model/resolve/0123456789abcdef0123456789abcdef01234567/config.json",
    );
    await ensureModelFiles(model, root, { fetcher, backoffMs: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects a corrupted download after retrying, leaving nothing behind", async () => {
    const fetcher = fetcherFor({
      "config.json": small,
      "model.safetensors": Buffer.from("tampered"),
    });
    await expect(
      ensureModelFiles(model, root, { fetcher, retries: 2, backoffMs: 1 }),
    ).rejects.toThrow(/Checksum mismatch/);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const dir = path.join(root, modelDirName(model));
    expect(fs.existsSync(path.join(dir, "model.safetensors"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "model.safetensors.part"))).toBe(false);
  });

  it("re-downloads a file that changed on disk", async () => {
    const fetcher = fetcherFor({ "config.json": small, "model.safetensors": big });
    const dir = await ensureModelFiles(model, root, { fetcher, backoffMs: 1 });
    fs.writeFileSync(path.join(dir, "config.json"), '{"d_model": 999}');
    expect(await verifiedFile(path.join(dir, "config.json"), model.files["config.json"]!)).toBe(
      false,
    );
    await ensureModelFiles(model, root, { fetcher, backoffMs: 1 });
    expect(fs.readFileSync(path.join(dir, "config.json"))).toEqual(small);
  });

  it("prunes every model directory but the ones kept", async () => {
    fs.mkdirSync(path.join(root, modelDirName(model)));
    fs.mkdirSync(path.join(root, "old--model@aaaaaaaaaaaa"));
    expect(await pruneModels(root, [model])).toEqual(["old--model@aaaaaaaaaaaa"]);
    expect(fs.readdirSync(root)).toEqual([modelDirName(model)]);
    expect(await pruneModels(path.join(root, "missing"), [])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  A real model, when one is available                               */
/* ------------------------------------------------------------------ */

const realDir = process.env.TRANSLATION_TEST_MODEL_DIR;
const haveReal = Boolean(realDir && fs.existsSync(path.join(realDir, "config.json")));

describe.skipIf(!haveReal)("a real OPUS-MT model (TRANSLATION_TEST_MODEL_DIR)", () => {
  it("translates a sentence and keeps a placeholder", { timeout: 120_000 }, async () => {
    const { loadOrt } = await import("@/lib/translation/engine/ort");
    const { MarianModel } = await import("@/lib/translation/engine/marian");
    const ort = await loadOrt();
    const m = await MarianModel.load(realDir!, { ort, threads: 2 });
    try {
      const [out] = await m.translate(["X1 entered the Carmel at fifteen."], { beams: 4 });
      expect(out).toMatch(/X1/);
      expect(out!.length).toBeGreaterThan(10);
    } finally {
      await m.release();
    }
  });
});
