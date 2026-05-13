import { describe, expect, it } from "vitest";
import { venerationRank } from "@/lib/data/saints";

describe("venerationRank — Mary, Joseph, the Twelve, then the rest", () => {
  function ranks(names: string[]): number[] {
    return names.map(venerationRank);
  }

  it("places Our Lady first (rank 0)", () => {
    expect(venerationRank("Our Lady of Guadalupe")).toBe(0);
    expect(venerationRank("Blessed Virgin Mary, Mother of God")).toBe(0);
  });

  it("places Saint Joseph second (rank 1)", () => {
    expect(venerationRank("Saint Joseph")).toBe(1);
  });

  it("places the Twelve Apostles after Joseph, in traditional order", () => {
    const apostleNames = [
      "Saint Peter",
      "Saint Andrew",
      "Saint James the Greater",
      "Saint John the Apostle",
      "Saint Philip",
      "Saint Bartholomew",
      "Saint Thomas",
      "Saint Matthew",
      "Saint James the Less",
      "Saint Jude Thaddaeus",
      "Saint Simon the Zealot",
      "Saint Matthias",
    ];
    const r = ranks(apostleNames);
    // Each one increments by 1 (between 2 and 13 inclusive).
    expect(r).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("places Mary Magdalene, Stephen, and Paul immediately after the Twelve", () => {
    expect(venerationRank("Saint Mary Magdalene")).toBe(14);
    expect(venerationRank("Saint Stephen the Protomartyr")).toBe(15);
    expect(venerationRank("Saint Paul the Apostle")).toBe(16);
  });

  it("places every other saint at the largest rank (fall-through to alphabetical)", () => {
    expect(venerationRank("Saint Anthony of Padua")).toBe(17);
    expect(venerationRank("Saint Therese of Lisieux")).toBe(17);
    expect(venerationRank("Pope Saint John Paul II")).toBe(17);
  });

  it("Marian titles outrank named angels (angels keep their own /saints filter)", () => {
    // venerationRank only knows the venerable order. Filtering by
    // saints / our-lady / angels happens upstream; this test guards that
    // within "our-lady" Mary still floats to the top.
    expect(venerationRank("Our Lady of Lourdes")).toBeLessThan(
      venerationRank("Saint Michael the Archangel"),
    );
  });
});
