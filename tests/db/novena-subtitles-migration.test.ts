/**
 * Migration 0077 re-projects the novenas' stored subtitles on the day it deploys. Each new
 * subtitle must be the one the application now writes for the curated novena, or the
 * worker's hygiene sweep would change it again, and each row must change only while it
 * still holds the old one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveContentSubtype } from "@/lib/admin-worker/content-subtype";
import { validatePayload } from "@/lib/checklist";
import { novenaKnowledge } from "@/lib/checklist/knowledge/novenas";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

const NAME = "0077_novenas_said_as_they_are_prayed";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

const LITERAL = "'(?:[^']|'')*'";
const unquote = (literal: string) => literal.slice(1, -1).replace(/''/g, "'");
const rows = [
  ...sql.matchAll(new RegExp(`\\((${LITERAL}),\\s*(${LITERAL}),\\s*(${LITERAL})\\)`, "g")),
].map((match) => ({
  slug: unquote(match[1]!),
  oldSubtitle: unquote(match[2]!),
  newSubtitle: unquote(match[3]!),
}));

/** The subtitle the publish orchestrator writes for a curated novena. */
function projected(slug: string): string {
  const entry = novenaKnowledge.find((e) => e.slug === slug);
  expect(entry, slug).toBeDefined();
  const validation = validatePayload("NOVENA", entry!.payload);
  expect(validation.ok, `${slug} is schema-valid`).toBe(true);
  const payload = (validation as { data: Record<string, unknown> }).data;
  return generateContentSubtitle({
    contentType: "NOVENA",
    contentSubtype: resolveContentSubtype("NOVENA", payload),
    title: String(payload.title),
    fields: payload,
  });
}

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("changes a novena's subtitle only while it holds exactly the old one", () => {
    expect(sql.match(/UPDATE "PublishedContent"/g)).toHaveLength(1);
    expect(sql).toContain(`content."contentType" = 'NOVENA'::"ChecklistContentType"`);
    expect(sql).toContain(`content."subtitle" = projected."oldSubtitle"`);
    expect(rows.length).toBeGreaterThan(60);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
  });

  it("writes the subtitle the application writes, so the hygiene sweep agrees", () => {
    for (const { slug, newSubtitle } of rows) expect(newSubtitle, slug).toBe(projected(slug));
  });

  it("changes every subtitle it names, and names no saint as the one prayed to", () => {
    for (const { slug, oldSubtitle, newSubtitle } of rows) {
      expect(newSubtitle, slug).not.toBe(oldSubtitle);
      expect(newSubtitle, slug).not.toMatch(/ to Saint /);
      expect(newSubtitle, slug).not.toMatch(/begins (?:The|Any|Nine)\b/);
    }
    const divineMercy = rows.find((row) => row.slug === "divine-mercy-novena");
    expect(divineMercy?.oldSubtitle).toContain("to Saint Faustina Kowalska");
  });

  it("leaves alone every curated novena whose subtitle already reads right", () => {
    const named = new Set(rows.map((row) => row.slug));
    for (const entry of novenaKnowledge) {
      if (named.has(entry.slug)) continue;
      expect(projected(entry.slug), entry.slug).not.toMatch(/ to Saint |begins (?:The|Any)\b/);
    }
  });
});
