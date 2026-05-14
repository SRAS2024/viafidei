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
    title: "Consecration to Jesus through Mary (St. Louis de Montfort, 33 days)",
    description:
      "33-day total consecration to Jesus through Mary prepared by St. Louis-Marie Grignion de Montfort. The four weeks proceed from renunciation of the world's spirit, through knowledge of self, knowledge of Mary, and knowledge of Jesus Christ. The act of consecration is made on a Marian feast — the Annunciation, the Assumption, the Immaculate Conception, or another solemnity of Our Lady.",
    defaultDurationDays: 33,
    category: "consecration",
    checklist: [
      "Days 1–12 — Spirit of the world: daily reading + Litany of the Holy Spirit + a decade of the Rosary",
      "Days 13–19 — Knowledge of self: examen of corruption + Ave Maris Stella + Litany of the Holy Spirit",
      "Days 20–26 — Knowledge of the Blessed Virgin Mary: Litany of Loreto + Magnificat + a decade",
      "Days 27–33 — Knowledge of Jesus Christ: O Jesu vivens in Maria + Sacred Heart meditation + a decade",
      "Day 33 — Vigil: confession and read the act of consecration aloud",
      "Day 34 — Attend Mass on a Marian feast and make the act of consecration",
    ],
  },
  {
    slug: "consecration-st-joseph",
    title: "Consecration to St. Joseph (33 days)",
    description:
      "33-day consecration after the model promoted by Fr. Donald Calloway. Each phase meditates on one of the Wonders of Saint Joseph — son of David, foster father of the Son of God, mirror of patience, terror of demons, protector of the Church — and the preparation culminates in a personal act of consecration on a feast of Saint Joseph (commonly 19 March or 1 May).",
    defaultDurationDays: 33,
    category: "consecration",
    checklist: [
      "Days 1–4 — Saint Joseph, son of David: daily reading + Litany of Saint Joseph",
      "Days 5–9 — Light of patriarchs and Spouse of the Mother of God",
      "Days 10–14 — Foster father of the Son of God: Joyful Mysteries decade",
      "Days 15–19 — Diligent protector of Christ and Pillar of families",
      "Days 20–24 — Mirror of patience and Lover of poverty",
      "Days 25–29 — Model of workers and Patron of the dying",
      "Days 30–32 — Terror of demons and Protector of the Holy Church",
      "Day 33 — Vigil: confession and read the act of consecration aloud",
      "Day 34 — Attend Mass and make the act of consecration",
    ],
  },
  {
    slug: "consecration-sacred-heart",
    title: "Consecration to the Sacred Heart (9-day novena)",
    description:
      "A nine-day preparation culminating in personal consecration to the Sacred Heart of Jesus. Each day meditates on one title from the Litany of the Sacred Heart and pairs it with a short Scripture reading, a decade of the Rosary, or a Holy Hour. The act of consecration is made on the Solemnity of the Sacred Heart, on a First Friday, or on another Friday of your choosing.",
    defaultDurationDays: 9,
    category: "consecration",
    checklist: [
      "Day 1 — Heart of Jesus, sanctuary of mercy (John 19:31–37 + Litany)",
      "Day 2 — Heart of Jesus, formed in the womb of the Virgin Mother",
      "Day 3 — Heart of Jesus, of infinite majesty (Te Deum / Adoro Te)",
      "Day 4 — Heart of Jesus, burning furnace of charity (Anima Christi)",
      "Day 5 — Heart of Jesus, fount of life and holiness",
      "Day 6 — Heart of Jesus, our peace and reconciliation (confession)",
      "Day 7 — Heart of Jesus, victim for our sins (Stations of the Cross)",
      "Day 8 — Holy Hour and confession before the act",
      "Day 9 — Attend Mass and pray the act of consecration aloud",
    ],
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
    description: "Enter the covenant of Christian marriage in the Catholic Church.",
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

  {
    slug: "consecration-holy-family",
    title: "Consecration to the Holy Family (9-day novena)",
    description:
      "A nine-day preparation that walks the household through the seven mysteries of the Holy Family of Nazareth, culminating in a family act of consecration ideally on the feast of the Holy Family (the Sunday within the Octave of Christmas). The pattern follows Pope Leo XIII's act of consecration and the long French tradition of consecrating Christian homes to Jesus, Mary, and Joseph.",
    defaultDurationDays: 9,
    category: "consecration",
    checklist: [
      "Day 1 — Annunciation (Luke 1:26–38): Mary's fiat + the Angelus + one decade",
      "Day 2 — Visitation (Luke 1:39–56): pray the Magnificat with your family",
      "Day 3 — Nativity (Luke 2:1–20): three Glory Bes in thanksgiving for family life",
      "Day 4 — Presentation in the Temple (Luke 2:22–38): offer your family + Nunc Dimittis",
      "Day 5 — Flight into Egypt (Matthew 2:13–23): pray for displaced families",
      "Day 6 — Hidden life at Nazareth (Luke 2:39–40, 51–52): pray for daily work",
      "Day 7 — Finding in the Temple (Luke 2:41–52): pray for any family member away from the faith",
      "Day 8 — Pray the Litany of the Holy Family; confession if needed",
      "Day 9 — Gather the household and pray Pope Leo XIII's act of consecration aloud together",
    ],
  },
];

export function getGoalTemplate(slug: string): GoalTemplate | null {
  return GOAL_TEMPLATES.find((g) => g.slug === slug) ?? null;
}
