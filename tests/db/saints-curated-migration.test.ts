/**
 * Migrations 0063 and 0064 write saints straight into the published tables, because
 * the saint list must read right on the day it deploys. Those rows have to be the
 * ones the publish orchestrator would have written, or the worker's curated sync and
 * hygiene sweep would rewrite them on their next pass. This holds each file to the
 * curated entries and to the functions that derive the rest of each row, so a
 * corrected biography cannot leave a migration behind.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { computeContentChecksum } from "@/lib/admin-worker/cache-freshness";
import { resolveContentSubtype } from "@/lib/admin-worker/content-subtype";
import { findCuratedEntry, validatePayload } from "@/lib/checklist";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { derivedColumnsFor } from "@/lib/content-shared/derived-columns";
import { parseYear } from "@/lib/content-shared/saints";

const readMigration = (name: string) =>
  readFileSync(join(process.cwd(), "prisma", "migrations", name, "migration.sql"), "utf8");

const NAME = "0063_our_lady_and_the_missing_apostles";
const sql = readMigration(NAME);
const SLUGS = [
  "saint-blessed-virgin-mary",
  "saint-philip-the-apostle",
  "saint-james-the-less",
  "saint-simon-the-zealot",
];

const FOUND_MISSING_NAME = "0064_saints_found_missing";
const foundMissingSql = readMigration(FOUND_MISSING_NAME);
const FOUND_MISSING = [
  "saint-gabriel-the-archangel",
  "saint-raphael-the-archangel",
  "saint-elizabeth-mother-of-john-the-baptist",
  "saint-zechariah-father-of-john-the-baptist",
  "saint-peregrine-laziosi",
  "saint-dismas",
  "saint-basil-the-great",
  "saint-gregory-nazianzen",
  "saint-cuthbert-of-lindisfarne",
  "saint-margaret-clitherow",
  "saint-isaac-jogues",
  "saint-joseph-of-arimathea",
  "saint-abraham-the-patriarch",
  "saint-moses-the-lawgiver",
  "saint-david-the-king",
  "saint-isaiah-the-prophet",
  "saint-jeremiah-the-prophet",
  "saint-ezekiel-the-prophet",
  "saint-daniel-the-prophet",
];

/** A slug's PublishedContent insert. */
function publishedInsert(slug: string, migration = sql): string {
  const inserts = migration.split('INSERT INTO "PublishedContent"').slice(1);
  const insert = inserts.find((part) => part.includes(`'${slug}'`));
  expect(insert, `${slug} is inserted`).toBeTruthy();
  return insert!;
}

/** The payload a slug's PublishedContent insert carries. */
function migratedPayload(slug: string, migration = sql): Record<string, unknown> {
  const json = /\$payload\$(.*?)\$payload\$/s.exec(publishedInsert(slug, migration))?.[1];
  expect(json, `${slug} has a payload`).toBeTruthy();
  return JSON.parse(json!) as Record<string, unknown>;
}

/** What the orchestrator stores for a curated saint. */
function orchestrated(slug: string) {
  const entry = findCuratedEntry("SAINT", slug);
  expect(entry, slug).toBeDefined();
  const validation = validatePayload("SAINT", entry!.payload);
  expect(validation.ok, `${slug} is schema-valid`).toBe(true);
  const payload = { ...(validation as { data: Record<string, unknown> }).data };
  const subtype = resolveContentSubtype("SAINT", payload);
  if (subtype) payload.contentSubtype = subtype;
  const title = String(payload.canonicalName);
  return {
    payload,
    title,
    subtitle: generateContentSubtitle({
      contentType: "SAINT",
      contentSubtype: subtype,
      title,
      fields: payload,
    }),
    checksum: computeContentChecksum(title, payload),
    derived: derivedColumnsFor("SAINT", payload),
  };
}

describe(`${NAME}`, () => {
  it("carries the marker the deploy's self-heal trusts, and only guarded inserts", () => {
    expect(sql).toContain("@idempotent-recoverable");
    expect(sql).toMatch(/SET LOCAL lock_timeout/);
    const body = sql.replace(/--[^\n]*/g, "");
    const inserts = body.match(/INSERT INTO/g)?.length ?? 0;
    expect(inserts).toBe(1 + 8 + 4);
    expect(body.match(/ON CONFLICT DO NOTHING/g)?.length).toBe(inserts);
  });

  it("publishes nothing for an item a person has rejected", () => {
    for (const slug of SLUGS) {
      expect(publishedInsert(slug)).toContain(
        `"approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"`,
      );
    }
  });

  for (const slug of SLUGS) {
    describe(slug, () => {
      const expected = orchestrated(slug);

      it("stores the payload the curated entry parses to", () => {
        expect(migratedPayload(slug)).toEqual(expected.payload);
      });

      it("stores the orchestrator's title, subtitle and checksum", () => {
        const insert = publishedInsert(slug);
        expect(insert).toContain(`'${expected.title.replace(/'/g, "''")}'`);
        expect(insert).toContain(`'${expected.subtitle.replace(/'/g, "''")}'`);
        expect(insert).toContain(`'${expected.checksum}'`);
      });

      it("stores the derived query columns", () => {
        const { feastMonth, feastDayOfMonth, sortYear, subtype } = expected.derived;
        expect(publishedInsert(slug)).toContain(
          `${feastMonth}, ${feastDayOfMonth}, ${sortYear ?? "NULL"}, '${subtype}'`,
        );
      });
    });
  }

  it("corrects exactly the dates parseYear used to misread", () => {
    const pattern =
      /\^\\s\*\\d\{1,4\}-\\d\{2\}-\\d\{2\}\\s\+\(AD\|CE\|A\\\.D\\\.\|C\\\.E\\\.\)\\s\*\$/;
    expect(sql).toMatch(pattern);
    expect(parseYear("542-08-27 AD")).toBe(542);
    expect(parseYear("98-01-27 CE")).toBe(98);
  });
});

describe(FOUND_MISSING_NAME, () => {
  it("carries the deploy's marker, and only guarded inserts", () => {
    expect(foundMissingSql).toContain("@idempotent-recoverable");
    expect(foundMissingSql).toMatch(/SET LOCAL lock_timeout/);
    const body = foundMissingSql.replace(/--[^\n]*/g, "");
    const inserts = body.match(/INSERT INTO/g)?.length ?? 0;
    expect(inserts).toBe(1 + 2 * FOUND_MISSING.length + FOUND_MISSING.length);
    expect(body.match(/ON CONFLICT DO NOTHING/g)?.length).toBe(inserts);
  });

  it("publishes nothing for an item a person has rejected", () => {
    for (const slug of FOUND_MISSING) {
      expect(publishedInsert(slug, foundMissingSql)).toContain(
        `"approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"`,
      );
    }
  });

  for (const slug of FOUND_MISSING) {
    it(`${slug} is the row the orchestrator would write`, () => {
      const expected = orchestrated(slug);
      expect(migratedPayload(slug, foundMissingSql)).toEqual(expected.payload);
      const insert = publishedInsert(slug, foundMissingSql);
      expect(insert).toContain(`'${expected.title.replace(/'/g, "''")}'`);
      expect(insert).toContain(`'${expected.subtitle.replace(/'/g, "''")}'`);
      expect(insert).toContain(`'${expected.checksum}'`);
      const { feastMonth, feastDayOfMonth, sortYear, subtype } = expected.derived;
      expect(insert).toContain(
        `${feastMonth}, ${feastDayOfMonth}, ${sortYear ?? "NULL"}, '${subtype}'`,
      );
    });
  }
});

describe("0065_withdraw_crawled_pages", () => {
  const withdrawn = readMigration("0065_withdraw_crawled_pages");
  const body = withdrawn.replace(/--[^\n]*/g, "");

  it("unpublishes, and never deletes", () => {
    expect(withdrawn).toContain("@idempotent-recoverable");
    expect(body).not.toMatch(/\bDELETE\b/);
    expect(body).toMatch(/"isPublished" = false/);
    expect(body).toMatch(/WHERE "isPublished"/);
  });

  it("takes down the page that reprints strangers' prayer requests", () => {
    expect(body.match(/send-deacon-keith-your-prayer-requests/g)).toHaveLength(2);
    expect(body.match(/saint-archippus-q276575/g)).toHaveLength(2);
  });
});
