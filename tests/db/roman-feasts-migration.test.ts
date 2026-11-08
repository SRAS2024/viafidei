/**
 * Migration 0071 moves two saints from Eastern dates to their Roman feasts. It must touch
 * only those two rows, only when they still hold the old date, and keep the stored day,
 * its query columns and the subtitle in step.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const NAME = "0071_roman_feasts_of_joachim_and_mary_of_bethany";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");
const statements = sql.split('UPDATE "PublishedContent"').slice(1);

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it.each([
    ["saint-joachim", "09-09", "07-26", 7, 26],
    ["saint-mary-of-bethany", "06-04", "07-29", 7, 29],
  ])("moves %s from %s to %s, and only from there", (slug, from, to, month, day) => {
    const statement = statements.find((s) => s.includes(`"slug" = '${slug}'`));
    expect(statement, slug).toBeTruthy();
    expect(statement).toContain(`to_jsonb('${to}'::text)`);
    expect(statement).toContain(`"feastMonth" = ${month}`);
    expect(statement).toContain(`"feastDayOfMonth" = ${day}`);
    expect(statement).toContain(`AND "payload"->>'feastDay' = '${from}';`);
    expect(statement).toContain(`"contentType" = 'SAINT'::"ChecklistContentType"`);
  });

  it("changes nothing else", () => {
    expect(statements).toHaveLength(2);
  });
});
