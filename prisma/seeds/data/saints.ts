export type SaintSeed = {
  slug: string;
  canonicalName: string;
  feastDay: string;
  patronages: string[];
  biography: string;
};

export const SAINTS: SaintSeed[] = [
  {
    slug: "st-augustine-of-hippo",
    canonicalName: "St. Augustine of Hippo",
    feastDay: "August 28",
    patronages: ["Theologians", "Printers", "Brewers"],
    biography:
      "Doctor of the Church, author of the Confessions and The City of God; his vigorous theology shaped the Latin tradition.",
  },
  {
    slug: "st-therese-of-lisieux",
    canonicalName: "St. Thérèse of Lisieux",
    feastDay: "October 1",
    patronages: ["Missions", "Florists"],
    biography:
      "The Little Flower; Doctor of the Church known for her Little Way of spiritual childhood and confidence in God.",
  },
  {
    slug: "st-thomas-aquinas",
    canonicalName: "St. Thomas Aquinas",
    feastDay: "January 28",
    patronages: ["Students", "Schools", "Philosophers"],
    biography:
      "Angelic Doctor; the Summa Theologica remains a monumental synthesis of Christian philosophy and theology.",
  },
  {
    slug: "st-joseph",
    canonicalName: "St. Joseph",
    feastDay: "March 19",
    patronages: ["The Universal Church", "Fathers", "Workers"],
    biography:
      "Foster father of Jesus and husband of the Blessed Virgin Mary; patron of the Universal Church.",
  },
];
