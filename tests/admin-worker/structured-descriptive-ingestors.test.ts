/**
 * The descriptive structured ingestors — DEVOTION, MARIAN_TITLE, and
 * SPIRITUAL_PRACTICE — grow those types automatically and keylessly. These tests
 * pin their accuracy contract: the narrative is resolved from MULTIPLE sources in
 * priority order — the entity's official source FIRST and Wikipedia only as a
 * LAST resort — every source is cited for cross-reference, an entity with no
 * sourced narrative is skipped, the produced record passes the REAL content
 * schema, and a non-Catholic "practice" is never published.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
}));
vi.mock("@/lib/admin-worker/structured/document-excerpt", () => ({
  fetchDocumentExcerpt: vi.fn(),
}));

import { validatePayload } from "@/lib/checklist";
import {
  classifyDevotionType,
  classifyPracticeKind,
  ingestorFor,
} from "@/lib/admin-worker/structured/ingestors";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { fetchDocumentExcerpt } from "@/lib/admin-worker/structured/document-excerpt";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedExcerpt = vi.mocked(fetchDocumentExcerpt);

const OFFICIAL =
  "The devotion to the Sacred Heart of Jesus is one of the most widely practised " +
  "Catholic devotions, taking the physical heart of Jesus Christ as the representation " +
  "of his divine love for humanity, and is honoured especially on the First Fridays.";
const WIKI_SACRED_HEART =
  "The Sacred Heart is a devotion to the heart of Jesus as the symbol of divine love, " +
  "spread through the apparitions to Saint Margaret Mary Alacoque in the seventeenth century.";

beforeEach(() => {
  mockedSummary.mockReset();
  mockedExcerpt.mockReset();
});
afterEach(() => vi.restoreAllMocks());

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}
const mapWith = (type: string, r: SparqlBinding) =>
  ingestorFor(type)!.map(r, {} as Record<string, never>);

describe("classifyDevotionType", () => {
  it("reads the type from the source text, defaulting to Catholic devotion", () => {
    expect(classifyDevotionType("Devotion to the Sacred Heart of Jesus")).toBe(
      "Devotion to the Sacred Heart",
    );
    expect(classifyDevotionType("Eucharistic adoration and the Forty Hours")).toBe(
      "Eucharistic devotion",
    );
    expect(classifyDevotionType("Our Lady of the Rosary")).toBe("Marian devotion");
    expect(classifyDevotionType("An obscure pious practice")).toBe("Catholic devotion");
  });
});

describe("classifyPracticeKind", () => {
  it("maps recognised Catholic practices and rejects everything else", () => {
    expect(classifyPracticeKind("the practice of Lectio Divina")).toBe("lectio_divina");
    expect(classifyPracticeKind("the daily Examen of conscience")).toBe("examen");
    expect(classifyPracticeKind("praying the Stations of the Cross")).toBe("stations_of_the_cross");
    expect(classifyPracticeKind("transcendental meditation technique")).toBeNull();
  });
});

describe("DEVOTION ingestor — multi-source, official first", () => {
  it("prefers the official source over Wikipedia and cites both", async () => {
    mockedExcerpt.mockResolvedValue(OFFICIAL);
    mockedSummary.mockResolvedValue({
      extract: WIKI_SACRED_HEART,
      url: "https://en.wikipedia.org/wiki/Sacred_Heart",
    } as never);

    const entry = await mapWith(
      "DEVOTION",
      row({
        d: "http://www.wikidata.org/entity/Q827475",
        label: "Sacred Heart",
        site: "https://www.sacredheartdevotion.example/about",
        art: "https://en.wikipedia.org/wiki/Sacred_Heart",
      }),
    );

    expect(entry).not.toBeNull();
    // Narrative is the OFFICIAL source, not the Wikipedia abstract.
    expect(entry!.payload.background).toBe(OFFICIAL);
    expect(entry!.payload.devotionType).toBe("Devotion to the Sacred Heart");
    // Both the official site and Wikipedia are cited for cross-reference.
    expect(entry!.citations).toContain("https://www.sacredheartdevotion.example/about");
    expect(entry!.citations).toContain("https://en.wikipedia.org/wiki/Sacred_Heart");
    expect(entry!.citations.length).toBeGreaterThanOrEqual(2);
    expect(validatePayload("DEVOTION", entry!.payload).ok).toBe(true);
  });

  it("falls back to Wikipedia only when no official source resolves", async () => {
    mockedExcerpt.mockResolvedValue(null); // official page yields nothing
    mockedSummary.mockResolvedValue({
      extract: WIKI_SACRED_HEART,
      url: "https://en.wikipedia.org/wiki/Sacred_Heart",
    } as never);

    const entry = await mapWith(
      "DEVOTION",
      row({
        d: "http://www.wikidata.org/entity/Q827475",
        label: "Sacred Heart",
        site: "https://flaky.example",
        art: "https://en.wikipedia.org/wiki/Sacred_Heart",
      }),
    );

    expect(entry).not.toBeNull();
    expect(entry!.payload.background).toBe(WIKI_SACRED_HEART);
    expect(validatePayload("DEVOTION", entry!.payload).ok).toBe(true);
  });

  it("skips an entity whose sources yield no narrative", async () => {
    mockedExcerpt.mockResolvedValue(null);
    mockedSummary.mockResolvedValue(null);
    const entry = await mapWith(
      "DEVOTION",
      row({
        d: "http://www.wikidata.org/entity/Q1",
        label: "Some Devotion",
        art: "https://en.wikipedia.org/wiki/X",
      }),
    );
    expect(entry).toBeNull();
  });
});

describe("MARIAN_TITLE ingestor", () => {
  it("produces a schema-valid Marian title from cited sources", async () => {
    mockedExcerpt.mockResolvedValue(null);
    mockedSummary.mockResolvedValue({
      extract:
        "Our Lady of Sorrows is a title of the Blessed Virgin Mary referring to the seven " +
        "sorrows she endured during the life and Passion of her Son, commemorated on 15 September.",
      url: "https://en.wikipedia.org/wiki/Our_Lady_of_Sorrows",
    } as never);

    const entry = await mapWith(
      "MARIAN_TITLE",
      row({
        m: "http://www.wikidata.org/entity/Q1542985",
        label: "Our Lady of Sorrows",
        art: "https://en.wikipedia.org/wiki/Our_Lady_of_Sorrows",
      }),
    );

    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("our-lady-of-sorrows");
    expect(entry!.citations.length).toBeGreaterThanOrEqual(2);
    expect(validatePayload("MARIAN_TITLE", entry!.payload).ok).toBe(true);
  });
});

describe("SPIRITUAL_PRACTICE ingestor", () => {
  it("maps a recognised practice to its kind and passes the schema", async () => {
    mockedExcerpt.mockResolvedValue(null);
    mockedSummary.mockResolvedValue({
      extract:
        "Lectio Divina is a traditional monastic practice of scriptural reading, meditation, " +
        "and prayer intended to promote communion with God and to deepen knowledge of his word; " +
        "it proceeds through reading, meditation, prayer, and contemplation.",
      url: "https://en.wikipedia.org/wiki/Lectio_Divina",
    } as never);

    const entry = await mapWith(
      "SPIRITUAL_PRACTICE",
      row({
        p: "http://www.wikidata.org/entity/Q1808990",
        label: "Lectio Divina",
        art: "https://en.wikipedia.org/wiki/Lectio_Divina",
      }),
    );

    expect(entry).not.toBeNull();
    expect(entry!.payload.practiceKind).toBe("lectio_divina");
    expect(validatePayload("SPIRITUAL_PRACTICE", entry!.payload).ok).toBe(true);
  });

  it("skips a non-Catholic practice (no recognised kind)", async () => {
    mockedExcerpt.mockResolvedValue(null);
    mockedSummary.mockResolvedValue({
      extract:
        "Transcendental Meditation is a technique for avoiding distracting thoughts and " +
        "promoting a state of relaxed awareness, introduced in the mid-twentieth century by a " +
        "non-Christian movement and unrelated to Catholic prayer.",
      url: "https://en.wikipedia.org/wiki/Transcendental_Meditation",
    } as never);

    const entry = await mapWith(
      "SPIRITUAL_PRACTICE",
      row({
        p: "http://www.wikidata.org/entity/Q207179",
        label: "Transcendental Meditation",
        art: "https://en.wikipedia.org/wiki/Transcendental_Meditation",
      }),
    );
    expect(entry).toBeNull();
  });
});
