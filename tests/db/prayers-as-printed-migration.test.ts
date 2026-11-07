/**
 * Migration 0069 corrects scanning errors in the psalms and canticles of the prayer
 * library on the day it deploys. Each statement replaces exact words in one named row, so
 * the file has to agree with the curated text the worker would write, or the worker's next
 * sync would change it back, and with the Scripture store, which was corrected from the
 * printed editions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { BookCode } from "@/lib/content-shared/bible/books";
import { douayText } from "@/lib/content-shared/bible/dra";
import { findCuratedEntry } from "@/lib/checklist";

const NAME = "0069_prayers_as_printed";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

const unquote = (literal: string) => literal.slice(1, -1).replace(/''/g, "'");
const LITERAL = "'(?:[^']|'')*'";

interface Edit {
  slug: string;
  oldWords: string;
  newWords: string;
}

const edits: Edit[] = sql
  .split('UPDATE "PublishedContent"')
  .slice(1)
  .map((statement) => {
    const words = new RegExp(
      `replace\\("payload"->>'body',\\s*(${LITERAL}),\\s*(${LITERAL})\\)`,
    ).exec(statement);
    const guard = new RegExp(`strpos\\("payload"->>'body', (${LITERAL})\\) > 0;`).exec(statement);
    const slug = /AND "slug" = '([^']+)'/.exec(statement);
    expect(words, statement).toBeTruthy();
    expect(guard, statement).toBeTruthy();
    expect(slug, statement).toBeTruthy();
    expect(unquote(guard![1]!), "the guard names the same words").toBe(unquote(words![1]!));
    expect(statement).toContain(`"contentType" = 'PRAYER'::"ChecklistContentType"`);
    return {
      slug: slug![1]!,
      oldWords: unquote(words![1]!),
      newWords: unquote(words![2]!),
    };
  });

/** Where the store has each corrected reading. */
const VERSE: Record<string, [BookCode, number, number]> = {
  "for all the things that he hath rendered to me?": ["PSA", 115, 3],
  "hath exalted me": ["PSA", 117, 16],
  "I will go in to them,": ["PSA", 117, 19],
  "in the name of the Lord. We have blessed": ["PSA", 117, 26],
  "night shall be light as the day:": ["PSA", 138, 12],
  "The high praises of God": ["PSA", 149, 6],
  "will not fear: because": ["ISA", 12, 2],
  "they shall be called the children of God.": ["MAT", 5, 9],
  "and are none of his children": ["DEU", 32, 5],
};

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("has every correction, and nothing it cannot account for", () => {
    expect(edits.map((edit) => edit.newWords).sort()).toEqual(Object.keys(VERSE).sort());
  });

  for (const { slug, oldWords, newWords } of edits) {
    describe(`${slug}: "${newWords}"`, () => {
      const body = String(findCuratedEntry("PRAYER", slug)?.payload.body);

      it("leaves the row as the curated entry has it", () => {
        expect(body).toContain(newWords);
        expect(body).not.toContain(oldWords);
      });

      it("cannot run twice, since the old words are not inside the new", () => {
        expect(newWords).not.toContain(oldWords);
      });

      it("says what the Scripture store says", () => {
        const [book, chapter, verse] = VERSE[newWords]!;
        expect(douayText(book, chapter, verse)).toContain(newWords);
      });
    });
  }
});
