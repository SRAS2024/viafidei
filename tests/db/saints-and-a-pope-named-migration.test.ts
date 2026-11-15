/**
 * Migration 0082 names three saints and a pope as the Church names them. What it stores
 * must be what the worker now derives (the repair sweep's stage and title, the curated
 * pope entry), or the worker would put the old names back, and each row must change only
 * while it still holds exactly the old name.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  STAGE_CORRECTIONS,
  resolveCanonizationStatus,
  saintDisplayTitle,
  type SaintFacts,
} from "@/lib/admin-worker/structured/saint-facts";
import { findCuratedEntry, validatePayload } from "@/lib/checklist";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import {
  SAINT_DISPLAY_ORDER,
  STAGE_NOT_RECORDED,
  saintDetailEyebrow,
} from "@/lib/content-shared/saints";

const NAME = "0082_saints_and_a_pope_named_as_the_church_names_them";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");
const statements = sql.split(/UPDATE "(?:PublishedContent|ChecklistItem)"/).slice(1);

/** The UPDATE of one published row, by slug. */
function statementFor(slug: string): string {
  const found = statements.find((s) => s.includes(`content."slug" = '${slug}'`));
  expect(found, slug).toBeTruthy();
  return found!;
}

function facts(qid: string, label: string, statuses: string[], religions: string[]): SaintFacts {
  return {
    qid,
    entityUri: `http://www.wikidata.org/entity/${qid}`,
    label,
    description: null,
    feasts: [],
    statuses,
    religions,
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
  };
}

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
    // Four published rows and their checklist items.
    expect(statements).toHaveLength(5);
  });

  it("calls Nikola Tavelić a saint, as the sweep now derives him", () => {
    const statement = statementFor("saint-nikola-tavelic");
    expect(statement).toContain(`content."title" = 'Venerable Nikola Tavelić'`);
    expect(statement).toContain(`content."payload"->>'canonizationStatus' = 'venerable'`);
    // Wikidata still has Venerable beside the generic saint item: the correction wins.
    const resolved = resolveCanonizationStatus(
      facts("Q48252", "Nikola Tavelić", ["Q51619", "Q43115"], ["Q9592"]),
    );
    expect(resolved).toEqual({ status: "canonized", basis: "hand-checked" });
    expect(saintDisplayTitle("Nikola Tavelić", "canonized")).toBe("Saint Nikola Tavelić");
    expect(statement).toContain(`SET "title" = 'Saint Nikola Tavelić'`);
    const fields = { saintType: "martyr", feastDay: "11-14", patronages: [] };
    expect(
      generateContentSubtitle({
        contentType: "SAINT",
        fields: { ...fields, canonizationStatus: "venerable" },
      }),
    ).toBe("Venerable · Martyr · Feast November 14");
    expect(
      generateContentSubtitle({
        contentType: "SAINT",
        fields: { ...fields, canonizationStatus: "canonized" },
      }),
    ).toBe("Martyr · Feast November 14");
    expect(statement).toContain(
      `WHEN content."subtitle" = 'Venerable · Martyr · Feast November 14' THEN 'Martyr · Feast November 14'`,
    );
  });

  it("calls Saint Michael the Archangel, keeping his slug and place", () => {
    const statement = statementFor("saint-michael");
    expect(statement).toContain(`'{"canonicalName": "Michael the Archangel"}'::jsonb`);
    expect(saintDisplayTitle("Michael the Archangel", "canonized")).toBe(
      "Saint Michael the Archangel",
    );
    expect(statement).toContain(`SET "title" = 'Saint Michael the Archangel'`);
    expect(SAINT_DISPLAY_ORDER).toContain("saint-michael");
  });

  it('drops "Saint" from Arthur of Glastonbury, whom no Catholic source records', () => {
    const statement = statementFor("saint-arthur");
    expect(statement).toContain(`SET "title" = 'Arthur of Glastonbury'`);
    // Wikidata's "Catholic saint" proves nothing here: the sweep leaves the row alone.
    expect(STAGE_CORRECTIONS.get("Q4070328")).toBeNull();
    expect(resolveCanonizationStatus(facts("Q4070328", "Saint Arthur", ["Q3464126"], []))).toBe(
      null,
    );
    // The page prints no stage over him; another canonized saint still gets "Saint".
    expect(STAGE_NOT_RECORDED.has("saint-arthur")).toBe(true);
    const payload = { canonizationStatus: "canonized", saintType: "religious" };
    expect(saintDetailEyebrow(payload, "Arthur of Glastonbury", "saint-arthur")).toBeUndefined();
    expect(saintDetailEyebrow(payload, "Arthur of Glastonbury", "saint-other")).toBe("Saint");
    // Nothing hides or withdraws him.
    expect(sql).not.toMatch(/isPublished|DELETE/);
  });

  it("calls John Paul I blessed, exactly as his curated entry now does", () => {
    const entry = findCuratedEntry("POPE", "pope-john-paul-i");
    expect(entry).toBeDefined();
    expect(validatePayload("POPE", entry!.payload).ok).toBe(true);
    expect(entry!.payload.title).toBe("Pope Blessed John Paul I");
    const statement = statementFor("pope-john-paul-i");
    expect(statement).toContain(`content."contentType" = 'POPE'::"ChecklistContentType"`);
    expect(statement).toContain(`SET "title" = '${entry!.payload.title as string}'`);
    expect(statement).toContain(`'{"summary": "${entry!.payload.summary as string}"}'::jsonb`);
    // The same form as the other beatified popes.
    expect(findCuratedEntry("POPE", "pope-pius-ix")!.payload.title).toBe("Pope Blessed Pius IX");
  });

  it("moves each checklist item's name with its title, only from the old name", () => {
    const items = sql.slice(sql.indexOf("WITH named("));
    for (const [slug, oldName, newName] of [
      ["saint-nikola-tavelic", "Venerable Nikola Tavelić", "Saint Nikola Tavelić"],
      ["saint-michael", "Saint Michael", "Saint Michael the Archangel"],
      ["saint-arthur", "Saint Arthur", "Arthur of Glastonbury"],
      ["pope-john-paul-i", "Pope John Paul I", "Pope Blessed John Paul I"],
    ]) {
      expect(items).toContain(`'${slug}', '${oldName}', '${newName}'`);
    }
    expect(items).toContain(`item."canonicalName" = named."oldName"`);
  });
});
