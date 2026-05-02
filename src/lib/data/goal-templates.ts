export type GoalTemplate = {
  slug: string;
  title: string;
  description: string;
  defaultDurationDays?: number;
  category: "novena" | "consecration" | "ocia" | "sacrament" | "fast" | "other";
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
