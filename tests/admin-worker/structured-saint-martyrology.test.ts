/**
 * The 1916 Roman Martyrology as a feast-day witness (and a narrow biography
 * source) for the SAINT ingest. The parser is pinned on two real excerpts of
 * the Internet Archive's OCR — 1–3 January, and 26–29 March, where the OCR
 * lost the heading of the 28th — and the matcher on the committed day index
 * built from the whole book. The matcher may only say "on Wikidata's feast
 * day, the book commemorates this saint", and only when the saint is named
 * unambiguously, by the label's English name, as the subject of exactly one
 * announcement of that day.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseFeastValue } from "@/lib/admin-worker/structured/corroboration";
import { parseMartyrologyOcr } from "@/lib/admin-worker/structured/roman-martyrology-parse";
import {
  MARTYROLOGY_1916,
  announcementSubjects,
  feastSentElsewhere,
  labelName,
  martyrology1916,
  martyrologyBiography,
  martyrologyFeastVerdict,
} from "@/lib/admin-worker/structured/roman-martyrology";

const FIXTURES = path.join(__dirname, "fixtures", "saint-pd");
const fixture = (name: string) => readFileSync(path.join(FIXTURES, name), "utf8");

function feast(label: string) {
  return parseFeastValue({ label })!;
}

describe("parsing the OCR into days (real excerpts)", () => {
  it("reads 1–3 January: announcements split, page furniture and footnote out", () => {
    const { days, problems } = parseMartyrologyOcr(fixture("rm1916-january-1-3.txt"), {
      monthDays: { 1: 3 },
    });
    expect(Object.keys(days)).toEqual(["01-01", "01-02", "01-03"]);
    const jan1 = days["01-01"];
    expect(jan1).toContain(
      "In the diocese of Lyons, in the monastery of St. Claude, St. Eugendus, abbot, whose life was eminent for virtues and miracles.",
    );
    // "the birthday* of St. Justin": the footnote mark is gone, and so is the
    // footnote itself ("*In the language of the Church, birthday refers …").
    expect(
      jan1.some((e) => e.startsWith("At Chieti, in Abruzzo, the birthday of St. Justin")),
    ).toBe(true);
    expect(jan1.join(" ")).not.toMatch(/language of the Church/);
    // A word broken at a line end is mended ("Csesa-" + "rea" in the OCR).
    expect(
      jan1.some((e) => e.includes("At Csesarea, in Cappadocia, the demise of St. Basil")),
    ).toBe(true);
    // The closing formula and the rubric are not announcements.
    expect(jan1.join(" ")).not.toMatch(/Thanks be to God|many other holy martyrs, confessors/);
    expect(days["01-03"].some((e) => e.includes("St. Genevieve, virgin"))).toBe(true);
    expect(problems).toEqual(["found 1 of 12 month titles"]);
  });

  it("leaves a month out when its days cannot be counted — a lost heading never shifts days", () => {
    const { days, problems } = parseMartyrologyOcr(fixture("rm1916-january-1-3.txt"));
    expect(days).toEqual({});
    expect(problems).toContain("JANUARY: 3 day starts for 31 days — month left out");
  });

  it("recovers a day whose heading the OCR lost from its drop capital (28 March)", () => {
    // The excerpt is the book's 26–29 March, so its days number from 1.
    const { days } = parseMartyrologyOcr(fixture("rm1916-march-26-29.txt"), {
      monthDays: { 3: 4 },
    });
    expect(Object.keys(days)).toHaveLength(4);
    expect(days["03-03"][0]).toBe(
      "T. JOHN of Capistran, confessor, who is mentioned on the 23d of October.",
    );
    expect(days["03-02"].some((e) => e.startsWith("At Salzburg, St. Rupert"))).toBe(true);
    expect(days["03-04"][0]).toMatch(/^TN Persia, the holy martyrs Jonas and Barachisius/);
    // Asked for one day more than the excerpt has, the month is refused.
    expect(
      parseMartyrologyOcr(fixture("rm1916-march-26-29.txt"), { monthDays: { 3: 5 } }).days,
    ).toEqual({});
  });
});

describe("the committed day index", () => {
  const { days } = martyrology1916();

  it("covers the whole year, the recovered days included", () => {
    expect(Object.keys(days)).toHaveLength(365);
    expect(days["03-11"][0]).toMatch(/^A T Carthage, the holy martyrs/);
    expect(days["03-28"][0]).toMatch(/^T\. JOHN of Capistran/);
    expect(days["10-31"]).toContain("At Ratisbon, St. Wolfgang, bishop.");
    expect(days["12-17"][0]).toMatch(/^AT Eleutheropolis, in Palestine/);
  });

  it("cites the Internet Archive scan", () => {
    expect(MARTYROLOGY_1916.url).toBe("https://archive.org/details/romanmartyrology00cathuoft");
  });
});

describe("who an announcement is about", () => {
  it("takes the first honoured group, not a place, a relation or a persecutor", () => {
    expect(
      announcementSubjects(
        "In the diocese of Lyons, in the monastery of St. Claude, St. Eugendus, abbot, whose life was eminent for virtues and miracles.",
      ),
    ).toEqual({ names: ["eugendus"], honorific: "saint" });
    expect(
      announcementSubjects(
        "At Carthage, St. Caecilius, the priest who converted St. Cyprian to the faith of Christ.",
      )?.names,
    ).toEqual(["caecilius"]);
    expect(
      announcementSubjects(
        "AT Arezzo, in Tuscany, during the persecution of Decius, under the governor Tiburtius, the holy martyrs Pergentinus and Laurentinus, brothers, who, while yet children, were put to the sword.",
      )?.names,
    ).toEqual(["pergentinus", "laurentinus"]);
    expect(
      announcementSubjects(
        "In Tuscany, on Mount Senario, blessed Bonfilius, confessor, one of the seven founders.",
      )?.honorific,
    ).toBe("blessed");
  });

  it("reads the day's first announcement under a mangled drop capital", () => {
    expect(
      announcementSubjects(
        "T. JOHN of Capistran, confessor, who is mentioned on the 23d of October.",
        true,
      )?.names,
    ).toEqual(["john"]);
  });

  it("reads a label's English name", () => {
    expect(labelName("Odilo of Cluny")).toEqual({ given: "odilo", others: ["cluny"] });
    expect(labelName("Saint Fronto of Périgueux")).toEqual({
      given: "fronto",
      others: ["perigueux"],
    });
    expect(labelName("John Felton (martyr)")).toEqual({ given: "john", others: ["felton"] });
  });

  it("knows a feast sent to another day from a feast kept on this one", () => {
    expect(feastSentElsewhere("… Her feast is kept on the 30th of this month.", "01-01")).toBe(
      "01-30",
    );
    expect(
      feastSentElsewhere(
        "… the demise of St. Basil, bishop, whose festival is kept on the 14th of June, the date …",
        "01-01",
      ),
    ).toBe("06-14");
    // "Mentioned on" points to the death-day notice: this announcement IS the feast.
    expect(
      feastSentElsewhere(
        "T. JOHN of Capistran, confessor, who is mentioned on the 23d of October.",
        "03-28",
      ),
    ).toBeNull();
  });
});

describe("the feast verdict (committed index)", () => {
  it("corroborates Wikidata's day when the saint is the one subject of that day", () => {
    const v = martyrologyFeastVerdict({
      label: "Eugendus",
      feast: feast("1 January"),
      status: "canonized",
    });
    expect(v.kind).toBe("corroborated");
    const v2 = martyrologyFeastVerdict({
      label: "Odilo of Cluny",
      feast: feast("1 January"),
      status: "canonized",
    });
    expect(v2.kind).toBe("corroborated");
  });

  it("is silent on another day — the 1916 day must BE Wikidata's", () => {
    expect(
      martyrologyFeastVerdict({ label: "Eugendus", feast: feast("2 January"), status: "canonized" })
        .kind,
    ).toBe("silent");
  });

  it("is silent for a common name, a missing place word, or another stage", () => {
    // "Felix" is the subject of announcements on dozens of days.
    expect(
      martyrologyFeastVerdict({ label: "Felix", feast: feast("14 January"), status: "canonized" }),
    ).toMatchObject({ kind: "silent", detail: expect.stringMatching(/subject on \d+ days/) });
    // 10 June names a Maximus — at Naples, not Aveia.
    expect(
      martyrologyFeastVerdict({
        label: "Maximus of Aveia",
        feast: feast("10 June"),
        status: "canonized",
      }),
    ).toMatchObject({ kind: "silent", detail: "06-10 names maximus without aveia" });
    // Wikidata says Blessed; the book calls him Saint — not the same claim.
    expect(
      martyrologyFeastVerdict({ label: "Eugendus", feast: feast("1 January"), status: "beatified" })
        .kind,
    ).toBe("silent");
  });

  it("CONTRADICTS when the announcement sends the feast to another day", () => {
    // 1 January: "St. Martina, virgin, … Her feast is kept on the 30th of this month."
    expect(
      martyrologyFeastVerdict({ label: "Martina", feast: feast("1 January"), status: "canonized" }),
    ).toMatchObject({ kind: "contradicted", detail: expect.stringContaining("01-30") });
    // …and on the 30th it corroborates.
    expect(
      martyrologyFeastVerdict({ label: "Martina", feast: feast("30 January"), status: "canonized" })
        .kind,
    ).toBe("corroborated");
  });
});

describe("the announcement as a biography", () => {
  function match(label: string, day: string) {
    const v = martyrologyFeastVerdict({ label, feast: feast(day), status: "canonized" });
    if (v.kind !== "corroborated") throw new Error(`${label}: ${v.kind}`);
    return v.match;
  }

  it("shows a clean announcement verbatim", () => {
    expect(martyrologyBiography(match("Maximus of Riez", "27 November"))).toMatch(
      /^At Riez, in France, St\. Maximus, bishop and confessor, who, from his tender years/,
    );
  });

  it("never shows a short one, a damaged one, or one with a misreading", () => {
    // 45 characters: corroborates the feast, too short to be a biography.
    expect(martyrologyBiography(match("Gaudentius of Rimini", "14 October"))).toBeNull();
    // "the abboc St. Stephen": a word the book uses nowhere else.
    expect(martyrologyBiography(match("Stephen of Muret", "8 February"))).toBeNull();
    // 30 January opens under the drop capital ("A T Rome").
    expect(martyrologyBiography(match("Martina", "30 January"))).toBeNull();
  });
});
