/**
 * Saint identity matcher tests (spec §7).
 *
 * The Saint builder uses assessSaintIdentity() to reject pages that
 * are *about an institution named after a saint* — parishes,
 * schools, churches, hospitals, staff pages, bulletins, livestreams
 * — rather than the saint themselves.
 */

import { describe, expect, it } from "vitest";
import { assessSaintIdentity } from "@/lib/content-factory/normalize/saint-identity";

describe("assessSaintIdentity()", () => {
  it('classifies "St. Patrick\'s Cathedral" as institution, not saint_profile', () => {
    const r = assessSaintIdentity({
      title: "St. Patrick's Cathedral",
      body: "St. Patrick's Cathedral is a famous Catholic church in midtown Manhattan.",
    });
    expect(r.kind).toBe("institution");
  });

  it('classifies "St. Thomas Aquinas Catholic School" as institution', () => {
    const r = assessSaintIdentity({
      title: "St. Thomas Aquinas Catholic School",
      body: "Welcome to our school. Enrollment for the 2026 school year is now open.",
    });
    expect(r.kind).toBe("institution");
  });

  it('classifies "St. Joseph Hospital" as institution', () => {
    const r = assessSaintIdentity({
      title: "St. Joseph Hospital",
      body: "St. Joseph Hospital is a 250-bed acute care medical center.",
    });
    expect(r.kind).toBe("institution");
  });

  it("classifies a saint biography with feast day and canonization cues as saint_profile", () => {
    const r = assessSaintIdentity({
      title: "St. Thomas Aquinas",
      body:
        "St. Thomas Aquinas was canonized in 1323 and declared a Doctor of the Church. " +
        "His feast day is January 28. He is the patron saint of theologians.",
    });
    expect(r.kind).toBe("saint_profile");
  });

  it("classifies a livestream page as livestream even when the title names a saint", () => {
    const r = assessSaintIdentity({
      title: "St. Mary's Parish — Watch Live",
      body: "Join us live every Sunday at 10am. Click here to register for tonight's livestream.",
    });
    expect(r.kind).toBe("livestream");
  });

  it("classifies a staff directory as staff_or_bulletin", () => {
    const r = assessSaintIdentity({
      title: "St. Patrick's Parish — Staff Directory",
      body:
        "Father John Doe — Pastor. Phone: (212) 555-1234. Email: father@stpat.org. " +
        "Office hours: Monday-Friday. Mass schedule: Saturday 5pm, Sunday 9am.",
    });
    expect(r.kind).toBe("staff_or_bulletin");
  });

  it("returns unknown when no decisive signal is present", () => {
    const r = assessSaintIdentity({
      title: "Some Page",
      body: "Some content without any obvious cues.",
    });
    expect(r.kind).toBe("unknown");
  });
});
