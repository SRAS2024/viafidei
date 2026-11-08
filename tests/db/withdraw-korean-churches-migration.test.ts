/**
 * Migration 0078 withdraws Korean churches that OpenStreetMap tags Catholic but are not,
 * places that are no church at all, and one bare shrine label. It must never take a
 * Catholic parish, must reject the checklist items of what no import rule keeps out, and
 * must leave the bare label unrejected, because the import already leaves such a name out
 * and the shrine may come back under its own name.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PROTESTANT_NAME_RE, parishExclusionFor } from "@/lib/admin-worker/parish-osm";

const NAME = "0078_withdraw_korean_churches_that_are_not_catholic";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

const LITERAL = "'(?:[^']|'')*'";
const unquote = (literal: string) => literal.slice(1, -1).replace(/''/g, "'");
/** The rows of every VALUES list that follows `WITH <name>(`, as their literals. */
function listsOf(name: string): string[][][] {
  return sql
    .split(`WITH ${name}(`)
    .slice(1)
    .map((part) =>
      [
        ...part
          .slice(0, part.indexOf("\n)\n"))
          .matchAll(new RegExp(`\\(\\s*(${LITERAL}(?:,\\s*${LITERAL})*)\\s*\\)`, "g")),
      ].map((row) =>
        [...row[1]!.matchAll(new RegExp(LITERAL, "g"))].map((literal) => unquote(literal[0])),
      ),
    );
}

const [rejected = [], unpublished = []] = listsOf("withdrawn");
const unnamed = listsOf("unnamed")[0] ?? [];
const reasonOf = (prefix: string) => rejected.filter(([, , reason]) => reason!.startsWith(prefix));
const churches = reasonOf("Withdrawn: not a Catholic church.");
const buildings = reasonOf("Withdrawn: not a church.");

/** A name that says it is a Catholic church: 천주교 …교회, …천주교회, …성당. */
const CATHOLIC_NAME = /천주|가톨릭|카톨릭|성당$/;

/** What the review on 2026-11-07 found to be no church: shops, a hall, curia buildings. */
const NO_CHURCH = [
  "대성당",
  "삼구유통광장마트;대성당",
  "대건관",
  "천주교 대구대교구청",
  "교구청별관",
  "꾸르실료 교육관",
  "교육원다동",
  "교육원 가동",
  "유스티노 기념관",
  "카톨릭신학원",
  "신학대학",
  "성김대건 기념관",
  "남산성당 성물방 '바티카노'",
];

/** The Catholic parishes among the directory's 교회 entries, which stay. */
const KEPT = [
  "천주교망우동성가정교회",
  "김녕성당(김녕천주교회)",
  "천주교 남해교회",
  "천주교 중동교회",
  "천주교 함평교회",
  "천주교 이태원교회",
  "주안5동천주교회",
  "太平天主教堂 태평천주교회",
];

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("rejects and unpublishes the same records, each only while it keeps its name", () => {
    expect(rejected.length).toBe(churches.length + buildings.length);
    expect(unpublished).toEqual(rejected.map(([slug, title]) => [slug, title]));
    expect(new Set(rejected.map(([slug]) => slug)).size).toBe(rejected.length);
    expect(sql).toContain(`SET "approvalStatus" = 'REJECTED'::"ChecklistApprovalStatus"`);
    expect(sql).toContain(`"rejectedReason" = withdrawn."reason"`);
    expect(sql).toContain(`WHERE item."approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"`);
    expect(sql.match(/content\."title" = withdrawn\."title"/g)).toHaveLength(2);
    expect(sql.match(/content\."title" = unnamed\."title"/g)).toHaveLength(1);
    expect(sql.match(/WHERE content\."isPublished"/g)).toHaveLength(2);
    expect(sql.match(/"contentType" = 'PARISH'::"ChecklistContentType"/g)).toHaveLength(3);
    expect(sql).not.toMatch(/\bDELETE\b/);
  });

  it("never takes a Catholic parish", () => {
    const titles = [...rejected, ...unnamed].map(([, title]) => title);
    for (const kept of KEPT) expect(titles, kept).not.toContain(kept);
  });

  it("withdraws a church for what it calls itself", () => {
    expect(churches.length).toBeGreaterThan(100);
    for (const [slug, title] of churches) {
      const otherCommunion =
        PROTESTANT_NAME_RE.test(title!) || (/교회/.test(title!) && !CATHOLIC_NAME.test(title!));
      expect(otherCommunion, `${slug} ${title}`).toBe(true);
    }
    // The import refuses these by name from now on.
    for (const title of [
      "하나님의교회 세계복음선교협회",
      "제칠일 안식일예수재림교 서울중앙교회",
      "정교회춘천성보리스성당",
      "정교회양구성안드레아성당",
    ]) {
      expect(
        churches.map(([, t]) => t),
        title,
      ).toContain(title);
      expect(PROTESTANT_NAME_RE.test(title), title).toBe(true);
    }
  });

  it("withdraws as no church only the shops, the hall and the curia buildings reviewed", () => {
    expect(buildings).toHaveLength(21);
    for (const [slug, title] of buildings) expect(NO_CHURCH, `${slug} ${title}`).toContain(title);
    expect(buildings.filter(([, title]) => title === "대성당")).toHaveLength(9);
  });

  it("unpublishes the bare shrine label without rejecting it: the import leaves it out", () => {
    expect(unnamed).toEqual([["parish-way-684526945", "성모당"]]);
    expect(parishExclusionFor("성모당")?.reason).toBe("generic-name");
    expect(sql.slice(sql.indexOf("WITH unnamed("))).not.toContain("REJECTED");
  });
});
