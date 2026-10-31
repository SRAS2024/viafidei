/**
 * The one-off saint cleanup (scripts/booster/saint-cleanup.ts). Pins:
 *   - a dry run decides everything and writes NOTHING (no row, no log);
 *   - the Orthodox-only figures (Severus of Antioch, Empress Theodora) are
 *     unpublished, never deleted, with a reason; a row whose ARTICLE alone
 *     names another communion is only listed as a suspect unless asked;
 *   - "venerable" rows from the Orthodox honorific Q12774503 are re-statused
 *     from the article (Joseph Marello → Saint, Giovanni Battista de' Rossi
 *     even without a Catholic religion on Wikidata, Bellinus of Padua from
 *     the older `venerated` parameter), unpublished only on positive evidence
 *     that another communion venerates them (Gregorio Aglipay), and listed for
 *     review when the sources are silent (Íñigo of Oña);
 *   - a CONFIRMED Venerable keeps no feast, but a row Wikidata or its article
 *     puts past Venerable (Richard Henkes, Nikola Tavelić) keeps it and is
 *     listed for review;
 *   - an article that could not be read never leads to a change;
 *   - published feasts that contradict the article infobox are LISTED only;
 *   - with --apply every write goes through the protected / unpublish paths
 *     and leaves an AdminWorkerLog row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/structured/wikipedia-infobox", () => ({
  fetchArticleInfobox: vi.fn(async (_url: string): Promise<Record<string, string>> => ({})),
}));
vi.mock("@/lib/admin-worker/content-protection", () => ({
  applyProtectedContentUpdate: vi.fn(async () => ({
    applied: true,
    kind: "replace",
    reason: "applied",
    versionId: "v1",
  })),
}));
vi.mock("@/lib/admin-worker/human-review", () => ({
  fileHumanReview: vi.fn(async () => ({ id: "hr1" })),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { runSaintCleanup } from "@/lib/admin-worker/structured/saint-cleanup";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { fetchArticleInfobox } from "@/lib/admin-worker/structured/wikipedia-infobox";
import { applyProtectedContentUpdate } from "@/lib/admin-worker/content-protection";
import { fileHumanReview } from "@/lib/admin-worker/human-review";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";

const mockedSparql = vi.mocked(runSparql);
const mockedInfobox = vi.mocked(fetchArticleInfobox);
const mockedUpdate = vi.mocked(applyProtectedContentUpdate);
const mockedReview = vi.mocked(fileHumanReview);
const mockedLog = vi.mocked(writeAdminWorkerLog);

const WD = "http://www.wikidata.org/entity/";
const wiki = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

interface Row {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown>;
  sourceRef: string | null;
}

function saint(
  id: string,
  qid: string,
  name: string,
  over: Record<string, unknown> = {},
  title = name,
): Row {
  return {
    id,
    slug: `saint-${id}`,
    title,
    subtitle: null,
    sourceRef: `https://www.wikidata.org/wiki/${qid}`,
    payload: {
      slug: `saint-${id}`,
      canonicalName: name,
      feastDay: "05-30",
      feastMonth: 5,
      feastDayOfMonth: 30,
      biography: `${name} was a Catholic priest.`.padEnd(120, " "),
      saintType: "other",
      canonizationStatus: "canonized",
      citations: [`https://www.wikidata.org/wiki/${qid}`, wiki(name.replace(/\s+/g, "_"))],
      ...over,
    },
  };
}

function facts(qid: string, label: string, over: Record<string, string> = {}): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries({ s: `${WD}${qid}`, label, ...over })) {
    b[k] = { type: "literal", value: v };
  }
  return b;
}

const VENERABLE = { canonizationStatus: "venerable" };
const ROWS: Row[] = [
  saint("severus", "Q729105", "Severus of Antioch"),
  saint("theodora", "Q204843", "Theodora"),
  saint("marello", "Q1353091", "Joseph Marello", VENERABLE),
  saint("rossi", "Q459394", "Giovanni Battista de Rossi", {
    ...VENERABLE,
    feastDay: "05-23",
    feastMonth: 5,
    feastDayOfMonth: 23,
  }),
  saint("aglipay", "Q981953", "Gregorio Aglipay", VENERABLE),
  saint("paisius", "Q5000003", "Paisius Velichkovsky", VENERABLE),
  saint(
    "sheen",
    "Q463048",
    "Fulton J. Sheen",
    { ...VENERABLE, feastDay: "12-09", feastMonth: 12, feastDayOfMonth: 9 },
    "Venerable Fulton J. Sheen",
  ),
  saint(
    "henkes",
    "Q71226",
    "Richard Henkes",
    { ...VENERABLE, feastDay: "02-22", feastMonth: 2, feastDayOfMonth: 22 },
    "Venerable Richard Henkes",
  ),
  saint(
    "lira",
    "Q9034167",
    "Moises Lira Serafin",
    { ...VENERABLE, feastDay: "06-25", feastMonth: 6, feastDayOfMonth: 25 },
    "Venerable Moises Lira Serafin",
  ),
  saint(
    "tavelic",
    "Q48252",
    "Nikola Tavelic",
    { ...VENERABLE, feastDay: "11-14", feastMonth: 11, feastDayOfMonth: 14 },
    "Venerable Nikola Tavelic",
  ),
  saint("kolping", "Q60619", "Adolph Kolping", {
    canonizationStatus: "beatified",
    feastDay: "12-04",
    feastMonth: 12,
    feastDayOfMonth: 4,
  }),
  saint("rose", "Q170145", "Rose of Lima", {
    feastDay: "08-23",
    feastMonth: 8,
    feastDayOfMonth: 23,
  }),
  saint("gaianus", "Q5000001", "Gaianus", {}, "Saint Gaianus"),
  saint("menas", "Q5000002", "Menas of Samnium", {}, "Saint Menas of Samnium"),
];

const FACTS: SparqlBinding[] = [
  facts("Q729105", "Severus of Antioch", { statuses: `${WD}Q43115`, religions: `${WD}Q1764554` }),
  facts("Q204843", "Theodora", { statuses: `${WD}Q43115`, religions: `${WD}Q183091` }),
  facts("Q1353091", "Joseph Marello", {
    statuses: `${WD}Q12774503`,
    religions: `${WD}Q9592`,
    positions: `${WD}Q29182`,
  }),
  // No religion at all on Wikidata: "proven non-Catholic" by the honorific.
  facts("Q459394", "Giovanni Battista de Rossi", { statuses: `${WD}Q12774503` }),
  facts("Q981953", "Gregorio Aglipay", {
    statuses: `${WD}Q12774503`,
    religions: `${WD}Q9592||${WD}Q771902`,
  }),
  facts("Q5000003", "Paisius Velichkovsky", { statuses: `${WD}Q12774503` }),
  facts("Q463048", "Fulton J. Sheen", { statuses: `${WD}Q51619`, religions: `${WD}Q9592` }),
  // Wikidata lags: still "Venerable" after the 2019 beatification.
  facts("Q71226", "Richard Henkes", { statuses: `${WD}Q51619`, religions: `${WD}Q9592` }),
  facts("Q9034167", "Moises Lira Serafin", { statuses: `${WD}Q51619`, religions: `${WD}Q9592` }),
  // "Venerable" outranks the generic saint item: resolves to venerable.
  facts("Q48252", "Nikola Tavelic", {
    statuses: `${WD}Q51619||${WD}Q43115`,
    religions: `${WD}Q9592`,
  }),
  facts("Q60619", "Adolph Kolping", { statuses: `${WD}Q2369287` }),
  facts("Q170145", "Rose of Lima", { statuses: `${WD}Q3464126` }),
  // Generic "saint" with no religion: the article decides who venerates them.
  facts("Q5000001", "Gaianus", { statuses: `${WD}Q43115` }),
  facts("Q5000002", "Menas of Samnium", { statuses: `${WD}Q43115` }),
];

const INFOBOXES: Record<string, Record<string, string>> = {
  [wiki("Joseph_Marello")]: {
    venerated_in: "Catholic Church",
    beatified_date: "26 September 1993",
    canonized_date: "25 November 2001",
    feast_day: "30 May",
  },
  [wiki("Giovanni_Battista_de_Rossi")]: {
    venerated_in: "Catholic Church",
    canonized_date: "8 December 1881",
    feast_day: "23 May",
  },
  // The real article fills `venerated`, not `venerated_in`.
  [wiki("Gregorio_Aglipay")]: {
    title: "First Supreme Bishop of the Philippine Independent Church",
    venerated: "The Episcopal Church (Saint on trial use only); Philippine Independent Church",
  },
  [wiki("Paisius_Velichkovsky")]: {
    venerated_in: "Eastern Orthodox Church",
    canonized_date: "1988",
  },
  [wiki("Richard_Henkes")]: { beatified_date: "15 September 2019", feast_day: "22 February" },
  [wiki("Nikola_Tavelic")]: { canonized_date: "21 June 1970", feast_day: "14 November" },
  // Beatified in 2014; the infobox says so only through its honorific.
  [wiki("Moises_Lira_Serafin")]: {
    honorific_prefix: "Blessed",
    venerated_in: "Catholic Church",
    feast_day: "25 June",
  },
  [wiki("Adolph_Kolping")]: { feast_day: "6 December", beatified_date: "1991" },
  [wiki("Rose_of_Lima")]: { feast_day: "23 August" },
  [wiki("Gaianus")]: { venerated_in: "Eastern Orthodox Church", feast_day: "30 May" },
  [wiki("Menas_of_Samnium")]: {
    venerated_in: "Catholic Church; Eastern Orthodox Church",
    feast_day: "30 May",
  },
};

/**
 * `findMany` is the run's opening snapshot; `findUnique` is the row as it
 * stands when --apply writes it (`current` overrides it per row id, to stage
 * what the live worker changed in between).
 */
function makePrisma(
  rows: Row[] = ROWS,
  current: Record<string, Partial<Row> & { isPublished?: boolean }> = {},
) {
  const update = vi.fn(async () => ({}));
  const findUnique = vi.fn(async (args: { where: { id: string } }) => {
    const row = rows.find((r) => r.id === args.where.id);
    if (!row) return null;
    return { ...row, isPublished: true, ...current[row.id] };
  });
  const prisma = {
    publishedContent: {
      findMany: vi.fn(async () => rows),
      findUnique,
      update,
    },
  } as unknown as PrismaClient;
  return { prisma, update, findUnique };
}

beforeEach(() => {
  mockedSparql.mockReset();
  mockedSparql.mockResolvedValue(FACTS);
  mockedInfobox.mockReset();
  mockedInfobox.mockImplementation(async (url: string) => INFOBOXES[url] ?? {});
  mockedUpdate.mockClear();
  mockedReview.mockClear();
  mockedLog.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("saint cleanup — dry run", () => {
  it("decides every change and writes nothing", async () => {
    const { prisma, update } = makePrisma();
    const report = await runSaintCleanup(prisma);

    expect(report.dryRun).toBe(true);
    const bySlug = new Map(report.actions.map((a) => [a.slug, a]));

    // 1. Orthodox-only: the two confirmed figures. The row whose ARTICLE alone
    //    names the Orthodox Church is a suspect, listed and left alone; the
    //    row venerated by BOTH churches is not even that.
    expect(bySlug.get("saint-severus")).toMatchObject({ kind: "unpublish", category: "orthodox" });
    expect(bySlug.get("saint-theodora")).toMatchObject({ kind: "unpublish", category: "orthodox" });
    expect(bySlug.has("saint-gaianus")).toBe(false);
    expect(report.suspects).toEqual([
      expect.objectContaining({
        slug: "saint-gaianus",
        venerated: "Eastern Orthodox Church",
        actioned: false,
      }),
    ]);
    expect(bySlug.has("saint-menas")).toBe(false);

    // 2. Orthodox-honorific venerables: Marello is a canonized saint per his
    //    article; so is de' Rossi, although Wikidata gives him no religion (the
    //    honorific alone must not unpublish him); Aglipay has no Catholic stage
    //    anywhere, and Paisius's article names only the Orthodox Church.
    expect(bySlug.get("saint-marello")).toMatchObject({
      kind: "update",
      category: "restatus",
      changes: {
        canonizationStatus: ["venerable", "canonized"],
        title: ["Joseph Marello", "Saint Joseph Marello"],
        saintType: ["other", "bishop"],
      },
    });
    expect(bySlug.get("saint-rossi")).toMatchObject({
      kind: "update",
      category: "restatus",
      changes: { canonizationStatus: ["venerable", "canonized"] },
    });
    expect(bySlug.get("saint-aglipay")).toMatchObject({ kind: "unpublish", category: "restatus" });
    expect(bySlug.get("saint-paisius")).toMatchObject({ kind: "unpublish", category: "restatus" });

    // 3. A confirmed Venerable loses the feast; Henkes (beatified 2019, still
    //    "Venerable" on Wikidata) and Tavelić (canonized 1970) keep theirs and
    //    are listed for review.
    expect(bySlug.get("saint-sheen")).toMatchObject({
      kind: "update",
      category: "feastless",
      changes: { feastDay: ["12-09", null] },
    });
    expect(bySlug.has("saint-henkes")).toBe(false);
    expect(bySlug.has("saint-tavelic")).toBe(false);
    expect(bySlug.has("saint-lira")).toBe(false);
    expect(report.stageReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "saint-henkes",
          published: "venerable",
          wikidata: "venerable",
          article: "beatified",
        }),
        expect.objectContaining({ slug: "saint-tavelic", article: "canonized" }),
        expect.objectContaining({ slug: "saint-lira", article: "beatified" }),
      ]),
    );

    // 4. The contradicting feast is LISTED; the consistent ones are not.
    expect(report.feastContradictions).toEqual([
      expect.objectContaining({
        slug: "saint-kolping",
        publishedFeast: "12-04",
        infoboxFeast: "12-06",
        kind: "contradicted",
      }),
    ]);
    expect(bySlug.has("saint-rose")).toBe(false);

    // Nothing written, nothing logged.
    expect(report.actions.every((a) => a.applied === null)).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedReview).not.toHaveBeenCalled();
    expect(mockedLog).not.toHaveBeenCalled();
  });

  it("runs only the parts asked for, and never strips a feast the re-status still owes", async () => {
    const { prisma } = makePrisma();
    const report = await runSaintCleanup(prisma, { categories: new Set(["feastless"]) });
    // Marello, de' Rossi, Aglipay and Paisius are "venerable" only through the
    // Orthodox honorific: without the re-status step their feast is left alone.
    expect(report.actions.map((a) => a.slug)).toEqual(["saint-sheen"]);
    expect(report.feastContradictions).toEqual([]);
    expect(report.suspects).toEqual([]);
    // Only the articles of the feastless candidates were read.
    const read = mockedInfobox.mock.calls.map((c) => c[0]).sort();
    expect(read).toEqual([
      wiki("Fulton_J._Sheen"),
      wiki("Moises_Lira_Serafin"),
      wiki("Nikola_Tavelic"),
      wiki("Richard_Henkes"),
    ]);
  });

  it("keeps the feast when Wikidata itself records a later stage", async () => {
    const { prisma } = makePrisma([
      saint(
        "olivelli",
        "Q3984333",
        "Teresio Olivelli",
        { ...VENERABLE, feastDay: "01-17", feastMonth: 1, feastDayOfMonth: 17 },
        "Venerable Teresio Olivelli",
      ),
    ]);
    mockedSparql.mockResolvedValue([
      facts("Q3984333", "Teresio Olivelli", { statuses: `${WD}Q2369287`, religions: `${WD}Q9592` }),
    ]);
    const report = await runSaintCleanup(prisma, { categories: new Set(["feastless"]) });
    expect(report.actions).toEqual([]);
    expect(report.stageReview).toEqual([
      expect.objectContaining({ slug: "saint-olivelli", wikidata: "beatified" }),
    ]);
  });

  it("changes nothing on an article that could not be read", async () => {
    // A 429 / timeout: the helper answers {} and records the read as unread.
    mockedInfobox.mockImplementation(async (url: string, opts) => {
      opts?.ledger?.unread.push(url);
      return {};
    });
    const { prisma } = makePrisma(
      ROWS.filter((r) => ["marello", "aglipay", "sheen", "gaianus"].includes(r.id)),
    );
    const report = await runSaintCleanup(prisma);
    // Never unpublished or stripped on a read that proved nothing.
    expect(report.actions).toEqual([]);
    expect(report.suspects).toEqual([]);
    expect(report.feastContradictions).toEqual([]);
    const unread = report.errors.filter((e) => /could not be read/.test(e)).join(" ");
    for (const slug of ["saint-marello", "saint-aglipay", "saint-sheen", "saint-gaianus"]) {
      expect(unread).toContain(slug);
    }
  });

  it("never strips a feast when the Wikidata record could not be read", async () => {
    mockedSparql.mockResolvedValue(null);
    const { prisma } = makePrisma(ROWS.filter((r) => r.id === "sheen"));
    const report = await runSaintCleanup(prisma, { categories: new Set(["feastless"]) });
    expect(report.actions).toEqual([]);
    expect(report.errors.join(" ")).toMatch(/Wikidata facts unavailable/);
  });

  it("reads the older `venerated` parameter, and reviews a row whose sources are silent", async () => {
    const { prisma } = makePrisma([
      saint("bellinus", "Q3637802", "Bellinus of Padua", VENERABLE),
      saint("inigo", "Q3821148", "Inigo of Ona", VENERABLE),
    ]);
    mockedSparql.mockResolvedValue([
      facts("Q3637802", "Bellinus of Padua", {
        statuses: `${WD}Q12774503`,
        religions: `${WD}Q9592`,
      }),
      facts("Q3821148", "Inigo of Ona", { statuses: `${WD}Q12774503`, religions: `${WD}Q9592` }),
    ]);
    mockedInfobox.mockImplementation(async (url: string) =>
      url === wiki("Bellinus_of_Padua")
        ? {
            honorific_prefix: "Saint",
            venerated: "Roman Catholic Church",
            feast_day: "26 November",
          }
        : {},
    );
    const report = await runSaintCleanup(prisma, { categories: new Set(["restatus"]) });
    expect(report.actions).toEqual([
      expect.objectContaining({
        slug: "saint-bellinus",
        kind: "update",
        changes: expect.objectContaining({ canonizationStatus: ["venerable", "canonized"] }),
      }),
    ]);
    // Íñigo of Oña (canonized 1259) has no infobox: absence of evidence is
    // not evidence, so he is listed, never unpublished.
    expect(report.stageReview).toEqual([
      expect.objectContaining({ slug: "saint-inigo", wikidata: null, article: null }),
    ]);
  });

  it("strips a feast on a stage only the article states (Wikidata proves none)", async () => {
    const holzhauser = saint(
      "holzhauser",
      "Q89846",
      "Bartholomew Holzhauser",
      { ...VENERABLE, feastDay: "05-20", feastMonth: 5, feastDayOfMonth: 20 },
      "Venerable Bartholomew Holzhauser",
    );
    const silent = saint(
      "silent",
      "Q5000004",
      "Silent Venerable",
      { ...VENERABLE, feastDay: "06-01", feastMonth: 6, feastDayOfMonth: 1 },
      "Venerable Silent Venerable",
    );
    const { prisma } = makePrisma([holzhauser, silent]);
    mockedSparql.mockResolvedValue([
      facts("Q89846", "Bartholomew Holzhauser", { religions: `${WD}Q9592` }),
      facts("Q5000004", "Silent Venerable", { religions: `${WD}Q9592` }),
    ]);
    mockedInfobox.mockImplementation(async (url: string) =>
      url === wiki("Bartholomew_Holzhauser")
        ? { honorific_prefix: "Venerable", venerated_in: "Roman Catholic Church" }
        : { feast_day: "1 June" },
    );
    const report = await runSaintCleanup(prisma, { categories: new Set(["feastless"]) });
    expect(report.actions).toEqual([
      expect.objectContaining({ slug: "saint-holzhauser", category: "feastless" }),
    ]);
    expect(report.stageReview).toEqual([
      expect.objectContaining({ slug: "saint-silent", wikidata: null }),
    ]);
  });

  it("never strips the feast of a row whose stage only its own payload claims", async () => {
    // No Wikidata record (a web-pipeline row) and no article: nothing confirms
    // "venerable", so the feast stays and the row is listed for review.
    const web: Row = {
      ...saint("webven", "Q1", "Web Venerable", {
        ...VENERABLE,
        feastDay: "03-01",
        feastMonth: 3,
        feastDayOfMonth: 1,
        citations: ["https://example.org/a", "https://example.org/b"],
      }),
      sourceRef: null,
    };
    const { prisma } = makePrisma([web]);
    mockedSparql.mockResolvedValue([]);
    const report = await runSaintCleanup(prisma, { categories: new Set(["feastless"]) });
    expect(report.actions).toEqual([]);
    expect(report.stageReview).toEqual([
      expect.objectContaining({ slug: "saint-webven", wikidata: null, articleUrl: null }),
    ]);
  });

  it("re-statuses only where the article agrees with Wikidata's Catholic stage", async () => {
    // An honorific row Wikidata also calls "Catholic saint", whose article
    // records only a beatification: neither source is trusted over the other.
    const { prisma } = makePrisma([saint("pryjma", "Q2042224", "Volodymyr Pryjma", VENERABLE)]);
    mockedSparql.mockResolvedValue([
      facts("Q2042224", "Volodymyr Pryjma", {
        statuses: `${WD}Q12774503||${WD}Q3464126`,
        religions: `${WD}Q9592`,
      }),
    ]);
    mockedInfobox.mockResolvedValue({ beatified_date: "27 June 2001", feast_day: "27 June" });
    const report = await runSaintCleanup(prisma, { categories: new Set(["restatus"]) });
    expect(report.actions).toEqual([]);
    expect(report.stageReview).toEqual([
      expect.objectContaining({
        slug: "saint-pryjma",
        wikidata: "canonized",
        article: "beatified",
      }),
    ]);
  });
});

describe("saint cleanup — --apply", () => {
  it("writes every change through the protected and unpublish paths, with logs", async () => {
    const { prisma, update } = makePrisma();
    const report = await runSaintCleanup(prisma, { apply: true });

    // Unpublish: flag only (never delete), a WARN log and a review row each.
    const unpublished = (update.mock.calls as unknown as Array<[{ where: { id: string } }]>).map(
      (c) => c[0].where.id,
    );
    expect(unpublished.sort()).toEqual(["aglipay", "paisius", "severus", "theodora"]);
    for (const call of update.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>) {
      expect(call[0].data).toMatchObject({ isPublished: false });
      expect(Object.keys(call[0].data).sort()).toEqual(["isPublished", "unpublishedAt"]);
    }
    expect(mockedReview).toHaveBeenCalledTimes(4);
    expect(
      (prisma as unknown as { publishedContent: Record<string, unknown> }).publishedContent,
    ).not.toHaveProperty("delete");

    // Re-status + feast removal through the versioned, reversible gate.
    const calls = mockedUpdate.mock.calls.map((c) => c[1]);
    const marello = calls.find((c) => c.contentId === "marello")!;
    expect(marello.proposedPayload).toMatchObject({
      canonizationStatus: "canonized",
      title: "Saint Joseph Marello",
      saintType: "bishop",
      feastDay: "05-30",
    });
    expect(marello.proposedTitle).toBe("Saint Joseph Marello");
    expect(marello.allowReplace).toBe(true);
    const sheen = calls.find((c) => c.contentId === "sheen")!;
    expect(sheen.proposedPayload).not.toHaveProperty("feastDay");
    expect(sheen.proposedPayload).not.toHaveProperty("feastMonth");
    expect(sheen.proposedPayload).not.toHaveProperty("feastDayOfMonth");
    expect(sheen.proposedSubtitle).not.toMatch(/feast/i);
    expect(sheen.reason).toMatch(/no liturgical feast/);
    // The rows under review are not touched.
    expect(calls.some((c) => c.contentId === "henkes" || c.contentId === "tavelic")).toBe(false);

    // A log row per change + the summary.
    const events = mockedLog.mock.calls.map((c) => c[1].eventName);
    expect(events.filter((e) => e === "structured_saint_unpublished")).toHaveLength(4);
    expect(events.filter((e) => e === "saint_cleanup_update")).toHaveLength(3);
    expect(events.filter((e) => e === "booster_saint_cleanup")).toHaveLength(1);
    expect(report.actions.every((a) => a.applied === true)).toBe(true);
  });

  it("writes each row as it stands NOW, and leaves one the worker changed since", async () => {
    const marello = ROWS.find((r) => r.id === "marello")!;
    const sheen = ROWS.find((r) => r.id === "sheen")!;
    const { prisma, update, findUnique } = makePrisma(ROWS, {
      // The repair lane already stripped Sheen's feast while the audit ran.
      sheen: {
        payload: { ...sheen.payload, feastDay: undefined, feastMonth: undefined },
      },
      // A translation landed on Marello's row meanwhile: it must survive.
      marello: { payload: { ...marello.payload, translations: { it: "Giuseppe Marello" } } },
      // Someone unpublished Theodora by hand.
      theodora: { isPublished: false },
      // The repair lane re-statused de' Rossi to canonized already.
      rossi: {
        payload: {
          ...ROWS.find((r) => r.id === "rossi")!.payload,
          canonizationStatus: "canonized",
        },
      },
    });

    const report = await runSaintCleanup(prisma, { apply: true });
    const bySlug = new Map(report.actions.map((a) => [a.slug, a]));

    // Every action re-read its row first.
    expect(findUnique).toHaveBeenCalledTimes(report.actions.length);
    // Applied on the fresh row: the translation is kept.
    const calls = mockedUpdate.mock.calls.map((c) => c[1]);
    expect(calls.find((c) => c.contentId === "marello")!.proposedPayload).toMatchObject({
      canonizationStatus: "canonized",
      translations: { it: "Giuseppe Marello" },
    });
    // Left alone, with the reason, when the decision no longer holds.
    for (const slug of ["saint-sheen", "saint-rossi", "saint-theodora"]) {
      expect(bySlug.get(slug)).toMatchObject({ applied: false });
      expect(bySlug.get(slug)!.error).toMatch(/left unchanged/);
    }
    expect(bySlug.get("saint-sheen")!.error).toMatch(/feastDay changed/);
    expect(bySlug.get("saint-rossi")!.error).toMatch(/stage is now "canonized"/);
    expect(bySlug.get("saint-theodora")!.error).toMatch(/no longer published/);
    expect(calls.some((c) => ["sheen", "rossi"].includes(c.contentId))).toBe(false);
    const unpublished = (update.mock.calls as unknown as Array<[{ where: { id: string } }]>).map(
      (c) => c[0].where.id,
    );
    expect(unpublished).not.toContain("theodora");
    expect(unpublished).toContain("severus");
  });

  it("unpublishes the suspects only when asked", async () => {
    const { prisma, update } = makePrisma(ROWS.filter((r) => r.id === "gaianus"));
    const report = await runSaintCleanup(prisma, { apply: true, unpublishArticleSuspects: true });
    expect(report.suspects).toEqual([expect.objectContaining({ actioned: true })]);
    expect(report.actions).toEqual([
      expect.objectContaining({ slug: "saint-gaianus", kind: "unpublish", applied: true }),
    ]);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
