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
  isCatholicPracticeContext,
} from "@/lib/admin-worker/structured/ingestors";
import { rejectionOf } from "@/lib/admin-worker/structured/reject";
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
    expect(rejectionOf(entry)?.code).toBe("narrative_too_short");
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
    // Worth pinning precisely: this fixture is NOT stopped by the Catholicity
    // screen (its text carries no other-religion marker), it is stopped by the
    // practice-kind classifier. Before reason codes both read as "skipped".
    expect(rejectionOf(entry)?.code).toBe("unrecognized_type");
  });
});

/**
 * The Catholicity screen, pinned against text MEASURED live on 2026-09-08 —
 * the first page of the "spiritual practice" corpus (Q2270606) and the flagship
 * Catholic practices deeper in it. Paraphrases would have hidden the trap this
 * suite exists for: the practices this site most needs are precisely the ones
 * whose articles NAME the separated communions, because those communions
 * borrowed them.
 */
describe("isCatholicPracticeContext — measured Wikipedia abstracts", () => {
  const ABSTRACTS: Record<string, string> = {
    exclusivePsalmody:
      "Exclusive psalmody is the practice of singing only the biblical Psalms in congregational " +
      "singing as worship. Today it is practised by several Protestant, especially Reformed " +
      "denominations. Hymns besides the Psalms have been composed by Christians since the " +
      "earliest days of the church, but psalms were preferred by the early church. During the " +
      "Protestant Reformation, Martin Luther and many other reformers used hymns as well as " +
      "psalms, but John Calvin preferred the Psalms. Several denominations, notably the " +
      "Reformed Presbyterians, continue the practice of exclusive psalmody.",
    stations:
      "The Stations of the Cross or the Way of the Cross are any series of fourteen images " +
      "depicting Jesus Christ on the day of his crucifixion and accompanying prayers. The " +
      "objective of the stations is to help the faithful to make a spiritual pilgrimage through " +
      "contemplation of the Passion of Christ. It has become one of the most popular devotions " +
      "and the stations can be found in many Western Christian churches, including those in the " +
      "Catholic, Lutheran, Anglican and Methodist traditions.",
    adoration:
      "Eucharistic adoration is a devotional practice primarily in Western Catholicism and " +
      "Western Rite Orthodoxy, but also to a lesser extent in certain Lutheran and Anglican " +
      "traditions, in which the Blessed Sacrament is adored by the faithful.",
    lectio:
      "In Western Christianity, Lectio Divina is a traditional monastic practice of scriptural " +
      "reading, meditation and prayer intended to promote communion with God and to increase " +
      "the knowledge of God's word.",
    novena:
      "A novena is an ancient tradition of devotional praying in Christianity, consisting of " +
      "private or public prayers repeated for nine successive days or weeks.",
    pardon:
      "A pardon is a typically Breton form of pilgrimage and one of the most traditional " +
      "demonstrations of popular Catholicism in Brittany. Of very ancient origin, it is " +
      "comparable to the pattern days of pre-famine Ireland.",
    fastingInIslam:
      "Fasting in Islam, known as sawm, is the practice of abstaining from food and drink, " +
      "observed by Muslims during the month of Ramadan.",
  };

  it("REJECTS a Reformed practice whose text never says Catholic", () => {
    // Q2078967. Before this guard it passed on "church" / "Christians" alone,
    // and only `classifyPracticeKind` having no branch kept it unpublished.
    expect(isCatholicPracticeContext(ABSTRACTS.exclusivePsalmody)).toBe(false);
  });

  it("KEEPS the Catholic practices that name the other communions themselves", () => {
    // A bare Anglican/Lutheran blacklist would throw both of these away.
    expect(isCatholicPracticeContext(ABSTRACTS.stations)).toBe(true);
    expect(isCatholicPracticeContext(ABSTRACTS.adoration)).toBe(true);
  });

  it("KEEPS Catholic practices whose text never says the word Catholic", () => {
    // So the Catholic marker can never become an unconditional requirement.
    expect(isCatholicPracticeContext(ABSTRACTS.lectio)).toBe(true);
    expect(isCatholicPracticeContext(ABSTRACTS.novena)).toBe(true);
  });

  it("KEEPS a regional Catholic devotion the source calls Catholic", () => {
    // Q1024974: the Breton pardon. Measured, its article calls it "popular
    // Catholicism in Brittany" — it is a Catholic pilgrimage, not folk religion.
    expect(isCatholicPracticeContext(ABSTRACTS.pardon)).toBe(true);
  });

  it("still REJECTS another religion outright", () => {
    expect(isCatholicPracticeContext(ABSTRACTS.fastingInIslam)).toBe(false);
  });
});

describe("isCatholicPracticeContext — 'Catholicos' is not a Catholic marker", () => {
  it("does not let an Armenian/Assyrian primate's title unlock the separated-communion veto", () => {
    // The veto is waived when the text carries an explicitly Catholic marker,
    // because the flagship Catholic practices name the other communions
    // themselves. `\bcatholic` also matched "Catholicos" — the title of the
    // Armenian Apostolic and Assyrian primates — which handed that waiver to
    // exactly the texts it exists to stop.
    const armenian =
      "Blessing of water is a Christian church ceremony. In the Armenian Apostolic tradition " +
      "the Catholicos presides. The rite is also found in Anglican worship and Protestant hymnody.";
    expect(isCatholicPracticeContext(armenian)).toBe(false);
    // "Catholicism" / "Catholicity" must still read as Catholic.
    expect(
      isCatholicPracticeContext(
        "A pardon is a Breton pilgrimage and a demonstration of popular Catholicism, also " +
          "observed in some Anglican parishes.",
      ),
    ).toBe(true);
  });
});
