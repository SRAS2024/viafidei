/**
 * Keyless structured-data extraction toolkit. These pin the JSON-LD /
 * OpenGraph / microdata / meta parsers and the normalised StructuredFacts they
 * distil, plus the strict no-op behaviour on pages with no structured data (so
 * folding it into extraction never changes the bare-HTML path).
 */
import { describe, expect, it } from "vitest";

import {
  extractDefinitionFacts,
  extractJsonLd,
  extractMetaTags,
  extractMicrodata,
  extractOpenGraph,
  extractStructuredData,
  hasStructuredFacts,
  structuredFactsToText,
} from "@/lib/admin-worker/structured-data-extractors";

describe("extractJsonLd", () => {
  it("parses a schema.org block and unwraps @graph + arrays", () => {
    const html = `
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"Person","name":"St. Thomas Aquinas","birthDate":"1225-01-01","deathDate":"1274-03-07"}
        ]}
      </script>`;
    const nodes = extractJsonLd(html) as Array<Record<string, unknown>>;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe("St. Thomas Aquinas");
  });

  it("tolerates trailing commas and ignores malformed blocks", () => {
    const html = `
      <script type="application/ld+json">{"@type":"Article","headline":"X",}</script>
      <script type="application/ld+json">{ not json </script>`;
    const nodes = extractJsonLd(html) as Array<Record<string, unknown>>;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].headline).toBe("X");
  });
});

describe("extractOpenGraph + extractMetaTags", () => {
  it("reads og:* and article:* properties", () => {
    const html = `
      <meta property="og:title" content="Litany of Humility" />
      <meta property="og:type" content="article" />
      <meta property="article:published_time" content="2020-05-01T10:00:00Z" />`;
    const og = extractOpenGraph(html);
    expect(og["og:title"]).toBe("Litany of Humility");
    expect(og["og:type"]).toBe("article");
    expect(og["article:published_time"]).toContain("2020-05-01");
  });

  it("reads description, author, and Dublin Core meta", () => {
    const html = `
      <meta name="description" content="A prayer of humility." />
      <meta name="author" content="USCCB" />
      <meta name="DC.date" content="1999-12-31" />`;
    const meta = extractMetaTags(html);
    expect(meta["description"]).toBe("A prayer of humility.");
    expect(meta["author"]).toBe("USCCB");
    expect(meta["dc.date"]).toBe("1999-12-31");
  });
});

describe("extractMicrodata", () => {
  it("captures itemprop values incl. content/datetime attributes", () => {
    const html = `
      <div itemscope itemtype="https://schema.org/Person">
        <span itemprop="name">Pope Leo XIII</span>
        <time itemprop="birthDate" datetime="1810-03-02"></time>
      </div>`;
    const items = extractMicrodata(html);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].props["name"]).toBe("Pope Leo XIII");
    expect(items[0].props["birthdate"]).toBe("1810-03-02");
  });
});

describe("extractDefinitionFacts", () => {
  it("lifts feast day / patronage from a definition list and a fact table", () => {
    const html = `
      <dl><dt>Feast day</dt><dd>January 28</dd>
          <dt>Patronage</dt><dd>students, schools</dd></dl>
      <table><tr><th>Born</th><td>1225</td></tr>
             <tr><td>Died</td><td>1274-03-07</td></tr></table>`;
    const facts = extractDefinitionFacts(html);
    expect(facts["feast day"]).toBe("January 28");
    expect(facts["patronage"]).toContain("students");
    expect(facts["born"]).toBe("1225");
    expect(facts["died"]).toBe("1274-03-07");
  });

  it("surfaces fact-table dates through StructuredFacts", () => {
    const html = `<table><tr><th>Reign began</th><td>1878-02-20</td></tr></table>`;
    const { facts } = extractStructuredData(html);
    expect(hasStructuredFacts(facts)).toBe(true);
    expect(facts.properties["reign began"]).toBe("1878-02-20");
    expect(facts.dates).toContain("1878-02-20");
  });
});

describe("extractStructuredData → facts", () => {
  it("distils JSON-LD Person into type, names, and dates", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Person","name":"St. Thomas Aquinas","birthDate":"1225-01-01","deathDate":"1274-03-07",
         "sameAs":["https://www.wikidata.org/wiki/Q9438"]}
      </script>`;
    const { facts } = extractStructuredData(html);
    expect(facts.type).toBe("person");
    expect(facts.title).toBe("St. Thomas Aquinas");
    expect(facts.names).toContain("St. Thomas Aquinas");
    expect(facts.dates).toEqual(expect.arrayContaining(["1225-01-01", "1274-03-07"]));
    expect(facts.urls).toContain("https://www.wikidata.org/wiki/Q9438");
  });

  it("lets JSON-LD override OpenGraph for the title", () => {
    const html = `
      <meta property="og:title" content="OG Title" />
      <script type="application/ld+json">{"@type":"Article","name":"JSON-LD Title","datePublished":"2015-05-24"}</script>`;
    const { facts } = extractStructuredData(html);
    expect(facts.title).toBe("JSON-LD Title");
    expect(facts.datePublished).toBe("2015-05-24");
    expect(facts.type).toBe("article");
  });

  it("is a strict no-op on bare HTML with no structured data", () => {
    const html = `<html><body><h1>Hello</h1><p>Plain text only.</p></body></html>`;
    const { facts } = extractStructuredData(html);
    expect(hasStructuredFacts(facts)).toBe(false);
    expect(structuredFactsToText(facts)).toBe("");
  });

  it("renders a labelled facts block when data is present", () => {
    const html = `<script type="application/ld+json">{"@type":"Article","name":"Rerum Novarum","datePublished":"1891-05-15","author":{"name":"Pope Leo XIII"}}</script>`;
    const { facts } = extractStructuredData(html);
    const text = structuredFactsToText(facts);
    expect(text).toContain("[structured data]");
    expect(text).toContain("Rerum Novarum");
    expect(text).toContain("1891-05-15");
    expect(text).toContain("Pope Leo XIII");
  });

  it("never throws on non-string / empty input", () => {
    expect(() => extractStructuredData("")).not.toThrow();
    expect(() => extractStructuredData(undefined as unknown as string)).not.toThrow();
  });
});
