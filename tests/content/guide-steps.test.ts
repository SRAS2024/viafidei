import { describe, expect, it } from "vitest";

import { toGuideSteps, toDisclosureItems } from "@/lib/content-shared/structured-content";

describe("toGuideSteps", () => {
  it("keeps the step number the payload stores", () => {
    const steps = toGuideSteps([
      { order: 1, title: "Begin", body: "Make the Sign of the Cross." },
      { order: 2, title: "Continue", body: "Pray the Our Father." },
    ]);
    expect(steps).toEqual([
      { order: 1, title: "Begin", body: "Make the Sign of the Cross." },
      { order: 2, title: "Continue", body: "Pray the Our Father." },
    ]);
  });

  it("sorts by the stored order, not by array position", () => {
    const steps = toGuideSteps([
      { order: 3, title: "Third", body: "c" },
      { order: 1, title: "First", body: "a" },
      { order: 2, title: "Second", body: "b" },
    ]);
    expect(steps?.map((s) => s.title)).toEqual(["First", "Second", "Third"]);
    expect(steps?.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it("renumbers from 1 when the payload has gaps or duplicates", () => {
    // A reader must never see "1, 1, 7" — the numerals are the whole point.
    const steps = toGuideSteps([
      { order: 1, title: "One", body: "a" },
      { order: 1, title: "Also one", body: "b" },
      { order: 7, title: "Seven", body: "c" },
    ]);
    expect(steps?.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it("falls back to array position when order is missing", () => {
    const steps = toGuideSteps([
      { title: "One", body: "a" },
      { title: "Two", body: "b" },
    ]);
    expect(steps?.map((s) => s.order)).toEqual([1, 2]);
  });

  it("returns null for anything that is not a list of title+body objects", () => {
    expect(toGuideSteps(["just a string"])).toBeNull();
    expect(toGuideSteps([])).toBeNull();
    expect(toGuideSteps(null)).toBeNull();
    expect(toGuideSteps([{ title: "No body" }])).toBeNull();
  });

  it("leaves toDisclosureItems working as before (novena days have no number)", () => {
    const items = toDisclosureItems([{ day: "Day One", prayer: "O God..." }]);
    expect(items).toEqual([{ title: "Day One", body: "O God..." }]);
  });
});
