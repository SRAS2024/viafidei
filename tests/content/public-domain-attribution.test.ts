/**
 * A saint whose biography is quoted from the Catholic Encyclopedia (1913) or
 * the Roman Martyrology (1916) is credited to that work — one small line, as
 * Wikipedia text is — and never to Wikipedia, even though the Wikipedia
 * article read for its feast and stage is among its citations.
 */
import { describe, expect, it } from "vitest";

import { publicDomainTextSource } from "@/lib/content-shared/public-domain-attribution";
import { wikipediaTextSource } from "@/lib/content-shared/wikipedia-attribution";

const WD = "https://www.wikidata.org/wiki/Q1288349";
const EN = "https://en.wikipedia.org/wiki/%C3%8Dte_of_Killeedy";
const CE = "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/St._Ita";
const RM = "https://archive.org/details/romanmartyrology00cathuoft";
const BIO =
  'Saint Ita, called the "Brigid of Munster"; b. in the present County of Waterford, about 475; d. 15 January, 570.';

const encyclopediaSaint = {
  biography: BIO,
  citations: [WD, EN, CE],
  provenance: {
    biography: "catholic-encyclopedia-1913",
    biographyUrl: CE,
    biographyTitle: "St. Ita",
    feast: "wikipedia",
  },
};

describe("publicDomainTextSource", () => {
  it("credits an Encyclopedia biography with its article", () => {
    expect(publicDomainTextSource(encyclopediaSaint)).toEqual({
      source: "catholic-encyclopedia-1913",
      url: CE,
      work: "the Catholic Encyclopedia (1913)",
      title: "St. Ita",
    });
  });

  it("credits a Martyrology announcement with the book", () => {
    expect(
      publicDomainTextSource({
        biography:
          "At Riez, in France, St. Maximus, bishop and confessor, who, from his tender years …",
        provenance: {
          biography: "roman-martyrology-1916",
          biographyUrl: RM,
          biographyDay: "11-27",
        },
      }),
    ).toEqual({ source: "roman-martyrology-1916", url: RM, work: "the Roman Martyrology (1916)" });
  });

  it("is null for Wikipedia text, a missing biography, or a page off the source's host", () => {
    expect(
      publicDomainTextSource({
        biography: BIO,
        provenance: { biography: "wikipedia", article: EN },
      }),
    ).toBeNull();
    expect(publicDomainTextSource({ provenance: encyclopediaSaint.provenance })).toBeNull();
    expect(
      publicDomainTextSource({
        biography: BIO,
        provenance: {
          ...encyclopediaSaint.provenance,
          biographyUrl: "https://www.newadvent.org/cathen/08201c.htm",
        },
      }),
    ).toBeNull();
  });
});

describe("wikipediaTextSource on a public-domain biography", () => {
  it("never credits Wikipedia for it, though the article is cited", () => {
    expect(wikipediaTextSource("SAINT", encyclopediaSaint)).toBeNull();
    expect(
      wikipediaTextSource("SAINT", {
        biography: "In Africa, in a village called Lemelis, the holy martyrs Primus and Donatus …",
        citations: [
          "https://www.wikidata.org/wiki/Q16591776",
          "https://pl.wikipedia.org/wiki/Prymus_i_Donat",
          RM,
        ],
        provenance: { biography: "roman-martyrology-1916", biographyUrl: RM, feast: "wikipedia" },
      }),
    ).toBeNull();
  });
});
