/**
 * The worker's growth-capability self-check. Every remaining capability is
 * KEYLESS and on by default (open-internet, dynamic fetcher, keyword web-search,
 * structured-source reachability) — there is NO external-AI capability, because
 * the Admin Worker resolves growth through its own coded logic. A plateau
 * therefore points at a disabled toggle or a network-reachability problem, never
 * at a missing AI/API key.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { diagnoseCapabilityGaps } from "@/lib/admin-worker/capability-gaps";

const ENV_KEYS = [
  "ADMIN_WORKER_OPEN_INTERNET",
  "ADMIN_WORKER_KEYLESS_WEB_SEARCH",
  "ADMIN_WORKER_DYNAMIC_FETCHER",
  "ADMIN_WORKER_SKIP_NETWORK",
  "GOOGLE_SEARCH_API_KEY",
  "GOOGLE_SEARCH_ENGINE_ID",
  "BING_SEARCH_API_KEY",
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
  it("with nothing configured, NO capability is missing — every one is keyless + on by default", async () => {
    const cap = await diagnoseCapabilityGaps(prismaWithLog(false));
    const names = cap.missing.map((g) => g.capability);
    // There is no AI-extraction / translation-provider capability anymore.
    expect(names).not.toContain("AI-assisted extraction");
    expect(names).not.toContain("Latin/Greek translation provider");
    // The keyless capabilities are all on by default.
    expect(names).not.toContain("Open-internet fetching");
    expect(names).not.toContain("Keyword web-search discovery");
    expect(names).not.toContain("Dynamic (JS-rendering) fetcher");
    expect(names).not.toContain("Structured source reachable");
    expect(cap.missing).toHaveLength(0);
    expect(cap.summary).toMatch(/all growth capabilities/i);
  });

  it("keyless capabilities show missing only when explicitly disabled / offline", async () => {
    process.env.ADMIN_WORKER_OPEN_INTERNET = "0";
    process.env.ADMIN_WORKER_KEYLESS_WEB_SEARCH = "0";
    const cap = await diagnoseCapabilityGaps(prismaWithLog(false));
    const names = cap.missing.map((g) => g.capability);
    expect(names).toContain("Open-internet fetching");
    expect(names).toContain("Keyword web-search discovery");
    // The remediation is a keyless toggle — it never asks for an AI/API key.
    const openGap = cap.missing.find((g) => g.capability === "Open-internet fetching");
    expect(openGap?.env ?? "").not.toMatch(/AI_API_KEY/);
  });

  it("flags the structured source as unreachable when a recent warn log exists", async () => {
    const cap = await diagnoseCapabilityGaps(prismaWithLog(true));
    expect(cap.missing.map((g) => g.capability)).toContain("Structured source reachable");
  });
});
