/**
 * A church a map tags as Catholic whose own name says it is Protestant is no parish of
 * the directory, and a Catholic name that merely shares a word is never caught.
 */
import { describe, expect, it } from "vitest";

import { PROTESTANT_NAME_RE, parishExclusionFor } from "@/lib/admin-worker/parish-osm";

describe("a Protestant church's own name", () => {
  it.each([
    "감리교회",
    "강남감리교회",
    "서울장로교회",
    "순복음교회",
    "First Methodist Church",
    "Grace Lutheran Church",
    // Tagged Catholic in OpenStreetMap, found in the directory on 2026-11-07.
    "하나님의교회 세계복음선교협회",
    "제칠일 안식일예수재림교 서울중앙교회",
    "정교회춘천성보리스성당",
    "한국정교회 성 니콜라스 대성당",
  ])("keeps %s out", (name) => {
    expect(parishExclusionFor(name)?.reason).toBe("not-catholic");
  });

  it.each([
    "St. John the Baptist",
    "Saint John the Baptist Catholic Church",
    "Church of Christ the King",
    "Christ the King",
    "명동대성당",
    "강구성당",
    "Holy Rosary Church",
    "천주교 이태원교회",
    "김녕성당(김녕천주교회)",
    "하느님의 자비 성당",
    "수정성당",
  ])("leaves the Catholic %s alone", (name) => {
    expect(PROTESTANT_NAME_RE.test(name)).toBe(false);
    expect(parishExclusionFor(name)?.reason).not.toBe("not-catholic");
  });
});

describe("a bare Korean building label", () => {
  it.each(["대성당", "성당", "성모당", "교회"])("names no place, so %s is left out", (name) => {
    expect(parishExclusionFor(name)?.reason).toBe("generic-name");
  });

  it.each(["명동대성당", "해미순교성지 대성당", "연무대성당"])(
    "keeps %s, which names its place",
    (name) => {
      expect(parishExclusionFor(name)).toBeNull();
    },
  );
});
