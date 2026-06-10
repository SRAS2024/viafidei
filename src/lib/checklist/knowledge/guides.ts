import type { CuratedEntry } from "./index";

const USCCB = "https://www.usccb.org/";
const VATICAN = "https://www.vatican.va/";

/**
 * The prayers each kind of guide uses, in the order they are prayed (first to
 * last). The guide page renders these at the bottom as dropdown toggles with a
 * universal Latin/Greek language switch, so a user has every prayer of the
 * guide readily available even if they don't know it by heart.
 */
const RELATED_PRAYERS_BY_KIND: Record<string, string[]> = {
  rosary: [
    "apostles-creed",
    "our-father",
    "hail-mary",
    "glory-be",
    "salve-regina",
    "prayer-to-saint-michael",
  ],
  chaplet: ["our-father", "hail-mary", "apostles-creed"],
  confession: ["confiteor", "act-of-contrition"],
  adoration: ["anima-christi", "our-father", "glory-be"],
  consecration: ["memorare", "hail-mary", "glory-be"],
  discernment: ["veni-creator-spiritus", "our-father"],
  vocation: ["veni-creator-spiritus", "our-father"],
};

function guide(
  slug: string,
  title: string,
  kind:
    | "rosary"
    | "chaplet"
    | "confession"
    | "adoration"
    | "consecration"
    | "discernment"
    | "vocation"
    | "lent_preparation"
    | "advent_preparation"
    | "rcia"
    | "ocia"
    | "general",
  summary: string,
  steps: Array<{ order: number; title: string; body: string }>,
  sacramentKey?:
    | "baptism"
    | "confirmation"
    | "eucharist"
    | "reconciliation"
    | "anointing_of_the_sick"
    | "holy_orders"
    | "matrimony",
): CuratedEntry {
  return {
    contentType: "GUIDE",
    slug,
    authorityLevel: "USCCB",
    citations: [USCCB, VATICAN],
    payload: {
      slug,
      title,
      summary,
      kind,
      ...(sacramentKey ? { sacramentKey } : {}),
      steps,
      relatedPrayers: RELATED_PRAYERS_BY_KIND[kind] ?? [],
      citations: [USCCB, VATICAN],
    },
  };
}

export const guideKnowledge: CuratedEntry[] = [
  guide(
    "how-to-pray-the-rosary",
    "How to Pray the Holy Rosary",
    "rosary",
    "A step-by-step guide to praying the Rosary, the great Marian psalter of the Latin Church.",
    [
      {
        order: 1,
        title: "Begin with the Sign of the Cross and the Apostles' Creed",
        body: "Make the Sign of the Cross. Hold the crucifix and pray the Apostles' Creed.",
      },
      {
        order: 2,
        title: "Opening prayers on the first beads",
        body: "On the first bead pray the Our Father. On the next three pray a Hail Mary on each (for an increase of faith, hope, and charity). Pray the Glory Be.",
      },
      {
        order: 3,
        title: "Announce the first mystery",
        body: "Announce the first mystery (Joyful, Sorrowful, Glorious, or Luminous, depending on the day) and pray an Our Father on the large bead.",
      },
      {
        order: 4,
        title: "Pray a decade",
        body: "On each of the ten small beads pray one Hail Mary while meditating on the mystery. End with a Glory Be and (optionally) the Fatima Prayer: 'O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of Thy mercy.'",
      },
      {
        order: 5,
        title: "Repeat for the remaining four mysteries",
        body: "Continue for the four remaining mysteries of the set, announcing each, praying an Our Father, ten Hail Marys, and a Glory Be.",
      },
      {
        order: 6,
        title: "Conclude with the Hail Holy Queen",
        body: "Pray the Hail Holy Queen (Salve Regina), the closing prayer of the Rosary. Make the Sign of the Cross.",
      },
    ],
  ),
  guide(
    "how-to-pray-the-divine-mercy-chaplet",
    "How to Pray the Divine Mercy Chaplet",
    "chaplet",
    "A step-by-step guide to praying the Chaplet of Divine Mercy, prayed on ordinary Rosary beads.",
    [
      {
        order: 1,
        title: "Begin with the Sign of the Cross",
        body: "Make the Sign of the Cross. The Chaplet of Divine Mercy is prayed on ordinary Rosary beads.",
      },
      {
        order: 2,
        title: "Optional opening prayers",
        body: "You may pray the optional opening: 'You expired, Jesus, but the source of life gushed forth for souls, and the ocean of mercy opened up for the whole world.' Then three times: 'O Blood and Water, which gushed forth from the Heart of Jesus as a fount of Mercy for us, I trust in You!'",
      },
      {
        order: 3,
        title: "Our Father, Hail Mary, and the Apostles' Creed",
        body: "On the opening beads, pray one Our Father, one Hail Mary, and the Apostles' Creed.",
      },
      {
        order: 4,
        title: "The Eternal Father prayer on the large bead",
        body: "On the large bead before each decade, pray: 'Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.'",
      },
      {
        order: 5,
        title: "Pray the decade and repeat for all five",
        body: "On each of the ten small beads, pray: 'For the sake of His sorrowful Passion, have mercy on us and on the whole world.' Then repeat the Eternal Father prayer and the ten petitions for all five decades.",
      },
      {
        order: 6,
        title: "Conclude with the Holy God (three times)",
        body: "After the five decades, pray three times: 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.'",
      },
      {
        order: 7,
        title: "Optional closing prayer",
        body: "You may conclude with the closing prayer to the merciful God, then make the Sign of the Cross.",
      },
    ],
  ),
  guide(
    "how-to-go-to-confession",
    "How to Go to Confession",
    "confession",
    "A simple step-by-step guide to the Sacrament of Reconciliation.",
    [
      {
        order: 1,
        title: "Examine your conscience",
        body: "Before going, review your life in the light of God's love. The Ten Commandments, the Beatitudes, and the Precepts of the Church are the traditional framework.",
      },
      {
        order: 2,
        title: "Be sorry for your sins",
        body: "Contrition (sorrow for sin) is the most important part. Perfect contrition (sorrow for love of God) brings the soul to friendship with God even before sacramental absolution.",
      },
      {
        order: 3,
        title: "Resolve not to sin again",
        body: "Form a firm purpose of amendment — the resolve, with God's grace, to avoid sin and the occasions of sin.",
      },
      {
        order: 4,
        title: "Confess your sins to the priest",
        body: "Begin: 'Bless me, Father, for I have sinned. It has been [time] since my last confession. These are my sins...' Confess all mortal sins by kind and number to the best of your memory. Venial sins may also be confessed (and are highly recommended).",
      },
      {
        order: 5,
        title: "Pray the Act of Contrition",
        body: "When the priest invites you, pray an Act of Contrition. The priest will give you a penance and grant sacramental absolution.",
      },
      {
        order: 6,
        title: "Complete your penance",
        body: "Complete the penance the priest assigned as soon as possible after confession. Thank God for the gift of his mercy.",
      },
    ],
    "reconciliation",
  ),
  guide(
    "examination-of-conscience",
    "Examination of Conscience",
    "confession",
    "A traditional examination of conscience structured on the Ten Commandments.",
    [
      {
        order: 1,
        title: "I am the Lord your God; you shall not have strange gods before me.",
        body: "Have I made anything (work, money, possessions, a person, an addiction) more important to me than God? Have I omitted daily prayer? Have I dabbled in occult practices, fortune telling, the New Age?",
      },
      {
        order: 2,
        title: "You shall not take the name of the Lord your God in vain.",
        body: "Have I used the names of God, Jesus, Mary, or the saints irreverently? Have I blasphemed, cursed, or sworn falsely?",
      },
      {
        order: 3,
        title: "Remember to keep holy the Lord's day.",
        body: "Have I missed Sunday Mass or a Holy Day of Obligation through my own fault? Have I done unnecessary servile work on the Lord's day?",
      },
      {
        order: 4,
        title: "Honor your father and your mother.",
        body: "Have I honored my parents (or, as a parent, raised my children in the faith)? Have I respected legitimate civil authority?",
      },
      {
        order: 5,
        title: "You shall not kill.",
        body: "Have I harmed another person in body, soul, or reputation? Have I been complicit in abortion, euthanasia, or other direct attacks on human life? Have I harbored anger, hatred, or grudges?",
      },
      {
        order: 6,
        title: "You shall not commit adultery.",
        body: "Have I been chaste in thought, word, and deed appropriate to my state in life? Have I committed adultery, fornication, masturbation, pornography use, or contraceptive acts?",
      },
      {
        order: 7,
        title: "You shall not steal.",
        body: "Have I stolen, cheated, or defrauded another? Have I been just in my work and business dealings? Have I given alms in proportion to my means?",
      },
      {
        order: 8,
        title: "You shall not bear false witness against your neighbor.",
        body: "Have I lied, gossiped, slandered, or detracted? Have I damaged another's reputation? Have I kept secrets I was bound to keep?",
      },
      {
        order: 9,
        title: "You shall not covet your neighbor's wife.",
        body: "Have I entertained impure thoughts about another? Have I deliberately fed desires contrary to chastity?",
      },
      {
        order: 10,
        title: "You shall not covet your neighbor's goods.",
        body: "Have I been envious, greedy, or grasping? Have I trusted in possessions rather than in God's providence?",
      },
    ],
    "reconciliation",
  ),
];
