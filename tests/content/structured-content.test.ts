import { describe, expect, it } from "vitest";

import { toDisclosureItems } from "@/lib/content-shared/structured-content";

describe("toDisclosureItems (guide prayers / novena days → dropdowns)", () => {
  it("turns guide prayers (title + text) into disclosure items in order", () => {
    const items = toDisclosureItems([
      { title: "Our Father", text: "Our Father, who art in heaven..." },
      { title: "Hail Mary", text: "Hail Mary, full of grace..." },
    ]);
    expect(items).toEqual([
      { title: "Our Father", body: "Our Father, who art in heaven..." },
      { title: "Hail Mary", body: "Hail Mary, full of grace..." },
    ]);
  });

  it("turns novena days (title + prayer) into disclosure items", () => {
    const items = toDisclosureItems([
      { title: "Day 1", prayer: "Day one prayer. Amen." },
      { title: "Day 2", prayer: "Day two prayer. Amen." },
    ]);
    expect(items?.map((i) => i.title)).toEqual(["Day 1", "Day 2"]);
    expect(items?.[0]?.body).toMatch(/Day one prayer/);
  });

  it("joins array-of-strings bodies (steps) into multi-line text", () => {
    const items = toDisclosureItems([
      { title: "Day 1", steps: ["Make the Sign of the Cross", "Pray"] },
    ]);
    expect(items?.[0]?.body).toBe("Make the Sign of the Cross\nPray");
  });

  it("returns null for plain string arrays (keeps normal list rendering)", () => {
    expect(toDisclosureItems(["a", "b", "c"])).toBeNull();
  });

  it("returns null when elements lack a label or a body", () => {
    expect(toDisclosureItems([{ foo: "bar" }])).toBeNull();
    expect(toDisclosureItems([{ title: "x" }])).toBeNull();
    expect(toDisclosureItems([])).toBeNull();
    expect(toDisclosureItems("not an array")).toBeNull();
  });
});
