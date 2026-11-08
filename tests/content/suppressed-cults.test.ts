/**
 * The cults the Church suppressed or never allowed are refused by the saint import, by
 * name, and nothing else is: a saint who shares part of a name keeps his place.
 */
import { describe, expect, it } from "vitest";

import { isSuppressedCult } from "@/lib/content-shared/suppressed-cults";

describe("isSuppressedCult", () => {
  it.each([
    "Simon of Trent",
    "Blessed Simon of Trent",
    "Simonino di Trento",
    "Werner of Oberwesel",
    "Saint Werner of Bacharach",
    "Saint Dominguito del Val",
    "Andreas Oxner of Rinn",
    "Anderl von Rinn",
    "William of Norwich",
    "Little Saint Hugh of Lincoln",
    "Richard of Pontoise",
    "Rudolph of Berne",
    "Holy Child of La Guardia",
    "Harold of Gloucester",
    "Robert of Bury",
  ])("refuses %s", (name) => {
    expect(isSuppressedCult(name)).toBe(true);
  });

  it.each([
    "Saint Hugh of Lincoln",
    "Saint Simon the Zealot",
    "Saint William of York",
    "Saint Robert Bellarmine",
    "Saint Richard of Chichester",
    "Saint Dominic",
  ])("keeps %s", (name) => {
    expect(isSuppressedCult(name)).toBe(false);
  });
});
