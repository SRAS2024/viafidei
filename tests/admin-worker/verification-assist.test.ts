/**
 * The single-authoritative-source verification assist is what lets live-extracted
 * content from a TOP Catholic authority (the Holy See, a bishops' conference)
 * verify the way the hand-curated ground truth already does — on one
 * authoritative source — instead of stalling forever when independent
 * cross-check sources are merely unreachable. These tests pin its gates: off by
 * default, top-authority source only, never override a real disagreement, never
 * re-confirm an already-verified field, and record PASS rows only for what the
 * AI explicitly confirms.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runAiVerificationAssist } from "@/lib/admin-worker/dispatcher";

const KEYS = [
  "EXTRACTION_AI_API_URL",
  "EXTRACTION_AI_API_KEY",
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

function enableAi() {
  process.env.EXTRACTION_AI_API_URL = "https://ai.example/v1/chat/completions";
  process.env.EXTRACTION_AI_API_KEY = "k";
}

function stubAiConfirm(confirmed: string[]): typeof global.fetch {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ confirmed }) } }] }),
  })) as unknown as typeof global.fetch;
}

function makePrisma(opts: {
  sourceHost?: string;
  mismatchCount?: number;
  alreadyOk?: string[];
  create: ReturnType<typeof vi.fn>;
}) {
  return {
    adminWorkerSourceRead: {
      findUnique: vi.fn(async () => ({
        sourceHost: opts.sourceHost ?? "vatican.va",
        sourceUrl: "https://www.vatican.va/x",
        extractedText: "Saint Rose of Lima — feast August 23.",
      })),
    },
    adminWorkerCrossSourceVerification: {
      count: vi.fn(async () => opts.mismatchCount ?? 0),
      findMany: vi.fn(async () => (opts.alreadyOk ?? []).map((f) => ({ fieldName: f }))),
      create: opts.create,
    },
  } as unknown as Parameters<typeof runAiVerificationAssist>[0];
}

const artifact = {
  id: "art1",
  contentType: "SAINT",
  sourceReadId: "sr1",
  packageChecksum: "cs1",
  extractedFields: { saintName: "Saint Rose of Lima", feastDay: "August 23" },
};

describe("runAiVerificationAssist", () => {
  it("is a no-op when AI is disabled (records nothing)", async () => {
    const create = vi.fn();
    const prisma = makePrisma({ create });
    const confirmed = await runAiVerificationAssist(prisma, artifact, ["feastDay"]);
    expect(confirmed).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("records PASS rows for AI-confirmed fields on a top-authority source", async () => {
    enableAi();
    global.fetch = stubAiConfirm(["feastDay", "saintName"]);
    const create = vi.fn(async () => ({ id: "v1" }));
    const prisma = makePrisma({ create });

    const confirmed = await runAiVerificationAssist(prisma, artifact, ["feastDay"]);

    expect(confirmed.sort()).toEqual(["feastDay", "saintName"]);
    expect(create).toHaveBeenCalledTimes(2);
    const row = (create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(row.matchResult).toBe("PASS");
    expect(row.finalDecision).toBe("ACCEPT");
    expect(row.validationSourceHost).toBe("vatican.va");
    expect(row.contentId).toBe("art1");
  });

  it("skips a source that is not a top Catholic authority", async () => {
    enableAi();
    global.fetch = stubAiConfirm(["feastDay"]);
    const create = vi.fn();
    const prisma = makePrisma({ sourceHost: "somecatholicblog.example", create });
    const confirmed = await runAiVerificationAssist(prisma, artifact, ["feastDay"]);
    expect(confirmed).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses to override a real disagreement (an existing MISMATCH row)", async () => {
    enableAi();
    global.fetch = stubAiConfirm(["feastDay"]);
    const create = vi.fn();
    const prisma = makePrisma({ mismatchCount: 1, create });
    const confirmed = await runAiVerificationAssist(prisma, artifact, ["feastDay"]);
    expect(confirmed).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("does not re-confirm fields that already carry a MATCH/PASS row", async () => {
    enableAi();
    const fetchSpy = stubAiConfirm(["feastDay"]);
    global.fetch = fetchSpy;
    const create = vi.fn();
    const prisma = makePrisma({ alreadyOk: ["saintName", "feastDay"], create });
    const confirmed = await runAiVerificationAssist(prisma, artifact, []);
    expect(confirmed).toEqual([]);
    expect(create).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
