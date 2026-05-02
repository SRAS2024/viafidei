export type PrayerSeed = {
  slug: string;
  defaultTitle: string;
  category: string;
  body: string;
};

export const PRAYERS: PrayerSeed[] = [
  {
    slug: "pater-noster",
    defaultTitle: "Pater Noster",
    category: "Dominical",
    body:
      "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
  },
  {
    slug: "ave-maria",
    defaultTitle: "Ave Maria",
    category: "Marian",
    body:
      "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
  },
  {
    slug: "anima-christi",
    defaultTitle: "Anima Christi",
    category: "Eucharistic",
    body:
      "Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Within thy wounds hide me. Suffer me not to be separated from thee. From the malignant enemy defend me. In the hour of my death call me, and bid me come unto thee, that with thy saints I may praise thee for ever and ever. Amen.",
  },
  {
    slug: "regina-caeli",
    defaultTitle: "Regina Cæli",
    category: "Marian",
    body:
      "Queen of Heaven, rejoice, alleluia, for He whom you did merit to bear, alleluia, has risen as He said, alleluia. Pray for us to God, alleluia.",
  },
  {
    slug: "memorare",
    defaultTitle: "Memorare",
    category: "Marian",
    body:
      "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession, was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee I come; before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
  },
];
