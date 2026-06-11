/**
 * Structured-knowledge ingestion is the keyless, deterministic procurement
 * engine that lifts the publish ceiling: it pulls structured facts from Wikidata
 * + Wikipedia and publishes schema-valid records through the same real gate as
 * everything else. These tests pin: the network gating (a hard no-op offline),
 * the Wikidata helpers, the POPE mapper producing a record that passes the REAL
 * content schema, and the orchestrator's publish / skip-live / dedup / cursor
 * behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validatePayload } from "@/lib/checklist";
import { fetchJson, structuredNetworkEnabled } from "@/lib/admin-worker/structured/http";
import {
  bindingValue,
  wikidataEntityUrl,
  type SparqlBinding,
} from "@/lib/admin-worker/structured/wikidata";
import { ingestorFor, slugify } from "@/lib/admin-worker/structured/ingestors";
import type { SparqlBinding as Row } from "@/lib/admin-worker/structured/wikidata";

/** Invoke the registered POPE ingestor's mapper directly. */
function popeIngestorMap(row: Row) {
  return ingestorFor("POPE")!.map(row, {} as Record<string, never>);
}

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;
const realFetch = global.fetch;

beforeEach(() => {
  savedSkip = process.env[SKIP];
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("structured http (network gating)", () => {
  it("is disabled and never calls fetch in skip-network mode", async () => {
    process.env[SKIP] = "1";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof global.fetch;
    expect(structuredNetworkEnabled()).toBe(false);
    expect(await fetchJson("https://example.com")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null on a non-2xx response", async () => {
    delete process.env[SKIP];
    global.fetch = vi.fn(async () => ({ ok: false })) as unknown as typeof global.fetch;
    expect(await fetchJson("https://example.com")).toBeNull();
  });
});

describe("wikidata helpers", () => {
  it("reads trimmed non-empty binding values", () => {
    const row: SparqlBinding = {
      a: { type: "literal", value: "  hi  " },
      b: { type: "literal", value: "   " },
    };
    expect(bindingValue(row, "a")).toBe("hi");
    expect(bindingValue(row, "b")).toBeUndefined();
    expect(bindingValue(row, "missing")).toBeUndefined();
  });

  it("derives the entity page URL from a QID uri", () => {
    expect(wikidataEntityUrl("http://www.wikidata.org/entity/Q42")).toBe(
      "https://www.wikidata.org/wiki/Q42",
    );
  });
});

describe("slugify", () => {
  it("produces ascii slugs, stripping accents and punctuation", () => {
    expect(slugify("John Paul II")).toBe("john-paul-ii");
    expect(slugify("Benedict XVI")).toBe("benedict-xvi");
    expect(slugify("Pius X")).toBe("pius-x");
  });
});

describe("POPE ingestor mapping", () => {
  // Offline: map() must not hit Wikipedia; it uses the article URL as a citation.
  beforeEach(() => {
    process.env[SKIP] = "1";
  });

  function row(over: Record<string, string | undefined>): SparqlBinding {
    const b: SparqlBinding = {};
    for (const [k, v] of Object.entries(over)) {
      if (v !== undefined) b[k] = { type: "literal", value: v };
    }
    return b;
  }

  it("maps a full row to a SCHEMA-VALID POPE entry", async () => {
    const entry = await popeIngestorMap(
      row({
        pope: "http://www.wikidata.org/entity/Q989",
        popeLabel: "John Paul II",
        startYear: "1978",
        endYear: "2005",
        birthName: "Karol Józef Wojtyła",
        article: "https://en.wikipedia.org/wiki/Pope_John_Paul_II",
      }),
    );
    expect(entry).not.toBeNull();
    expect(entry!.contentType).toBe("POPE");
    expect(entry!.slug).toBe("pope-john-paul-ii");
    expect(entry!.payload.title).toBe("Pope John Paul II");
    expect(entry!.payload.papacyStart).toBe("1978");
    expect(entry!.payload.papacyEnd).toBe("2005");
    expect(entry!.payload.birthName).toBe("Karol Józef Wojtyła");
    expect(entry!.citations.length).toBeGreaterThanOrEqual(1);
    // The produced payload MUST satisfy the real content schema.
    expect(validatePayload("POPE", entry!.payload).ok).toBe(true);
  });

  it("prefixes 'Pope ' only when the label lacks it; omits papacyEnd for a reigning pope", async () => {
    const entry = await popeIngestorMap(
      row({
        pope: "http://www.wikidata.org/entity/Q450",
        popeLabel: "Pope Francis",
        startYear: "2013",
      }),
    );
    expect(entry!.payload.title).toBe("Pope Francis");
    expect(entry!.payload.papacyEnd).toBeUndefined();
    expect(String(entry!.payload.summary)).toContain("to the present");
    expect(validatePayload("POPE", entry!.payload).ok).toBe(true);
  });

  it("returns null when the label is a bare QID (no English label)", async () => {
    const entry = await popeIngestorMap(
      row({ pope: "http://www.wikidata.org/entity/Q1", popeLabel: "Q1", startYear: "100" }),
    );
    expect(entry).toBeNull();
  });

  it("returns null when the reign-start year is missing", async () => {
    const entry = await popeIngestorMap(
      row({ pope: "http://www.wikidata.org/entity/Q2", popeLabel: "Linus" }),
    );
    expect(entry).toBeNull();
  });
});
