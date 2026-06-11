/**
 * Wikipedia infobox parsing — the yield multiplier for SAINT corroboration
 * (the feast day usually lives in the infobox, not the abstract). These tests
 * pin the deterministic wikitext parser: brace-balanced block extraction,
 * top-level parameter splitting (pipes inside links/templates don't split),
 * and value cleaning (refs dropped, links → labels, date templates → ISO).
 */
import { describe, expect, it } from "vitest";

import {
  cleanInfoboxValue,
  extractInfoboxBlock,
  parseInfobox,
} from "@/lib/admin-worker/structured/wikipedia-infobox";

const WIKITEXT = `{{Short description|Peruvian saint}}
{{Infobox saint
| name = Rose of Lima
| birth_date = {{birth date|1586|4|20|df=y}}
| death_date = {{death date and age|1617|8|24|1586|4|20|df=y}}
| feast_day = {{nowrap|23 August}}<ref>Roman Martyrology</ref>
| patronage = [[Lima]], [[Peru]]; embroiderers, gardeners
| canonized_date = 12 April 1671
| canonized_by = [[Pope Clement X]]
| titles = [[Virgin (title)|Virgin]]
}}
'''Rose of Lima''' was a Peruvian [[Dominican Order|Dominican]] tertiary.`;

describe("extractInfoboxBlock", () => {
  it("extracts the brace-balanced infobox (nested templates intact)", () => {
    const block = extractInfoboxBlock(WIKITEXT);
    expect(block).not.toBeNull();
    expect(block!.startsWith("{{Infobox saint")).toBe(true);
    expect(block!.endsWith("}}")).toBe(true);
    expect(block).toContain("feast_day");
  });

  it("returns null when there is no infobox", () => {
    expect(extractInfoboxBlock("just prose, no template")).toBeNull();
  });
});

describe("cleanInfoboxValue", () => {
  it("drops refs, unwraps nowrap, and keeps the value", () => {
    expect(cleanInfoboxValue("{{nowrap|23 August}}<ref>Roman Martyrology</ref>")).toBe("23 August");
  });

  it("converts links to their labels", () => {
    expect(cleanInfoboxValue("[[Lima]], [[Peru]]; embroiderers")).toBe("Lima, Peru; embroiderers");
    expect(cleanInfoboxValue("[[Pope Clement X|Clement X]]")).toBe("Clement X");
  });

  it("converts birth/death date templates to ISO dates", () => {
    expect(cleanInfoboxValue("{{birth date|1586|4|20|df=y}}")).toBe("1586-04-20");
    expect(cleanInfoboxValue("{{death date and age|1617|8|24|1586|4|20|df=y}}")).toBe("1617-08-24");
  });
});

describe("parseInfobox", () => {
  it("parses the full field map with cleaned values", () => {
    const box = parseInfobox(WIKITEXT);
    expect(box.name).toBe("Rose of Lima");
    expect(box.feast_day).toBe("23 August");
    expect(box.birth_date).toBe("1586-04-20");
    expect(box.death_date).toBe("1617-08-24");
    expect(box.patronage).toBe("Lima, Peru; embroiderers, gardeners");
    expect(box.canonized_date).toBe("12 April 1671");
    expect(box.canonized_by).toBe("Pope Clement X");
  });

  it("does not split on pipes inside links or templates", () => {
    const box = parseInfobox(`{{Infobox saint
| titles = [[Virgin (title)|Virgin]] and {{nowrap|Doctor|of}} something
| feast_day = 1 October
}}`);
    expect(box.feast_day).toBe("1 October");
    expect(box.titles).toContain("Virgin");
  });

  it("returns {} for wikitext without an infobox", () => {
    expect(parseInfobox("no box here")).toEqual({});
  });
});
