/**
 * Migration 0066 corrects the novenas' stored backgrounds on the day it deploys. Each
 * of its statements replaces exact words in named rows and touches nothing else, so
 * the file has to agree with the curated text the worker would write: its result must
 * be what the curated entry says, or the worker's next sync would change it back.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { novenaKnowledge } from "@/lib/checklist/knowledge/novenas";

const NAME = "0066_novena_background_true_where_it_stands";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

const curated = new Map(
  novenaKnowledge.map((entry) => [entry.slug, entry.payload.background as string]),
);
const unquote = (literal: string) => literal.slice(1, -1).replace(/''/g, "'");
const LITERAL = "'(?:[^']|'')*'";

interface Edit {
  slugs: string[];
  oldWords: string;
  newWords: string;
}

/** The file's statements, in order, as the words each one changes. */
const edits: Edit[] = sql
  .split('UPDATE "PublishedContent"')
  .slice(1)
  .map((statement) => {
    const words = new RegExp(
      `replace\\("payload"->>'background',\\s*(${LITERAL}),\\s*(${LITERAL})\\)`,
    ).exec(statement);
    const guard = new RegExp(`strpos\\("payload"->>'background', (${LITERAL})\\) > 0;`).exec(
      statement,
    );
    expect(words, statement).toBeTruthy();
    expect(guard, statement).toBeTruthy();
    expect(unquote(guard![1]!), "the guard names the same words").toBe(unquote(words![1]!));
    expect(statement).toContain(`"contentType" = 'NOVENA'::"ChecklistContentType"`);
    const named = /AND "slug" (?:= '[^']+'|IN \([^)]*\))/.exec(statement);
    expect(named, statement).toBeTruthy();
    return {
      slugs: [...named![0].matchAll(/'([^']+)'/g)].map((match) => match[1]!),
      oldWords: unquote(words![1]!),
      newWords: unquote(words![2]!),
    };
  });

/** A background with the file's statements applied. */
const applied = (slug: string, text: string) =>
  edits.reduce(
    (current, edit) =>
      edit.slugs.includes(slug) ? current.split(edit.oldWords).join(edit.newWords) : current,
    text,
  );

/** The background a row held before: the file's statements undone, last to first. */
const undone = (slug: string, text: string) =>
  [...edits]
    .reverse()
    .reduce(
      (current, edit) =>
        edit.slugs.includes(slug) ? current.split(edit.newWords).join(edit.oldWords) : current,
      text,
    );

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("does nothing but update the backgrounds of named novenas", () => {
    expect(edits.length).toBeGreaterThan(40);
    const withoutWords = sql.replace(new RegExp(LITERAL, "g"), "''");
    expect(withoutWords).not.toMatch(/\bDELETE\b|\bINSERT\b|\bDROP\b|\bALTER\b|\bCREATE\b/);
    const statements = withoutWords
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements[0]).toBe("SET LOCAL lock_timeout = ''");
    expect(statements.slice(1)).toHaveLength(edits.length);
    for (const statement of statements.slice(1)) {
      expect(statement).toMatch(
        /^UPDATE "PublishedContent"\s+SET "payload" = jsonb_set\("payload", ''/,
      );
    }
    for (const edit of edits) expect(edit.slugs.length, edit.oldWords).toBeGreaterThan(0);
  });

  it("names only novenas the curated source has", () => {
    for (const edit of edits) {
      for (const slug of edit.slugs) expect(curated.has(slug), slug).toBe(true);
    }
  });

  it("clears a changed row's freshness marker rather than leave it stale", () => {
    const updates = sql.split('UPDATE "PublishedContent"').slice(1);
    expect(updates).toHaveLength(edits.length);
    for (const update of updates) expect(update).toContain('"contentChecksum" = NULL');
  });

  it("leaves in the curated text each set of new words, and none of the old", () => {
    for (const edit of edits) {
      for (const slug of edit.slugs) {
        const text = curated.get(slug)!;
        expect(text, `${slug}: ${edit.newWords}`).toContain(edit.newWords);
        expect(text, `${slug}: ${edit.oldWords}`).not.toContain(edit.oldWords);
      }
    }
  });

  it("brings the old text to exactly the curated text, and then has nothing left to do", () => {
    let corrected = 0;
    for (const [slug, text] of curated) {
      const before = undone(slug, text);
      if (before !== text) corrected += 1;
      expect(applied(slug, before), slug).toBe(text);
      expect(applied(slug, text), `${slug} on a second run`).toBe(text);
    }
    expect(corrected).toBe(66);
  });

  it("is a no-op on text that does not match", () => {
    const rewritten = "A worker's own words: the subjects are elsewhere.";
    expect(applied("novena-saint-george", rewritten)).toBe(rewritten);
  });

  it("covers every novena that said below, with the words production holds", () => {
    const below = edits.filter((edit) => /\bbelow\b/.test(edit.oldWords));
    expect(below.flatMap((edit) => edit.slugs).length).toBe(44);
    const slugsOrEnum = edits.filter((edit) => /PRAYER|\(novena-|as litany-of/.test(edit.oldWords));
    expect(new Set(slugsOrEnum.flatMap((edit) => edit.slugs)).size).toBe(22);
  });
});
