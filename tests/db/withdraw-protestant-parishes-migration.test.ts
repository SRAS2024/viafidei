/**
 * Migration 0073 unpublishes churches whose own names say they are Protestant. Its
 * pattern must be the import's own, so a withdrawn church is not imported again and the
 * migration takes nothing the import would keep.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PROTESTANT_NAME_RE } from "@/lib/admin-worker/parish-osm";

const NAME = "0073_withdraw_protestant_churches_from_the_parish_directory";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");
const pattern = /"title" ~\* '([^']+)'/.exec(sql)?.[1] ?? "";
// Postgres writes a word boundary \y where JavaScript writes \b.
const asJs = new RegExp(pattern.replace(/\\y/g, "\\b"), "i");

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
    expect(sql).toContain(`WHERE "isPublished"`);
    expect(sql).toContain(`"contentType" = 'PARISH'::"ChecklistContentType"`);
  });

  it("withdraws by the same names the import refuses", () => {
    expect(pattern).not.toBe("");
    expect(asJs.source.replace(/\\b/g, "")).toBe(
      PROTESTANT_NAME_RE.source.replace(/\\b/g, "").replace("(?:", "("),
    );
  });

  it.each(["Gamri Gyohoe (감리교회)", "First Methodist Church"])("takes %s", (title) => {
    expect(asJs.test(title)).toBe(true);
  });

  it.each([
    "St. John the Baptist",
    "Church of Christ the King",
    "Myeongdong Seongdang (명동대성당)",
  ])("leaves %s", (title) => {
    expect(asJs.test(title)).toBe(false);
  });
});
