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
    description:
      "Receive the Sacrament of Confession this month. The goal walks you through the full spiritual practice — preparation, examination of conscience, contrition, the rite itself, absolution, and the follow-up that turns one good confession into a lasting conversion.",
    defaultDurationDays: 30,
    category: "sacrament",
    checklist: [
      "Choose a confession time at your parish (or a nearby one) and add it to your calendar",
      "Set aside 20–30 minutes for an examination of conscience using the Ten Commandments",
      "Note any mortal sins by kind and approximate number; recall venial sins honestly",
      "Arouse contrition: sorrow for having offended a good and loving God, not merely fear of punishment",
      "Make a firm purpose of amendment — name the occasions of sin you will avoid",
      "Enter the confessional and begin: ‘Bless me, Father, for I have sinned…’",
      "Confess your sins clearly; listen to the priest's counsel; accept the penance",
      "Pray the Act of Contrition aloud when invited",
      "Receive sacramental absolution; answer ‘Amen’",
      "Complete the assigned penance as soon as practicable",
      "Give thanks; journal one concrete resolution to live out this week",
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

  // ── Sacrament-completion goals ───────────────────────────────────
  // One per sacrament. Marking the goal complete unlocks the
  // corresponding badge on the user's profile. "Already completed"
  // workflow in the profile UI lets the user date-stamp a sacrament
  // they received before joining the app.

  {
    slug: "sacrament-baptism",
    title: "Receive the Sacrament of Baptism",
    description:
      "The first of the seven sacraments and the gateway to the Christian life — receive Baptism in the Catholic Church.",
    category: "sacrament",
    checklist: [
      "Speak with a parish priest about reception",
      "Begin OCIA / catechumenate if needed",
      "Choose your baptismal name and godparents",
      "Receive the Sacrament of Baptism",
    ],
  },
  {
    slug: "sacrament-confirmation",
    title: "Receive the Sacrament of Confirmation",
    description: "Be sealed with the Gift of the Holy Spirit through Confirmation.",
    category: "sacrament",
    checklist: [
      "Attend Confirmation preparation classes",
      "Choose a Confirmation name (a saint as patron)",
      "Choose a sponsor in good standing with the Church",
      "Receive the sacred chrism from the bishop",
    ],
  },
  {
    slug: "sacrament-first-communion",
    title: "Receive your First Holy Communion",
    description:
      "Receive Jesus Christ — body, blood, soul, and divinity — for the first time in the Most Holy Eucharist.",
    category: "sacrament",
    checklist: [
      "Complete Eucharistic preparation (typically First Confession first)",
      "Make a good Confession the day or week before",
      "Approach the altar fasting one hour before Communion",
      "Receive the Body of Christ with reverence",
    ],
  },
  {
    slug: "sacrament-matrimony",
    title: "Receive the Sacrament of Matrimony",
    description:
      "Enter the covenant of Christian marriage in the Catholic Church.",
    category: "sacrament",
    checklist: [
      "Engage in formal pre-Cana / marriage preparation",
      "Complete the parish pre-nuptial inquiry",
      "Make a good Confession before the wedding day",
      "Exchange consent before the Church and receive the nuptial blessing",
    ],
  },
  {
    slug: "sacrament-holy-orders",
    title: "Receive Holy Orders",
    description: "Be ordained to the diaconate, presbyterate, or episcopate.",
    category: "sacrament",
    checklist: [
      "Discern vocation under a spiritual director",
      "Apply to a seminary or religious formation program",
      "Complete formation (typically 4–7 years)",
      "Receive Holy Orders through the laying on of hands by the bishop",
    ],
  },
  {
    slug: "sacrament-anointing-of-the-sick",
    title: "Receive the Anointing of the Sick",
    description:
      "When seriously ill or in danger of death, receive the sacrament of healing and strength.",
    category: "sacrament",
    checklist: [
      "Request a priest from your parish",
      "Make a confession if able and conscious",
      "Receive the anointing with the Oil of the Sick",
      "Receive Viaticum (Holy Communion as food for the journey) if available",
    ],
  },

  // ── Holy Family consecration (the existing template already has
  //     Marian, St. Joseph, and Sacred Heart — this fills the gap)
  {
    slug: "consecration-holy-family",
    title: "Consecration to the Holy Family",
    description:
      "Personal and family consecration to Jesus, Mary, and Joseph — the school of holiness for every Christian home.",
    defaultDurationDays: 9,
    category: "consecration",
    checklist: [
      "Day 1 — Meditate on the Annunciation and Mary's fiat",
      "Day 2 — Meditate on the Visitation",
      "Day 3 — Meditate on the Nativity",
      "Day 4 — Meditate on the Presentation in the Temple",
      "Day 5 — Meditate on the Flight into Egypt",
      "Day 6 — Meditate on the hidden life at Nazareth",
      "Day 7 — Meditate on the Finding of Jesus in the Temple",
      "Day 8 — Pray the Litany of the Holy Family",
      "Day 9 — Make the act of consecration as a family",
    ],
  },
];

export function getGoalTemplate(slug: string): GoalTemplate | null {
  return GOAL_TEMPLATES.find((g) => g.slug === slug) ?? null;
}
