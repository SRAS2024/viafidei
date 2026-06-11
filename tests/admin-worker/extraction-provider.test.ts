/**
 * AI-assisted extraction is the capability that removes the ceiling on what the
 * Admin Worker can publish: when the deterministic extractors leave required
 * fields missing, an AI provider fills ONLY what the page text supports, and a
 * single-authoritative-source assist lets the verifier confirm sensitive facts
 * against the artifact's own top-authority source when independent sources are
 * unreachable. These tests pin its SAFE DEFAULTS (off, no-op, never throws) and
 * its strict behaviour on the live path (only requested fields, only usable
 * values, accurate provenance).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  aiConfirmFields,
  aiExtractFields,
  enrichExtractorWithAI,
  extractionAiEnabled,
  parseJsonObject,
} from "@/lib/admin-worker/extraction-provider";
import type { ExtractorOutput } from "@/lib/admin-worker/extractors";

const KEYS = [
  "EXTRACTION_AI_API_URL",
  "EXTRACTION_AI_API_KEY",
  "EXTRACTION_AI_MODEL",
  "TRANSLATION_AI_API_URL",
  "TRANSLATION_AI_API_KEY",
  "TRANSLATION_AI_MODEL",
  "ADMIN_WORKER_SKIP_NETWORK",
] as const;

let saved: Record<string, string | undefined>;
const realFetch = global.fetch;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

/** Build a fetch stub that returns a chat-completions body with `content`. */
function stubAiResponse(content: string, ok = true): typeof global.fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => ({ choices: [{ message: { content } }] }),
  })) as unknown as typeof global.fetch;
}

function makeOutput(over: Partial<ExtractorOutput<Record<string, unknown>>> = {}) {
  const base: ExtractorOutput<Record<string, unknown>> = {
    fields: { saintName: "Saint Rose" },
    missingFields: ["feastDay", "biography"],
    confidenceScore: 0.5,
    sourceEvidence: [],
    rejectedSections: [],
    formatting: {},
    warnings: [],
    fatalReasons: [],
  };
  return { ...base, ...over };
}

describe("extractionAiEnabled (safe default)", () => {
  it("is disabled when no provider is configured", () => {
    expect(extractionAiEnabled()).toBe(false);
  });

  it("is enabled once a dedicated extraction key + url are present", () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    expect(extractionAiEnabled()).toBe(true);
  });

  it("falls back to the translation provider config", () => {
    process.env.TRANSLATION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.TRANSLATION_AI_API_KEY = "k";
    expect(extractionAiEnabled()).toBe(true);
  });

  it("stays disabled in skip-network mode even when configured", () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    expect(extractionAiEnabled()).toBe(false);
  });
});

describe("parseJsonObject", () => {
  it("returns null for empty / non-object input", () => {
    expect(parseJsonObject("")).toBeNull();
    expect(parseJsonObject("no json here")).toBeNull();
    expect(parseJsonObject("[1,2,3]")).toBeNull();
  });

  it("extracts a balanced object even inside code fences and prose", () => {
    const raw = 'Here you go:\n```json\n{"feastDay": "August 23", "n": 5}\n```\nDone.';
    expect(parseJsonObject(raw)).toEqual({ feastDay: "August 23", n: 5 });
  });

  it("handles braces inside string values", () => {
    expect(parseJsonObject('{"a": "has } brace", "b": "{nested}"}')).toEqual({
      a: "has } brace",
      b: "{nested}",
    });
  });

  it("returns null on malformed JSON", () => {
    expect(parseJsonObject('{"a": }')).toBeNull();
  });
});

describe("aiExtractFields", () => {
  it("returns null with no provider configured (never calls the network)", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof global.fetch;
    const r = await aiExtractFields({
      contentType: "SAINT",
      fields: ["feastDay"],
      text: "Her feast is August 23.",
    });
    expect(r).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null in skip-network mode even when configured", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof global.fetch;
    const r = await aiExtractFields({ contentType: "SAINT", fields: ["feastDay"], text: "x" });
    expect(r).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps only requested fields with usable values, trimming strings", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    global.fetch = stubAiResponse(
      JSON.stringify({
        feastDay: "  August 23  ",
        biography: "", // empty → dropped
        unrequested: "ignored", // not requested → dropped
        patronages: ["South America"],
      }),
    );
    const r = await aiExtractFields({
      contentType: "SAINT",
      fields: ["feastDay", "biography", "patronages"],
      text: "Saint Rose of Lima, feast August 23, patroness of South America.",
    });
    expect(r).toEqual({ feastDay: "August 23", patronages: ["South America"] });
  });

  it("returns null when the provider errors", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof global.fetch;
    const r = await aiExtractFields({ contentType: "SAINT", fields: ["feastDay"], text: "x" });
    expect(r).toBeNull();
  });
});

describe("aiConfirmFields", () => {
  it("returns [] with no provider configured", async () => {
    const r = await aiConfirmFields({
      contentType: "SAINT",
      text: "feast August 23",
      pairs: [{ field: "feastDay", value: "August 23" }],
    });
    expect(r).toEqual([]);
  });

  it("returns only requested field names the AI confirms", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    global.fetch = stubAiResponse(
      JSON.stringify({ confirmed: ["feastDay", "saintName", "notRequested"] }),
    );
    const r = await aiConfirmFields({
      contentType: "SAINT",
      text: "Saint Rose of Lima — feast August 23.",
      pairs: [
        { field: "feastDay", value: "August 23" },
        { field: "saintName", value: "Saint Rose of Lima" },
      ],
    });
    expect(r.sort()).toEqual(["feastDay", "saintName"]);
  });

  it("returns [] when the response has no confirmed array", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    global.fetch = stubAiResponse(JSON.stringify({ something: "else" }));
    const r = await aiConfirmFields({
      contentType: "SAINT",
      text: "x",
      pairs: [{ field: "feastDay", value: "August 23" }],
    });
    expect(r).toEqual([]);
  });
});

describe("enrichExtractorWithAI", () => {
  const ctx = {
    contentType: "SAINT",
    text: "Saint Rose of Lima — feast August 23.",
    title: "Saint Rose of Lima",
    url: "https://www.vatican.va/x",
    host: "vatican.va",
    checksum: "abc",
  };

  it("is a no-op when AI is disabled (returns the same output unchanged)", async () => {
    const output = makeOutput();
    const r = await enrichExtractorWithAI(output, ctx);
    expect(r.aiFilled).toEqual([]);
    expect(r.output).toBe(output);
  });

  it("is a no-op when there are no missing fields", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof global.fetch;
    const output = makeOutput({ missingFields: [] });
    const r = await enrichExtractorWithAI(output, ctx);
    expect(r.aiFilled).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fills missing fields, clears them, and records AI_EXTRACTION provenance", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "k";
    global.fetch = stubAiResponse(JSON.stringify({ feastDay: "August 23" }));
    const output = makeOutput();
    const r = await enrichExtractorWithAI(output, ctx);

    expect(r.aiFilled).toEqual(["feastDay"]);
    expect(r.output.fields.feastDay).toBe("August 23");
    // The unresolved missing field stays missing.
    expect(r.output.missingFields).toEqual(["biography"]);
    const prov = r.output.sourceEvidence.find((p) => p.fieldName === "feastDay");
    expect(prov?.extractionMethod).toBe("AI_EXTRACTION");
    expect(prov?.sourceHost).toBe("vatican.va");
    expect(r.output.warnings.some((w) => w.includes("ai-filled"))).toBe(true);
  });
});
