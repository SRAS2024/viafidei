/**
 * The saints catalogue card shows a saint's patronage, then feast day, beneath
 * the name. The page query projects the payload away (the type is heading for
 * 10,000 rows), so those two facts come from one primary-key-bounded query that
 * projects only the JSON fields the card needs — never the whole payload.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn() },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { saintCardDetailLines } from "@/lib/content-shared/saints";
import { listSaintCardDetails } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

type Sql = { strings?: string[]; values: unknown[] };
const textOf = (sql: Sql): string => (sql.strings ?? []).join(" ? ");

const row = (over: Record<string, unknown>) => ({
  patronages: [],
  patronage: null,
  feastDay: null,
  feastMonth: null,
  feastDayOfMonth: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listSaintCardDetails", () => {
  it("projects only the card's fields for this page's ids — never the payload itself", async () => {
    queryRaw.mockResolvedValueOnce([]);
    await listSaintCardDetails(["peter", "agnes"]);

    const sql = queryRaw.mock.calls[0][0] as Sql;
    const text = textOf(sql);
    expect(text).toContain(`payload->'patronages'`);
    expect(text).toContain(`payload->>'feastDay'`);
    expect(text).toContain(`"feastMonth", "feastDayOfMonth"`);
    // Every mention of the payload is a JSON field projection.
    expect(text).not.toMatch(/\bpayload\b(?!\s*->)/);
    expect(text).toContain(`"id" = ANY(`);
    expect(text).toContain(`'SAINT'::"ChecklistContentType"`);
    expect(sql.values).toContainEqual(["peter", "agnes"]);
  });

  it("runs no query for an empty page", async () => {
    expect((await listSaintCardDetails([])).size).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("maps patronages, the legacy single patronage, and the feast", async () => {
    queryRaw.mockResolvedValueOnce([
      row({
        id: "peter",
        patronages: ["the papacy", " fishermen ", "", 7],
        feastDay: "06-29",
        feastMonth: 6,
        feastDayOfMonth: 29,
      }),
      // Indexed columns never backfilled: the stored "MM-DD" still formats.
      row({ id: "nicholas", patronages: null, patronage: "sailors", feastDay: "12-06" }),
      // A movable feast stored as prose passes through exactly as written.
      row({ id: "movable", feastDay: "The Tuesday after Pentecost" }),
      row({ id: "unrecorded", patronage: "  " }),
    ]);

    const details = await listSaintCardDetails(["peter", "nicholas", "movable", "unrecorded"]);

    expect(details.get("peter")).toEqual({
      patronages: ["the papacy", "fishermen"],
      feast: "June 29",
    });
    expect(details.get("nicholas")).toEqual({ patronages: ["sailors"], feast: "December 6" });
    expect(details.get("movable")).toEqual({
      patronages: [],
      feast: "The Tuesday after Pentecost",
    });
    expect(details.get("unrecorded")).toEqual({ patronages: [], feast: null });
  });
});

describe("saintCardDetailLines", () => {
  const t = createTranslator("en");

  it("reads patronage, then feast day", () => {
    expect(
      saintCardDetailLines(
        { patronages: ["the papacy", "fishermen", "Rome"], feast: "June 29" },
        t,
      ),
    ).toEqual(["Patron of the papacy, fishermen, Rome", "Feast day: June 29"]);
  });

  it("leaves out whichever fact is not recorded", () => {
    expect(saintCardDetailLines({ patronages: [], feast: "January 21" }, t)).toEqual([
      "Feast day: January 21",
    ]);
    expect(saintCardDetailLines({ patronages: ["Ireland"], feast: null }, t)).toEqual([
      "Patron of Ireland",
    ]);
    expect(saintCardDetailLines({ patronages: [], feast: null }, t)).toEqual([]);
    expect(saintCardDetailLines(undefined, t)).toEqual([]);
  });
});
