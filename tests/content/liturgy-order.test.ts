/**
 * How /liturgy arranges its entries: section by section, and inside a section
 * the way the Church's year runs, opening with Advent, rather than an alphabet
 * of "Feast of…" and "Solemnity of…".
 */
import { describe, expect, it } from "vitest";

import { LITURGICAL_FILTERS } from "@/lib/content-shared/liturgical-categories";
import {
  LITURGY_SECTIONS,
  groupLiturgySections,
  sortLiturgyForDisplay,
} from "@/lib/content-shared/liturgy-order";

function entry(slug: string, kind: string, feastDate?: string, title = slug) {
  return { slug, title, payload: { kind, ...(feastDate ? { feastDate } : {}) } };
}

const slugs = (entries: ReadonlyArray<{ slug: string }>) => entries.map((e) => e.slug);

describe("LITURGY_SECTIONS", () => {
  it("offers every filter except All, the Mass and the rites first", () => {
    expect(LITURGY_SECTIONS.map((s) => s.key)).toEqual([
      "mass-rites",
      "seasons",
      "feasts",
      "memorials",
      "explained",
    ]);
    expect(new Set(LITURGY_SECTIONS)).toEqual(
      new Set(LITURGICAL_FILTERS.filter((f) => f.key !== "all")),
    );
  });
});

describe("sortLiturgyForDisplay", () => {
  it("keeps each section together, in reading order", () => {
    const sorted = sortLiturgyForDisplay([
      entry("glossary-liturgical-colors", "glossary_term"),
      entry("memorial-our-lady-of-sorrows", "memorial", "09-15"),
      entry("solemnity-christmas", "solemnity", "12-25"),
      entry("season-advent", "liturgical_season"),
      entry("structure-roman-rite-mass", "mass_structure"),
    ]);
    expect(slugs(sorted)).toEqual([
      "structure-roman-rite-mass",
      "season-advent",
      "solemnity-christmas",
      "memorial-our-lady-of-sorrows",
      "glossary-liturgical-colors",
    ]);
  });

  it("runs feasts and solemnities through the year together, opening in December", () => {
    const sorted = sortLiturgyForDisplay([
      entry("feast-saint-andrew", "feast", "11-30"),
      entry("solemnity-assumption", "solemnity", "08-15"),
      entry("solemnity-mary-mother-of-god", "solemnity", "01-01"),
      entry("solemnity-christmas", "solemnity", "12-25"),
      entry("solemnity-immaculate-conception", "solemnity", "12-08"),
      entry("feast-saint-stephen", "feast", "12-26"),
    ]);
    expect(slugs(sorted)).toEqual([
      "solemnity-immaculate-conception",
      "solemnity-christmas",
      "feast-saint-stephen",
      "solemnity-mary-mother-of-god",
      "solemnity-assumption",
      "feast-saint-andrew",
    ]);
  });

  it("gives a movable celebration its usual place among the fixed feasts", () => {
    const sorted = sortLiturgyForDisplay([
      entry("solemnity-christ-the-king", "solemnity"),
      entry("feast-saint-andrew", "feast", "11-30"),
      entry("feast-saint-mark", "feast", "04-25"),
      entry("solemnity-pentecost", "solemnity"),
      entry("solemnity-easter", "solemnity"),
      entry("solemnity-annunciation", "solemnity", "03-25"),
      entry("feast-holy-family", "feast"),
      entry("solemnity-christmas", "solemnity", "12-25"),
      entry("solemnity-mary-mother-of-god", "solemnity", "01-01"),
    ]);
    expect(slugs(sorted)).toEqual([
      "solemnity-christmas",
      "feast-holy-family",
      "solemnity-mary-mother-of-god",
      "solemnity-annunciation",
      "solemnity-easter",
      "feast-saint-mark",
      "solemnity-pentecost",
      "solemnity-christ-the-king",
      "feast-saint-andrew",
    ]);
  });

  it("walks the seasons from Advent, each before its great days", () => {
    const sorted = sortLiturgyForDisplay([
      entry("season-ordinary-time", "liturgical_season"),
      entry("good-friday-of-the-lords-passion", "liturgical_season"),
      entry("season-triduum", "liturgical_season"),
      entry("ash-wednesday", "liturgical_season"),
      entry("season-lent", "liturgical_season"),
      entry("gaudete-sunday", "liturgical_season"),
      entry("season-advent", "liturgical_season"),
      entry("the-liturgical-year", "liturgical_year"),
    ]);
    expect(slugs(sorted)).toEqual([
      "the-liturgical-year",
      "season-advent",
      "gaudete-sunday",
      "season-lent",
      "ash-wednesday",
      "season-triduum",
      "good-friday-of-the-lords-passion",
      "season-ordinary-time",
    ]);
  });

  it("sets an entry it has no place for after the rest of its section, by title", () => {
    const sorted = sortLiturgyForDisplay([
      entry("new-b", "liturgical_season", undefined, "Zeal"),
      entry("new-a", "liturgical_season", undefined, "Awe"),
      entry("season-advent", "liturgical_season"),
      entry("structure-roman-rite-mass", "mass_structure"),
    ]);
    expect(slugs(sorted)).toEqual(["structure-roman-rite-mass", "season-advent", "new-a", "new-b"]);
  });

  it("keeps an entry no section claims, last, and leaves the input alone", () => {
    const input = [entry("oddity", "unheard_of"), entry("season-advent", "liturgical_season")];
    expect(slugs(sortLiturgyForDisplay(input))).toEqual(["season-advent", "oddity"]);
    expect(slugs(input)).toEqual(["oddity", "season-advent"]);
  });
});

describe("groupLiturgySections", () => {
  it("gathers a page's entries under the sections it holds", () => {
    const page = sortLiturgyForDisplay([
      entry("solemnity-christmas", "solemnity", "12-25"),
      entry("season-advent", "liturgical_season"),
      entry("season-lent", "liturgical_season"),
    ]);
    const groups = groupLiturgySections(page);
    expect(groups.map((g) => [g.label, slugs(g.items)])).toEqual([
      ["Seasons", ["season-advent", "season-lent"]],
      ["Feasts & Solemnities", ["solemnity-christmas"]],
    ]);
  });

  it("gives an entry no section claims no heading rather than dropping it", () => {
    const groups = groupLiturgySections([entry("oddity", "unheard_of")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
    expect(slugs(groups[0].items)).toEqual(["oddity"]);
  });
});
