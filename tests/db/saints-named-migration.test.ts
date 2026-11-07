/**
 * Migration 0070 adds "Saint" to fifteen hand-checked names at the top of the saint list.
 * It must stay exact: only named rows, only the word "Saint", only names the list ranks,
 * and the same list for the published row and its checklist item.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SAINT_DISPLAY_ORDER } from "@/lib/content-shared/saints";

const NAME = "0070_saints_named_as_saints";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

const lists = sql
  .split("VALUES")
  .slice(1)
  .map((part) =>
    [...part.split(")\nUPDATE")[0]!.matchAll(/\('([^']+)', '([^']+)', '([^']+)'\)/g)].map(
      (match) => ({ slug: match[1]!, oldName: match[2]!, newName: match[3]! }),
    ),
  );

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("names the same fifteen in both statements", () => {
    expect(lists).toHaveLength(2);
    expect(lists[0]).toHaveLength(15);
    expect(lists[1]).toEqual(lists[0]);
  });

  it("adds the word Saint and changes nothing else", () => {
    for (const { oldName, newName } of lists[0]!) {
      expect(newName).toBe(`Saint ${oldName}`);
    }
  });

  it("only touches names the list ranks, not the catalogue at large", () => {
    const ranked = new Set<string>(SAINT_DISPLAY_ORDER);
    for (const { slug } of lists[0]!) expect(ranked.has(slug), slug).toBe(true);
  });

  it("leaves a row alone unless it has exactly the old name", () => {
    expect(sql).toContain(`content."title" = named."oldName"`);
    expect(sql).toContain(`item."canonicalName" = named."oldName"`);
  });
});
