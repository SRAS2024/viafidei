/**
 * `StructuredIngestor.identify` is the cheap, network-free identity the
 * orchestrator uses to recognise an already-live row BEFORE it spends one or
 * two Wikipedia / official-site fetches mapping it. An ingestor without it
 * re-fetches every published row on every sweep (the documents lane was doing
 * ~100 HTTP calls a pass to publish nothing), so these tests pin two things:
 *   - EVERY registered ingestor has one;
 *   - the identity it derives is the SAME slug the mapper would publish under
 *     (a drifting slug would make the pre-filter miss and the row map anyway).
 */
import { describe, expect, it } from "vitest";

import {
  STRUCTURED_INGESTORS,
  riteCoreSlug,
  slugify,
} from "@/lib/admin-worker/structured/ingestors";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const WD = "http://www.wikidata.org/entity/";

function binding(fields: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(fields)) b[k] = { type: "literal", value: v };
  return b;
}

describe("STRUCTURED_INGESTORS — every ingestor can identify a row cheaply", () => {
  it("defines identify() on all of them", () => {
    const missing = STRUCTURED_INGESTORS.filter((i) => typeof i.identify !== "function").map(
      (i) => i.id,
    );
    expect(missing).toEqual([]);
  });

  it("has a unique id and content type per ingestor", () => {
    const ids = STRUCTURED_INGESTORS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const types = STRUCTURED_INGESTORS.map((i) => i.contentType);
    expect(new Set(types).size).toBe(types.length);
  });
});

/** Row shape (entity variable + label) each ingestor's SPARQL projects. */
const CASES: Array<{
  id: string;
  row: SparqlBinding;
  qid: string;
  slug: string;
  name: string;
}> = [
  {
    id: "wikidata-popes",
    row: binding({ pope: `${WD}Q1`, popeLabel: "Leo XIII" }),
    qid: "Q1",
    slug: "pope-leo-xiii",
    name: "Pope Leo XIII",
  },
  {
    id: "wikidata-saints",
    row: binding({ s: `${WD}Q2`, label: "Rose of Lima" }),
    qid: "Q2",
    slug: "saint-rose-of-lima",
    name: "Rose of Lima",
  },
  {
    id: "wikidata-church-documents",
    row: binding({ doc: `${WD}Q3`, label: "Rerum novarum" }),
    qid: "Q3",
    slug: "rerum-novarum",
    name: "Rerum novarum",
  },
  {
    id: "wikidata-doctors",
    row: binding({ d: `${WD}Q4`, label: "Teresa of Ávila" }),
    qid: "Q4",
    slug: `doctor-${slugify("Teresa of Ávila")}`,
    name: "Teresa of Ávila",
  },
  {
    id: "wikidata-rites",
    row: binding({ r: `${WD}Q5`, label: "Byzantine Rite" }),
    qid: "Q5",
    slug: `rite-${riteCoreSlug("Byzantine Rite")}`,
    name: "Byzantine Rite",
  },
  {
    id: "wikidata-devotions",
    row: binding({ d: `${WD}Q6`, label: "Sacred Heart of Jesus" }),
    qid: "Q6",
    slug: "sacred-heart-of-jesus",
    name: "Sacred Heart of Jesus",
  },
  {
    id: "wikidata-marian-titles",
    row: binding({ m: `${WD}Q7`, label: "Our Lady of Guadalupe" }),
    qid: "Q7",
    slug: "our-lady-of-guadalupe",
    name: "Our Lady of Guadalupe",
  },
  {
    id: "wikidata-spiritual-practices",
    row: binding({ p: `${WD}Q8`, label: "Lectio Divina" }),
    qid: "Q8",
    slug: "lectio-divina",
    name: "Lectio Divina",
  },
];

describe("identify() derives the publishable slug from the SPARQL row alone", () => {
  it("covers every registered ingestor", () => {
    expect(CASES.map((c) => c.id).sort()).toEqual(STRUCTURED_INGESTORS.map((i) => i.id).sort());
  });

  for (const c of CASES) {
    it(`${c.id}: qid + slug + name with no network`, () => {
      const ingestor = STRUCTURED_INGESTORS.find((i) => i.id === c.id)!;
      const id = ingestor.identify!(c.row);
      expect(id).toMatchObject({ qid: c.qid, slug: c.slug, name: c.name });
    });

    it(`${c.id}: returns null when the label service echoed the QID`, () => {
      const ingestor = STRUCTURED_INGESTORS.find((i) => i.id === c.id)!;
      const labelKey = c.id === "wikidata-popes" ? "popeLabel" : "label";
      const row: SparqlBinding = { ...c.row, [labelKey]: { type: "literal", value: "Q999" } };
      // A bare QID is Wikidata's "no English label" marker, never a real name —
      // identifying on it would slug thousands of rows to "q999".
      expect(ingestor.identify!(row)).toBeNull();
    });
  }
});
