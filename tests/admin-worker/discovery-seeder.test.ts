/**
 * The structured discovery seeder bridges Wikidata's coverage to the content
 * types with no structured ingestor (devotion, Marian title, apparition) by
 * enqueueing their authoritative source URLs for the live extraction pipeline.
 * These tests pin: it is discovery-only (routes URLs through the candidate
 * guard, tagged with the predicted content type), bounded + cursor-advancing,
 * and a no-op when disabled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/web-navigator", () => ({
  discoverCandidate: vi.fn(async () => ({ id: "c1", status: "DISCOVERED" })),
}));

import type { PrismaClient } from "@prisma/client";

import { runDiscoverySeeder } from "@/lib/admin-worker/structured/discovery-seeder";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { discoverCandidate } from "@/lib/admin-worker/web-navigator";

const mockedSparql = vi.mocked(runSparql);
const mockedDiscover = vi.mocked(discoverCandidate);

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
const OPT = "ADMIN_WORKER_DISCOVERY_SEEDER";
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = { [SKIP]: process.env[SKIP], [OPT]: process.env[OPT] };
  delete process.env[SKIP];
  delete process.env[OPT];
  mockedSparql.mockReset();
  mockedDiscover.mockReset();
  mockedDiscover.mockResolvedValue({ id: "c1", status: "DISCOVERED" } as never);
});
afterEach(() => {
  for (const k of [SKIP, OPT]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

function makePrisma() {
  return {
    adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;
}

describe("runDiscoverySeeder", () => {
  it("enqueues authoritative source URLs tagged with the predicted content type", async () => {
    // First seed (DEVOTION) returns one entity with a website + article; the
    // other two seeds return nothing.
    mockedSparql
      .mockResolvedValueOnce([
        row({
          x: "http://www.wikidata.org/entity/Q42",
          site: "https://divinemercy.example",
          art: "https://en.wikipedia.org/wiki/Divine_Mercy",
        }),
      ])
      .mockResolvedValue([]);

    const out = await runDiscoverySeeder(makePrisma(), { force: true });

    expect(out.enabled).toBe(true);
    expect(out.entities).toBe(1);
    expect(out.enqueued).toBe(2); // website + article
    const firstCall = mockedDiscover.mock.calls[0][1] as {
      url: string;
      predictedContentType: string;
    };
    expect(firstCall.url).toBe("https://divinemercy.example");
    expect(firstCall.predictedContentType).toBe("DEVOTION");
  });

  it("skips entities that carry no source URL", async () => {
    mockedSparql
      .mockResolvedValueOnce([row({ x: "http://www.wikidata.org/entity/Q7" })])
      .mockResolvedValue([]);

    const out = await runDiscoverySeeder(makePrisma(), { force: true });

    expect(out.entities).toBe(1);
    expect(out.enqueued).toBe(0);
    expect(mockedDiscover).not.toHaveBeenCalled();
  });

  it("is a no-op when disabled", async () => {
    process.env[OPT] = "0";
    const out = await runDiscoverySeeder(makePrisma(), { force: true });
    expect(out.enabled).toBe(false);
    expect(out.enqueued).toBe(0);
    expect(mockedSparql).not.toHaveBeenCalled();
  });

  it("covers every gap content type (devotion, Marian title, apparition, novena, prayer, spiritual practice, rite)", async () => {
    mockedSparql.mockResolvedValue([]);
    const out = await runDiscoverySeeder(makePrisma(), { force: true });
    expect(Object.keys(out.bySeed).sort()).toEqual(
      [
        "seed-apparitions",
        "seed-devotions",
        "seed-marian-titles",
        "seed-novenas",
        "seed-prayers",
        "seed-rites",
        "seed-spiritual-practices",
      ].sort(),
    );
  });
});
