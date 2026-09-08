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

/**
 * WRAPPER TEMPLATES — the regression this suite exists to prevent.
 *
 * Measured live on 2026-09-08: `{{Infobox Christian leader}}` on Pope
 * Zephyrinus (Q101306) writes his feast days as
 * `feast_day = {{unbulleted list|20 December (…)|26 August (…)}}`. The cleaner
 * deleted every template it did not recognise, so the value cleaned to "" and
 * — because only non-empty values are recorded — the `feast_day` key vanished
 * from the parsed map altogether. The saint ingest then reported
 * `feast_uncorroborated` against an article that states the feast twice. The
 * same erasure emptied `{{plainlist}}` patronages and `{{start date}}`
 * canonization dates (the only status source for a saint with no P411).
 */
const ZEPHYRINUS_FEAST =
  "{{unbulleted list|20 December ([[Maronite Church]], [[Eastern Orthodoxy|Orthodox Churches]], " +
  "[[Latin Church]])|26 August ([[General Roman Calendar of 1960|Latin Church pre-1969]])}}";

describe("cleanInfoboxValue — wrapper templates", () => {
  it("unwraps a list template into its dates, in document order", () => {
    expect(cleanInfoboxValue(ZEPHYRINUS_FEAST)).toBe(
      "20 December (Maronite Church, Orthodox Churches, Latin Church); " +
        "26 August (Latin Church pre-1969)",
    );
  });

  it("keeps a piped link inside a list argument whole", () => {
    // The separator pipe of [[Eastern Orthodoxy|Orthodox Churches]] must not
    // be read as an argument separator, or one date becomes two fragments.
    expect(cleanInfoboxValue(ZEPHYRINUS_FEAST)).not.toContain("Eastern Orthodoxy");
    expect(cleanInfoboxValue("{{ubl|[[A (x)|A]] and [[B]]}}")).toBe("A and B");
  });

  it("unwraps every list flavour and turns bullets into separators", () => {
    expect(cleanInfoboxValue("{{hlist|Rome|Milan}}")).toBe("Rome; Milan");
    expect(cleanInfoboxValue("{{plainlist|\n* Farmers\n* Bakers\n* [[Poland]]\n}}")).toBe(
      "Farmers; Bakers; Poland",
    );
    expect(cleanInfoboxValue("{{bulleted list|Sailors|Travellers}}")).toBe("Sailors; Travellers");
  });

  it("drops named parameters, which are chrome rather than content", () => {
    expect(cleanInfoboxValue("{{ubl|class=nowrap|1 January|2 February}}")).toBe(
      "1 January; 2 February",
    );
  });

  it("reads start/end date templates as dates, at day or year precision", () => {
    expect(cleanInfoboxValue("{{start date|1997|10|19}}")).toBe("1997-10-19");
    expect(cleanInfoboxValue("{{start date|1997}}")).toBe("1997");
  });

  it("STILL drops a template it does not recognise, rather than guessing", () => {
    // The allowlist is the whole point: an unread template is not evidence.
    expect(cleanInfoboxValue("{{convert|12|mi|km}}")).toBe("");
    expect(cleanInfoboxValue("{{citation needed|date=May 2024}}")).toBe("");
  });

  it("resolves nested wrappers innermost-first", () => {
    expect(cleanInfoboxValue("{{ubl|{{nowrap|23 August}}|{{small|20 December}}}}")).toBe(
      "23 August; 20 December",
    );
  });
});

describe("parseInfobox — a wrapped value is a PRESENT value", () => {
  it("records feast_day / patronage / canonized_date that live in templates", () => {
    const box = parseInfobox(`{{Infobox Christian leader
| name = Zephyrinus
| feast_day = ${ZEPHYRINUS_FEAST}
| patronage = {{plainlist|
* Farmers
* Bakers
}}
| canonized_date = {{start date|1997|10|19}}
}}`);
    // Before the fix each of these three keys was absent from the map.
    expect(box.feast_day).toContain("20 December");
    expect(box.feast_day).toContain("26 August");
    expect(box.patronage).toBe("Farmers; Bakers");
    expect(box.canonized_date).toBe("1997-10-19");
  });
});
