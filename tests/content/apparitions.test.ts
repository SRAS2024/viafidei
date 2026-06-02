import { describe, expect, it } from "vitest";

import {
  apparitionApprovalLabel,
  apparitionEyebrow,
  apparitionFeastDay,
} from "@/lib/content-shared/apparitions";

describe("apparitionApprovalLabel", () => {
  it("maps the approval enum to a readable label", () => {
    expect(apparitionApprovalLabel({ approvedStatus: "approved" })).toBe("Approved");
    expect(apparitionApprovalLabel({ approvedStatus: "under_investigation" })).toBe(
      "Under investigation",
    );
    expect(apparitionApprovalLabel({})).toBeUndefined();
  });
});

describe("apparitionFeastDay", () => {
  it("uses a stored feastDay when present", () => {
    expect(apparitionFeastDay({ feastDay: "03-25", title: "Some Apparition" })).toBe("03-25");
  });

  it("falls back to the curated feast of major apparitions by name", () => {
    expect(apparitionFeastDay({ title: "Our Lady of Lourdes" })).toBe("02-11");
    expect(apparitionFeastDay({ title: "Our Lady of Fátima" })).toBe("05-13");
    expect(apparitionFeastDay({ slug: "our-lady-of-fatima" })).toBe("05-13");
    expect(apparitionFeastDay({ title: "Our Lady of Guadalupe" })).toBe("12-12");
    expect(apparitionFeastDay({ title: "Our Lady of La Salette" })).toBe("09-19");
    expect(apparitionFeastDay({ title: "Our Lady of Knock" })).toBe("08-21");
    expect(apparitionFeastDay({ title: "Our Lady of the Miraculous Medal" })).toBe("11-27");
  });

  it("returns undefined for apparitions with no known feast", () => {
    expect(apparitionFeastDay({ title: "A Private Revelation" })).toBeUndefined();
    expect(apparitionFeastDay({})).toBeUndefined();
  });
});

describe("apparitionEyebrow", () => {
  it("combines status and feast day", () => {
    expect(apparitionEyebrow({ approvedStatus: "approved", title: "Our Lady of Lourdes" })).toBe(
      "Approved · Feast February 11",
    );
  });

  it("shows status alone when there is no feast", () => {
    expect(apparitionEyebrow({ approvedStatus: "under_investigation", title: "Medjugorje" })).toBe(
      "Under investigation",
    );
  });

  it("returns undefined when there is nothing to show", () => {
    expect(apparitionEyebrow({})).toBeUndefined();
  });
});
