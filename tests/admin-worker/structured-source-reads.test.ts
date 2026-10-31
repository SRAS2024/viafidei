/**
 * A rejection reached after a failed source read is never remembered.
 *
 * Every structured fetch helper fails open: an infobox fetch that timed out or
 * answered 429 parsed as `{}`, a narrative source that failed read as "no
 * text". The SAINT mapper then rejected with `no_canonization_date` /
 * `feast_uncorroborated` / `feast_ambiguous`, the descriptive mappers with
 * `narrative_too_short` — codes the rejection memory keeps for a day,
 * doubling to a week — so a valid saint or devotion whose read merely failed
 * was deferred instead of retried on the next sweep. Pinned here:
 *   - the HTTP layer records, in a per-entity ledger, every read that ended
 *     without an answer about the resource (no response, timeout, 408/425/429/
 *     5xx, network gate closed) and never a 404 or another 4xx;
 *   - the parse API's own error answers are told apart the same way;
 *   - `mapSourceRow` reports a remembered-kind rejection reached with an unread
 *     source as `source_read_failed` (the mapper's verdict kept in the detail),
 *     through the real SAINT and DEVOTION mappers;
 *   - the ingest pass writes no memo for it, and still remembers the genuine
 *     rejection beside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));
vi.mock("@/lib/admin-worker/web-navigator", () => ({
  discoverCandidate: vi.fn(async () => null),
}));

import type { PrismaClient } from "@prisma/client";

import {
  fetchJson,
  fetchText,
  isTransientFetchFailure,
  resetWikimediaQueue,
  type SourceReadLedger,
} from "@/lib/admin-worker/structured/http";
import { runStructuredIngest } from "@/lib/admin-worker/structured/ingest";
import { ingestorFor } from "@/lib/admin-worker/structured/ingestors";
import { mapSourceRow, mapSourceRowDetailed } from "@/lib/admin-worker/structured/map-row";
import { isRejection } from "@/lib/admin-worker/structured/reject";
import {
  isRememberedRejection,
  rejectionMemoKey,
  resetRejectionMemoryPruneClock,
} from "@/lib/admin-worker/structured/reject-memory";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { fetchIntroForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import {
  fetchArticleSource,
  fetchArticleWikitext,
} from "@/lib/admin-worker/structured/wikipedia-infobox";

const mockedSparql = vi.mocked(runSparql);
const WD = "http://www.wikidata.org/entity/";

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

/** Route every GET by URL; anything unrouted is a network error. */
function stubFetch(routes: Array<[RegExp, () => Response | Promise<Response>]>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    for (const [re, respond] of routes) if (re.test(url)) return respond();
    throw new TypeError(`fetch failed: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

const ledger = (): SourceReadLedger => ({ unread: [] });

beforeEach(() => {
  savedSkip = process.env[SKIP];
  delete process.env[SKIP];
  resetRejectionMemoryPruneClock();
  // A stubbed 503 from Wikipedia pauses the serial Wikimedia queue (http.ts);
  // never let one test's pause hold the next test's requests.
  resetWikimediaQueue();
  mockedSparql.mockReset();
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  vi.unstubAllGlobals();
});

describe("the read ledger (http.ts)", () => {
  it("counts a read that got no answer about the resource, never a 404", () => {
    const at = (status: number | null, aborted = false, disabled = false) =>
      isTransientFetchFailure({ status, aborted, disabled });
    expect(at(null)).toBe(true); // network error
    expect(at(null, true)).toBe(true); // our own timeout
    expect(at(null, false, true)).toBe(true); // network gate closed
    for (const status of [408, 425, 429, 500, 502, 503, 504]) expect(at(status)).toBe(true);
    for (const status of [400, 401, 403, 404, 410]) expect(at(status)).toBe(false);
  });

  it("fetchJson records transient failures in the ledger and nothing else", async () => {
    stubFetch([
      [/\/ok$/, () => json({ a: 1 })],
      [/\/gone$/, () => json({}, 404)],
      [/\/throttled$/, () => json({}, 429)],
      [/\/down$/, () => json({}, 503)],
    ]);
    const l = ledger();
    expect(await fetchJson("https://x.example/ok", { ledger: l })).toEqual({ a: 1 });
    expect(await fetchJson("https://x.example/gone", { ledger: l })).toBeNull();
    expect(l.unread).toEqual([]);
    expect(await fetchJson("https://x.example/throttled", { ledger: l })).toBeNull();
    expect(await fetchJson("https://x.example/down", { ledger: l })).toBeNull();
    expect(await fetchJson("https://x.example/unreachable", { ledger: l })).toBeNull();
    expect(l.unread).toEqual([
      "https://x.example/throttled",
      "https://x.example/down",
      "https://x.example/unreachable",
    ]);
    // Without a ledger the helper behaves exactly as before.
    expect(await fetchJson("https://x.example/down")).toBeNull();
  });

  it("fetchText does the same, and the closed network gate counts as unread", async () => {
    const fetchMock = stubFetch([
      [/\/page$/, () => html("<p>text</p>")],
      [/\/missing$/, () => html("", 404)],
      [/\/error$/, () => html("", 500)],
    ]);
    const l = ledger();
    expect(await fetchText("https://site.example/page", { ledger: l })).toBe("<p>text</p>");
    expect(await fetchText("https://site.example/missing", { ledger: l })).toBeNull();
    expect(await fetchText("https://site.example/error", { ledger: l })).toBeNull();
    expect(l.unread).toEqual(["https://site.example/error"]);

    process.env[SKIP] = "1";
    fetchMock.mockClear();
    const offline = ledger();
    expect(await fetchText("https://site.example/page", { ledger: offline })).toBeNull();
    expect(await fetchJson("https://x.example/ok", { ledger: offline })).toBeNull();
    expect(offline.unread).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the ledger bounded", async () => {
    stubFetch([[/./, () => json({}, 503)]]);
    const l = ledger();
    for (let i = 0; i < 10; i += 1) await fetchJson(`https://x.example/${i}`, { ledger: l });
    expect(l.unread.length).toBeLessThanOrEqual(4);
  });

  it("tells the parse API's 'no such page' answer from a server that could not answer", async () => {
    stubFetch([
      [/page=Missing/, () => json({ error: { code: "missingtitle" } })],
      [/page=Busy/, () => json({ error: { code: "internal_api_error_DBQueryError" } })],
      [/page=Plain/, () => json({ parse: { wikitext: "No infobox in this article." } })],
    ]);
    const l = ledger();
    expect(
      await fetchArticleWikitext("https://en.wikipedia.org/wiki/Missing", { ledger: l }),
    ).toBeNull();
    expect(await fetchArticleWikitext("https://en.wikipedia.org/wiki/Plain", { ledger: l })).toBe(
      "No infobox in this article.",
    );
    expect(l.unread).toEqual([]);
    expect(
      await fetchArticleWikitext("https://en.wikipedia.org/wiki/Busy", { ledger: l }),
    ).toBeNull();
    expect(l.unread).toHaveLength(1);
    expect(l.unread[0]).toContain("page=Busy");
  });

  it("says whether the article itself was read, not only what it held", async () => {
    stubFetch([
      [/page=Missing/, () => json({ error: { code: "missingtitle" } })],
      [/page=Busy/, () => json({}, 503)],
      [
        /page=Kolping/,
        () =>
          json({
            parse: { wikitext: "{{Infobox saint\n|feast_day=6 December\n}}\nHe was a priest." },
          }),
      ],
    ]);
    const l = ledger();
    const read = await fetchArticleSource("https://en.wikipedia.org/wiki/Kolping", { ledger: l });
    expect(read).toMatchObject({ read: true, infobox: { feast_day: "6 December" } });
    expect(read.prose).toContain("He was a priest.");
    // "No such page" is an answer: nothing to corroborate, but nothing unread.
    expect(
      await fetchArticleSource("https://en.wikipedia.org/wiki/Missing", { ledger: l }),
    ).toEqual({ infobox: {}, prose: "", read: true });
    expect(l.unread).toEqual([]);
    // A 503 is not: the empty parts say nothing about the article.
    expect(await fetchArticleSource("https://en.wikipedia.org/wiki/Busy", { ledger: l })).toEqual({
      infobox: {},
      prose: "",
      read: false,
    });
    expect(l.unread).toHaveLength(1);
  });
});

describe("the article introduction (TextExtracts)", () => {
  it("asks for the plain-text intro of the right page, and records a read that failed", async () => {
    const fetchMock = stubFetch([
      [
        /titles=Gaugericus/,
        () =>
          json({
            query: {
              pages: [{ title: "Gaugericus", extract: "  Saint Gaugericus (Géry) was…  " }],
            },
          }),
      ],
      [/titles=Missing/, () => json({ query: { pages: [{ title: "Missing", missing: true }] } })],
      [/titles=Busy/, () => json({}, 503)],
    ]);
    const l = ledger();
    expect(
      await fetchIntroForArticleUrl("https://en.wikipedia.org/wiki/Gaugericus", { ledger: l }),
    ).toBe("Saint Gaugericus (Géry) was…");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://en.wikipedia.org/w/api.php?action=query&prop=extracts");
    expect(url).toContain("exintro=1");
    expect(url).toContain("explaintext=1");
    expect(
      await fetchIntroForArticleUrl("https://en.wikipedia.org/wiki/Missing", { ledger: l }),
    ).toBeNull();
    expect(l.unread).toEqual([]);
    expect(
      await fetchIntroForArticleUrl("https://en.wikipedia.org/wiki/Busy", { ledger: l }),
    ).toBeNull();
    expect(l.unread).toHaveLength(1);
    expect(await fetchIntroForArticleUrl("https://example.org/not-wikipedia")).toBeNull();
  });
});

function binding(fields: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(fields)) b[k] = { type: "literal", value: v };
  return b;
}

/**
 * A branch-3 saint (Catholic religion + feast, no P411): its status can only
 * come from the article's infobox.
 */
const EGINO = binding({
  s: `${WD}Q102290`,
  label: "Egino of Augsburg",
  religions: `${WD}Q9592`,
  feasts: "15 July",
  art: "https://en.wikipedia.org/wiki/Egino_of_Augsburg",
});
const EGINO_SUMMARY = {
  extract:
    "Egino of Augsburg was a Benedictine abbot of the monastery of Saints Ulrich and Afra in Augsburg, remembered on 15 July.",
  content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Egino_of_Augsburg" } },
};

describe("mapSourceRow — the SAINT mapper", () => {
  it("refuses, as source_read_failed, a saint whose article could not be read", async () => {
    stubFetch([
      [/rest_v1\/page\/summary\/Egino_of_Augsburg/, () => json(EGINO_SUMMARY)],
      [/action=parse/, () => json({}, 503)],
    ]);
    const mapped = await mapSourceRowDetailed(ingestorFor("SAINT")!, EGINO);
    expect(isRejection(mapped.result) && mapped.result.code).toBe("source_read_failed");
    expect(isRejection(mapped.result) && mapped.result.detail).toMatch(/article not read/);
    expect(isRememberedRejection("source_read_failed")).toBe(false);
    // The read that failed is what the ingest's outage streak counts.
    expect(mapped.unreadSources).toBe(1);
  });

  it("never publishes on the lead alone when the infobox read failed", async () => {
    // Before: a 503 on the parse call read as "no infobox", the prose rule took
    // over, and the lead's feast sentence published a day the infobox (never
    // seen) might contradict — Kolping's lead could say 4 December while his
    // infobox says 6 December.
    const saint = binding({
      s: `${WD}Q60619`,
      label: "Adolph Kolping",
      statuses: `${WD}Q2369287`,
      feasts: "4 December",
      art: "https://en.wikipedia.org/wiki/Adolph_Kolping",
    });
    stubFetch([
      [
        /rest_v1\/page\/summary\/Adolph_Kolping/,
        () =>
          json({
            extract:
              "Adolph Kolping was a German Catholic priest and the founder of the Kolping " +
              "Association. His feast day is 4 December in the Catholic calendar.",
            content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Adolph_Kolping" } },
          }),
      ],
      [/action=parse/, () => json({}, 429)],
    ]);
    const result = await mapSourceRow(ingestorFor("SAINT")!, saint);
    expect(isRejection(result) && result.code).toBe("source_read_failed");
  });

  it("keeps the entity's own verdict when the infobox was read and states no status", async () => {
    stubFetch([
      [/rest_v1\/page\/summary\/Egino_of_Augsburg/, () => json(EGINO_SUMMARY)],
      [/action=parse/, () => json({ parse: { wikitext: "Egino was an abbot." } })],
    ]);
    const result = await mapSourceRow(ingestorFor("SAINT")!, EGINO);
    expect(isRejection(result) && result.code).toBe("no_canonization_date");
  });
});

describe("runStructuredIngest — no memo for a verdict reached on a failed read", () => {
  type Row = { memoryValue: unknown; lastUsedAt: Date | null };
  type Where = {
    memoryKey?: { in?: string[]; startsWith?: string };
    lastUsedAt?: { lt: Date };
  };

  function fakePrisma() {
    const memory = new Map<string, Row>();
    const matches = (key: string, where: Where) => {
      const lastUsedAt = memory.get(key)?.lastUsedAt;
      return (
        (!where.memoryKey?.in || where.memoryKey.in.includes(key)) &&
        (!where.memoryKey?.startsWith || key.startsWith(where.memoryKey.startsWith)) &&
        (!where.lastUsedAt || (lastUsedAt != null && lastUsedAt < where.lastUsedAt.lt))
      );
    };
    const prisma = {
      adminWorkerMemory: {
        findUnique: vi.fn(
          async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) =>
            memory.get(where.memoryType_memoryKey.memoryKey) ?? null,
        ),
        upsert: vi.fn(
          async ({
            where,
            create,
          }: {
            where: { memoryType_memoryKey: { memoryKey: string } };
            create: { memoryValue: unknown };
          }) => {
            memory.set(where.memoryType_memoryKey.memoryKey, {
              memoryValue: create.memoryValue,
              lastUsedAt: new Date(),
            });
            return {};
          },
        ),
        findMany: vi.fn(async ({ where }: { where: Where }) =>
          [...memory]
            .filter(([key]) => matches(key, where))
            .map(([memoryKey, r]) => ({ memoryKey, ...r })),
        ),
        deleteMany: vi.fn(async ({ where }: { where: Where }) => {
          let count = 0;
          for (const key of [...memory.keys()]) {
            if (where.memoryKey && matches(key, where)) {
              memory.delete(key);
              count += 1;
            }
          }
          return { count };
        }),
        createMany: vi.fn(
          async ({
            data,
          }: {
            data: Array<{ memoryKey: string; memoryValue: unknown; lastUsedAt: Date }>;
          }) => {
            for (const d of data) {
              memory.set(d.memoryKey, { memoryValue: d.memoryValue, lastUsedAt: d.lastUsedAt });
            }
            return { count: data.length };
          },
        ),
        count: vi.fn(async () => 0),
      },
      publishedContent: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
      checklistItem: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "ci" })),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    };
    return { prisma: prisma as unknown as PrismaClient, memory };
  }

  it("retries the devotion whose official site did not answer, remembers the one whose site is gone", async () => {
    const devotion = (qid: string, label: string, site: string) =>
      binding({
        d: `${WD}${qid}`,
        label,
        site,
        art: `https://en.wikipedia.org/wiki/${label.replace(/ /g, "_")}`,
      });
    mockedSparql.mockResolvedValue([
      devotion("Q801", "Devotion Alpha", "https://alpha.example/"),
      devotion("Q802", "Devotion Beta", "https://beta.example/"),
    ]);
    stubFetch([
      [/alpha\.example/, () => html("", 503)],
      [/beta\.example/, () => html("", 404)],
      [/rest_v1\/page\/summary\//, () => json({ extract: "A devotion." })],
    ]);
    const { prisma, memory } = fakePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "DEVOTION", batch: 10 });

    expect(out.published).toBe(0);
    expect(out.skipReasons).toEqual({ source_read_failed: 1, narrative_too_short: 1 });
    expect(out.rejectionsRemembered).toBe(1);
    expect(memory.has(rejectionMemoKey("wikidata-devotions", "Q801"))).toBe(false);
    expect(memory.get(rejectionMemoKey("wikidata-devotions", "Q802"))?.memoryValue).toMatchObject({
      code: "narrative_too_short",
    });
  });
});
