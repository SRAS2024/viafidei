/**
 * The machine-translation provider seam is the authorized fallback for prayers
 * the deterministic corpus cannot render. These tests pin its behaviour: with
 * nothing configured it is disabled and proposes nothing, and — per the site
 * owner's directive that every prayer/litany carry both Latin and Greek — a
 * configured machine translation is auto-published by default (opt-out), filling
 * the gap the authentic corpus leaves.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  autoPublishMachineTranslations,
  machineTranslationEnabled,
  parseKeylessGoogleResponse,
  proposeMachineTranslation,
} from "@/lib/admin-worker/translation-provider";

const KEYS = [
  "TRANSLATION_AI_API_URL",
  "TRANSLATION_AI_API_KEY",
  "TRANSLATION_AI_MODEL",
  "EXTRACTION_AI_API_URL",
  "EXTRACTION_AI_API_KEY",
  "EXTRACTION_AI_MODEL",
  "GOOGLE_TRANSLATE_API_KEY",
  "TRANSLATION_AUTOPUBLISH_MACHINE",
  "ADMIN_WORKER_KEYLESS_TRANSLATE",
  "ADMIN_WORKER_SKIP_NETWORK",
] as const;

let saved: Record<string, string | undefined>;

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
});

describe("translation provider (machine fallback)", () => {
  it("is KEYLESS-enabled by default — no provider key required", () => {
    // The keyless Google endpoint fills the gap with zero configuration.
    expect(machineTranslationEnabled()).toBe(true);
  });

  it("is fully disabled (proposes nothing) only when keyless is opted out and no key is set", async () => {
    process.env.ADMIN_WORKER_KEYLESS_TRANSLATE = "0";
    expect(machineTranslationEnabled()).toBe(false);
    const r = await proposeMachineTranslation("Our Father, who art in heaven...", "la");
    expect(r).toBeNull();
  });

  it("disables the keyless endpoint in skip-network mode", () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    expect(machineTranslationEnabled()).toBe(false);
  });

  it("reports enabled once a provider key is present", () => {
    process.env.ADMIN_WORKER_KEYLESS_TRANSLATE = "0";
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-key";
    expect(machineTranslationEnabled()).toBe(true);
  });

  it("auto-publishes machine output by default to fill the gap (opt-out)", () => {
    expect(autoPublishMachineTranslations()).toBe(true);
    process.env.TRANSLATION_AUTOPUBLISH_MACHINE = "1";
    expect(autoPublishMachineTranslations()).toBe(true);
    process.env.TRANSLATION_AUTOPUBLISH_MACHINE = "true";
    expect(autoPublishMachineTranslations()).toBe(true);
  });

  it("routes machine drafts to review only when explicitly opted out", () => {
    process.env.TRANSLATION_AUTOPUBLISH_MACHINE = "0";
    expect(autoPublishMachineTranslations()).toBe(false);
    process.env.TRANSLATION_AUTOPUBLISH_MACHINE = "false";
    expect(autoPublishMachineTranslations()).toBe(false);
    process.env.TRANSLATION_AUTOPUBLISH_MACHINE = "off";
    expect(autoPublishMachineTranslations()).toBe(false);
  });
});

describe("parseKeylessGoogleResponse", () => {
  it("joins the translated segments from the free-endpoint array shape", () => {
    // Shape: [[ [translated, source, ...], ... ], ...]
    const body = JSON.stringify([
      [
        ["Pater noster, ", "Our Father, ", null, null],
        ["qui es in caelis", "who art in heaven", null, null],
      ],
      null,
      "en",
    ]);
    expect(parseKeylessGoogleResponse(body)).toBe("Pater noster, qui es in caelis");
  });

  it("returns null for malformed or empty responses", () => {
    expect(parseKeylessGoogleResponse("not json")).toBeNull();
    expect(parseKeylessGoogleResponse("{}")).toBeNull();
    expect(parseKeylessGoogleResponse("[null]")).toBeNull();
    expect(parseKeylessGoogleResponse(JSON.stringify([[]]))).toBeNull();
  });
});
