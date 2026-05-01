export type ApparitionSeed = {
  slug: string;
  title: string;
  location: string;
  country: string;
  approvedStatus: string;
  summary: string;
};

export const APPARITIONS: ApparitionSeed[] = [
  {
    slug: "our-lady-of-guadalupe",
    title: "Our Lady of Guadalupe",
    location: "Tepeyac",
    country: "Mexico",
    approvedStatus: "Approved",
    summary:
      "In December 1531 the Blessed Virgin appeared to St. Juan Diego, leaving her image on the tilma still venerated today in the Basilica of Guadalupe.",
  },
  {
    slug: "our-lady-of-lourdes",
    title: "Our Lady of Lourdes",
    location: "Lourdes",
    country: "France",
    approvedStatus: "Approved",
    summary:
      "In 1858 the Blessed Virgin appeared to St. Bernadette Soubirous at Massabielle, identifying herself as the Immaculate Conception.",
  },
  {
    slug: "our-lady-of-fatima",
    title: "Our Lady of Fátima",
    location: "Fátima",
    country: "Portugal",
    approvedStatus: "Approved",
    summary:
      "In 1917 the Blessed Virgin appeared to three shepherd children, calling the faithful to prayer, penance, and devotion to the Immaculate Heart.",
  },
];
