export type GoalTemplate = {
  slug: string;
  title: string;
  description: string;
  defaultDurationDays?: number;
  category: "novena" | "consecration" | "ocia" | "sacrament" | "fast" | "devotion" | "other";
  checklist: string[];
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    slug: "novena-9-day",
    title: "Nine-day Novena",
    description: "A traditional 9-day prayer novena.",
    defaultDurationDays: 9,
    category: "novena",
    checklist: Array.from({ length: 9 }, (_, i) => `Day ${i + 1} prayer`),
  },
  {
    slug: "pray-rosary-daily",
    title: "Pray the Rosary every day",
    description: "A 30-day practice of praying a full Rosary daily.",
    defaultDurationDays: 30,
    category: "devotion",
    checklist: [
      "Open with the Sign of the Cross and the Apostles' Creed",
      "Pray the opening Our Father",
      "Pray three Hail Marys for faith, hope, and charity",
      "Announce the first mystery and pray its decade",
      "Pray the remaining four decades with their mysteries",
      "Close with the Hail, Holy Queen and the closing prayer",
    ],
  },
  {
    slug: "divine-mercy-novena",
    title: "Divine Mercy Novena",
    description: "A 9-day novena praying the Chaplet of Divine Mercy.",
    defaultDurationDays: 9,
    category: "novena",
    checklist: [
      "Day 1 — for all mankind, especially sinners",
      "Day 2 — for the souls of priests and religious",
      "Day 3 — for all devout and faithful souls",
      "Day 4 — for those who do not believe in Jesus and those who do not yet know him",
      "Day 5 — for the souls of separated brethren",
      "Day 6 — for the meek and humble and the children",
      "Day 7 — for those who especially venerate and glorify Jesus' mercy",
      "Day 8 — for souls detained in Purgatory",
      "Day 9 — for souls who have become lukewarm",
    ],
  },
  {
    slug: "monthly-confession",
    title: "Monthly Confession",
    description: "Receive the sacrament of Confession once a month.",
    defaultDurationDays: 30,
    category: "sacrament",
    checklist: [
      "Make an examination of conscience",
      "Pray an Act of Contrition",
      "Receive the sacrament from a priest",
      "Complete the assigned penance",
    ],
  },
  {
    slug: "weekly-adoration",
    title: "Weekly Eucharistic Adoration",
    description: "Spend a holy hour before the Blessed Sacrament each week.",
    defaultDurationDays: 28,
    category: "devotion",
    checklist: [
      "Choose a parish offering Adoration",
      "Set aside one hour each week",
      "Bring Scripture or a Litany for guided prayer",
      "Close with a prayer of thanksgiving",
    ],
  },
  {
    slug: "marian-consecration",
    title: "Marian Consecration (33 days)",
    description: "A 33-day total consecration to Jesus through Mary.",
    defaultDurationDays: 33,
    category: "consecration",
    checklist: [
      "Days 1–12: Preparatory phase — renunciation of the world",
      "Days 13–19: Knowledge of self",
      "Days 20–26: Knowledge of the Blessed Virgin Mary",
      "Days 27–33: Knowledge of Jesus Christ",
      "Make the act of consecration",
    ],
  },
  {
    slug: "vocation-discernment",
    title: "Discerning your vocation",
    description: "A 40-day rule of prayer for vocational discernment.",
    defaultDurationDays: 40,
    category: "other",
    checklist: [
      "Pray a daily Holy Hour or Rosary for your vocation",
      "Speak with a trusted priest or spiritual director",
      "Read the lives of saints in your state of life",
      "Make a weekly examination of consolations and desolations",
      "Conclude with a retreat or day of recollection",
    ],
  },
  {
    slug: "daily-examen",
    title: "Daily Examination of Conscience",
    description: "A 30-day practice of nightly examen.",
    defaultDurationDays: 30,
    category: "other",
    checklist: [
      "Place yourself in God's presence",
      "Give thanks for the gifts of the day",
      "Review the day asking for the Holy Spirit's light",
      "Acknowledge faults and ask forgiveness",
      "Resolve, with God's grace, to amend tomorrow",
    ],
  },
  {
    slug: "sacred-heart-novena",
    title: "Novena to the Sacred Heart",
    description: "A 9-day novena to the Sacred Heart of Jesus.",
    defaultDurationDays: 9,
    category: "novena",
    checklist: Array.from(
      { length: 9 },
      (_, i) => `Day ${i + 1} — Sacred Heart prayer and reflection`,
    ),
  },
  {
    slug: "novena-st-michael-lent",
    title: "St. Michael's Lent",
    description: "A 40-day preparation devotion ending on the Feast of St. Michael (Sept 29).",
    defaultDurationDays: 40,
    category: "novena",
    checklist: Array.from({ length: 40 }, (_, i) => `Day ${i + 1}`),
  },
  {
    slug: "consecration-de-montfort",
    title: "Consecration to Jesus through Mary (St. Louis de Montfort)",
    description: "33-day total consecration prepared by St. Louis-Marie Grignion de Montfort.",
    defaultDurationDays: 33,
    category: "consecration",
    checklist: [
      "Days 1–12: Preparatory phase (renunciation of the world)",
      "Days 13–19: Knowledge of self",
      "Days 20–26: Knowledge of the Blessed Virgin Mary",
      "Days 27–33: Knowledge of Jesus Christ",
      "Day 33: Make the act of consecration",
    ],
  },
  {
    slug: "consecration-st-joseph",
    title: "Consecration to St. Joseph",
    description:
      "33-day consecration after the model promoted by Fr. Donald Calloway, beginning on a feast that ends on a feast of St. Joseph.",
    defaultDurationDays: 33,
    category: "consecration",
    checklist: ["Begin", "Daily reading", "Daily prayer", "Make act of consecration"],
  },
  {
    slug: "consecration-sacred-heart",
    title: "Consecration to the Sacred Heart",
    description: "Personal consecration to the Sacred Heart of Jesus.",
    defaultDurationDays: 33,
    category: "consecration",
    checklist: ["Daily Sacred Heart prayer", "Daily reflection", "Make consecration"],
  },
  {
    slug: "ocia-journey",
    title: "OCIA / RCIA Journey",
    description: "Catechumenate process for full reception into the Catholic Church.",
    category: "ocia",
    checklist: [
      "Inquiry",
      "Catechumenate",
      "Period of Purification and Enlightenment",
      "Sacraments of Initiation",
      "Mystagogy",
    ],
  },
  {
    slug: "sacrament-confession",
    title: "Make a good Confession",
    description: "Prepare and receive the Sacrament of Reconciliation.",
    category: "sacrament",
    checklist: [
      "Examination of conscience",
      "Act of contrition",
      "Receive absolution",
      "Complete the assigned penance",
    ],
  },
  {
    slug: "fast-friday",
    title: "Friday penance",
    description: "Honor the Lord's Passion every Friday with a chosen fast or abstinence.",
    category: "fast",
    checklist: ["Choose your weekly Friday penance", "Practice it each Friday", "Pray for graces"],
  },
];

export function getGoalTemplate(slug: string): GoalTemplate | null {
  return GOAL_TEMPLATES.find((g) => g.slug === slug) ?? null;
}
