import { describe, expect, it } from "vitest";
import { categorizeSaintByName } from "@/lib/data/saints";

describe("categorizeSaintByName", () => {
  it("classifies Marian titles as our-lady", () => {
    expect(categorizeSaintByName("Our Lady of Guadalupe")).toBe("our-lady");
    expect(categorizeSaintByName("Blessed Virgin Mary, Mother of God")).toBe("our-lady");
    expect(categorizeSaintByName("Madonna del Buon Consiglio")).toBe("our-lady");
    expect(categorizeSaintByName("Notre Dame de Lourdes")).toBe("our-lady");
    expect(categorizeSaintByName("Theotokos")).toBe("our-lady");
    expect(categorizeSaintByName("Nuestra Señora del Pilar")).toBe("our-lady");
  });

  it("classifies named angels as angel", () => {
    expect(categorizeSaintByName("Saint Michael the Archangel")).toBe("angel");
    expect(categorizeSaintByName("Saint Gabriel the Archangel")).toBe("angel");
    expect(categorizeSaintByName("Saint Raphael the Archangel")).toBe("angel");
    expect(categorizeSaintByName("Holy Guardian Angels")).toBe("angel");
  });

  it("classifies canonized humans as saint by default", () => {
    expect(categorizeSaintByName("Saint Anthony of Padua")).toBe("saint");
    expect(categorizeSaintByName("Saint Therese of Lisieux")).toBe("saint");
    expect(categorizeSaintByName("Pope Saint John Paul II")).toBe("saint");
    expect(categorizeSaintByName("Saint Joseph")).toBe("saint");
  });
});
