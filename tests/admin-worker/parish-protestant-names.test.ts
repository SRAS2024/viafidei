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
  ])("leaves the Catholic %s alone", (name) => {
    expect(PROTESTANT_NAME_RE.test(name)).toBe(false);
    expect(parishExclusionFor(name)?.reason).not.toBe("not-catholic");
  });
});
