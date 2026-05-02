import type { SpiritualLifeKind } from "@prisma/client";

export type SpiritualLifeGuideSeed = {
  slug: string;
  kind: SpiritualLifeKind;
  title: string;
  summary: string;
  bodyText?: string;
  steps?: object;
  durationDays?: number;
  goalTemplateSlug?: string;
};

export const SPIRITUAL_LIFE_GUIDES: SpiritualLifeGuideSeed[] = [
  {
    slug: "how-to-pray-the-rosary",
    kind: "ROSARY",
    title: "How to Pray the Rosary",
    summary:
      "A complete step-by-step guide to praying the Holy Rosary, including all four sets of mysteries.",
    bodyText: `The Rosary is one of the most beloved prayers in the Catholic tradition. Pope John Paul II called it "a compendium of the Gospel." Each decade meditates on a mystery from the life of Christ and Mary.`,
    steps: [
      {
        order: 1,
        title: "Hold the crucifix",
        body: "Make the Sign of the Cross and pray the Apostles' Creed.",
      },
      { order: 2, title: "First large bead", body: "Pray one Our Father." },
      {
        order: 3,
        title: "Three small beads",
        body: "Pray three Hail Marys for faith, hope, and charity.",
      },
      {
        order: 4,
        title: "Glory Be",
        body: "Pray the Glory Be, then announce the first mystery and meditate briefly.",
      },
      {
        order: 5,
        title: "Each decade",
        body: "Pray one Our Father on the large bead, ten Hail Marys on the small beads, and one Glory Be. Add the Fatima prayer: O my Jesus, forgive us our sins…",
      },
      {
        order: 6,
        title: "Repeat",
        body: "Continue for all five decades of the chosen set of mysteries.",
      },
      {
        order: 7,
        title: "Conclude",
        body: "After the fifth decade pray the Hail Holy Queen (Salve Regina) and the closing prayer.",
      },
    ],
    durationDays: 30,
    goalTemplateSlug: "pray-rosary-daily",
  },
  {
    slug: "guide-to-confession",
    kind: "CONFESSION",
    title: "A Guide to the Sacrament of Confession",
    summary:
      "How to prepare for and make a good Confession — from examination of conscience to receiving absolution.",
    bodyText: `The Sacrament of Penance and Reconciliation is the ordinary means by which mortal sins committed after Baptism are forgiven. Regular confession of venial sins is also a pious practice that strengthens the soul.`,
    steps: [
      {
        order: 1,
        title: "Examination of conscience",
        body: "Using the Ten Commandments or a printed guide, review your thoughts, words, and actions since your last confession. Be honest and thorough.",
      },
      {
        order: 2,
        title: "Contrition",
        body: "Arouse genuine sorrow for having offended God — not merely fear of punishment. Firm purpose of amendment: intend not to sin again.",
      },
      {
        order: 3,
        title: "Enter the confessional",
        body: "Greet the priest. Make the Sign of the Cross: Bless me, Father, for I have sinned. It has been [time] since my last confession.",
      },
      {
        order: 4,
        title: "Confess your sins",
        body: "Tell your sins clearly, including kind and number for mortal sins. Avoid unnecessary detail; stick to what is needed for absolution.",
      },
      {
        order: 5,
        title: "Listen to the priest",
        body: "He may offer counsel and will give you a penance (prayers or acts of charity to perform).",
      },
      {
        order: 6,
        title: "Act of contrition",
        body: "Pray an Act of Contrition aloud: O my God, I am heartily sorry for having offended Thee…",
      },
      {
        order: 7,
        title: "Absolution",
        body: "The priest pronounces the words of absolution. Your sins are forgiven. Leave in peace.",
      },
      {
        order: 8,
        title: "Perform your penance",
        body: "Complete the penance given as soon as possible.",
      },
    ],
    durationDays: 1,
    goalTemplateSlug: "monthly-confession",
  },
  {
    slug: "eucharistic-adoration-guide",
    kind: "ADORATION",
    title: "A Guide to Eucharistic Adoration",
    summary:
      "How to spend time fruitfully in the presence of the Blessed Sacrament, whether for a holy hour or a brief visit.",
    bodyText: `Eucharistic Adoration is the practice of spending time in prayer before the Blessed Sacrament, whether reserved in the tabernacle or exposed in a monstrance. It is one of the most direct forms of union with Christ available outside of Mass itself.`,
    steps: [
      {
        order: 1,
        title: "Arrive and genuflect",
        body: "Upon entering the chapel, genuflect on your right knee to acknowledge the Real Presence of Christ.",
      },
      {
        order: 2,
        title: "Begin with praise",
        body: "Open with the Anima Christi or a short act of adoration: I adore you, Lord Jesus Christ, truly present in the Blessed Sacrament.",
      },
      {
        order: 3,
        title: "Silence and listening",
        body: "Spend time simply being present. Do not feel the need to fill the silence with words. Let Christ speak to your heart.",
      },
      {
        order: 4,
        title: "Scripture",
        body: "Read a passage of the Gospel slowly, pausing to let the words settle. The Bread of Life discourse (John 6) is especially fitting.",
      },
      {
        order: 5,
        title: "Intercession",
        body: "Bring your intentions, those of others, and the needs of the Church before the Lord.",
      },
      {
        order: 6,
        title: "Thanksgiving",
        body: "Thank God for specific gifts — his presence, the gift of faith, particular graces received.",
      },
      {
        order: 7,
        title: "Closing prayer",
        body: "End with the Divine Praises (if Benediction is given) or with a personal act of love.",
      },
    ],
    durationDays: 7,
    goalTemplateSlug: "weekly-adoration",
  },
  {
    slug: "marian-consecration-33-days",
    kind: "CONSECRATION",
    title: "33-Day Preparation for Marian Consecration",
    summary:
      "A 33-day preparation for total consecration to Jesus through Mary, following the method of Saint Louis de Montfort.",
    bodyText: `Marian consecration is an act by which a baptised Christian entrusts themselves entirely to Mary, so that she may lead them more perfectly to Christ. The most celebrated method is that of Saint Louis-Marie Grignion de Montfort, systematised in his work True Devotion to the Blessed Virgin.`,
    steps: [
      {
        order: 1,
        title: "Days 1–12: Renouncing the world",
        body: "Examine and renounce attachment to the world, sin, and self. Pray: Come, Holy Spirit. Litany of the Holy Spirit. Ave Maris Stella.",
      },
      {
        order: 2,
        title: "Days 13–19: Knowledge of self",
        body: "Deepen awareness of personal weakness and dependence on grace. Pray: Litany of the Holy Spirit. Ave Maris Stella. Psalm 50.",
      },
      {
        order: 3,
        title: "Days 20–26: Knowledge of Mary",
        body: "Study Mary's role in salvation history and her virtues. Pray: Litany of Loreto. Ave Maris Stella. Little Crown of the Blessed Virgin.",
      },
      {
        order: 4,
        title: "Days 27–33: Knowledge of Jesus",
        body: "Meditate on the Incarnation, life, and Passion of Christ. Pray: Litany of Loreto. Ave Maris Stella. O Jesus Living in Mary.",
      },
      {
        order: 5,
        title: "Day 33: Act of Consecration",
        body: "On the chosen feast day, recite the Act of Consecration: I, N., a faithless sinner, renew and ratify today in your hands, O Immaculate Mother…",
      },
    ],
    durationDays: 33,
    goalTemplateSlug: "marian-consecration",
  },
  {
    slug: "discerning-your-vocation",
    kind: "VOCATION",
    title: "Discerning Your Vocation",
    summary:
      "A prayerful guide to discovering God's particular call — to marriage, consecrated life, priesthood, or dedicated single life.",
    bodyText: `Every baptised Christian has a universal vocation to holiness (Lumen Gentium, 40). Within that, God calls each person to a particular state of life. Discernment is the prayerful process of listening for that call.`,
    steps: [
      {
        order: 1,
        title: "Establish a prayer life",
        body: "Daily Mass, Rosary, and examination of conscience create the interior quiet in which God's voice can be heard.",
      },
      {
        order: 2,
        title: "Know yourself",
        body: "What gifts, desires, and natural inclinations has God given you? Vocation often builds on these, not against them.",
      },
      {
        order: 3,
        title: "Learn the vocations",
        body: "Read about married life, priesthood, religious life, and the dedicated single life. Speak with those living each vocation.",
      },
      {
        order: 4,
        title: "Seek a spiritual director",
        body: "A wise priest or religious can help you interpret what you hear in prayer and weigh consolations and desolations.",
      },
      {
        order: 5,
        title: "Pray the 'vocation prayer'",
        body: "Lord, I want what you want. Show me the path. Give me the courage to take the first step.",
      },
      {
        order: 6,
        title: "Act and observe",
        body: "Visit a seminary, make a vocations retreat, or serve in a parish ministry. Act on the promptings you receive and note the fruit.",
      },
      {
        order: 7,
        title: "Trust and decide",
        body: "God does not torment souls he calls. At the right time, with peace and counsel, make your choice and trust in his providence.",
      },
    ],
    durationDays: 90,
    goalTemplateSlug: "vocation-discernment",
  },
  {
    slug: "general-examination-of-conscience",
    kind: "GENERAL",
    title: "General Examination of Conscience",
    summary:
      "A daily practice of reviewing the day with God — a key tool for spiritual growth and preparation for confession.",
    bodyText: `The daily examination of conscience (examen) was promoted by Saint Ignatius of Loyola. It takes five to ten minutes and is traditionally made at the end of the day.`,
    steps: [
      {
        order: 1,
        title: "Give thanks",
        body: "Recall the gifts of the day — people, moments, graces — and thank God for them.",
      },
      {
        order: 2,
        title: "Ask for light",
        body: "Ask the Holy Spirit to show you the movements of the day clearly.",
      },
      {
        order: 3,
        title: "Review the day",
        body: "Walk back through the hours: your thoughts, words, and actions. Where did you respond to grace? Where did you resist it?",
      },
      {
        order: 4,
        title: "Express sorrow",
        body: "For any sins or failures, express genuine contrition: O my God, I am sorry.",
      },
      {
        order: 5,
        title: "Look to tomorrow",
        body: "Ask for grace for the coming day, particularly in areas where you struggled today.",
      },
    ],
    durationDays: 30,
    goalTemplateSlug: "daily-examen",
  },
];
