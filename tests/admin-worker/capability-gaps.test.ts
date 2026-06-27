/**
 * The worker's growth-capability self-check. It recognises which outward
 * capability is missing (AI extraction, open-internet, search, translation,
 * structured-source reachability) so a plateau becomes an actionable
 * instruction instead of a silent stall.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { diagnoseCapabilityGaps } from "@/lib/admin-worker/capability-gaps";

const ENV_KEYS = [
  "EXTRACTION_AI_API_URL",
  "EXTRACTION_AI_API_KEY",
  "EXTRACTION_AI_MODEL",
  "TRANSLATION_AI_API_URL",
  "TRANSLATION_AI_API_KEY",
  "TRANSLATION_AI_MODEL",
  "GOOGLE_TRANSLATE_API_KEY",
  "ADMIN_WORKER_OPEN_INTERNET",
  "GOOGLE_SEARCH_API_KEY",
  "GOOGLE_SEARCH_ENGINE_ID",
  "BING_SEARCH_API_KEY",
  "ADMIN_WORKER_SKIP_NETWORK",
] as const;

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function prismaWithLog(unreachable: boolean): PrismaClient {
  return {
    adminWorkerLog: {
      findFirst: vi.fn(async () => (unreachable ? { id: "log1" } : null)),
    },
  } as unknown as PrismaClient;
}

describe("diagnoseCapabilityGaps", () => {
  it("with nothing configured, only the keyed AI-extraction capability is missing (rest are keyless)", async () => {
    const cap = await diagnoseCapabilityGaps(prismaWithLog(false));
    const names = cap.missing.map((g) => g.capability);
    // AI extraction is the one genuinely keyed quality booster.
    expect(names).toContain("AI-assisted extraction");
    // These are all keyless and ON by default now — not missing with no config.
    expect(names).not.toContain("Open-internet fetching");
    expect(names).not.toContain("Keyword web-search discovery");
    expect(names).not.toContain("Latin/Greek translation provider");
    expect(names).not.toContain("Dynamic (JS-rendering) fetcher");
    // Structured source is "reachable" (no recent unreachable log).
    expect(names).not.toContain("Structured source reachable");
    expect(cap.summary).toMatch(/gap/i);
  });

  it("keyless capabilities show missing when explicitly disabled / offline", async () => {
    process.env.ADMIN_WORKER_OPEN_INTERNET = "0";
    process.env.ADMIN_WORKER_KEYLESS_WEB_SEARCH = "0";
    process.env.ADMIN_WORKER_KEYLESS_TRANSLATE = "0";
    const cap = await diagnoseCapabilityGaps(prismaWithLog(false));
    const names = cap.missing.map((g) => g.capability);
    expect(names).toContain("Open-internet fetching");
    expect(names).toContain("Keyword web-search discovery");
    expect(names).toContain("Latin/Greek translation provider");
  });

  it("reports all-configured when the env is fully set", async () => {
    process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.EXTRACTION_AI_API_KEY = "sk-test";
    process.env.TRANSLATION_AI_API_URL = "https://ai.example/v1/chat/completions";
    process.env.TRANSLATION_AI_API_KEY = "sk-test";
    process.env.ADMIN_WORKER_OPEN_INTERNET = "1";
    process.env.GOOGLE_SEARCH_API_KEY = "g-key";
    process.env.GOOGLE_SEARCH_ENGINE_ID = "g-cx";
    const cap = await diagnoseCapabilityGaps(prismaWithLog(false));
    expect(cap.missing).toHaveLength(0);
    expect(cap.summary).toMatch(/all growth capabilities/i);
  });

  it("flags the structured source as unreachable when a recent warn log exists", async () => {
    const cap = await diagnoseCapabilityGaps(prismaWithLog(true));
    expect(cap.missing.map((g) => g.capability)).toContain("Structured source reachable");
  });
});
