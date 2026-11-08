/**
 * Migration 0075 files misfiled saints under what they were and corrects three names. The
 * types and titles it writes must be the ones the import and the repair sweep now derive,
 * or the sweep would put the old ones back, and each row must change only while it still
 * holds exactly the old value.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  deriveSaintType,
  resolveCanonizationStatus,
  saintDisplayTitle,
  type SaintFacts,
} from "@/lib/admin-worker/structured/saint-facts";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { SAINT_FILTER_SUBTYPES } from "@/lib/content-shared/saint-categories";

const NAME = "0075_saints_filed_and_named_as_they_are";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

const LITERAL = "'(?:[^']|'')*'";
const unquote = (literal: string) => literal.slice(1, -1).replace(/''/g, "'");
/** The rows of every VALUES list that follows `WITH <name>(`, as strings. */
function valuesOf(name: string): string[][] {
  const blocks = sql.split(`WITH ${name}(`).slice(1);
  expect(blocks.length, name).toBeGreaterThan(0);
  return blocks.flatMap((part) =>
    [
      ...part
        .slice(0, part.indexOf("\n)\n"))
        .matchAll(/\(\s*('(?:[^']|'')*'(?:,\s*'(?:[^']|'')*')+)\s*\)/g),
    ].map((row) =>
      [...row[1]!.matchAll(new RegExp(LITERAL, "g"))].map((literal) => unquote(literal[0])),
    ),
  );
}

const filed = valuesOf("filed").map(([slug, oldType, newType, oldSubtitle, newSubtitle]) => ({
  slug: slug!,
  oldType: oldType!,
  newType: newType!,
  oldSubtitle: oldSubtitle!,
  newSubtitle: newSubtitle!,
}));
const named = valuesOf("named");

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** What a stored saint subtitle says: its stage, first patronage and feast. */
function readSubtitle(subtitle: string): Record<string, unknown> {
  const m =
    /^(?:(Blessed|Venerable|Servant of God) · )?[A-Za-z ]+?(?:, patron (?:of )?(.+?))?(?: · Feast (\w+) (\d+))?$/.exec(
      subtitle,
    );
  expect(m, subtitle).toBeTruthy();
  const status =
    { Blessed: "beatified", Venerable: "venerable", "Servant of God": "servant_of_god" }[
      m![1] ?? ""
    ] ?? "canonized";
  const feastDay = m![3]
    ? `${String(MONTHS.indexOf(m![3]) + 1).padStart(2, "0")}-${m![4]!.padStart(2, "0")}`
    : undefined;
  return {
    canonizationStatus: status,
    patronages: m![2] ? [m![2]] : [],
    ...(feastDay ? { feastDay } : {}),
  };
}

/** Wikidata's record of the two disciples whose stage the repair sweep can prove (2026-11-07). */
function facts(over: Partial<SaintFacts>): SaintFacts {
  return {
    qid: "Q1",
    entityUri: "http://www.wikidata.org/entity/Q1",
    label: "",
    description: null,
    feasts: [],
    statuses: [],
    religions: [],
    religionLabels: [],
    positions: [],
    occupations: [],
    awards: [],
    bishopSee: false,
    founded: false,
    birthYear: null,
    deathYear: null,
    enArticle: null,
    altArticles: [],
    website: null,
    ceIds: [],
    ceArticles: [],
    ...over,
  };
}
const PROVABLE: Record<string, { facts: SaintFacts; titles: string }> = {
  "saint-crescens": {
    facts: facts({
      qid: "Q981729",
      label: "Crescens",
      statuses: ["Q43115"],
      religions: ["Q9592"],
      positions: ["Q91073251", "Q43412"],
      occupations: ["Q250867", "Q29182"],
      bishopSee: true,
      deathYear: 100,
    }),
    titles: "Hieromartyr Apostle of the Seventy",
  },
  "saint-prochorus": {
    facts: facts({
      qid: "Q1169498",
      label: "Prochorus",
      statuses: ["Q43115"],
      religions: ["Q9592"],
      positions: ["Q43412"],
      occupations: ["Q161944"],
      deathYear: 100,
    }),
    titles:
      "Bishop of Nicomedia Deacon Hieromartyr Apostle of the Seventy One of the Seven Deacons",
  },
};

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("files each saint only while the row still holds the old type", () => {
    expect(sql).toContain(`content."payload"->>'saintType' = filed."oldType"`);
    expect(sql).toContain(`"subtype" = filed."newType"`);
    expect(sql).toContain(`WHEN content."subtitle" = filed."oldSubtitle" THEN filed."newSubtitle"`);
    expect(filed.length).toBeGreaterThan(20);
    expect(new Set(filed.map((row) => row.slug)).size).toBe(filed.length);
  });

  it("takes every one out of the chip it was misfiled under", () => {
    const chipOf = (type: string) =>
      Object.entries(SAINT_FILTER_SUBTYPES).find(([, types]) => types.includes(type))?.[0];
    for (const { slug, oldType, newType } of filed) {
      expect(["pope", "bishop", "apostle", "evangelist"], slug).toContain(oldType);
      expect(chipOf(newType), slug).not.toBe(chipOf(oldType));
      expect(["pope", "apostle", "evangelist"], slug).not.toContain(newType);
    }
    // The real Popes Mark and Dionysius stay where they are.
    expect(filed.map((row) => row.slug)).not.toContain("saint-mark");
    expect(filed.map((row) => row.slug)).not.toContain("saint-dionysius");
  });

  it("writes the subtitle the application writes for the new type", () => {
    for (const { slug, newType, oldSubtitle, newSubtitle } of filed) {
      const fields = { ...readSubtitle(oldSubtitle), saintType: newType };
      expect(newSubtitle, slug).toBe(generateContentSubtitle({ contentType: "SAINT", fields }));
    }
  });

  it("agrees with the repair sweep wherever Wikidata lets it prove the saint", () => {
    for (const [slug, { facts: record, titles }] of Object.entries(PROVABLE)) {
      expect(resolveCanonizationStatus(record)?.status, slug).toBe("canonized");
      const row = filed.find((r) => r.slug === slug);
      expect(row, slug).toBeDefined();
      expect(deriveSaintType(record, { infoboxTitles: titles }), slug).toBe(row!.newType);
    }
  });

  it("names three saints as the sweep now derives their titles", () => {
    expect(named.length).toBeGreaterThanOrEqual(6);
    const titles = named.filter((row) => row.length === 5);
    expect(titles).toHaveLength(3);
    for (const [slug, oldTitle, newTitle, , newName] of titles) {
      expect(newTitle, slug).toBe(saintDisplayTitle(newName!, "canonized"));
      expect(newTitle, slug).not.toBe(oldTitle);
    }
    // The checklist items follow the same three titles.
    const items = named.filter((row) => row.length === 4);
    expect(items.map(([slug, , newTitle]) => [slug, newTitle])).toEqual(
      titles.map(([slug, , newTitle]) => [slug, newTitle]),
    );
    expect(sql).toContain(`AND content."title" = named."oldTitle"`);
    expect(sql).toContain(`item."canonicalName" IN (named."oldTitle", named."oldName")`);
  });

  it("says once, at the start, that Willehad was one of the Martyrs of Gorkum", () => {
    expect(sql).toContain(
      "to_jsonb('Willehad of Denmark, a Franciscan friar and priest, was one of the Martyrs of Gorkum. ' || (\"payload\"->>'biography'))",
    );
    expect(sql).toContain(
      `"payload"->>'biography' LIKE 'The Martyrs of Gorkum were a group of 19 %'`,
    );
  });
});
