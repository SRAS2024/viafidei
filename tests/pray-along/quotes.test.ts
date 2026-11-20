/**
 * The words a guide or a novena day quotes for the reader to say.
 */
import { describe, expect, it } from "vitest";

import { quotedPassages } from "@/lib/pray-along/quotes";

describe("quotedPassages", () => {
  it("finds single-quoted prayers and is not fooled by apostrophes", () => {
    expect(
      quotedPassages(
        "Say them near the person's ear: 'Jesus, Mary and Joseph.' 'Lord Jesus, receive my spirit.' Then pray the Apostles' Creed.",
      ),
    ).toEqual(["Jesus, Mary and Joseph.", "Lord Jesus, receive my spirit."]);
  });

  it("keeps every passage in order, short answers too, whatever the quotation marks", () => {
    expect(
      quotedPassages(
        "All answer 'Amen'; families say: 'Mary, our Mother, we give you our family.' Then: “O my Jesus, forgive us our sins.”",
      ),
    ).toEqual([
      "Amen",
      "Mary, our Mother, we give you our family.",
      "O my Jesus, forgive us our sins.",
    ]);
    expect(quotedPassages("Beten Sie: „Gegrüßet seist du, Maria.“")).toEqual([
      "Gegrüßet seist du, Maria.",
    ]);
  });

  it("says an abbreviated salutation whole, from the one it continues", () => {
    expect(
      quotedPassages(
        "'By the intercession of Saint Michael and the celestial choir of Seraphim, may the Lord make us worthy.' Then: '...and the celestial choir of Cherubim, may the Lord grant us grace.'",
      ),
    ).toEqual([
      "By the intercession of Saint Michael and the celestial choir of Seraphim, may the Lord make us worthy.",
      "By the intercession of Saint Michael and the celestial choir of Cherubim, may the Lord grant us grace.",
    ]);
  });
});
