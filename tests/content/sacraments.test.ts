import { describe, expect, it } from "vitest";

import { SEVEN_SACRAMENTS, matchSacrament } from "@/lib/content-shared/sacraments";
import * as Badges from "@/components/icons/SacramentBadges";

describe("the seven sacraments tab content", () => {
  it("is exactly the seven sacraments, titled and ordered as specified", () => {
    expect(SEVEN_SACRAMENTS.map((s) => s.title)).toEqual([
      "Baptism",
      "Holy Communion",
      "Confirmation",
      "Confession",
      "Anointing of the Sick",
      "Matrimony",
      "Holy Orders",
    ]);
  });

  it("has a badge component for every sacrament icon", () => {
    const components: Record<string, unknown> = {
      baptism: Badges.BaptismBadge,
      eucharist: Badges.EucharistBadge,
      confirmation: Badges.ConfirmationBadge,
      confession: Badges.ConfessionBadge,
      anointing: Badges.AnointingBadge,
      matrimony: Badges.MatrimonyBadge,
      "holy-orders": Badges.HolyOrdersBadge,
    };
    for (const s of SEVEN_SACRAMENTS) {
      expect(typeof components[s.iconKey]).toBe("function");
    }
  });

  it("pairs a published row to its card by sacramentKey", () => {
    expect(
      matchSacrament("the-sacrament-of-baptism", "The Sacrament of Baptism", "BAPTISM")?.title,
    ).toBe("Baptism");
    expect(matchSacrament("x", "Holy Communion", "EUCHARIST")?.title).toBe("Holy Communion");
    // Confession normalises from RECONCILIATION.
    expect(matchSacrament("x", "x", "RECONCILIATION")?.title).toBe("Confession");
  });

  it("falls back to slug/title tokens when no key is present", () => {
    expect(matchSacrament("the-sacrament-of-confession", "Confession", null)?.title).toBe(
      "Confession",
    );
    expect(matchSacrament("holy-matrimony", "On Marriage", null)?.title).toBe("Matrimony");
    expect(matchSacrament("nothing-relevant", "Random page", null)).toBeNull();
  });
});
