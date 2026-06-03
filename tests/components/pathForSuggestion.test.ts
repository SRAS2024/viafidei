import { describe, expect, it } from "vitest";

import { pathForSuggestion, type Suggestion } from "@/components/layout/HeaderSearchClient";

const s = (group: Suggestion["group"], slug: string): Suggestion => ({
  group,
  id: slug,
  slug,
  label: slug,
});

describe("pathForSuggestion (search suggestion → detail route)", () => {
  it("routes each group to its real public detail page", () => {
    expect(pathForSuggestion(s("prayers", "anima-christi"))).toBe("/prayers/anima-christi");
    expect(pathForSuggestion(s("saints", "augustine"))).toBe("/saints/augustine");
    // Apparitions live under Our Lady, not Saints.
    expect(pathForSuggestion(s("apparitions", "our-lady-of-lourdes"))).toBe(
      "/our-lady/our-lady-of-lourdes",
    );
    // Parishes have their own tab, not the (redirecting) spiritual-guidance path.
    expect(pathForSuggestion(s("parishes", "st-marys"))).toBe("/parishes/st-marys");
    expect(pathForSuggestion(s("devotions", "sacred-heart"))).toBe("/devotions/sacred-heart");
    expect(pathForSuggestion(s("liturgy", "rerum-novarum"))).toBe("/liturgy-history/rerum-novarum");
    // Content types added after the original groups.
    expect(pathForSuggestion(s("popes", "leo-xiii"))).toBe("/popes/leo-xiii");
    expect(pathForSuggestion(s("doctors", "aquinas"))).toBe("/doctors/aquinas");
    expect(pathForSuggestion(s("guides", "how-to-pray-the-rosary"))).toBe(
      "/guides/how-to-pray-the-rosary",
    );
    expect(pathForSuggestion(s("sacraments", "baptism"))).toBe("/sacraments/baptism");
    expect(pathForSuggestion(s("rites", "byzantine"))).toBe("/rites/byzantine");
    expect(pathForSuggestion(s("documents", "lumen-gentium"))).toBe(
      "/liturgy-history/lumen-gentium",
    );
  });

  it("keeps sacraments / consecrations under the sacraments tab from the spiritual-life group", () => {
    expect(pathForSuggestion(s("spiritualLife", "sacrament-baptism"))).toBe(
      "/sacraments/sacrament-baptism",
    );
    expect(pathForSuggestion(s("spiritualLife", "consecration-marian"))).toBe(
      "/sacraments/consecration-marian",
    );
    expect(pathForSuggestion(s("spiritualLife", "benedictines"))).toBe(
      "/spiritual-life/benedictines",
    );
  });
});
