import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const USCCB = "https://www.usccb.org/";

function apparition(
  slug: string,
  title: string,
  location: string,
  country: string,
  year: number,
  visionaries: string[],
  summary: string,
  background: string,
  marianTitleSlug?: string,
  messageHighlights: string[] = [],
): CuratedEntry {
  return {
    contentType: "APPARITION",
    slug,
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug,
      title,
      location,
      country,
      approvedStatus: "approved",
      yearOfApparition: year,
      summary,
      background,
      visionaries,
      messageHighlights,
      ...(marianTitleSlug ? { associatedMarianTitleSlug: marianTitleSlug } : {}),
      citations: [VATICAN, USCCB],
    },
  };
}

export const apparitionKnowledge: CuratedEntry[] = [
  apparition(
    "apparition-our-lady-of-guadalupe",
    "Apparition of Our Lady of Guadalupe",
    "Tepeyac Hill",
    "Mexico",
    1531,
    ["Saint Juan Diego"],
    "The Blessed Virgin Mary appeared four times to the indigenous neophyte Juan Diego at Tepeyac in December 1531, asking that a church be built there and leaving her miraculous image imprinted on his tilma. The apparitions led to the conversion of millions of indigenous peoples and shaped the spiritual identity of the Americas.",
    "Pope Benedict XIV declared Our Lady of Guadalupe patroness of New Spain in 1754. Pope Pius XII named her Empress of the Americas in 1945. Pope John Paul II canonized Juan Diego in 2002. The original tilma remains preserved in the Basilica of Our Lady of Guadalupe in Mexico City, where it continues to defy natural explanation.",
    "our-lady-of-guadalupe",
    [
      "Am I not here, who am your Mother?",
      "Are you not in the folds of my mantle, in the crossing of my arms?",
      "What more do you need?",
    ],
  ),
  apparition(
    "apparition-our-lady-of-lourdes",
    "Apparition of Our Lady of Lourdes",
    "Lourdes",
    "France",
    1858,
    ["Saint Bernadette Soubirous"],
    "The Blessed Virgin Mary appeared eighteen times to the fourteen-year-old peasant girl Marie-Bernarde 'Bernadette' Soubirous at the grotto of Massabielle in Lourdes between February 11 and July 16, 1858. Mary identified herself as 'the Immaculate Conception,' confirming the dogma defined four years earlier by Pope Pius IX.",
    "The apparitions were approved by the Bishop of Tarbes in 1862. The spring uncovered by Bernadette at Mary's direction has been the site of over 70 medically documented miraculous healings recognized by the Church. The Sanctuary of Lourdes receives over six million pilgrims annually. Pope John Paul II established the Memorial of Our Lady of Lourdes on February 11 as the World Day of the Sick.",
    "immaculate-conception",
    [
      "I am the Immaculate Conception.",
      "Penance, penance, penance.",
      "Pray for sinners.",
      "Go and drink at the spring and wash there.",
    ],
  ),
  apparition(
    "apparition-our-lady-of-fatima",
    "Apparition of Our Lady of Fatima",
    "Cova da Iria",
    "Portugal",
    1917,
    ["Saint Lucia dos Santos", "Saint Francisco Marto", "Saint Jacinta Marto"],
    "From May 13 through October 13, 1917, the Blessed Virgin Mary appeared six times to three shepherd children at the Cova da Iria near Fatima, Portugal. The apparitions culminated in the Miracle of the Sun on October 13, witnessed by some 70,000 people. Mary called for prayer, penance, the Rosary, and the consecration of Russia to her Immaculate Heart.",
    "The apparitions were approved by the Bishop of Leiria in 1930. Pope Pius XII consecrated the world to the Immaculate Heart of Mary in 1942. Pope John Paul II credited Our Lady of Fatima with saving his life in the 1981 assassination attempt and consecrated Russia to the Immaculate Heart of Mary in union with all the bishops of the world in 1984. Francisco and Jacinta were canonized in 2017 — the youngest non-martyr saints in Church history.",
    "our-lady-of-fatima",
    [
      "Pray the Rosary every day to obtain peace for the world.",
      "Sacrifice yourselves for sinners.",
      "Russia will be converted and there will be peace.",
      "In the end, my Immaculate Heart will triumph.",
    ],
  ),
  apparition(
    "apparition-miraculous-medal-rue-du-bac",
    "Apparition of the Miraculous Medal (Rue du Bac)",
    "Rue du Bac, Paris",
    "France",
    1830,
    ["Saint Catherine Labouré"],
    "The Blessed Virgin Mary appeared to the Daughter of Charity novice Catherine Labouré in the chapel at 140 Rue du Bac, Paris, on November 27, 1830. Mary stood on a globe with rays of light streaming from her hands and an inscription: 'O Mary, conceived without sin, pray for us who have recourse to thee.' She asked that a medal be struck in this image.",
    "The medal was first struck in 1832 with the approval of the Archbishop of Paris. Devotion spread so rapidly that by 1842 over 100 million medals had been distributed; the medal acquired the popular title 'Miraculous Medal' after the wave of conversions and healings associated with its use. The shrine at Rue du Bac remains one of the most-visited Marian sites in Europe.",
    "immaculate-conception",
    ["O Mary, conceived without sin, pray for us who have recourse to thee."],
  ),
  apparition(
    "apparition-our-lady-of-la-salette",
    "Apparition of Our Lady of La Salette",
    "La Salette-Fallavaux",
    "France",
    1846,
    ["Maximin Giraud", "Mélanie Calvat"],
    "On September 19, 1846, the Blessed Virgin Mary appeared to two shepherd children at La Salette in the French Alps. Weeping, she warned of the consequences of profaning the Lord's Day and taking God's name in vain, and called for prayer and conversion.",
    "The apparition was approved by the Bishop of Grenoble in 1851. The Basilica of Notre-Dame de La Salette stands at the site of the apparition. Pope Pius IX received the children at the Vatican in 1851. Our Lady of La Salette is the Reconciler of Sinners.",
  ),
];
