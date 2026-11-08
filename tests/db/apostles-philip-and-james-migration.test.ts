/**
 * Migration 0076 points the May 3 feast and the devotion to Saint Jude at the Apostles'
 * own records. What it stores must be what the curated entries now say, or the worker's
 * curated sync would change it again, and it must touch only those two rows.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findCuratedEntry, validatePayload } from "@/lib/checklist";
import { CHURCH_HISTORY_EVENTS } from "@/lib/content-shared/church-history-events";
import { SAINT_DUPLICATE_OF } from "@/lib/content-shared/saints";

const NAME = "0076_the_apostles_philip_and_james_each_on_his_own_page";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");
const statements = sql.split('UPDATE "PublishedContent"').slice(1);

/** The array the curated entry's validated payload holds under `field`. */
function curated(contentType: "LITURGICAL" | "DEVOTION", slug: string, field: string): unknown {
  const entry = findCuratedEntry(contentType, slug);
  expect(entry, slug).toBeDefined();
  const validation = validatePayload(contentType, entry!.payload);
  expect(validation.ok, `${slug} is schema-valid`).toBe(true);
  return (validation as { data: Record<string, unknown> }).data[field];
}

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
    expect(statements).toHaveLength(2);
  });

  it.each([
    ["LITURGICAL", "feast-saints-philip-and-james", "associatedSaintSlugs"],
    ["DEVOTION", "devotion-to-saint-jude", "relatedSaints"],
  ] as const)("stores what the curated %s %s now says", (contentType, slug, field) => {
    const statement = statements.find((s) => s.includes(`"slug" = '${slug}'`));
    expect(statement, slug).toBeTruthy();
    expect(statement).toContain(`"contentType" = '${contentType}'::"ChecklistContentType"`);
    const stored = new RegExp(`'\\{${field}\\}', '([^']+)'::jsonb`).exec(statement!)?.[1];
    expect(JSON.parse(stored!)).toEqual(curated(contentType, slug, field));
    // Only while the row still links the combined record.
    const guard = new RegExp(`"payload"->'${field}' = '([^']+)'::jsonb;`).exec(statement!)?.[1];
    expect(JSON.parse(guard!)).toContain("saints-philip-and-james");
    expect(statement).toContain(`"contentChecksum" = NULL`);
  });

  it("leaves no curated link or history event on the combined record", () => {
    expect(SAINT_DUPLICATE_OF["saints-philip-and-james"]).toBe("saint-philip-the-apostle");
    for (const event of CHURCH_HISTORY_EVENTS) {
      expect(event.links?.saints ?? [], event.slug).not.toContain("saints-philip-and-james");
    }
  });
});
